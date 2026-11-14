"""Shared answer policy around the original chapter/homework executors.

The upstream page parser, answer-field builder, submission and task scheduler are
retained. Only explicit gateway misses may use the user's random-answer options.
Exams are not hooked. Each backend process belongs to one account.
"""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import replace
from functools import wraps
import json
import random
import threading
import time
from urllib.parse import urlsplit

KEY = 'config.fusion_answer_policy'
LOCAL = threading.local()
TYPES = {0: 'single', 1: 'multiple', 2: 'completion', 3: 'judgement', 4: 'short'}


def validate(body):
    if not isinstance(body, dict) or not isinstance(body.get('settings'), dict):
        raise ValueError('answer_policy_invalid')
    value = deepcopy(body)
    url = urlsplit(value.get('baseUrl', ''))
    if (url.scheme != 'http' or url.hostname != '127.0.0.1' or not url.port
            or url.path != '/v1' or url.username or url.password or url.query or url.fragment):
        raise ValueError('answer_gateway_invalid')
    token = value.get('apiKey')
    if not isinstance(token, str) or not 32 <= len(token) <= 128 or not all(c.isalnum() or c in '_-' for c in token):
        raise ValueError('answer_gateway_invalid')
    settings = value['settings']
    upload = settings.get('upload')
    if not (upload in ('save', 'nomove', 'force') or type(upload) is int and 0 <= upload <= 100):
        raise ValueError('answer_upload_invalid')
    for key, bounds in {'thread': (1, 3), 'period': (1, 60), 'stopSecondWhenFinish': (3, 9999),
                        'answerWrapperHandlerTimeout': (10, 180)}.items():
        v = settings.get(key)
        if type(v) is not int or not bounds[0] <= v <= bounds[1]:
            raise ValueError('answer_number_invalid')
    for key in ('work-when-no-job', 'randomWork-choice', 'randomWork-complete', 'imageOptimize'):
        if type(settings.get(key)) is not bool:
            raise ValueError('answer_switch_invalid')
    for key in ('randomWork-completeTexts-textarea', 'answerSeparators', 'redundanceWordsText'):
        if not isinstance(settings.get(key), str) or len(settings[key]) > 16000:
            raise ValueError('answer_text_invalid')
    return value


class SearchFailure(Exception):
    pass


def question_key(question):
    return (question.stem, kind(question), tuple(question.options), question.answer_num)


def kind(question):
    return int(getattr(question.qtype, 'value', question.qtype))


class SearchBatch:
    def __init__(self, state):
        self.state = state
        self.pool = None
        self.pending = {}
        self.lock = threading.Lock()
        self.next_start = 0

    def close(self):
        if self.pool:
            self.pool.shutdown(wait=True, cancel_futures=True)

    def query(self, question, context):
        try:
            return self._query(question, context)
        except Exception:
            self.state['search_error'] = True
            raise SearchFailure('搜题失败，未随机补答或提交') from None

    def _query(self, question, context):
        state = self.state
        if self.pool is None:
            self.pool = ThreadPoolExecutor(max_workers=state['settings']['thread'], thread_name_prefix='answer-search')
            from core.question_bank.models import QuestionType
            for item in getattr(state.get('form'), 'questions', []):
                if item.qtype not in TYPES:
                    continue
                q = replace(question, stem=item.stem, qtype=QuestionType(item.qtype),
                            options=list(item.options), answer_num=item.answer_num)
                key = question_key(q)
                if key not in self.pending:
                    self.pending[key] = self.pool.submit(self.lookup, q)
        key = question_key(question)
        if key not in self.pending:
            self.pending[key] = self.pool.submit(self.lookup, question)
        result = self.pending[key].result()
        state['queried'] += 1
        if result.success and not result.answer.extra.get('fusion_random'):
            state['found'] += 1
        return result

    def lookup(self, question):
        import requests
        from core.question_bank.models import Answer, QueryResult
        state, settings = self.state, self.state['settings']
        runner = state['runner']
        if not runner.wait_if_paused():
            raise SearchFailure('答题已停止')
        with self.lock:
            delay = max(0, self.next_start - time.monotonic())
            self.next_start = time.monotonic() + delay + settings['period']
        if delay and not runner.sleep(delay):
            raise SearchFailure('答题已停止')
        body = {'title': question.stem, 'type': TYPES[kind(question)],
                'courseName': str(getattr(question, 'course_name', '') or (getattr(runner, 'context', {}) or {}).get('course_name') or '')[:500],
                'options': [{'label': chr(65+i), 'text': v} for i, v in enumerate(question.options)],
                'blankCount': max(1, question.answer_num) if kind(question) == 2 else 0}
        # Loopback requests carry a per-account ephemeral capability, never a vendor key.
        try:
            with requests.Session() as session:
                session.trust_env = False
                response = session.post(state['baseUrl'] + '/fusion/query', json=body,
                    headers={'Authorization': 'Bearer ' + state['apiKey']},
                    timeout=settings['answerWrapperHandlerTimeout'] + 5)
                if response.status_code != 200:
                    raise SearchFailure('搜题接口返回异常，未随机补答或提交')
                data = response.json()
        except SearchFailure:
            raise
        except Exception:
            raise SearchFailure('搜题连接失败，未随机补答或提交') from None
        raw = data.get('answer')
        random_answer = False
        if data.get('kind') == 'miss':
            random_answer = True
            if kind(question) in (0, 1, 3) and settings['randomWork-choice']:
                raw = random.choice(('对', '错')) if kind(question) == 3 else chr(65+random.randrange(len(question.options)))
            elif kind(question) == 2 and settings['randomWork-complete']:
                choices = [v.strip() for v in settings['randomWork-completeTexts-textarea'].splitlines() if v.strip()]
                if choices:
                    raw = [random.choice(choices) for _ in range(max(1, question.answer_num))]
            if raw is None:
                return QueryResult(success=False, msg='题库和 AI 均未找到答案')
        elif data.get('kind') != 'hit':
            raise SearchFailure('搜题返回格式异常，未提交')
        parts = raw if isinstance(raw, list) else [str(raw)]
        answer = Answer(raw='\n'.join(parts), normalized='\n'.join(parts), parts=parts,
                        extra={'fusion_random': random_answer})
        if kind(question) in (0, 1):
            if not isinstance(raw, str) or not raw or any(not 'A' <= c <= 'Z' or ord(c)-65 >= len(question.options) for c in raw):
                raise SearchFailure('选项答案格式异常，未提交')
            answer.extra['matched_indices'] = [ord(c)-65 for c in raw]
        return QueryResult(success=True, answer=answer)


def install(store):
    from core import work, homework, taskpoint
    from core.scheduler import TaskResult
    from answer_confirmation import migrate_unverified_cache, install_local_progress_guard, confirm
    migrate_unverified_cache(store)
    install_local_progress_guard(store)
    if getattr(work.WorkExecutor.execute, '_fusion_answer_policy', False):
        return
    for module, cls in ((work, work.WorkExecutor), (homework, homework.HomeworkExecutor)):
        original_execute = cls.execute
        original_bank = module.create_bank_from_ctx
        parse_name = 'parse_work_page' if module is work else 'parse_dowork_page'
        original_parse = getattr(module, parse_name)
        original_submit = module.submit_work

        def parse(*args, _original=original_parse, **kwargs):
            form = _original(*args, **kwargs)
            state = getattr(LOCAL, 'state', None)
            if state is not None:
                state['form'] = form
            return form

        def bank(*args, _original=original_bank, **kwargs):
            state = getattr(LOCAL, 'state', None)
            if state is None:
                return _original(*args, **kwargs)
            if 'batch' not in state:
                state['batch'] = SearchBatch(state)
            return state['batch']

        def submit(*args, _original=original_submit, **kwargs):
            state = getattr(LOCAL, 'state', None)
            if state is None:
                return _original(*args, **kwargs)
            settings = state['settings']
            if state.get('search_error'):
                raise SearchFailure('搜题失败，未提交')
            if not state['runner'].wait_if_paused():
                raise SearchFailure('答题已停止')
            state['submitted'] = True
            if settings['upload'] == 'nomove':
                return work.WorkSubmitResult(ok=True, message='已按设置保留，不保存或提交', mode='save')
            if not state['runner'].sleep(settings['stopSecondWhenFinish']):
                state['cancelled'] = True
                raise SearchFailure('答题已停止，未保存或提交')
            total = len(getattr(state.get('form'), 'questions', []))
            rate = 100 * state['found'] / max(1, total)
            kwargs['submit'] = settings['upload'] == 'force' or isinstance(settings['upload'], int) and rate >= settings['upload']
            state['did_submit'] = kwargs['submit']
            state['answer_fields'] = deepcopy(args[2] if len(args) > 2 else kwargs.get('answer_fields', {}))
            state['submit_kwargs'] = dict(kwargs)
            return _original(*args, **kwargs)

        @wraps(original_execute)
        def execute(self, task, runner, _original=original_execute, _submit=original_submit, _module=module):
            policy = store.get(KEY)
            if not policy:
                return _original(self, task, runner)
            state = {**policy, 'runner': runner, 'submitted': False,
                     'did_submit': False, 'queried': 0, 'found': 0}
            task.extra = dict(task.extra or {}, completion_verified=False)
            previous = getattr(LOCAL, 'state', None)
            old_auto, old_threshold = self.auto_submit, self.threshold
            LOCAL.state = state
            # The final submission decision is made from actual hits below, excluding
            # random answers. Keep upstream fetch, parsing and retries unchanged.
            self.auto_submit, self.threshold = True, 0
            try:
                result = _original(self, task, runner)
                if state.get('cancelled'):
                    return TaskResult(success=False, message='答题已停止，未保存或提交', finished=False, cancelled=True)
                if state.get('search_error'):
                    return TaskResult(success=False, message='搜题失败，未提交，请检查连接与配置', finished=False)
                form = state.get('form')
                total = len(getattr(form, 'questions', []))
                # Upstream skips an entirely unanswered form. Honour the explicitly
                # selected force-submit option only after every lookup completed
                # normally; errors and stopped/blocked tasks never take this path.
                if (policy['settings']['upload'] == 'force' and total > 0
                        and state['queried'] == total and not state['submitted']
                        and result.success and not result.finished and not result.cancelled
                        and not result.blocked and not result.face_required
                        and form.action and runner.wait_if_paused()):
                    if not runner.sleep(policy['settings']['stopSecondWhenFinish']):
                        return replace(result, success=False, cancelled=True, finished=False,
                                       message='答题已停止，未保存或提交')
                    response = _submit(self.session, form, work.apply_answers(form, {}),
                        submit=True, base_url=self.host, timeout=self.timeout,
                        referer=task.extra.get('task_url', ''), hw=task.task_type == 'homework')
                    state['submitted'], state['did_submit'] = True, True
                    state['answer_fields'] = work.apply_answers(form, {})
                    state['submit_kwargs'] = dict(base_url=self.host, timeout=self.timeout,
                        referer=task.extra.get('task_url', ''), hw=task.task_type == 'homework')
                    result = replace(result, success=response.ok, finished=response.ok,
                                     message=response.message)
                if state['submitted'] and result.success:
                    if policy['settings']['upload'] == 'nomove':
                        finished, action = False, '按设置不保存或提交'
                    else:
                        finished, action = confirm(self, task, runner, _module, state, _submit)
                    result = replace(result, finished=finished,
                        message=f"答题处理：题库命中 {state['found']}/{total}，{action}")
                elif result.success and result.finished:
                    finished, action = confirm(self, task, runner, _module, state, _submit)
                    result = replace(result, finished=finished, message=action)
                return result
            except SearchFailure as error:
                return TaskResult(success=False, message=str(error), finished=False, cancelled=state.get('cancelled', False))
            finally:
                if 'batch' in state:
                    state['batch'].close()
                self.auto_submit, self.threshold = old_auto, old_threshold
                LOCAL.state = previous
        execute._fusion_answer_policy = True
        setattr(module, parse_name, parse)
        module.create_bank_from_ctx, module.submit_work = bank, submit
        cls.execute = execute

    original_points = taskpoint.parse_task_points
    @wraps(original_points)
    def points(data, *args, **kwargs):
        policy = store.get(KEY) or {}
        if not policy.get('settings', {}).get('work-when-no-job') or not isinstance(data, dict):
            return original_points(data, *args, **kwargs)
        data = deepcopy(data)
        forced = set()
        for attachment in data.get('attachments', []):
            if (isinstance(attachment, dict) and attachment.get('type') in ('workid', 'work')
                    and not attachment.get('job') and not attachment.get('isPassed')):
                attachment['job'] = True
                forced.add(str((attachment.get('property') or {}).get('workid', '')))
        result = original_points(data, *args, **kwargs)
        for point in result:
            if (point.task_type in ('work', 'workid') and
                    str((point.extra.get('property') or {}).get('workid', '')) in forced):
                point.extra['fusion_forced_quiz'] = True
        return result
    taskpoint.parse_task_points = points
