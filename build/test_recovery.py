"""Recovery gating and runtime integrity checks without platform requests."""
from pathlib import Path
import importlib.util
import json
import hashlib
import sys
import tempfile
import types
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'src'


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class Recovery(unittest.TestCase):
    def setUp(self):
        self.previous = {key: sys.modules.get(key) for key in ('core', 'core.antispider')}
        anti = types.ModuleType('core.antispider')
        anti.AutoUnlockReport = lambda **kw: types.SimpleNamespace(**kw)
        anti.AntispiderChallenge = type('AntispiderChallenge', (), {})
        self.ok = False
        self.preflights = 0
        def preflight():
            self.preflights += 1
            if getattr(self, 'unavailable', False):
                raise ImportError('fixture')
        anti._ddddocr_instance = preflight
        anti.auto_unlock = lambda *args, **kwargs: anti.AutoUnlockReport(ok=self.ok)
        core = types.ModuleType('core')
        core.antispider = anti
        sys.modules.update({'core': core, 'core.antispider': anti})
        self.anti = anti
        self.state = module('recovery', SOURCE / 'fusion/antispider_recovery.py').install()
        self.events = []
        self.state['emit'] = self.events.append
        self.run = {'running': True, 'paused': False}
        def pause():
            self.run['paused'] = True
        self.retry_result = (None, anti.AntispiderChallenge())
        def retry(*args, **kwargs):
            if getattr(self, 'cancel_during_retry', False):
                self.engine._fusion_cancel_recovery()
            if isinstance(self.retry_result, Exception):
                raise self.retry_result
            return self.retry_result
        self.service = types.SimpleNamespace(with_retry=retry, auto_enabled=True)
        self.engine = types.SimpleNamespace(snapshot=lambda: {'run': dict(self.run)}, _pause_queue_for_block=pause, unlock=self.service)
        self.state['bind'](self.engine)

    def tearDown(self):
        for key, value in self.previous.items():
            if value is None:
                sys.modules.pop(key, None)
            else:
                sys.modules[key] = value

    def test_waits_for_all_upstream_rounds_and_remembers_running_state(self):
        for _ in range(3):
            self.anti.auto_unlock()
            self.assertEqual(self.events, [])
        self.engine._pause_queue_for_block()
        self.assertTrue(self.events[0]['payload']['resume'])
        self.assertTrue(self.run['paused'])
        self.engine._pause_queue_for_block()
        self.assertEqual(len(self.events), 1)
        self.assertEqual(self.preflights, 1)

    def test_success_after_failed_round_does_not_relogin(self):
        self.anti.auto_unlock()
        self.ok = True
        self.anti.auto_unlock()
        self.engine._pause_queue_for_block()
        self.assertEqual(self.events, [])

    def test_missing_ocr_is_cached_and_idle_task_is_not_resumed(self):
        self.unavailable = True
        self.run['running'] = False
        for _ in range(3):
            self.assertFalse(self.anti.auto_unlock().ok)
        self.engine._pause_queue_for_block()
        self.assertEqual(self.preflights, 1)
        self.assertFalse(self.events[0]['payload']['resume'])
        self.assertFalse(self.events[0]['payload']['ocr_available'])

    def test_submission_accepted_requires_resource_probe(self):
        self.ok = True
        report = self.anti.auto_unlock(probe=lambda: False)
        self.assertFalse(report.ok)
        self.assertFalse(report.confirmed_by_probe)
        self.engine._pause_queue_for_block()
        self.assertEqual(len(self.events), 1)
        self.assertEqual(self.events[0]['payload']['reason'], 'resource_still_blocked')

    def test_resource_confirmed_does_not_trigger_recovery(self):
        self.ok = True
        calls = []
        report = self.anti.auto_unlock(probe=lambda: (calls.append(True), True)[1])
        self.assertTrue(report.ok and report.confirmed_by_probe)
        self.assertEqual(calls, [True])
        self.engine._pause_queue_for_block()
        self.assertFalse(self.events)

    def test_chapter_discovery_exhaustion_recovers_without_pause_hook(self):
        result = self.service.with_retry(lambda: None)
        self.assertIs(result, self.retry_result)
        self.assertEqual(len(self.events), 1)
        self.assertTrue(self.events[0]['payload']['resume'])

    def test_auto_disabled_and_plain_network_error_do_not_trigger_login(self):
        self.service.with_retry(lambda: None, auto=False)
        self.assertFalse(self.events)
        self.retry_result = TimeoutError('fixture')
        with self.assertRaises(TimeoutError):
            self.service.with_retry(lambda: None)
        self.engine._pause_queue_for_block()
        self.assertFalse(self.events)

    def test_cancel_during_inflight_verification_blocks_late_recovery(self):
        self.anti.auto_unlock()
        self.cancel_during_retry = True
        self.service.with_retry(lambda: None)
        self.engine._pause_queue_for_block()
        self.assertFalse(self.events)

    def test_unrelated_task_block_is_not_an_ocr_failure(self):
        self.engine._pause_queue_for_block()
        self.assertFalse(self.events)


class Integrity(unittest.TestCase):
    def test_parallel_verification_rejects_same_size_tampering_and_escape(self):
        host = module('host', SOURCE / 'backend-host/run_integrated_backend.py')
        with tempfile.TemporaryDirectory(prefix='xbt-integrity-', dir=SOURCE.parent / 'build') as directory:
            host.ROOT = Path(directory)
            host.RUNTIME = host.ROOT / 'star-runtime'
            host.RUNTIME.mkdir()
            file = host.RUNTIME / 'file'
            file.write_bytes(b'original')
            manifest = {'source_exe_sha256': host.EXPECTED_EXE_SHA256, 'files': [{'path': 'file', 'size': 8, 'sha256': hashlib.sha256(b'original').hexdigest()}]}
            target = host.RUNTIME / host.MANIFEST_NAME
            target.write_text(json.dumps(manifest))
            host.verify_runtime()
            file.write_bytes(b'changed!')
            with self.assertRaisesRegex(ValueError, 'integrity mismatch'):
                host.verify_runtime()
            manifest['files'][0]['path'] = '../outside'
            target.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, 'unsafe manifest path'):
                host.verify_runtime()


if __name__ == '__main__':
    unittest.main()
