"""Per-account queue persistence and observations around the original engine.

No method here logs in, starts a runner, probes a version, or sends HTTP.
Saved task summaries are display data; executable task payloads are fetched by
the original engine when the user starts work.
"""
from dataclasses import fields, is_dataclass
from copy import copy
from functools import wraps
import importlib
import json
import logging
import math
import threading
import time
from urllib.parse import parse_qs, urlsplit

QUEUE_KEY = 'integration.queue'
QUEUE_SCHEMA = 1
MAX_QUEUE_BYTES = 2 * 1024 * 1024
MAX_QUEUE_ITEMS = 1000
MAX_ROWS = 50000
_QUIZ = frozenset(('work', 'workid', 'quiz', 'homework'))
_VERIFIED_TASKS = _QUIZ | frozenset(('discussion', 'survey'))
_INCOMPLETE = frozenset(('running', 'failed', 'partial', 'stopped', 'cancelled',
                         'waiting_face', 'face_required', 'unsupported', 'course_ended', 'unverified', 'manual'))
_STATES = frozenset(('pending', 'ready', 'loading', 'running', 'done', 'ok',
                     'server_done', 'skipped', 'failed', 'partial', 'stopped',
                     'cancelled', 'waiting_face', 'face_required', 'unsupported',
                     'course_ended', 'local_done', 'unverified', 'manual'))
_PRIVATE = frozenset(('password', 'passwd', 'cookies', 'cookie', 'authorization',
                      'api_key', 'apikey', 'access_token', 'refresh_token', 'token',
                      'secret', 'headers', 'dtoken'))
_LOCAL = threading.local()


def _number(value, default=None):
    if type(value) in (int, float) and math.isfinite(value):
        return value
    return default


def _count(value):
    value = _number(value)
    return max(0, int(value)) if value is not None else 0


def _text(value, limit=2000):
    return str(value)[:limit] if isinstance(value, (str, int, float)) else ''


def _plain(value, depth=0):
    if depth > 12:
        raise ValueError('queue_nested_too_deep')
    if value is None or isinstance(value, (bool, str)):
        if isinstance(value, str) and len(value) > 65536:
            raise ValueError('queue_string_too_large')
        return value
    if type(value) in (int, float):
        if not math.isfinite(value):
            raise ValueError('queue_nonfinite_number')
        return value
    if is_dataclass(value) and not isinstance(value, type):
        return _plain({f.name: getattr(value, f.name) for f in fields(value)}, depth + 1)
    if isinstance(value, dict):
        if len(value) > MAX_ROWS:
            raise ValueError('queue_too_many_fields')
        return {str(k): _plain(v, depth + 1) for k, v in value.items()
                if isinstance(k, (str, int)) and str(k).lower() not in _PRIVATE}
    if isinstance(value, (tuple, list)):
        if len(value) > MAX_ROWS:
            raise ValueError('queue_too_many_rows')
        return [_plain(v, depth + 1) for v in value]
    raise ValueError('queue_non_json_value')


def _state(value, restored=False):
    value = value if isinstance(value, str) and value in _STATES else 'pending'
    return 'ready' if restored and value in ('running', 'loading') else value


def _mode(value):
    return value if value in ('task', 'homework', 'both') else 'task'


def _item_key(item):
    course = item.course
    return (_text(course.course_id), _text(course.clazz_id), _text(item.chapter_id or '0'),
            _mode(getattr(item, 'mode', 'task')))


def _task_row(task):
    extra = getattr(task, 'extra', {}) or {}
    finished = bool(getattr(task, 'finished', False) or extra.get('isPassed'))
    return {'chapter_id': _text(getattr(task, 'chapter_id', '')),
            'name': _text(getattr(task, 'name', '')),
            'task_type': _text(getattr(task, 'task_type', '')),
            'index': _count(getattr(task, 'index', 0)),
            'finished': finished,
            'server_done': bool(getattr(task, 'server_done', False) or extra.get('isPassed') or
                                finished and extra.get('is_job') is not False),
            'local_done': bool(getattr(task, 'local_done', False)),
            'completion_verified': extra.get('completion_verified') is True or
                                   getattr(task, 'completion_verified', False) is True}


def _row_complete(row, status=None, *, fresh=False):
    # A more recent unsuccessful task event overrides older catalogue/cache flags.
    if status in _INCOMPLETE:
        return False
    quiz = row.get('task_type', row.get('type')) in _VERIFIED_TASKS
    if status == 'server_done' or status == 'ok' and (fresh or not quiz):
        return True
    if row.get('finished') or row.get('server_done') or row.get('isPassed') or row.get('completion_verified') is True:
        return True
    # Old quiz done/skipped/ok strings predate submission readback. Video and
    # other non-quiz local completion remain valid; this does not clear history.
    return not quiz and bool(row.get('done') or row.get('local_done') or
                             status in ('done', 'skipped', 'local_done'))


def _homework_row(task, index):
    row = _task_row(task)
    row.update(chapter_id='homework', task_type='homework', index=index)
    return row


def _construct(cls, values):
    if not isinstance(values, dict) or not is_dataclass(cls):
        raise ValueError('queue_model_invalid')
    allowed = {f.name for f in fields(cls) if f.init}
    return cls(**{k: v for k, v in values.items() if k in allowed})


def _summary_rows(rows):
    if not isinstance(rows, list) or len(rows) > MAX_ROWS:
        raise ValueError('queue_task_summaries_invalid')
    result = []
    for row in rows:
        if not isinstance(row, dict) or type(row.get('index', 0)) is not int:
            raise ValueError('queue_task_summary_invalid')
        result.append({'chapter_id': _text(row.get('chapter_id', '')),
                       'name': _text(row.get('name', '')),
                       'task_type': _text(row.get('task_type', '')),
                       'index': max(0, row.get('index', 0)),
                       'finished': bool(row.get('finished', False) or row.get('isPassed')),
                       'server_done': bool(row.get('server_done', False) or row.get('isPassed')),
                       'local_done': bool(row.get('local_done', False)),
                       'completion_verified': row.get('completion_verified') is True})
    return result


class IntegrationState:
    def __init__(self, engine, store, *, model_types=None, video_module=None,
                 requests_module=None, instrument_video=True, preferences_path=None):
        self.engine, self.store = engine, store
        self.preferences_path = preferences_path
        self.lock = threading.RLock()
        self.revision = 0
        self.persistence_error = ''
        self.restored_count = 0
        self._restoring = False
        self._needs_load = []
        self._task_states = {}
        self._fresh_task_states = set()
        self._summaries = {}
        self._runner_observation = None
        self._homework_loads = set()
        self._video = {'active': False, 'queue_index': -1, 'chapter_id': '',
                       'task_index': -1, 'name': '', 'current_seconds': None,
                       'duration_seconds': None, 'percent': None, 'source': None,
                       'updated_at': None, 'beisu': None, 'auto_enabled': None,
                       'decision': 'unknown', 'decision_reason': 'not_started', 'policy_source': None}
        if model_types is None:
            models = importlib.import_module('core.models')
            queue_models = importlib.import_module('engine.models')
            taskpoint = importlib.import_module('core.taskpoint')
            model_types = {'Course': models.Course, 'TaskPoint': models.TaskPoint,
                           'QueueItem': queue_models.QueueItem, 'Chapter': taskpoint.Chapter}
        self.model_types = model_types
        self._original_emit = getattr(engine, '_emit_fn', lambda event: None)

        def emit(event):
            try:
                event = self.observe(event)
            except Exception as exc:
                self.persistence_error = type(exc).__name__
            return self._original_emit(event)
        engine._emit_fn = emit
        self._wrap_make_runner()
        self._wrap_chapter_cache()
        self._wrap_login()
        if instrument_video:
            self._install_video(video_module or importlib.import_module('core.video'),
                                requests_module or importlib.import_module('requests'))
        self.restore_queue()
        self._wrap_retry_items()

    def playback(self):
        value = self.store.get('config.beisu', 1)
        value = value if _number(value) is not None and 1 <= value <= 1000 else 1
        return {'beisu': value, 'applies': 'next_video'}

    def set_playback(self, value):
        if _number(value) is None or not 1 <= value <= 1000:
            raise ValueError('playback_invalid')
        self.store.set('config.beisu', value)
        self._changed()
        return self.playback()

    def _wrap_make_runner(self):
        original = getattr(self.engine, '_make_runner', None)
        if not callable(original):
            return
        @wraps(original)
        def make_runner(*args, **kwargs):
            adjusted = []
            points = kwargs.get('points', args[2] if len(args) > 2 else None)
            if self._force_optional_quizzes() and points:
                prepared = []
                for task in points:
                    extra = getattr(task, 'extra', {}) or {}
                    if (getattr(task, 'task_type', '') in _QUIZ and extra.get('is_job') is False
                            and not extra.get('isPassed') and extra.get('completion_verified') is not True
                            and not getattr(task, 'server_done', False) and getattr(task, 'finished', False)):
                        current = copy(task)
                        current.finished = False
                        adjusted.append((task, current))
                        prepared.append(current)
                    else:
                        prepared.append(task)
                if adjusted:
                    if 'points' in kwargs:
                        kwargs = dict(kwargs, points=prepared)
                    else:
                        args = (*args[:2], prepared, *args[3:])
            runner = original(*args, **kwargs)
            if adjusted:
                original_run = runner.run
                @wraps(original_run)
                def run(*run_args, **run_kwargs):
                    try:
                        return original_run(*run_args, **run_kwargs)
                    finally:
                        # Only confirmed completion travels back to the cache
                        # source. Parser flags and video objects stay unchanged.
                        for source, prepared in adjusted:
                            if (getattr(prepared, 'extra', {}) or {}).get('completion_verified') is True:
                                source.extra = dict(getattr(source, 'extra', {}) or {}, completion_verified=True)
                runner.run = run
            runner._integration_state_adapter = self
            item = kwargs.get('item', args[0] if args else None)
            if isinstance(getattr(runner, 'context', None), dict) and getattr(item, 'course', None):
                runner.context['course_name'] = _text(getattr(item.course, 'name', ''), 500)
            index = kwargs.get('index', args[1] if len(args) > 1 else None)
            state_key = kwargs.get('state_key', args[3] if len(args) > 3 else '')
            homework = (_mode(getattr(item, 'mode', 'task')) == 'homework'
                        or isinstance(state_key, str) and state_key.endswith('|homework'))
            self._runner_observation = (runner, item, index, homework)
            return runner
        self.engine._make_runner = make_runner

    def _force_optional_quizzes(self):
        policy = self.store.get('config.fusion_answer_policy', {}) or {}
        settings = policy.get('settings') if isinstance(policy, dict) else None
        return isinstance(settings, dict) and bool(settings.get('work-when-no-job'))

    def _retry_chapters(self, item):
        if _mode(getattr(item, 'mode', 'task')) == 'homework':
            return {}
        key = _item_key(item)
        with self.lock:
            states = dict(self._task_states.get(key, {}))
            fresh_states = set(self._fresh_task_states)
            summary = self._summaries.get(key, {})
            groups = dict(summary.get('chapter_points', {}))
            loaded = set(groups)
            for row in summary.get('tasks', []):
                cid = row.get('chapter_id', '')
                if cid and cid not in loaded:
                    groups.setdefault(cid, []).append(row)
        reasons = {}
        for task_key, status in states.items():
            if status in ('partial', 'failed'):
                cid = task_key.rsplit(':', 1)[0]
                if cid != 'homework':
                    reasons[cid] = 'failed' if status == 'failed' else reasons.get(cid, 'partial')
        if self._force_optional_quizzes():
            for cid, points in (getattr(item, 'chapter_points', {}) or {}).items():
                rows = []
                for task in points:
                    row = _task_row(task)
                    # The original parser marks optional quizzes finished before
                    # execution. Only explicit platform/confirmation evidence can
                    # exclude these from a user-requested forced quiz run.
                    if (row['task_type'] in _QUIZ and
                            (getattr(task, 'extra', {}) or {}).get('is_job') is False):
                        row['finished'] = False
                    rows.append(row)
                groups[str(cid)] = rows
            cache = self.store.get('engine.chapter_cache.' + key[0] + '.' + key[1], {})
            if isinstance(cache, dict):
                for cid, rows in cache.items():
                    if cid not in groups and isinstance(rows, list):
                        groups[str(cid)] = rows
            for cid, rows in groups.items():
                for i, row in enumerate(rows):
                    if not isinstance(row, dict) or row.get('task_type', row.get('type')) not in _QUIZ:
                        continue
                    task_key = str(cid) + ':' + str(row.get('index', i))
                    if (row.get('completion_verified') is False and not
                            _row_complete(row, states.get(task_key), fresh=(key, task_key) in fresh_states)):
                        reasons.setdefault(str(cid), 'pending')
        return reasons

    def _wrap_retry_items(self):
        for item in self.engine.queue:
            original = getattr(item, 'todo_chapters', None)
            if not callable(original) or getattr(original, '_integration_retry', False):
                continue
            @wraps(original)
            def todo_chapters(*args, _item=item, _original=original, **kwargs):
                normal = _original(*args, **kwargs)
                retry = self._retry_chapters(_item)
                if not retry:
                    return normal
                wanted = {_text(getattr(chapter, 'chapter_id', '')) for chapter in normal} | set(retry)
                return [chapter for chapter in _item.chapters if _text(getattr(chapter, 'chapter_id', '')) in wanted]
            todo_chapters._integration_retry = True
            item.todo_chapters = todo_chapters

    def _reconcile_completion(self, item):
        retry = self._retry_chapters(item)
        chapter_states = getattr(item, 'chapter_state', {}) or {}
        for cid, status in retry.items():
            if chapter_states.get(cid) == 'done':
                chapter_states[cid] = status
        with self.lock:
            states = dict(self._task_states.get(_item_key(item), {}))
        negative = any(status in ('partial', 'failed') for status in states.values())
        if item.status == 'done' and (negative or retry):
            item.status = 'partial' if negative else 'ready'

    def _wrap_login(self):
        for name in ('login', 'restore'):
            original = getattr(self.engine, name, None)
            if not callable(original):
                continue
            def wrapped(*args, _original=original, **kwargs):
                result = _original(*args, **kwargs)
                self._after_login()
                return result
            setattr(self.engine, name, wraps(original)(wrapped))

    def _wrap_chapter_cache(self):
        original = getattr(self.engine, 'cache_chapter_points', None)
        if not callable(original):
            return
        @wraps(original)
        def cache_points(*args, **kwargs):
            result = original(*args, **kwargs)
            item = kwargs.get('item', args[0] if args else None)
            cid = kwargs.get('cid', kwargs.get('chapter_id', args[1] if len(args) > 1 else None))
            points = kwargs.get('points', args[2] if len(args) > 2 else None)
            try:
                key = _item_key(item)
                cache_key = 'engine.chapter_cache.' + key[0] + '.' + key[1]
                saved = self.store.get(cache_key, {})
                if not isinstance(saved, dict) or not isinstance(saved.get(str(cid)), list):
                    return result
                cache = dict(saved)
                rows = [dict(row) for row in saved[str(cid)]]
                states = self._task_states.get(key, {})
                for i, task in enumerate(points or []):
                    if i >= len(rows):
                        break
                    row = _task_row(task)
                    rows[i]['completion_verified'] = row['completion_verified']
                    rows[i]['server_done'] = row['server_done']
                    status = states.get(str(cid) + ':' + str(row['index']))
                    if status:
                        rows[i]['status'] = status
                cache[str(cid)] = rows
                self.store.set(cache_key, cache)
            except Exception as exc:
                self.persistence_error = type(exc).__name__
            return result
        self.engine.cache_chapter_points = cache_points

    def _after_login(self):
        if not bool(getattr(self.engine, 'logged_in', False)):
            return
        pending, self._needs_load = self._needs_load, []
        for item in pending:
            if item not in self.engine.queue:
                continue
            # Loading prepares data; it never invokes start_run or a runner.
            item.status = 'loading'
            if _item_key(item)[3] != 'task':
                self._homework_loads.add(_item_key(item))
            try:
                self.engine.request_load(item)
            except Exception:
                item.status = 'failed'
                self.persistence_error = 'queue_reload_failed'
        self._changed()

    def _encode_item(self, item):
        key = _item_key(item)
        mode = key[3]
        rows = [(_homework_row(t, i) if mode == 'homework' else _task_row(t))
                for i, t in enumerate(getattr(item, 'tasks', []))]
        homeworks = [_homework_row(t, i) for i, t in enumerate(getattr(item, 'homeworks', []) or [])]
        points = {str(cid): [_task_row(t) for t in tasks]
                  for cid, tasks in (getattr(item, 'chapter_points', {}) or {}).items()}
        if not rows and key in self._summaries:
            rows = self._summaries[key].get('tasks', [])
        if not points and key in self._summaries:
            points = self._summaries[key].get('chapter_points', {})
        if not homeworks and key in self._summaries:
            homeworks = self._summaries[key].get('homeworks', [])
        return {'course': _plain(item.course), 'chapter_id': key[2],
                'mode': mode, 'lazy': bool(item.lazy), 'status': _state(item.status),
                'chapters': _plain(getattr(item, 'chapters', [])),
                'chapter_state': {str(k): _state(v) for k, v in
                                  (getattr(item, 'chapter_state', {}) or {}).items()},
                'tasks': rows, 'chapter_points': points, 'homeworks': homeworks,
                'task_states': self._task_states.get(key, {}),
                'current_chapter_id': _text(getattr(item, 'current_chapter_id', '')),
                'face_check': bool(getattr(item, 'face_check', False)),
                'face_unlocked': bool(getattr(item, 'face_unlocked', False)),
                'course_ended': bool(getattr(item, 'course_ended', False)),
                'course_note': _text(getattr(item, 'course_note', '')),
                'empty_reason': _text(getattr(item, 'empty_reason', '')),
                'error': _text(getattr(item, 'error', ''))}

    def save_queue(self):
        with self.lock:
            if self._restoring:
                return
            try:
                if len(self.engine.queue) > MAX_QUEUE_ITEMS:
                    raise ValueError('queue_item_limit')
                payload = {'schema': QUEUE_SCHEMA, 'updated_at': int(time.time() * 1000),
                           'items': [self._encode_item(item) for item in self.engine.queue]}
                encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False,
                                     separators=(',', ':')).encode('utf-8')
                if len(encoded) > MAX_QUEUE_BYTES:
                    raise ValueError('queue_byte_limit')
                self.store.set(QUEUE_KEY, payload)
                self.persistence_error = ''
            except Exception as exc:
                self.persistence_error = str(exc) if isinstance(exc, ValueError) else type(exc).__name__

    def restore_queue(self):
        with self.lock:
            if self.engine.queue:
                return
            payload = self.store.get(QUEUE_KEY)
            if payload is None:
                return
            try:
                raw = json.dumps(payload, ensure_ascii=False, allow_nan=False,
                                 separators=(',', ':')).encode('utf-8')
                if len(raw) > MAX_QUEUE_BYTES or not isinstance(payload, dict) or payload.get('schema') != QUEUE_SCHEMA:
                    raise ValueError('queue_snapshot_invalid')
                items = payload.get('items')
                if not isinstance(items, list) or len(items) > MAX_QUEUE_ITEMS:
                    raise ValueError('queue_snapshot_invalid')
                restored, states, summaries = [], {}, {}
                seen = set()
                for saved in items:
                    saved = _plain(saved)
                    if not isinstance(saved, dict) or type(saved.get('lazy')) is not bool:
                        raise ValueError('queue_item_invalid')
                    mode = saved.get('mode', 'task')
                    if mode not in ('task', 'homework', 'both'):
                        raise ValueError('queue_mode_invalid')
                    course = _construct(self.model_types['Course'], saved.get('course'))
                    if not _text(course.course_id) or not _text(course.clazz_id):
                        raise ValueError('queue_course_identity_invalid')
                    chapters = saved.get('chapters', [])
                    if not isinstance(chapters, list) or len(chapters) > MAX_ROWS:
                        raise ValueError('queue_chapters_invalid')
                    item = _construct(self.model_types['QueueItem'], dict(
                        course=course, chapter_id=_text(saved.get('chapter_id', '0')) or '0', mode=mode,
                        lazy=saved['lazy'], status=_state(saved.get('status'), restored=True),
                        chapters=[_construct(self.model_types['Chapter'], c) for c in chapters],
                        chapter_state={str(k): _state(v, restored=True) for k, v in
                                       saved.get('chapter_state', {}).items()},
                        face_check=bool(saved.get('face_check')), face_unlocked=bool(saved.get('face_unlocked')),
                        course_ended=bool(saved.get('course_ended')),
                        course_note=_text(saved.get('course_note', '')),
                        empty_reason=_text(saved.get('empty_reason', '')), error=_text(saved.get('error', ''))))
                    key = _item_key(item)
                    if key in seen:
                        raise ValueError('queue_duplicate_identity')
                    seen.add(key)
                    states[key] = {str(k): _state(v, restored=True) for k, v in saved.get('task_states', {}).items()}
                    points = saved.get('chapter_points', {})
                    if not isinstance(points, dict):
                        raise ValueError('queue_chapter_points_invalid')
                    summaries[key] = {'tasks': _summary_rows(saved.get('tasks', [])),
                                      'chapter_points': {str(cid): _summary_rows(rows) for cid, rows in points.items()},
                                      'homeworks': _summary_rows(saved.get('homeworks', []))}
                    restored.append(item)
                self._restoring = True
                self._task_states, self._summaries = states, summaries
                self.engine.queue[:] = restored
                self.restored_count = len(restored)
                # Cached summaries serve the original chapters endpoint without
                # restoring stale executable protocol payloads or credentials.
                for item in restored:
                    key = _item_key(item)
                    cache = self.store.get('engine.chapter_cache.' + key[0] + '.' + key[1], {})
                    cache = dict(cache) if isinstance(cache, dict) else {}
                    for cid, rows in summaries[key]['chapter_points'].items():
                        cache[str(cid)] = [{'name': _text(r.get('name', '')),
                                           'type': _text(r.get('task_type', '')),
                                           'done': _row_complete(r, states[key].get(str(cid) + ':' + str(r.get('index', 0)))),
                                           'status': states[key].get(str(cid) + ':' + str(r.get('index', 0)), 'pending'),
                                           'server_done': bool(r.get('server_done')),
                                           'completion_verified': r.get('completion_verified') is True} for r in rows]
                    if cache:
                        self.store.set('engine.chapter_cache.' + key[0] + '.' + key[1], cache)
                    if key[3] != 'task' or not item.lazy and item.status != 'done':
                        self._needs_load.append(item)
                self.persistence_error = ''
            except Exception as exc:
                self.persistence_error = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
            finally:
                self._restoring = False
            self._after_login()

    def observe(self, event):
        if not isinstance(event, dict):
            return event
        kind, payload = event.get('type'), event.get('payload') or {}
        if kind in ('queue.changed', 'queue.item', 'run.done'):
            self._wrap_retry_items()
        if kind == 'task.event':
            if str(payload.get('message', '')).startswith('待人工处理：'):
                payload = dict(payload, status='manual')
                event = dict(event, payload=payload)
            index = payload.get('queue_index')
            if type(index) is int and 0 <= index < len(self.engine.queue):
                item = self.engine.queue[index]
                key = _item_key(item)
                observed = self._runner_observation
                homework = key[3] == 'homework' or (
                    observed is not None and observed[1] is item and observed[2] == index
                    and observed[0] is getattr(self.engine, '_runner', None) and observed[3])
                if homework:
                    payload = dict(payload, chapter_id='homework', integration_phase='homework')
                    event = dict(event, payload=payload)
                task_index = payload.get('index')
                if type(task_index) is int and task_index >= 0:
                    with self.lock:
                        rows = self._task_states.setdefault(key, {})
                        if len(rows) < MAX_ROWS:
                            task_key = _text(payload.get('chapter_id', '')) + ':' + str(task_index)
                            rows[task_key] = _state(payload.get('status'))
                            self._fresh_task_states.add((key, task_key))
        elif kind == 'queue.item':
            index = payload.get('index')
            if type(index) is int and 0 <= index < len(self.engine.queue):
                item = self.engine.queue[index]
                key = _item_key(item)
                if key[3] != 'task' and item.status == 'loading':
                    self._homework_loads.add(key)
                elif key in self._homework_loads:
                    self._homework_loads.discard(key)
                    summary = self._summaries.get(key, {})
                    summary.pop('homeworks', None)
                    if key[3] == 'homework':
                        summary.pop('tasks', None)
                    states = self._task_states.get(key, {})
                    for task_key in list(states):
                        if task_key.startswith('homework:'):
                            del states[task_key]
                self._reconcile_completion(item)
                if isinstance(payload.get('item'), dict):
                    event = dict(event, payload=dict(payload, item=dict(payload['item'], status=item.status)))
                elif 'status' in payload:
                    event = dict(event, payload=dict(payload, status=item.status))
        if kind in ('queue.changed', 'run.done'):
            for item in self.engine.queue:
                self._reconcile_completion(item)
        if kind in ('queue.changed', 'queue.item', 'task.event', 'run.done'):
            self.save_queue()
            with self.lock:
                self.revision += 1
        return event

    def _homework_rows(self, item, key):
        field = 'tasks' if key[3] == 'homework' else 'homeworks'
        tasks = [_homework_row(task, i) for i, task in enumerate(getattr(item, field, []) or [])]
        if key[3] == 'homework' and hasattr(item, '_fusion_homework_loaded'):
            return tasks
        return tasks or self._summaries.get(key, {}).get(field, [])

    def _homework_counts(self, item, key):
        if key[3] == 'homework' and getattr(item, '_fusion_homework_loaded', None) is False:
            return None
        rows = self._homework_rows(item, key)
        if not rows:
            if key[3] == 'homework' and getattr(item, '_fusion_homework_loaded', False):
                return 0, 0
            # An empty list also occurs before load or after a swallowed upstream
            # load failure; it does not establish that the course has no homework.
            return None
        states = self._task_states.get(key, {})
        return len(rows), sum(_row_complete(row, states.get('homework:' + str(i)),
                                           fresh=(key, 'homework:' + str(i)) in self._fresh_task_states)
                              for i, row in enumerate(rows))

    def homework_tasks(self, index):
        if type(index) is not int or not 0 <= index < len(self.engine.queue):
            raise IndexError('queue_item_unavailable')
        with self.lock:
            item = self.engine.queue[index]
            key = _item_key(item)
            if key[3] != 'both':
                return {'mode': key[3], 'tasks': []}
            tasks = self._homework_rows(item, key)
            states = self._task_states.get(key, {})
            rows = []
            for i, task in enumerate(tasks):
                status = states.get('homework:' + str(i), 'done' if task.get('finished') else 'pending')
                rows.append({'chapter_id': 'homework', 'index': i, 'name': _text(task.get('name', '')),
                             'task_type': 'homework', 'finished': bool(task.get('finished')),
                             'server_done': bool(task.get('server_done')),
                             'completion_verified': task.get('completion_verified') is True,
                             'status': 'pending' if status in ('ready', 'loading') else _state(status)})
            return {'mode': key[3], 'tasks': rows}

    def _queue_progress(self):
        total, done, complete, courses, courses_done = 0, 0, True, 0, 0
        for item in list(self.engine.queue):
            if getattr(item, '_fusion_pending_removal', False):continue
            courses += 1
            item_total, item_done, item_known = 0, 0, True
            key = _item_key(item)
            states = self._task_states.get(key, {})
            if key[3] == 'homework':
                counts = self._homework_counts(item, key)
                if counts is None:
                    item_known = False
                else:
                    item_total, item_done = counts
            elif getattr(item, 'chapters', None):
                chapters = item.chapters
                for chapter in chapters:
                    jobcount = getattr(chapter, 'jobcount', None)
                    if _number(jobcount) is None:
                        item_known = False
                        continue
                    count = _count(jobcount)
                    cid = _text(getattr(chapter, 'chapter_id', ''))
                    finished = min(count, _count(getattr(chapter, 'finishcount', 0)))
                    rows = (getattr(item, 'chapter_points', {}) or {}).get(cid)
                    if rows is None:
                        rows = self._summaries.get(key, {}).get('chapter_points', {}).get(cid)
                    observed = {}
                    if rows is not None:
                        for i, task in enumerate(rows):
                            row = task if isinstance(task, dict) else _task_row(task)
                            task_key = cid + ':' + str(row.get('index', i))
                            observed[task_key] = _row_complete(row, states.get(task_key),
                                                               fresh=(key, task_key) in self._fresh_task_states)
                    for task_key, status in states.items():
                        if task_key.startswith(cid + ':') and task_key not in observed:
                            observed[task_key] = status == 'server_done' or status == 'ok' and (key, task_key) in self._fresh_task_states
                    known = sum(observed.values())
                    # Optional/forced attachments can outnumber catalogue jobs.
                    # Keep every observed child in the denominator so a partial
                    # child cannot disappear behind a smaller catalogue total.
                    count = max(count, len(observed))
                    # Catalogue totals can cover unloaded tasks, but cannot
                    # overwrite a loaded child or an explicit partial/failed event.
                    finished = min(count, max(known, min(finished, max(0, count - (len(observed) - known)))))
                    item_total += count
                    item_done += finished
            elif not item.lazy and getattr(item, 'tasks', None):
                tasks = item.tasks
                item_total += len(tasks)
                for i, task in enumerate(tasks):
                    row = _task_row(task)
                    task_key = row['chapter_id'] + ':' + str(row.get('index', i))
                    item_done += _row_complete(row, states.get(task_key), fresh=(key, task_key) in self._fresh_task_states)
            else:
                item_known = False
            if key[3] == 'both':
                counts = self._homework_counts(item, key)
                if counts is None:
                    item_known = False
                else:
                    item_total += counts[0]
                    item_done += counts[1]
            total += item_total
            done += item_done
            complete = complete and item_known
            if item_known and item_total == item_done:
                courses_done += 1
        course_counts_complete = complete
        ready = not self._needs_load and not any(item.status == 'loading' for item in self.engine.queue)
        return {'course_total': courses, 'course_done': courses_done if course_counts_complete else None,
                'course_counts_complete': course_counts_complete,
                'course_percent': (round(courses_done * 100 / courses, 2) if courses else 0)
                                  if course_counts_complete else None,
                'task_total': total if complete else None, 'task_done': done,
                'task_percent': round(done * 100 / total, 2) if complete and total else None,
                'task_counts_complete': complete, 'task_progress_source': 'chapter_catalog_and_homework_events',
                'restore_ready': ready, 'restored_count': self.restored_count,
                'persistence_error': self.persistence_error}

    def monitor_progress(self):
        with self.lock:
            return {'revision': self.revision, 'video': dict(self._video),
                    'queue': self._queue_progress(), 'playback': self.playback()}

    def _changed(self):
        with self.lock:
            self.revision += 1
            payload = self.monitor_progress()
        try:
            self._original_emit({'type': 'integration.progress', 'payload': payload})
        except Exception:
            pass

    def _duration(self, duration):
        duration = _number(duration)
        if duration is None or duration <= 0:
            return
        with self.lock:
            self._video['duration_seconds'] = duration
            if self._video['current_seconds'] is None:
                self._video['source'] = 'video_metadata'
        self._changed()

    def _report(self, request, response):
        status = _number(getattr(response, 'status_code', None))
        if status is None or not 200 <= status < 300:
            return
        try:
            query = parse_qs(urlsplit(request.url).query)
            if not all(k in query for k in ('playingTime', 'duration', 'objectId', 'jobid')):
                return
            seconds, duration = float(query['playingTime'][0]), float(query['duration'][0])
            if not math.isfinite(seconds) or not math.isfinite(duration) or seconds < 0 or duration <= 0:
                return
        except (AttributeError, TypeError, ValueError, IndexError):
            return
        with self.lock:
            self._video.update(current_seconds=seconds, duration_seconds=duration,
                               percent=round(min(100, seconds * 100 / duration), 2),
                               source='video_report_response', updated_at=int(time.time() * 1000))
        self._changed()

    @staticmethod
    def _install_video(video, requests):
        if not getattr(video.VideoExecutor.execute, '_integration_observer', False):
            original = video.VideoExecutor.execute
            @wraps(original)
            def execute(executor, task, runner, _execute=original):
                adapter = getattr(runner, '_integration_state_adapter', None)
                if adapter is None:
                    return _execute(executor, task, runner)
                beisu = adapter.playback()['beisu']
                selection = {'beisu': beisu, 'auto_enabled': False, 'decision': 'manual',
                             'decision_reason': 'legacy_manual', 'policy_source': None}
                if adapter.preferences_path is not None:
                    try:
                        from video_speed_policy import select_speed, log_message
                        selection = select_speed(task, beisu, adapter.preferences_path)
                        message = log_message(selection)
                    except Exception:
                        selection = {'beisu': 1, 'auto_enabled': True, 'decision': 'unknown',
                                     'decision_reason': 'policy_unavailable', 'policy_source': None}
                        message = '自动倍速：无法确认平台倍速许可，本视频保守使用 1x。'
                    logger = getattr(video, 'log', logging.getLogger(__name__))
                    try:
                        logger.info(message)
                    except Exception:
                        pass
                beisu = selection['beisu']
                runner.context['beisu'] = beisu
                previous = getattr(_LOCAL, 'video', None)
                _LOCAL.video = adapter
                with adapter.lock:
                    adapter._video.update(active=True, queue_index=getattr(adapter.engine, '_active_index', -1),
                                          chapter_id=_text(getattr(task, 'chapter_id', '') or getattr(adapter.engine, '_active_chapter', '')),
                                          task_index=getattr(runner, 'current_index', getattr(task, 'index', -1)),
                                          name=_text(getattr(task, 'name', '')), current_seconds=None,
                                          duration_seconds=None, percent=None, source=None,
                                          updated_at=int(time.time() * 1000), **selection)
                adapter._changed()
                try:
                    return _execute(executor, task, runner)
                finally:
                    with adapter.lock:
                        adapter._video['active'] = False
                    _LOCAL.video = previous
                    adapter._changed()
            execute._integration_observer = True
            video.VideoExecutor.execute = execute
        for name in ('get_video_info', 'build_progress_urls'):
            original = getattr(video, name, None)
            if not callable(original) or getattr(original, '_integration_observer', False):
                continue
            def observed(*args, _original=original, _name=name, **kwargs):
                result = _original(*args, **kwargs)
                adapter = getattr(_LOCAL, 'video', None)
                if adapter is not None:
                    try:
                        adapter._duration(getattr(result, 'duration', None) if _name == 'get_video_info' else kwargs.get('duration'))
                    except Exception:
                        pass
                return result
            observed = wraps(original)(observed)
            observed._integration_observer = True
            setattr(video, name, observed)
        session_type = requests.sessions.Session
        if not getattr(session_type.send, '_integration_observer', False):
            original_send = session_type.send
            @wraps(original_send)
            def send(session, request, **kwargs):
                response = original_send(session, request, **kwargs)
                adapter = getattr(_LOCAL, 'video', None)
                if adapter is not None:
                    try:
                        adapter._report(request, response)
                    except Exception:
                        pass
                return response
            send._integration_observer = True
            session_type.send = send


def install(engine, store, *, model_types=None, video_module=None,
            requests_module=None, instrument_video=True, preferences_path=None):
    existing = getattr(engine, '_integration_state_adapter', None)
    if existing is not None:
        if preferences_path is not None:
            existing.preferences_path = preferences_path
        return existing
    state = IntegrationState(engine, store, model_types=model_types,
                             video_module=video_module, requests_module=requests_module,
                             instrument_video=instrument_video, preferences_path=preferences_path)
    engine._integration_state_adapter = state
    return state
