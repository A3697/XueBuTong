"""Exercise the shipped verification/retry services with synthetic transport.

No account data or platform requests. OCR accuracy is a separate validation;
this checks accepted/rejected responses, resource recovery and cancellation.
"""
from pathlib import Path
import html.parser
import json
import logging
import os
import sys
import tempfile
import types

source = Path(__file__).resolve().parents[1]
runtime = Path(os.environ['XBT_RUNTIME_ROOT']) / 'star-runtime'
record = Path(tempfile.mkdtemp(prefix='antispider-contract-', dir=os.environ['XBT_QA_ROOT']))
os.chdir(record)
sys.dont_write_bytecode = True
sys.path[:0] = [str(source / 'src/fusion'), str(runtime)]
handles = [os.add_dll_directory(str(p)) for p in {runtime, *(f.parent for f in runtime.rglob('*.pyd'))}]


def audit(event, args):
    if event.startswith(('socket.', 'subprocess.')) or event in ('os.system', 'os.startfile'):
        raise RuntimeError('fixture forbids external activity')
    if event == 'open' and args:
        mode, flags = args[1:3]
        writing = isinstance(mode, str) and any(c in mode for c in 'wax+') or isinstance(flags, int) and flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC)
        if writing and not Path(os.fsdecode(args[0])).resolve().is_relative_to(record):
            raise RuntimeError('fixture write escaped record')


sys.addaudithook(audit)
logging.disable(logging.CRITICAL)
import core.paths
import core.log
core.paths.user_data_dir = lambda: record
core.log.get_logger = lambda *a, **kw: logging.getLogger('fixture')
core.log.get_category_logger = core.log.get_logger
import core.storage


class Store:
    def __init__(self): self.items = {}
    def get(self, key, default=None): return self.items.get(key, default)
    def set(self, key, value): self.items[key] = value
    def delete(self, key): self.items.pop(key, None)


store = Store()
core.storage.get_store = lambda: store
import core.antispider as anti
from antispider_recovery import install
state = install()
import engine.unlock as unlock
import requests

configuration = {'auto': True}
unlock.ConfigManager = lambda *a, **kw: types.SimpleNamespace(load=lambda: types.SimpleNamespace(auto_captcha=configuration['auto'], captcha_command=''))
unlock.fetch_verify_form = lambda *a, **kw: {}
unlock.paths.cache_dir = lambda: record
anti._ddddocr_instance = lambda: object()
anti.fetch_captcha = lambda *a, **kw: anti.CaptchaImage(data=b'synthetic-image', content_type='image/png')
anti.solve_captcha = lambda *a, **kw: ('4826', 'synthetic OCR fixture')
challenge = anti.AntispiderChallenge(error='fixture-risk', status_code=202)
rows = []


def run(name, *, resource_ready=False, accepted=True, explicit=None, configured=True, timeout=False, cancel=False):
    configuration['auto'] = configured
    events, calls, reports = [], [], []
    state['emit'] = events.append
    service = unlock.UnlockService(session=lambda: object(), store=store, on_log=lambda *a: None, emit=lambda *a: None, stop_checker=lambda: False)
    service.say = lambda *a: None
    service._clear_taskpoint_cache = lambda: None
    service.stop_wait = lambda *a: False
    service.rounds = lambda: (1, 0)
    engine = types.SimpleNamespace(unlock=service, snapshot=lambda: {'run': {'running': True, 'paused': False}}, _pause_queue_for_block=lambda *a: None)
    state['bind'](engine)
    engine._fusion_cancel_recovery()

    def response(*args, **kwargs):
        if cancel:
            engine._fusion_cancel_recovery()
        return anti.UnlockResult(ok=accepted, status_code=200, message='success' if accepted else '验证码错误')

    anti.unlock_with_code = response

    def solve(*args, **kwargs):
        kwargs.update(max_attempts=1, pause=0)
        result = anti.auto_unlock(*args, **kwargs)
        reports.append(result)
        return result

    unlock.auto_unlock = solve

    def fetch(fresh):
        calls.append(fresh)
        if timeout:
            raise requests.exceptions.ReadTimeout('synthetic timeout')
        if resource_ready and len(calls) > 1:
            return {'resource': 'restored'}
        raise anti.AntispiderError(challenge)

    try:
        result = service.with_retry(fetch, auto=explicit)
    except requests.exceptions.ReadTimeout:
        assert timeout and not events and not reports
        rows.append({'name': name, 'passed': True, 'fetches': len(calls), 'recoveryEvents': 0})
        return
    enabled = bool(explicit) if explicit is not None else configured
    if resource_ready and enabled:
        assert result == ({'resource': 'restored'}, None)
        assert reports[-1].ok and reports[-1].confirmed_by_probe
        assert len(calls) == 2 and not events
    else:
        assert result[0] is None and result[1] is challenge
        assert len(events) == (1 if enabled and not cancel else 0)
        if accepted and enabled:
            assert reports[-1].ok is False and len(calls) == 2
    engine._pause_queue_for_block('subsequent generic task block')
    assert len(events) <= 1
    rows.append({'name': name, 'passed': True, 'fetches': len(calls), 'recoveryEvents': len(events)})


run('accepted-resource-restored', resource_ready=True)
run('accepted-resource-still-blocked')
run('captcha-rejected', accepted=False)
run('explicit-auto-off', explicit=False)
run('configured-auto-off', configured=False)
run('explicit-auto-on', explicit=True, configured=False, resource_ready=True)
run('ordinary-timeout', timeout=True)
run('manual-cancel-during-verification', cancel=True)
result = {'passed': True, 'network': 'disabled', 'transportAndOCR': 'synthetic', 'shippedServices': ['core.antispider', 'engine.unlock'], 'cases': rows}
(record / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf-8')
print(json.dumps({'passed': True, 'cases': len(rows), 'record': str(record)}))
