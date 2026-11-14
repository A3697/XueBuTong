"""Confirm remote quiz state instead of trusting an HTTP success acknowledgement.

Only the existing chapter/homework endpoints are used. A failed confirmation never
causes another final submission. At most one save of the same answers is attempted
when the refreshed, still-editable form proves the first write did not persist.
"""
from copy import deepcopy
from functools import wraps
from html import unescape

QUIZ_TYPES = frozenset(('work', 'workid', 'quiz', 'homework'))
REVISION_KEY = 'integration.quiz_confirmation_revision'


def migrate_unverified_cache(store):
    if store.get(REVISION_KEY) == 1:
        return
    for key in store.keys():
        if not str(key).startswith('engine.chapter_cache.'):
            continue
        cached = deepcopy(store.get(key))
        changed = False
        if not isinstance(cached, dict):
            continue
        for rows in cached.values():
            for row in rows if isinstance(rows, list) else []:
                if (isinstance(row, dict) and row.get('type') in QUIZ_TYPES
                        and row.get('done') and not any(row.get(key) is True for key in
                            ('completion_verified', 'server_done', 'isPassed'))):
                    row.update(done=False, completion_verified=False)
                    changed = True
        if changed:
            store.set(key, cached)
    snapshot = deepcopy(store.get('integration.queue'))
    changed = False
    for item in snapshot.get('items', []) if isinstance(snapshot, dict) else []:
        if not isinstance(item, dict):
            continue
        states = item.get('task_states', {})
        groups = list((item.get('chapter_points') or {}).items())
        groups.append(('', item.get('tasks', [])))
        groups.append(('homework', item.get('homeworks', [])))
        item_changed = False
        for cid, rows in groups:
            for row in rows if isinstance(rows, list) else []:
                if (not isinstance(row, dict) or row.get('task_type') not in QUIZ_TYPES
                        or any(row.get(key) is True for key in ('completion_verified', 'server_done', 'isPassed'))):
                    continue
                row.update(finished=False, completion_verified=False)
                chapter = str(cid or row.get('chapter_id', ''))
                task_key = chapter + ':' + str(row.get('index', 0))
                if states.get(task_key) in ('done', 'ok', 'skipped', 'server_done'):
                    states[task_key] = 'pending'
                if item.get('chapter_state', {}).get(chapter) == 'done':
                    item['chapter_state'][chapter] = 'pending'
                item_changed = True
        if item_changed:
            if item.get('status') == 'done':
                item['status'] = 'ready'
            changed = True
    if changed:
        store.set('integration.queue', snapshot)
    # Historical task.progress records and all videos, accounts and queues remain.
    store.set(REVISION_KEY, 1)


def install_local_progress_guard(store):
    from core.scheduler import TaskRunner
    original = TaskRunner._is_done
    if getattr(original, '_fusion_quiz_confirmation', False):
        return

    @wraps(original)
    def is_done(self, progress, key, task):
        if getattr(task, 'task_type', '') in QUIZ_TYPES:
            extra = getattr(task, 'extra', {}) or {}
            policy = store.get('config.fusion_answer_policy') or {}
            settings = policy.get('settings', {})
            optional = (task.task_type != 'homework' and extra.get('is_job') is False
                        and not settings.get('work-when-no-job'))
            # Fresh platform completion is useful; an old local "done" alone is
            # not. Optional chapter quizzes keep the user's original skip policy.
            if not optional and not extra.get('isPassed'):
                if task.task_type != 'homework' or not getattr(task, 'finished', False):
                    return False
        return original(self, progress, key, task)
    is_done._fusion_quiz_confirmation = True
    TaskRunner._is_done = is_done


def _normal(value):
    return unescape(str(value or '')).replace('\r\n', '\n').strip()


def _saved(form, answers):
    fields = dict(form.fields)
    expected = {key: value for key, value in answers.items() if _normal(value)}
    return bool(expected) and all(key in fields and _normal(fields[key]) == _normal(value)
                                  for key, value in expected.items())


def _read(executor, task, runner, module):
    from core.scheduler import TaskResult
    from core import work
    if task.task_type != 'homework':
        loaded = executor._load_work_page(task, runner.context, *executor._resolve_ids(task))
        if isinstance(loaded, TaskResult):
            if loaded.success and loaded.finished:
                return None, True
            raise ValueError('quiz_page_unavailable')
        return module.parse_work_page(loaded[1]), False
    url = (getattr(task, 'extra', {}) or {}).get('task_url', '')
    if not url:
        raise ValueError('homework_page_unavailable')
    response = executor.session.get(url, timeout=executor.timeout)
    response.raise_for_status()
    form = module.parse_dowork_page(response.text)
    if not form.questions and work.page_is_graded(response.text):
        return None, True
    if not form.questions or not form.action:
        raise ValueError('homework_page_unavailable')
    return form, False


def _job_complete(executor, task, runner):
    extra = getattr(task, 'extra', {}) or {}
    if task.task_type == 'homework' or not extra.get('is_job') or extra.get('fusion_forced_quiz'):
        return True
    from core.taskpoint import fetch_task_points_ex
    ctx = runner.context
    found = fetch_task_points_ex(executor.session, course_id=ctx['course_id'],
        clazz_id=ctx['clazz_id'], chapter_id=task.chapter_id, cpi=ctx.get('cpi', ''),
        use_cache=False)
    work_id, _ = executor._resolve_ids(task)
    matches = [row for row in found.points if row.task_type in ('work', 'workid')
               and executor._resolve_ids(row)[0] == work_id]
    if len(matches) != 1:
        raise ValueError('quiz_taskpoint_unconfirmed')
    return bool(matches[0].finished or (matches[0].extra or {}).get('isPassed'))


def confirm(executor, task, runner, module, state, original_submit):
    """Return (finished, message); confirmation failures deliberately stay partial."""
    try:
        form, graded = _read(executor, task, runner, module)
        if graded:
            if _job_complete(executor, task, runner):
                task.extra = dict(task.extra or {}, completion_verified=True)
                return True, '平台已确认提交/批阅并完成'
            return False, '测验已提交/批阅，但平台任务点仍未完成，请检查成绩或重做要求'
        answers = state.get('answer_fields') or {}
        saved = _saved(form, answers)
        if not saved and answers and runner.wait_if_paused():
            # Never replay a final submission or transfer answers to a different
            # set of question IDs. Save only against the newly fetched form.
            names = {key for key, _ in form.fields}
            if all(key in names for key in answers):
                kwargs = dict(state.get('submit_kwargs') or {})
                kwargs['submit'] = False
                response = original_submit(executor.session, form, answers, **kwargs)
                if response.ok:
                    form, graded = _read(executor, task, runner, module)
                    saved = not graded and _saved(form, answers)
        if saved:
            return False, ('答案已保存，平台仍可作答，未确认提交完成' if state.get('did_submit')
                           else '已重新读取并确认答案保存，未提交')
        return False, '平台未确认答案保存或提交，保留待完成状态，请重试'
    except Exception:
        return False, '未能重新读取平台状态，暂不标记完成；可稍后重试确认'
