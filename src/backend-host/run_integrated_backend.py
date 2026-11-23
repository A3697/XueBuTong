"""Original backend host for the independent integration tree.

Launch with python3144/python.exe -I -S -B and keep stdin open. Write stop\n
to stdin for graceful shutdown. Importing this tool never imports sample code.
"""
from pathlib import Path, PurePosixPath
import argparse
import ctypes
from ctypes import wintypes
import hashlib
import html.parser  # Resolve the bundled stdlib before the upstream partial html package shadows it.
import json
import logging
import os
import re
import socket
import subprocess
import sys
import threading
import time
import traceback
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'star-runtime'
INSTANCES = ROOT / 'instances'
HOST = '127.0.0.1'
MANIFEST_NAME = '_backend-prepared-manifest.json'
EXPECTED_EXE_SHA256 = '0373bcc62639895a2b4433d67fa409c59594ba538d79c60f2ea6dade8aeaedf4'
EXPECTED_STAR_VERSION = '1.3.1'
EXPECTED_PYTHON_SHA256 = 'a07f7d09c3121492bb066535c6d0811df5fbc2090cbca7031a97bb47ce1480c9'
DPAPI_HEADER = b'XSLIVE1\0'
DPAPI_ENTROPY = b'XingchanLiveBackendTokenV1'
_ACCOUNT_LOCK = None  # Keep the OS lock until interpreter/process exit, including cleanup failures.
ENHANCEMENT_MODULES = (
    'account_environment', 'upstream_updates', 'antispider_recovery',
    'video_speed_policy', 'answer_policy', 'supplemental_tasks', 'homework_catalog',
    'course_metadata', 'integration_state', 'queue_prune',
    'original_search_bridge', 'integration_controls', 'course_watch',
)


def identifiers(uid, session):
    if (not isinstance(uid, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', uid)
            or uid in ('__proto__', 'constructor', 'prototype')):
        raise ValueError('invalid uid')
    if not isinstance(session, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}', session):
        raise ValueError('invalid session')
    if re.fullmatch(r'(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])', session):
        raise ValueError('reserved session')
    return uid, session


def confined(path, root):
    """Reject junction/symlink escapes, including for not-yet-created leaves."""
    result = Path(path).resolve()
    if not result.is_relative_to(Path(root).resolve()):
        raise ValueError('path escaped integration tree')
    return result


def file_sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def relative_path(value):
    if not isinstance(value, str):
        raise ValueError('invalid manifest path')
    path = PurePosixPath(value)
    if not path.parts or path.is_absolute() or '..' in path.parts or ':' in value or '\\' in value:
        raise ValueError('unsafe manifest path')
    return path


def verify_runtime():
    runtime = confined(RUNTIME, ROOT)
    manifest = json.loads((runtime / MANIFEST_NAME).read_text(encoding='utf-8'))
    if manifest.get('source_exe_sha256') != EXPECTED_EXE_SHA256 or not manifest.get('files'):
        raise ValueError('runtime identity mismatch')
    def verify_entry(entry):
        path = confined(runtime.joinpath(*relative_path(entry['path']).parts), runtime)
        if not path.is_file() or path.stat().st_size != entry['size'] or file_sha256(path) != entry['sha256']:
            raise ValueError('runtime integrity mismatch')
    # Keep the complete path, length and SHA-256 checks on every start. A small
    # bounded pool overlaps disk access without a cache that could become stale.
    with ThreadPoolExecutor(max_workers=4, thread_name_prefix='runtime-integrity') as pool:
        for _ in pool.map(verify_entry, manifest['files']):
            pass
    return runtime, manifest


def verify_native_web():
    """Serve only unchanged web members from the paired upstream EXE."""
    web = confined(ROOT / 'assets' / 'star-native', ROOT)
    manifest = json.loads((web / '_source-manifest.json').read_text(encoding='utf-8'))
    if (manifest.get('source_exe_sha256') != EXPECTED_EXE_SHA256
            or manifest.get('version') != EXPECTED_STAR_VERSION or not manifest.get('files')):
        raise ValueError('native frontend identity mismatch')
    seen = set()
    for entry in manifest['files']:
        relative = relative_path(entry['path'])
        name = str(relative)
        if name in seen or entry.get('source_member') != 'web/dist/' + name:
            raise ValueError('native frontend member mismatch')
        seen.add(name)
        path = confined(web.joinpath(*relative.parts), web)
        if not path.is_file() or path.stat().st_size != entry['size'] or file_sha256(path) != entry['sha256']:
            raise ValueError('native frontend integrity mismatch')
    if 'index.html' not in seen:
        raise ValueError('native frontend entry missing')
    return web


def account_data_dir(instance, *, native=False):
    """Never share queue/session/cache files between native and enhanced mode."""
    return confined(instance / ('data-native' if native else 'data'), instance)


def verify_host():
    if os.name != 'nt' or sys.version_info[:3] != (3, 14, 4) or ctypes.sizeof(ctypes.c_void_p) != 8:
        raise RuntimeError('requires matching Windows x64 CPython 3.14.4')
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
    kernel32.GetModuleHandleW.restype = wintypes.HMODULE
    kernel32.GetModuleFileNameW.argtypes = [wintypes.HMODULE, wintypes.LPWSTR, wintypes.DWORD]
    kernel32.GetModuleFileNameW.restype = wintypes.DWORD
    module = kernel32.GetModuleHandleW('python314.dll')
    path = ctypes.create_unicode_buffer(32768)
    length = kernel32.GetModuleFileNameW(module, path, len(path)) if module else 0
    if not length or length >= len(path) or file_sha256(Path(path.value)) != EXPECTED_PYTHON_SHA256:
        raise RuntimeError('loaded Python runtime identity mismatch')


@lru_cache(maxsize=1)
def current_user_sid():
    system32 = Path(os.environ.get('SystemRoot', r'C:\Windows')) / 'System32'
    sid_result = subprocess.run([str(system32 / 'whoami.exe'), '/user', '/fo', 'csv', '/nh'],
                                stdin=subprocess.DEVNULL, capture_output=True, check=True,
                                creationflags=0x08000000)
    match = re.search(rb'S-1-[0-9-]+', sid_result.stdout)
    if not match:
        raise RuntimeError('current Windows SID unavailable')
    return match.group().decode('ascii')


def private_acl(path):
    """Use a protected DACL granting full control only to CurrentUser and SYSTEM."""
    if os.name != 'nt':
        raise RuntimeError('Windows private storage is required')
    sid = current_user_sid()
    advapi32 = ctypes.WinDLL('advapi32', use_last_error=True)
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p]
    advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW.restype = wintypes.BOOL
    advapi32.GetSecurityDescriptorDacl.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.BOOL),
                                                 ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(wintypes.BOOL)]
    advapi32.GetSecurityDescriptorDacl.restype = wintypes.BOOL
    advapi32.SetNamedSecurityInfoW.argtypes = [wintypes.LPWSTR, ctypes.c_int, wintypes.DWORD,
                                             ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]
    advapi32.SetNamedSecurityInfoW.restype = wintypes.DWORD
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    descriptor = ctypes.c_void_p()
    sddl = 'D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;' + sid + ')'
    if not advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl, 1, ctypes.byref(descriptor), None):
        raise RuntimeError('private ACL construction failed')
    try:
        dacl = ctypes.c_void_p()
        present, defaulted = wintypes.BOOL(), wintypes.BOOL()
        if not advapi32.GetSecurityDescriptorDacl(descriptor, ctypes.byref(present), ctypes.byref(dacl),
                                                 ctypes.byref(defaulted)) or not present.value:
            raise RuntimeError('private ACL extraction failed')
        # SE_FILE_OBJECT, DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION.
        if advapi32.SetNamedSecurityInfoW(str(path), 1, 0x80000004, None, None, dacl, None):
            raise RuntimeError('private ACL assignment failed')
    finally:
        kernel32.LocalFree(descriptor)


class DataBlob(ctypes.Structure):
    _fields_ = [('cbData', wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_ubyte))]


def dpapi(data, *, decrypt=False):
    """Same CurrentUser binary format/entropy as the proven Live host."""
    if os.name != 'nt':
        raise RuntimeError('Windows DPAPI is required')
    crypt32 = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    buffer = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    entropy_buffer = (ctypes.c_ubyte * len(DPAPI_ENTROPY)).from_buffer_copy(DPAPI_ENTROPY)
    incoming = DataBlob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    entropy = DataBlob(len(DPAPI_ENTROPY), ctypes.cast(entropy_buffer, ctypes.POINTER(ctypes.c_ubyte)))
    outgoing = DataBlob()
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    if decrypt:
        operation = crypt32.CryptUnprotectData
        operation.argtypes = [ctypes.POINTER(DataBlob), ctypes.c_void_p, ctypes.POINTER(DataBlob),
                              ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob)]
        operation.restype = wintypes.BOOL
        ok = operation(ctypes.byref(incoming), None, ctypes.byref(entropy), None, None, 1, ctypes.byref(outgoing))
    else:
        operation = crypt32.CryptProtectData
        operation.argtypes = [ctypes.POINTER(DataBlob), wintypes.LPCWSTR, ctypes.POINTER(DataBlob),
                              ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob)]
        operation.restype = wintypes.BOOL
        ok = operation(ctypes.byref(incoming), 'Xingchan Live local startup token', ctypes.byref(entropy),
                       None, None, 1, ctypes.byref(outgoing))
    if not ok:
        raise RuntimeError('DPAPI operation failed')
    try:
        return ctypes.string_at(outgoing.pbData, outgoing.cbData)
    finally:
        kernel32.LocalFree(ctypes.cast(outgoing.pbData, ctypes.c_void_p))


def read_runtime_info(token_file):
    """Parent-controller helper. Its caller owns the returned in-memory secret."""
    root = confined(INSTANCES, ROOT)
    file = confined(token_file, root)
    parts = file.relative_to(root).parts
    if len(parts) != 4 or parts[1] != 'sessions' or parts[3] != 'startup-token.dpapi':
        raise ValueError('invalid integration token path')
    uid, session = identifiers(parts[0], parts[2])
    return _decode_runtime_info(file, uid, session)


def _decode_runtime_info(file, uid, session):
    if file.stat().st_size > 65536:
        raise ValueError('invalid encrypted token size')
    encoded = file.read_bytes()
    if not encoded.startswith(DPAPI_HEADER):
        raise ValueError('wrong encrypted token format')
    payload = json.loads(dpapi(encoded[len(DPAPI_HEADER):], decrypt=True).decode('utf-8'))
    if (not isinstance(payload, dict) or payload.get('schema') != 1 or payload.get('host') != HOST
            or payload.get('uid') != uid or payload.get('session') != session
            or type(payload.get('port')) is not int or not 1 <= payload['port'] <= 65535
            or type(payload.get('pid')) is not int or payload['pid'] <= 0
            or not isinstance(payload.get('token'), str) or not 1 <= len(payload['token']) <= 4096):
        raise ValueError('wrong encrypted token payload')
    return {key: payload[key] for key in ('host', 'port', 'token', 'pid', 'uid', 'session')}


class StateFile:
    def __init__(self, path, *, uid, session, base_dir, token_file, port, native=False):
        self.path = path
        self.lock = threading.Lock()
        self.payload = {'schema': 1, 'state': 'preparing', 'pid': os.getpid(), 'host': HOST,
                        'uid': uid, 'session': session, 'port': port, 'token_file': str(token_file),
                        'base_dir': str(base_dir), 'mode': 'native' if native else 'integration',
                        'host_automatic_restore': False, 'host_automatic_start_run': False}

    def write(self, state, **fields):
        with self.lock:
            if self.payload['state'] in ('stopped', 'failed') and state != self.payload['state']:
                return
            if self.payload['state'] in ('stopping', 'stopped', 'failed') and state not in ('stopping', 'stopped', 'failed'):
                return
            self.payload.update(fields)
            self.payload['state'] = state
            temporary = self.path.with_suffix('.writing')
            temporary.write_text(json.dumps(self.payload, ensure_ascii=True, indent=2), encoding='utf-8')
            # Brief readers/AV scanners can momentarily deny replacement on Windows.
            # Keep atomic writes and retry only this transient sharing/permission failure.
            for attempt in range(30):
                try:
                    os.replace(temporary, self.path)
                    break
                except PermissionError:
                    if attempt == 29:
                        raise
                    time.sleep(min(0.01 * (attempt + 1), 0.08))


def redirect_private_log(path):
    for stream in (sys.stdout, sys.stderr):
        if stream is not None:
            stream.flush()
    descriptor = os.open(path, os.O_CREAT | os.O_WRONLY | os.O_APPEND, 0o600)
    try:
        os.dup2(descriptor, 1)
        os.dup2(descriptor, 2)
    finally:
        if descriptor not in (1, 2):
            os.close(descriptor)
    logging.basicConfig(level=logging.INFO, force=True, stream=sys.stderr,
                        format='%(asctime)s %(levelname)s %(message)s')


def launch(args):
    global _ACCOUNT_LOCK
    uid, session = identifiers(args.uid, args.session)
    native = bool(getattr(args, 'native', False))
    verify_host()
    instances = confined(INSTANCES, ROOT)
    instances.mkdir(exist_ok=True)
    private_acl(instances)
    instance = confined(instances / uid, instances)
    instance.mkdir(exist_ok=True)
    private_acl(instance)
    data = account_data_dir(instance, native=native)
    data.mkdir(exist_ok=True)  # Stable across launches: never clear, copy over, or delete.
    private_acl(data)
    sessions = confined(instance / 'sessions', instance)
    sessions.mkdir(exist_ok=True)
    private_acl(sessions)
    session_dir = confined(sessions / session, sessions)
    session_dir.mkdir(exist_ok=False)  # Each session is immutable history; choose a new identifier.
    private_acl(session_dir)
    state = StateFile(session_dir / 'startup-state.json', uid=uid, session=session,
                      base_dir=data, token_file=session_dir / 'startup-token.dpapi', port=args.port,
                      native=native)
    state.write('preparing')
    redirect_private_log(session_dir / 'backend-private.log')
    listener, engine, account_lock = None, None, None
    course_watcher, session_guard = None, None
    dll_handles = []
    done, stop = threading.Event(), threading.Event()
    server_reference = {}
    try:
        # A second process for the same uid must not write its persistent state concurrently.
        import msvcrt
        account_lock = (instance / 'backend.lock').open('a+b')
        if account_lock.seek(0, os.SEEK_END) == 0:
            account_lock.write(b'\0')
            account_lock.flush()
        account_lock.seek(0)
        msvcrt.locking(account_lock.fileno(), msvcrt.LK_NBLCK, 1)
        _ACCOUNT_LOCK = account_lock
        runtime, manifest = verify_runtime()
        web_dir = verify_native_web() if native else runtime / 'web' / 'dist'
        for name in ('storage', 'logs', 'tmp'):
            confined(data / name, data).mkdir(exist_ok=True)
        os.chdir(data)
        os.environ['TEMP'] = str(data / 'tmp')
        os.environ['TMP'] = str(data / 'tmp')
        sys.dont_write_bytecode = True
        sys.path.insert(0, str(runtime))
        dll_paths = {runtime}
        for entry in manifest['files']:
            path = relative_path(entry['path'])
            if path.suffix.lower() in ('.dll', '.pyd'):
                dll_paths.add(runtime.joinpath(*path.parts).parent)
        dll_handles = [os.add_dll_directory(str(path)) for path in sorted(dll_paths)]

        # Apply before any original backend imports or sessions are constructed.
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from network_policy import install_direct_network
        install_direct_network()
        sys.path.insert(1, str(confined(ROOT / 'src', ROOT)))
        # Bind writable roots before upstream modules freeze path defaults at import.
        # Resource/app paths remain source-bound; only user data belongs to this account.
        import core.paths as account_paths
        account_paths.user_data_dir = lambda: data
        # Bind the persistent account store before UA/auth modules capture
        # default device identifiers or construct their HTTP clients.
        from core.storage import KeyValueStore
        import core.storage as account_storage
        account_store = KeyValueStore(data / 'storage' / 'state.json')
        account_storage.get_store = lambda: account_store
        if not native:
            from account_environment import prepare_account_environment
            client_preferences = json.loads(os.environ.get('XBT_CLIENT_ENVIRONMENT', '{}'))
            prepare_account_environment(account_store, uid, client_preferences)
            from upstream_updates import install_disabled_updates
            install_disabled_updates()
            from antispider_recovery import install as install_antispider_recovery
            recovery = install_antispider_recovery()

        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        listener.bind((HOST, args.port))
        listener.listen(socket.SOMAXCONN)
        listener.setblocking(False)
        port = listener.getsockname()[1]
        state.write('loading_backend', port=port)

        def request_shutdown():
            stop.set()
            state.write('stopping')
            server = server_reference.get('server')
            if server is not None:
                server.should_exit = True

        def read_parent():
            try:
                while not done.is_set():
                    line = sys.stdin.readline()
                    if not line or line.rstrip('\r\n') == 'stop':
                        request_shutdown()  # EOF also stops an orphaned controller child.
                        return
            except BaseException:
                request_shutdown()

        threading.Thread(target=read_parent, name='integration-parent-control', daemon=True).start()
        # First sample-code execution. Original classes, authentication and lifespan remain intact.
        import uvicorn
        from core.log import setup_app_logging
        import core.face_photo as account_face_photo
        account_face_dir = confined(data / 'storage' / 'face', data)
        account_face_dir.mkdir(parents=True, exist_ok=True)
        account_face_photo.face_dir = lambda: account_face_dir
        if not native:
            from video_speed_policy import install as install_video_speed_policy
            install_video_speed_policy()
            from answer_policy import install as install_answer_policy
            install_answer_policy(account_store)
            from supplemental_tasks import install as install_supplemental_tasks
            install_supplemental_tasks(account_store)
            from homework_catalog import install as install_homework_catalog
            install_homework_catalog()
        from engine.app import AppEngine
        if not native:
            from course_metadata import install as install_course_metadata
            install_course_metadata()
        from server.app import create_app
        from server.events import EventHub, install_log_stream
        from server.security import new_token

        setup_app_logging(log_dir=data / 'logs', console=False)
        token = new_token()  # Original manager order: new_token before EventHub and AppEngine.
        hub = EventHub()
        engine = AppEngine(store=account_store, emit=hub.publish, base_dir=data)
        if not native:
            from integration_state import install as install_integration_state
            integration_state = install_integration_state(
                engine, account_store,
                preferences_path=confined(ROOT / 'bridge-data/workspace-preferences.json', ROOT))
            recovery['emit'] = engine._emit_fn
            recovery['bind'](engine)
            from queue_prune import install as install_queue_prune
            html_preferences = confined(ROOT / 'bridge-data/html-preferences.json', ROOT)
            blacklisted_courses = []
            if html_preferences.is_file():
                saved_preferences = json.loads(html_preferences.read_text(encoding='utf-8-sig'))
                blacklisted_courses = saved_preferences.get('accounts', {}).get(uid, {}).get('courseFilter', {}).get('blacklist', [])
            install_queue_prune(engine, account_store, integration_state, blacklisted_courses)
            def current_blacklist():
                # The panel can update its filter while this backend stays alive.
                # Retain the last known blacklist if an atomic replacement is in flight.
                nonlocal blacklisted_courses
                try:
                    if html_preferences.is_file():
                        saved = json.loads(html_preferences.read_text(encoding='utf-8-sig'))
                        values = saved.get('accounts', {}).get(uid, {}).get('courseFilter', {}).get('blacklist', [])
                        if isinstance(values, list):
                            blacklisted_courses = [value for value in values if isinstance(value, str)]
                except (OSError, ValueError, TypeError, AttributeError):
                    pass
                return list(blacklisted_courses)

            from course_watch import install as install_course_watch
            course_watcher = install_course_watch(engine, account_store, blacklist=current_blacklist)
        # Session displacement is a host lifecycle stop, shared by both modes.
        # Install after request observers so it can block subsequent requests.
        from session_guard import install as install_session_guard
        session_guard = install_session_guard(emit=engine.emit, engine=engine)
        install_log_stream(hub)
        application = create_app(web_dir=web_dir, hub=hub, engine=engine,
                                 token=token, on_shutdown_request=request_shutdown)
        # Install separate original-bank/AI search routes without replacing the app,
        # engine, original middleware, authentication, WebSockets, or lifespan.
        if not native:
            from original_search_bridge import install_routes
            install_routes(application, token=token, host=HOST, port=port)
            from integration_controls import install_routes as install_controls
            install_controls(application, token=token, host=HOST, port=port, store=account_store, state=integration_state)
            course_watcher.install_routes(application, token=token, host=HOST, port=port)
            from websocket_lifecycle import WebSocketLifecycle
            application = WebSocketLifecycle(application)
        else:
            # The original Vue page has no token plumbing. Its dedicated
            # Electron session supplies X-Token; preserve the original server
            # validation and translate only the local WebSocket transport.
            from native_transport import NativeTokenTransport
            application = NativeTokenTransport(application, token)
        loaded_enhancements = [name for name in ENHANCEMENT_MODULES if name in sys.modules]
        if native and loaded_enhancements:
            raise RuntimeError('native mode unexpectedly loaded fusion enhancements')
        state.write('loading_backend', enhancement_modules=loaded_enhancements,
                    frontend='original-' + EXPECTED_STAR_VERSION if native else 'fusion',
                    native_token_transport=native,
                    websocket_transport='websockets')
        payload = {'schema': 1, 'host': HOST, 'port': port, 'token': token,
                   'pid': os.getpid(), 'uid': uid, 'session': session}
        with Path(state.payload['token_file']).open('xb') as stream:
            stream.write(DPAPI_HEADER + dpapi(json.dumps(payload, ensure_ascii=False).encode('utf-8')))
        config = uvicorn.Config(application, host=HOST, port=port, log_config=None,
                                 log_level='warning', access_log=False, timeout_graceful_shutdown=15,
                                 # The bundled sans-I/O adapter can send a second close
                                 # while Electron is disconnecting and fail shutdown.
                                 # Keep business APIs unchanged; use the bundled adapter
                                 # that handles an already-closing WebSocket correctly.
                                 ws='websockets')
        server = uvicorn.Server(config)
        server_reference['server'] = server
        if stop.is_set():
            server.should_exit = True
        state.write('starting_server')

        def observe_started():
            while not done.wait(0.1):
                if stop.is_set() or server.should_exit:
                    state.write('stopping')
                    return
                if getattr(server, 'started', False):
                    state.write('listening')
                    return

        threading.Thread(target=observe_started, name='integration-startup-state', daemon=True).start()
        if course_watcher is not None:
            course_watcher.start()
        server.run(sockets=[listener])
        if not getattr(server, 'started', False) and not stop.is_set():
            raise RuntimeError('backend did not reach listening state')
        state.write('stopping')
    except BaseException:
        traceback.print_exc(file=sys.stderr)  # Private ACL-protected log only.
        state.write('failed', error='inspect_private_backend_log')
        raise
    finally:
        done.set()
        cleanup_ok = True
        if course_watcher is not None:
            try:
                cleanup_ok = bool(course_watcher.close()) and cleanup_ok
            except BaseException:
                cleanup_ok = False
                traceback.print_exc(file=sys.stderr)
        if engine is not None:
            try:
                # Same original shutdown method used by ManagerWindow.stop_service.
                cleanup_ok = bool(engine.stop_and_wait(timeout=10.0)) and cleanup_ok
            except BaseException:
                cleanup_ok = False
                traceback.print_exc(file=sys.stderr)
        if session_guard is not None:
            try:
                session_guard.dispose()
            except BaseException:
                cleanup_ok = False
                traceback.print_exc(file=sys.stderr)
        if listener is not None:
            listener.close()
        for handle in dll_handles:
            handle.close()
        if account_lock is not None and account_lock is not _ACCOUNT_LOCK:
            account_lock.close()
        if state.payload['state'] != 'failed':
            state.write('stopped' if cleanup_ok else 'failed', engine_stopped=cleanup_ok,
                        **({} if cleanup_ok else {'error': 'engine_stop_timeout_or_failure'}))
    return 0 if state.payload['state'] == 'stopped' else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--uid', required=True)
    parser.add_argument('--session', required=True)
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--native', action='store_true', help='Use upstream Xingchan behavior and isolated native data')
    args = parser.parse_args()
    try:
        identifiers(args.uid, args.session)
        if not 0 <= args.port <= 65535:
            raise ValueError('invalid port')
    except ValueError:
        parser.error('invalid uid, session or port')
    return launch(args)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        # Before redirection this is deliberately fixed text; afterwards it stays private.
        print('integrated_backend_failed: consult private startup-state.json and backend-private.log', file=sys.stderr)
        sys.exit(1)
