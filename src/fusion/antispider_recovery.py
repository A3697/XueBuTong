"""Confirm the original resource is restored, then recover an exhausted session.

Use the upstream probe/callback and challenge protocol. A successful captcha
submission alone does not establish that the requested course can be read.
"""
from functools import wraps
import logging
import threading


def install():
    import core.antispider as anti
    original = anti.auto_unlock
    state = {'emit': None, 'ready': None, 'error': '', 'failed': False, 'reason': '', 'epoch': 0}
    lock = threading.Lock()
    logger = getattr(anti, 'log', logging.getLogger('antispider'))

    class SubmissionMessage(logging.Filter):
        def filter(self, record):
            if (isinstance(record.msg, str) and record.msg.startswith('[风控] 自动过验证码成功：')
                    and '→' in record.msg):
                record.msg = record.msg.replace('自动过验证码成功', '验证码提交已被接受（待复核原请求）', 1)
            return True

    logger.addFilter(SubmissionMessage())

    def ready():
        with lock:
            if state['ready'] is None:
                try:
                    anti._ddddocr_instance()
                    state['ready'] = True
                except Exception as error:
                    state['ready'] = False
                    state['error'] = type(error).__name__
                    logger.warning('内置 OCR 初始化失败（%s），本次运行不再重复下载验证图片。请重启或修复组件。', state['error'])
            return state['ready']

    @wraps(original)
    def auto_unlock(*args, **kwargs):
        epoch = state['epoch']
        if not kwargs.get('command') and not ready():
            report = anti.AutoUnlockReport(ok=False, message='fusion_ocr_unavailable')
            state['reason'] = 'ocr_unavailable'
        else:
            try:
                report = original(*args, **kwargs)
            except Exception as error:
                # Preserve upstream handling instead of disguising a network
                # failure as an OCR rejection or a successful verification.
                if epoch == state['epoch']:
                    state['failed'] = True
                    state['reason'] = 'verification_exception'
                logger.warning('风控验证流程异常（%s），未确认限制解除。', type(error).__name__)
                raise
            probe = kwargs.get('probe')
            if report.ok and callable(probe) and not getattr(report, 'confirmed_by_probe', False):
                try:
                    restored = bool(probe())
                except Exception as error:
                    restored = False
                    logger.warning('验证码提交后的原请求复核失败（%s）。', type(error).__name__)
                report.probes = int(getattr(report, 'probes', 0)) + 1
                report.confirmed_by_probe = restored
                report.ok = restored
                if restored:
                    report.message = '原课程请求已恢复，验证通过。'
                    logger.info('原课程请求已恢复，确认风控验证通过。')
                else:
                    report.message = '验证码提交被接受，但原课程请求尚未恢复。'
                    logger.warning(report.message)
            if epoch == state['epoch']:
                state['reason'] = 'resource_still_blocked' if not report.ok else ''
        if epoch == state['epoch']:
            state['failed'] = not report.ok
        return report

    def bind(engine):
        pause = engine._pause_queue_for_block

        def cancel():
            state['epoch'] += 1
            state['failed'] = False
            state['reason'] = ''

        engine._fusion_cancel_recovery = cancel

        def exhausted(run):
            if state['emit']:
                state['failed'] = False
                state['emit']({'type': 'integration.risk-blocked', 'payload': {
                    'reason': state['reason'] or 'resource_still_blocked',
                    'resume': bool(run.get('running') and not run.get('paused')),
                    'ocr_available': state['ready'] is not False}})

        service = getattr(engine, 'unlock', None)
        if service is not None:
            retry = service.with_retry

            @wraps(retry)
            def with_retry(*args, **kwargs):
                run = engine.snapshot().get('run', {})
                epoch = state['epoch']
                try:
                    result = retry(*args, **kwargs)
                except Exception:
                    if epoch == state['epoch']:
                        state['failed'] = False
                    raise
                # Chapter discovery can return this before any task exists;
                # it never calls _pause_queue_for_block. Observe its actual
                # final challenge, not ordinary timeouts or missing content.
                enabled = bool(kwargs['auto']) if kwargs.get('auto') is not None else bool(service.auto_enabled)
                if (epoch == state['epoch'] and enabled
                        and isinstance(result, tuple) and len(result) == 2
                        and isinstance(result[1], anti.AntispiderChallenge)):
                    exhausted(run)
                elif epoch == state['epoch']:
                    state['failed'] = False
                return result

            service.with_retry = with_retry

        @wraps(pause)
        def blocked(*args, **kwargs):
            run = engine.snapshot().get('run', {})
            result = pause(*args, **kwargs)
            # Respect all upstream OCR rounds. Recover only once the engine
            # actually blocks its queue, never during a still-running attempt.
            if state['failed'] and state['emit']:
                exhausted(run)
            return result

        engine._pause_queue_for_block = blocked

    state['bind'] = bind
    anti.auto_unlock = auto_unlock
    return state
