"""Real shipped HTTP client, synthetic accounts, local HTTP fixture only.

Run with the bundled Python. XBT_RUNTIME_ROOT selects the installed runtime;
XBT_QA_ROOT selects an empty test-artifact parent. No real credentials are read.
"""
from pathlib import Path
import argparse
import hashlib
import html.parser
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import urllib.parse

SOURCE = Path(__file__).resolve().parents[1]
RUNTIME_ROOT = Path(os.environ['XBT_RUNTIME_ROOT']).resolve()
RECORD = Path(os.environ.get('XBT_QA_ROOT', SOURCE.parent)).resolve()


def child(args):
    runtime = RUNTIME_ROOT / 'star-runtime'
    data = Path(args.data).resolve()
    data.mkdir(parents=True, exist_ok=True)
    os.chdir(data)
    sys.dont_write_bytecode = True
    sys.path[:0] = [str(SOURCE / 'src/backend-host'), str(runtime)]
    handles = [os.add_dll_directory(str(p)) for p in {runtime, *(f.parent for f in runtime.rglob('*.pyd'))}]
    original_connect = socket.socket.connect

    def connect(sock, address):
        if not isinstance(address, tuple) or address[0] != '127.0.0.1':
            raise RuntimeError('Test only permits its local fixture server')
        return original_connect(sock, address)

    socket.socket.connect = connect
    socket.socket.connect_ex = lambda *_: (_ for _ in ()).throw(RuntimeError('network disabled'))
    import core.paths
    core.paths.user_data_dir = lambda: data
    from core.storage import KeyValueStore
    import core.storage
    store = KeyValueStore(data / 'storage/state.json')
    core.storage.get_store = lambda: store
    from network_policy import install_direct_network
    install_direct_network()
    from account_environment import prepare_account_environment, OWNER_KEY, COOKIES_KEY, LOGIN_KEY
    preferences = json.loads(args.preferences or '{}')
    state = prepare_account_environment(store, args.uid, preferences)
    assert state['uid'] == args.uid
    import core.ua as ua
    from core.auth import AuthClient
    from core.models import User
    client = AuthClient(store=store)
    device = ua.device_id(store)
    result = {'mode': args.mode, 'deviceHash': hashlib.sha256(device.encode()).hexdigest(),
              'uaDeviceBound': (client.session.headers['User-Agent'] == preferences['dalvikFull']
                                if preferences.get('dalvikFull') else client.session.headers['User-Agent'].endswith('_' + device)),
              'ownerBound': store.get(OWNER_KEY) == args.uid}
    assert result['uaDeviceBound'] and result['ownerBound']
    # Inspect the actual request sent by the shipped HTTP client, not just a
    # configuration object. Its WebView UA is exercised in a separate request.
    result['requestHeadersBound'] = (
        client.session.get(args.base + '/echo', timeout=5).json()['ua'] == ua.DALVIK_UA
        and client.session.get(args.base + '/echo', headers={'User-Agent': ua.WEBVIEW_UA}, timeout=5).json()['ua'] == ua.WEBVIEW_UA)
    assert result['requestHeadersBound']
    if preferences:
        p = state['preferences']
        if p['deviceId']:
            assert device == p['deviceId']
        for name, field in (('WEBVIEW', 'schildWebview'), ('DALVIK', 'schildDalvik')):
            header = getattr(ua, name + '_UA')
            complete = p['webviewFull' if name == 'WEBVIEW' else 'dalvikFull']
            if complete:
                assert header == complete
                continue
            assert '(device:' + p['model'] + ')' in header
            if p[field]:
                assert '(schild:' + p[field] + ')' in header
        assert p['webviewFull'] or ua.WEBVIEW_UA.startswith(p['webviewBase'] or ('Mozilla/5.0 (Linux; Android ' + p['androidVersion']))
        assert p['dalvikFull'] or ua.DALVIK_UA.startswith(p['dalvikBase'] or ('Dalvik/2.1.0 (Linux; U; Android ' + p['androidVersion']))
        result['customHeadersConfirmed'] = True
    if args.mode == 'seed':
        client.session.get(args.base + '/seed?label=' + args.label, timeout=5).raise_for_status()
        user = User(uid='fixture-' + args.label, name='Synthetic user', cookies=client._dump_cookies())
        client.save_session(user)
        result['cookieRows'] = len(store.get(COOKIES_KEY)['cookies'])
        assert result['cookieRows'] == 4
    elif args.mode in ('restore', 'expire'):
        user = client.restore()
        assert user and user.uid == 'fixture-' + args.label
        result['root'] = client.session.get(args.base + '/echo', timeout=5).json()['cookie']
        result['scoped'] = client.session.get(args.base + '/scoped/echo', timeout=5).json()['cookie']
        assert 'task=' + args.label + '_ROOT' in result['root']
        assert args.label + '_SCOPED' not in result['root']
        assert 'task=' + args.label + '_SCOPED' in result['scoped']
        assert 'sec=' not in result['root'] and 'sec=' not in result['scoped']
        from requests import Request
        foreign = client.session.prepare_request(Request('GET', 'https://unrelated.example/'))
        assert 'Cookie' not in foreign.headers
        result['foreignDomainExcluded'] = True
        if args.mode == 'expire':
            client.session.get(args.base + '/expire', timeout=5).raise_for_status()
            rows = store.get(COOKIES_KEY)['cookies']
            assert not any(row['name'] == 'task' and row['path'] == '/scoped' for row in rows)
            result['expiryPersisted'] = True
    elif args.mode == 'changed-login':
        assert client.restore() is not None
        previous = device
        store.set(LOGIN_KEY, 'previous-account-fixture')

        def stop_before_network(*_args, **_kwargs):
            assert not list(client.session.cookies)
            raise RuntimeError('synthetic login intercepted before network')

        client.verify_detail = stop_before_network
        try:
            client.login('different-fixture-user', 'synthetic-password')
        except RuntimeError as error:
            assert str(error) == 'synthetic login intercepted before network'
        else:
            raise AssertionError('login was not intercepted')
        assert store.get('auth.session') is None and store.get(COOKIES_KEY) is None
        assert ua.device_id(store) == previous
        result['oldLoginCleared'] = True
    elif args.mode == 'copied-owner':
        assert store.get('auth.session') is None and store.get(COOKIES_KEY) is None
        assert client.restore() is None and not list(client.session.cookies)
        result['foreignSessionRejected'] = True
    elif args.mode == 'changed-preferences':
        assert store.get('auth.session') is None and store.get(COOKIES_KEY) is None
        assert client.restore() is None and not list(client.session.cookies)
        result['changedPreferencesRequireLogin'] = True
    elif args.mode == 'legacy':
        store.delete(COOKIES_KEY)
        assert client.load_user() is not None
        assert client.restore() is None and not list(client.session.cookies)
        result['legacyAwaitingLogin'] = True
    elif args.mode == 'logout':
        assert client.restore() is not None
        client.logout()
        assert not list(client.session.cookies)
        assert store.get('auth.session') is None and store.get(COOKIES_KEY) is None
        assert ua.device_id(store) == device
        result['logoutCleared'] = True
    result['passed'] = True
    (data / 'test-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf-8')
    print(json.dumps(result))


class Fixture(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        self.send_response(200)
        if url.path == '/seed':
            label = urllib.parse.parse_qs(url.query)['label'][0]
            for cookie in (f'task={label}_ROOT; Path=/; HttpOnly; SameSite=Lax',
                           f'task={label}_SCOPED; Path=/scoped; HttpOnly',
                           f'device={label}_DEVICE; Path=/; Max-Age=3600',
                           f'sec={label}_SECURE; Path=/; Secure; HttpOnly'):
                self.send_header('Set-Cookie', cookie)
        elif url.path == '/expire':
            self.send_header('Set-Cookie', 'task=gone; Path=/scoped; Max-Age=0')
        data = json.dumps({'cookie': self.headers.get('Cookie', ''), 'ua': self.headers.get('User-Agent', '')}).encode()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    RECORD.mkdir(parents=True, exist_ok=True)
    root = Path(tempfile.mkdtemp(prefix='account-environment-', dir=RECORD))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = 'http://127.0.0.1:' + str(server.server_port)
    rows = []

    def run(mode, name, uid, label, preferences=None):
        data = root / name
        result_path = data / 'test-result.json'
        if result_path.exists():
            result_path.unlink()
        process = subprocess.run([str(RUNTIME_ROOT / 'python3144/python.exe'), '-I', '-S', '-B', '-X', 'utf8',
                                  str(Path(__file__).resolve()), '--child', '--mode', mode, '--data', str(data),
                                  '--uid', uid, '--label', label, '--base', base,
                                  '--preferences', json.dumps(preferences or {})], capture_output=True, text=True,
                                 encoding='utf-8', timeout=35)
        if process.returncode or not result_path.is_file():
            raise RuntimeError(f'{mode}/{name} did not complete: {process.stdout}\n{process.stderr}')
        value = json.loads(result_path.read_text('utf-8'))
        assert value['passed']
        rows.append(value)
        print(json.dumps({'mode': mode, 'profile': name, 'passed': True}), flush=True)
        return value

    try:
        a = run('seed', 'a', 'a' * 32, 'ALPHA')
        b = run('seed', 'b', 'b' * 32, 'BETA')
        assert a['deviceHash'] != b['deviceHash']
        ar = run('restore', 'a', 'a' * 32, 'ALPHA')
        br = run('restore', 'b', 'b' * 32, 'BETA')
        assert a['deviceHash'] == ar['deviceHash'] and b['deviceHash'] == br['deviceHash']
        assert 'BETA' not in ar['scoped'] and 'ALPHA' not in br['scoped']
        for name in ('copied', 'legacy', 'changed', 'logout'):
            shutil.copytree(root / 'a', root / name)
        copied = run('copied-owner', 'copied', 'c' * 32, 'ALPHA')
        assert copied['deviceHash'] != a['deviceHash']
        run('legacy', 'legacy', 'a' * 32, 'ALPHA')
        run('changed-login', 'changed', 'a' * 32, 'ALPHA')
        run('logout', 'logout', 'a' * 32, 'ALPHA')
        run('expire', 'a', 'a' * 32, 'ALPHA')
        custom = dict(deviceId='1234567890abcdef' * 2, androidVersion='14', model='Pixel 7',
                      buildNumber='UP1A.231005.007', chromeVersion='126.0.0.0',
                      schildWebview='abcdef1234567890' * 2, schildDalvik='fedcba0987654321' * 2)
        run('seed', 'custom', 'd' * 32, 'CUSTOM', custom)
        run('restore', 'custom', 'd' * 32, 'CUSTOM', custom)
        changed = {**custom, 'webviewBase': 'FixtureWebView/1.0', 'dalvikBase': 'FixtureDalvik/1.0'}
        run('changed-preferences', 'custom', 'd' * 32, 'CUSTOM', changed)
        run('seed', 'custom', 'd' * 32, 'CUSTOM', changed)
        run('restore', 'custom', 'd' * 32, 'CUSTOM', changed)
        full_webview = {**changed, 'webviewFull': 'FixtureWebView/2.0 (schild:fixture) (@Kalimdor)_fixture'}
        run('changed-preferences', 'custom', 'd' * 32, 'CUSTOM', full_webview)
        run('seed', 'custom', 'd' * 32, 'CUSTOM', full_webview)
        run('restore', 'custom', 'd' * 32, 'CUSTOM', full_webview)
        full_both = {**full_webview, 'dalvikFull': 'FixtureDalvik/2.0 (device:fixture)'}
        run('changed-preferences', 'custom', 'd' * 32, 'CUSTOM', full_both)
        run('seed', 'custom', 'd' * 32, 'CUSTOM', full_both)
        run('restore', 'custom', 'd' * 32, 'CUSTOM', full_both)
        run('changed-preferences', 'custom', 'd' * 32, 'CUSTOM', changed)
        run('seed', 'custom', 'd' * 32, 'CUSTOM', changed)
        run('restore', 'custom', 'd' * 32, 'CUSTOM', changed)
        # An old saved config has neither full-UA field. Upgrading with the
        # empty defaults must retain its cookies and login rather than log out.
        state_file = root / 'custom/storage/state.json'
        legacy_state = json.loads(state_file.read_text('utf-8'))
        for field in ('webviewFull', 'dalvikFull'):
            legacy_state['integration.client_preferences'].pop(field)
        state_file.write_text(json.dumps(legacy_state), encoding='utf-8')
        run('restore', 'custom', 'd' * 32, 'CUSTOM', changed)
        run('changed-preferences', 'custom', 'd' * 32, 'CUSTOM')
        imported = run('seed', 'imported', 'QA_lifecycle-b', 'IMPORTED')
        restored = run('restore', 'imported', 'QA_lifecycle-b', 'IMPORTED')
        assert imported['deviceHash'] == restored['deviceHash']
        (root / 'result.json').write_text(json.dumps({'passed': True, 'cases': rows, 'network': 'local fixture only'}, indent=2), 'utf-8')
        print(json.dumps({'passed': True, 'cases': len(rows), 'record': str(root)}))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--child', action='store_true')
    for option in ('mode', 'data', 'uid', 'label', 'base', 'preferences'):
        parser.add_argument('--' + option)
    args = parser.parse_args()
    child(args) if args.child else main()
