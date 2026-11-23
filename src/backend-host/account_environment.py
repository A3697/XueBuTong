"""Account-owned upstream device identity and scoped HTTP session persistence.

Keep the shipped client's application version, TLS stack and network routing.
Bind its device, configurable UA fields and cookies to the owning account.
UA fields describe request headers; they do not emulate hardware or change IPs.
"""
from functools import wraps
import hashlib
from http.cookiejar import Cookie
import json
import logging
import re
import sys
import threading
import time

OWNER_KEY = 'integration.client_owner'
COOKIES_KEY = 'integration.http_cookies'
LOGIN_KEY = 'integration.login_identity'
DEVICE_KEY = 'ua.device_id'
PREFERENCES_KEY = 'integration.client_preferences'
DEFAULTS = dict(deviceId='', androidVersion='17', model='2410DPN6CC',
                buildNumber='CP2A.260605.016', chromeVersion='151.0.7922.199',
                webviewBase='', dalvikBase='', schildWebview='', schildDalvik='',
                webviewFull='', dalvikFull='')
MAX_COOKIES = 3000
COOKIE_FIELDS = ('version', 'name', 'value', 'port', 'port_specified', 'domain',
                 'domain_specified', 'domain_initial_dot', 'path', 'path_specified',
                 'secure', 'expires', 'discard', 'comment', 'comment_url', 'rfc2109')


def normalize_preferences(value):
    if value is None:
        return DEFAULTS.copy()
    if not isinstance(value, dict):
        raise ValueError('客户端环境配置格式无效。')
    result = DEFAULTS.copy()
    for key in DEFAULTS:
        if key in value:
            if not isinstance(value[key], str):
                raise ValueError('客户端环境字段必须为文本。')
            if key in ('webviewFull', 'dalvikFull') and re.search(r'[\r\n]', value[key]):
                raise ValueError('完整 User-Agent 必须为单行文本。')
            result[key] = value[key].strip()
    for key in ('deviceId', 'schildWebview', 'schildDalvik'):
        if result[key] and not re.fullmatch(r'[a-fA-F0-9]{32}', result[key]):
            raise ValueError('设备号和 schild 标识应为 32 位十六进制字符。')
        result[key] = result[key].lower()
    for key, pattern in (('androidVersion', r'[0-9]{1,2}(?:\.[0-9]{1,2}){0,2}'),
                         ('model', r'[A-Za-z0-9._ -]{1,80}'),
                         ('buildNumber', r'[A-Za-z0-9._ -]{1,80}'),
                         ('chromeVersion', r'[0-9]{1,3}(?:\.[0-9]{1,6}){3}')):
        if not re.fullmatch(pattern, result[key]):
            raise ValueError('客户端系统、机型或版本格式无效。')
    for key in ('webviewBase', 'dalvikBase'):
        text = result[key]
        if text and (len(text) > 1024 or not re.fullmatch(r'[\x20-\x7e]+', text)
                     or re.search(r'\(schild:|ChaoXingStudy_', text, re.I)):
            raise ValueError('UA 基础串格式无效；设备号及 schild 后缀由程序追加。')
    for key in ('webviewFull', 'dalvikFull'):
        text = result[key]
        if text and (len(text) > 2048 or not re.fullmatch(r'[\x20-\x7e]+', text)):
            raise ValueError('完整 User-Agent 需为单行英文字符，最多 2048 字符。')
    return result


def configure_ua(ua, preferences):
    """Preserve generated headers unless this account explicitly overrides them."""
    ua.ANDROID_VERSION = preferences['androidVersion']
    ua.DEVICE_MODEL = preferences['model']
    ua.DEVICE_BUILD = preferences['buildNumber']
    device = f"{ua.DEVICE_MODEL} Build/{ua.DEVICE_BUILD}"
    ua.WEBVIEW_BASE = preferences['webviewBase'] or (
        f'Mozilla/5.0 (Linux; Android {ua.ANDROID_VERSION}; {device}; wv) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 '
        f"Chrome/{preferences['chromeVersion']} Mobile Safari/537.36")
    ua.DALVIK_BASE = preferences['dalvikBase'] or (
        f'Dalvik/2.1.0 (Linux; U; Android {ua.ANDROID_VERSION}; {device})')
    for name in ('WEBVIEW', 'DALVIK'):
        complete = preferences['webviewFull' if name == 'WEBVIEW' else 'dalvikFull']
        if complete:
            setattr(ua, name + '_UA', complete)
            continue
        original = getattr(ua, name + '_UA')
        _, marker, suffix = original.partition(' (schild:')
        if not marker or not suffix.endswith('_' + ua.DEVICE_ID):
            raise RuntimeError('星蝉客户端标识格式不兼容，已停止启动。')
        suffix = marker + suffix
        suffix = re.sub(r'\(device:[^)]*\)', lambda _: f'(device:{ua.DEVICE_MODEL})', suffix, count=1)
        setattr(ua, name + '_UA', getattr(ua, name + '_BASE') + suffix)


def cookie_rows(jar):
    """Retain domain/path and security attributes; do not flatten by cookie name."""
    now = time.time()
    rows = []
    for cookie in jar:
        if cookie.is_expired(now) or not cookie.domain:
            continue
        row = {key: getattr(cookie, key) for key in COOKIE_FIELDS}
        row['rest'] = dict(cookie._rest)
        rows.append(row)
    if len(rows) > MAX_COOKIES:
        raise ValueError('account cookie limit exceeded')
    return sorted(rows, key=lambda row: (row['domain'], row['path'], row['name']))


def restore_cookies(jar, rows):
    if not isinstance(rows, list) or len(rows) > MAX_COOKIES:
        raise ValueError('invalid account cookies')
    cookies = []
    now = time.time()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {*COOKIE_FIELDS, 'rest'}:
            raise ValueError('invalid account cookie fields')
        if not all(isinstance(row[key], str) for key in ('name', 'value', 'domain', 'path')):
            raise ValueError('invalid account cookie value')
        if not row['domain'] or not row['path'].startswith('/') or not isinstance(row['rest'], dict):
            raise ValueError('invalid account cookie scope')
        if row['expires'] is not None and not isinstance(row['expires'], (float, int)):
            raise ValueError('invalid account cookie expiry')
        cookie = Cookie(**row)
        if not cookie.is_expired(now):
            cookies.append(cookie)
    jar.clear()
    for cookie in cookies:
        jar.set_cookie(cookie)


def prepare_account_environment(store, uid, preferences=None):
    """Call after binding core.paths/storage and before any upstream UA import."""
    if (not isinstance(uid, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', uid)
            or uid in ('__proto__', 'constructor', 'prototype')):
        raise ValueError('invalid account environment owner')
    preferences = normalize_preferences(preferences)
    installed = getattr(sys.modules.get('core.auth'), '_fusion_account_environment', None)
    if installed:
        if (installed['uid'] != uid or installed['store'] is not store
                or installed['preferences'] != preferences):
            raise RuntimeError('another account already owns this backend process')
        return installed

    # A copied profile must not reuse its source account's device/session state.
    # A normal legacy profile has no owner marker and keeps its original device.
    owner = store.get(OWNER_KEY, '')
    if owner and owner != uid:
        for key in (DEVICE_KEY, COOKIES_KEY, LOGIN_KEY, 'auth.session',
                    PREFERENCES_KEY, 'ua.schild.webview', 'ua.schild.dalvik'):
            store.delete(key)
    store.set(OWNER_KEY, uid)
    previous = store.get(PREFERENCES_KEY)
    # Adding optional fields with empty defaults must not invalidate an existing
    # login when upgrading an otherwise unchanged account.
    changed = (normalize_preferences(previous) != preferences
               if isinstance(previous, dict) else preferences != DEFAULTS)
    requested_device = preferences['deviceId']
    if requested_device and requested_device != store.get(DEVICE_KEY):
        store.set(DEVICE_KEY, requested_device)
        changed = True
    for field, key in (('schildWebview', 'ua.schild.webview'), ('schildDalvik', 'ua.schild.dalvik')):
        if preferences[field]:
            changed = changed or store.get(key) != preferences[field]
            store.set(key, preferences[field])
        elif isinstance(previous, dict) and previous.get(field):
            store.delete(key)
    if changed:
        for key in (COOKIES_KEY, LOGIN_KEY, 'auth.session'):
            store.delete(key)
    if previous != preferences:
        store.set(PREFERENCES_KEY, preferences)

    import core.storage as storage
    storage.get_store = lambda: store
    import core.ua as ua
    device_id = ua.device_id(store)
    if ua.DEVICE_ID != device_id:
        raise RuntimeError('account environment loaded after the upstream device identity')
    configure_ua(ua, preferences)

    import core.auth as auth
    cls = auth.AuthClient
    original_init, original_save = cls.__init__, cls.save_session
    original_login, original_logout = cls.login, cls.logout
    logger = logging.getLogger('account-environment')
    state = {'uid': uid, 'store': store, 'deviceBound': True, 'preferences': preferences}

    def persist(client):
        with client._fusion_cookie_lock:
            if not client._fusion_cookie_ready:
                return
            user = client.store.get(auth.SESSION_KEY)
            if not isinstance(user, dict) or not user.get('uid'):
                return
            record = {'schema': 1, 'owner': uid, 'user': str(user['uid']),
                      'cookies': cookie_rows(client.session.cookies)}
            encoded = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
            if encoded != client._fusion_cookie_snapshot:
                client.store.set(COOKIES_KEY, record)
                client._fusion_cookie_snapshot = encoded

    @wraps(original_init)
    def initialize(client, *args, **kwargs):
        original_init(client, *args, **kwargs)
        if client.store is not store:
            raise RuntimeError('HTTP client belongs to a different account store')
        client._fusion_cookie_lock = threading.RLock()
        client._fusion_cookie_snapshot = ''
        client._fusion_cookie_ready = False
        send = client.session.send

        def send_scoped(request, **options):
            response = send(request, **options)
            try:
                persist(client)
            except (OSError, ValueError):
                # A local save failure must not turn a successful learning
                # request into a retry that could submit the same work twice.
                logger.warning('账号 Cookie 更新暂未保存；当前登录会话继续使用。')
            return response

        client.session.send = send_scoped

    @wraps(original_save)
    def save_session(client, user):
        original_save(client, user)
        client._fusion_cookie_ready = True
        persist(client)

    def restore(client):
        client._fusion_cookie_ready = False
        record = client.store.get(COOKIES_KEY)
        user = client.load_user()
        if (not user or not isinstance(record, dict) or record.get('schema') != 1
                or record.get('owner') != uid or record.get('user') != str(user.uid)):
            # Legacy name/value dictionaries cannot recover domain/path safely.
            # The normal controller login immediately establishes a new session.
            client.session.cookies.clear()
            return None
        try:
            restore_cookies(client.session.cookies, record.get('cookies'))
        except (TypeError, ValueError, KeyError):
            client.session.cookies.clear()
            logger.warning('账号会话缓存无效，将重新登录。')
            return None
        client._fusion_cookie_snapshot = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
        client._fusion_cookie_ready = True
        return user

    @wraps(original_login)
    def login(client, username, password, schoolid=None):
        identity = hashlib.sha256(json.dumps([str(username).strip(), str(schoolid or '')],
                                            ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()
        if client.store.get(LOGIN_KEY) != identity:
            client._fusion_cookie_ready = False
            client.session.cookies.clear()
            for key in (auth.SESSION_KEY, COOKIES_KEY):
                client.store.delete(key)
            client._fusion_cookie_snapshot = ''
            client.store.set(LOGIN_KEY, identity)
        return original_login(client, username, password, schoolid=schoolid)

    @wraps(original_logout)
    def logout(client):
        original_logout(client)
        client.session.cookies.clear()
        client.store.delete(COOKIES_KEY)
        client.store.delete(LOGIN_KEY)
        client._fusion_cookie_snapshot = ''
        client._fusion_cookie_ready = False

    cls.__init__, cls.save_session = initialize, save_session
    cls.restore, cls.login, cls.logout = restore, login, logout
    auth._fusion_account_environment = state
    return state
