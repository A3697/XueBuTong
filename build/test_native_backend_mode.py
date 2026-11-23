"""Native-mode storage and original frontend identity checks without account access."""
import hashlib
import asyncio
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src/backend-host'))
import run_integrated_backend as host
from native_transport import NativeTokenTransport
from websocket_lifecycle import WebSocketLifecycle


class NativeBackendMode(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='native-backend-', dir=Path.cwd())
        self.root = Path(self.temp.name)
        self.web = self.root / 'assets/star-native'
        self.web.mkdir(parents=True)
        self.content = b'<html>original fixture</html>'
        (self.web / 'index.html').write_bytes(self.content)
        self.manifest = {'version': host.EXPECTED_STAR_VERSION, 'source_exe_sha256': host.EXPECTED_EXE_SHA256,
                         'files': [{'path': 'index.html', 'source_member': 'web/dist/index.html',
                                    'size': len(self.content), 'sha256': hashlib.sha256(self.content).hexdigest()}]}
        self.write_manifest()

    def tearDown(self):
        self.temp.cleanup()

    def write_manifest(self):
        (self.web / '_source-manifest.json').write_text(json.dumps(self.manifest), encoding='utf-8')

    def test_native_and_fusion_data_never_overlap(self):
        instance = self.root / 'instances' / 'QA_case'
        self.assertEqual(host.account_data_dir(instance), instance / 'data')
        self.assertEqual(host.account_data_dir(instance, native=True), instance / 'data-native')
        self.assertNotEqual(host.account_data_dir(instance), host.account_data_dir(instance, native=True))

    def test_existing_state_contract_is_preserved_and_native_is_explicit(self):
        for native, expected in ((False, 'integration'), (True, 'native')):
            state = host.StateFile(self.root / 'state.json', uid='QA_case', session='one',
                                   base_dir=host.account_data_dir(self.root, native=native),
                                   token_file=self.root / 'token.dpapi', port=0, native=native)
            self.assertEqual(state.payload['mode'], expected)
            self.assertFalse(state.payload['host_automatic_restore'])
            self.assertFalse(state.payload['host_automatic_start_run'])

    def test_original_frontend_bytes_and_origin_are_required(self):
        with patch.object(host, 'ROOT', self.root):
            self.assertEqual(host.verify_native_web(), self.web)
            (self.web / 'index.html').write_bytes(self.content.replace(b'original', b'modified'))
            with self.assertRaisesRegex(ValueError, 'integrity'):
                host.verify_native_web()

    def test_stopping_and_terminal_states_cannot_revive_during_startup(self):
        state = host.StateFile(self.root / 'terminal.json', uid='QA_case', session='one',
                               base_dir=self.root, token_file=self.root / 'token', port=0)
        state.write('stopping')
        for stage in ('loading_backend', 'starting_server', 'listening'):
            state.write(stage)
            self.assertEqual(state.payload['state'], 'stopping')
        state.write('failed', error='fixture')
        state.write('stopping')
        state.write('stopped')
        self.assertEqual(state.payload['state'], 'failed')

    def test_other_upstream_version_is_not_silently_accepted(self):
        self.manifest['version'] = '1.2.0'
        self.write_manifest()
        with patch.object(host, 'ROOT', self.root), self.assertRaisesRegex(ValueError, 'identity'):
            host.verify_native_web()

    def test_duplicate_and_traversal_members_are_rejected(self):
        self.manifest['files'] *= 2
        self.write_manifest()
        with patch.object(host, 'ROOT', self.root), self.assertRaisesRegex(ValueError, 'member'):
            host.verify_native_web()
        self.manifest['files'] = [{'path': '../outside', 'source_member': 'web/dist/../outside'}]
        self.write_manifest()
        with patch.object(host, 'ROOT', self.root), self.assertRaisesRegex(ValueError, 'manifest path'):
            host.verify_native_web()

    def test_transport_preserves_rejections_and_other_routes(self):
        observed = []
        async def app(scope, receive, send):
            observed.append(scope)
        wrapped = NativeTokenTransport(app, 'local-secret')
        cases = [
            {'type': 'websocket', 'path': '/ws', 'headers': [], 'query_string': b''},
            {'type': 'websocket', 'path': '/ws', 'headers': [(b'x-token', b'wrong')], 'query_string': b''},
            {'type': 'websocket', 'path': '/ws', 'headers': [(b'x-token', b'local-secret')], 'query_string': b't=wrong'},
            {'type': 'websocket', 'path': '/other', 'headers': [(b'x-token', b'local-secret')], 'query_string': b''},
            {'type': 'http', 'path': '/ws', 'headers': [(b'x-token', b'local-secret')], 'query_string': b''},
        ]
        for scope in cases:
            asyncio.run(wrapped(scope, None, None))
            self.assertIs(observed[-1], scope)
        scope = {'type': 'websocket', 'path': '/ws', 'headers': [(b'X-Token', b'local-secret')], 'query_string': b'other=1'}
        asyncio.run(wrapped(scope, None, None))
        self.assertEqual(observed[-1]['query_string'], b'other=1&t=local-secret')
        self.assertEqual(scope['query_string'], b'other=1')

    def test_disconnected_native_stream_cleans_up_without_shutdown_timeout(self):
        async def check():
            events = asyncio.Queue()
            events.put_nowait({'type': 'websocket.connect'})
            accepted, cleaned = asyncio.Event(), asyncio.Event()
            async def app(scope, receive, send):
                self.assertEqual(await receive(), {'type': 'websocket.connect'})
                try:
                    accepted.set()
                    await asyncio.Event().wait()  # Upstream waits on its event hub.
                finally:
                    cleaned.set()
            for wrapper in (NativeTokenTransport(app, 'local-secret'), WebSocketLifecycle(app)):
                accepted.clear()
                cleaned.clear()
                if events.empty():
                    events.put_nowait({'type': 'websocket.connect'})
                task = asyncio.create_task(wrapper({'type': 'websocket', 'path': '/ws'}, events.get, None))
                await accepted.wait()
                events.put_nowait({'type': 'websocket.disconnect', 'code': 1000})
                await asyncio.wait_for(task, timeout=.5)
                self.assertTrue(cleaned.is_set())
        asyncio.run(check())

    def test_native_application_failures_are_not_swallowed(self):
        async def check():
            async def app(scope, receive, send):
                raise RuntimeError('native fixture failure')
            wrapped = NativeTokenTransport(app, 'local-secret')
            with self.assertRaisesRegex(RuntimeError, 'native fixture failure'):
                await wrapped({'type': 'websocket', 'path': '/ws'}, asyncio.Queue().get, None)
        asyncio.run(check())


if __name__ == '__main__':
    unittest.main(verbosity=2)
