"""Exercise the local update adapter against the actual bundled version service."""
from pathlib import Path
import dataclasses
import os
import socket
import sys
import tempfile
import threading
import unittest

SOURCE = Path(__file__).resolve().parents[1]
RUNTIME = Path(os.environ['XBT_RUNTIME_ROOT']) / 'star-runtime'
RECORD = Path(tempfile.mkdtemp(prefix='upstream-updates-', dir=os.environ['XBT_QA_ROOT']))
os.chdir(RECORD)
sys.path[:0] = [str(SOURCE / 'src/fusion'), str(RUNTIME)]
HANDLES = [os.add_dll_directory(str(path)) for path in
           {RUNTIME, *(p.parent for p in RUNTIME.rglob('*.pyd'))}]


def blocked(*args, **kwargs):
    raise AssertionError('upstream update adapter must not use network')


socket.socket.connect = blocked
socket.socket.connect_ex = blocked
socket.create_connection = blocked
import core.paths
core.paths.user_data_dir = lambda: RECORD
import core.version as version
from upstream_updates import DISABLED_MESSAGE, LOCAL_SOURCE, install_disabled_updates


class UpstreamUpdates(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result_class = version.CheckResult
        cls.checker_class = version.VersionChecker
        cls.installed = install_disabled_updates()

    def test_actual_component_contract_and_class_identity_remain(self):
        self.assertIs(version.CheckResult, self.result_class)
        self.assertIs(version.VersionChecker, self.checker_class)
        self.assertEqual(self.installed['component_version'], version.VERSION)
        result = dataclasses.asdict(version.VersionChecker().check(source='startup'))
        self.assertEqual(result['source'], LOCAL_SOURCE)
        self.assertEqual(result['local'], version.VERSION)
        for name in ('terminate', 'overdue', 'force', 'reminder', 'countdown'):
            if name in result:
                self.assertIs(result[name], False)

    def test_stale_version_file_does_not_end_account_session(self):
        state = RECORD / 'stale-version.json'
        state.write_text('{"terminated_at": 42, "startup_unverified": true}', encoding='utf-8')
        checker = version.VersionChecker(state_path=state, local_version=version.VERSION)
        self.assertFalse(checker.snapshot().terminate)
        self.assertEqual(checker.snapshot().summary(), DISABLED_MESSAGE)
        self.assertEqual(state.read_text(encoding='utf-8'), '{"terminated_at": 42, "startup_unverified": true}')

    def test_cloud_entry_is_local_and_periodic_worker_stops(self):
        info = version.fetch_cloud_info()
        self.assertEqual(info.version, version.VERSION)
        self.assertTrue(info.raw['updates_disabled'])
        with self.assertRaises(version.VersionNetworkError):
            version._read_source('https://example.invalid', session=None, timeout=1)
        stop = threading.Event()
        stop.set()
        emitted = []
        version.hourly_loop(version.VersionChecker(), stop, emitted.append)
        self.assertEqual(len(emitted), 1)
        self.assertFalse(emitted[0].terminate)

    def test_install_is_idempotent(self):
        self.assertEqual(install_disabled_updates(), self.installed)


if __name__ == '__main__':
    unittest.main(verbosity=2)
