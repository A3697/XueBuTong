"""Process-local direct connections for the independent fusion backend."""
import os
import re

_PROXY_ENV = re.compile(
    r'^(?:(?:http|https|all|ftp|ws|wss)_proxy|no_proxy|'
    r'npm_config_(?:proxy|https_proxy|noproxy)|'
    r'global_agent_(?:http_proxy|https_proxy|no_proxy)|node_use_env_proxy)$', re.I)
_installed = False


def direct_environment(source=None):
    env = {key: value for key, value in (os.environ if source is None else source).items()
           if not _PROXY_ENV.fullmatch(key)}
    env.update(NO_PROXY='*', no_proxy='*', NODE_USE_ENV_PROXY='0')
    return env


def install_direct_network():
    """Ignore registry/env proxies and explicit old backend proxy settings.

    Install before importing backend modules so urllib and websockets also see
    the direct resolver. Only the dedicated backend interpreter is affected.
    """
    global _installed
    for key in list(os.environ):
        if _PROXY_ENV.fullmatch(key):
            del os.environ[key]
    os.environ.update(direct_environment())
    if _installed:
        return

    import urllib.request
    urllib.request.getproxies = lambda: {}
    urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))

    import requests.sessions
    original_init = requests.sessions.Session.__init__
    original_send = requests.sessions.Session.send

    def direct_init(session, *args, **kwargs):
        original_init(session, *args, **kwargs)
        session.trust_env = False
        session.proxies.clear()

    def direct_send(session, request, **kwargs):
        session.trust_env = False
        kwargs['proxies'] = {}
        return original_send(session, request, **kwargs)

    requests.sessions.Session.__init__ = direct_init
    requests.sessions.Session.send = direct_send
    _installed = True
