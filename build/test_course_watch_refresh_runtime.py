"""Reopened exact chapter refreshes stale rows using the real shipped loader/runner.

All catalogue acquisition and task execution use synthetic data. No credentials,
course submissions or external connections are permitted.
"""
from pathlib import Path
from types import SimpleNamespace
import json
import os
import socket
import sys
import tempfile

SOURCE = Path(os.environ.get('XBT_SOURCE_ROOT', Path(__file__).resolve().parents[1]))
RUNTIME = Path(os.environ['XBT_RUNTIME_ROOT']) / 'star-runtime'
RECORD = Path(tempfile.mkdtemp(prefix='course-watch-refresh-', dir=os.environ['XBT_QA_ROOT']))
os.chdir(RECORD)
sys.path[:0] = [str(SOURCE / 'src/fusion'), str(RUNTIME)]
HANDLES = [os.add_dll_directory(str(p)) for p in {RUNTIME, *[x.parent for x in RUNTIME.rglob('*.pyd')]}]


def blocked(*args, **kwargs):
    raise AssertionError('runtime fixture forbids network')


socket.socket.connect = blocked
socket.socket.connect_ex = blocked
socket.create_connection = blocked
import core.paths
core.paths.user_data_dir = lambda: RECORD
from core.storage import KeyValueStore
from core.models import Course, TaskPoint
from core.taskpoint import Chapter, TaskPointFetchResult
from core.scheduler import TaskResult
from engine.models import QueueItem
from engine.app import AppEngine
import engine.app as runtime_app
from integration_state import IntegrationState
from queue_prune import install as install_queue_prune
from course_watch import CourseWatch

store = KeyValueStore(RECORD / 'store.json')
store.set('config.max_retry', 0)
store.set('task.progress.other-course', {'0': {'state': 'done', 'fixture': 'preserve'}})
events, requests, executed = [], [], []
engine = AppEngine(store=store, emit=events.append, base_dir=RECORD)
engine.session = SimpleNamespace()
engine.user = SimpleNamespace(uid='synthetic', name='Synthetic', fid='0')
course = Course(course_id='11', clazz_id='12', name='Synthetic reopening course')
engine.courses = [course]
existing = QueueItem(course=course, chapter_id='101', lazy=False, status='done')
existing.tasks = [TaskPoint(chapter_id='101', index=0, name='Stale cached task', task_type='workid', finished=True)]
existing.tasks[0].extra['completion_verified'] = True
engine.queue.append(existing)
state = IntegrationState(engine, store, instrument_video=False)
install_queue_prune(engine, store, state)


def fresh_points(*args, **kwargs):
    assert kwargs.get('use_cache') is False, 'must bypass the prior task-point cache'
    assert kwargs['chapter_id'] == '101'
    requests.append({'chapter_id': kwargs['chapter_id'], 'use_cache': kwargs['use_cache']})
    return TaskPointFetchResult(
        points=[TaskPoint(chapter_id='101', index=1, name='Newly opened task', task_type='workid')],
        chapters=[Chapter(chapter_id='101', name='Synthetic chapter', jobcount=1, unfinishcount=1)])


def execute(task, runner):
    executed.append({'chapter_id': task.chapter_id, 'index': task.index, 'name': task.name})
    task.finished = True
    task.extra['completion_verified'] = True
    return TaskResult(success=True, finished=True, message='Synthetic confirmed task')


runtime_app.fetch_task_points_ex = fresh_points
runtime_app.extract_defaults = lambda *args, **kwargs: {}
runtime_app.default_executors = lambda *args, **kwargs: {'workid': SimpleNamespace(execute=execute)}
# A network visit is outside this regression's synthetic task execution scope.
engine._visit_empty_chapters_after_run = lambda *args, **kwargs: None
native_request_load = engine.request_load


def checked_request_load(item, **kwargs):
    assert item.status == 'loading', 'set loading before the asynchronous loader is scheduled'
    assert kwargs.get('force') is True
    return native_request_load(item, **kwargs)


engine.request_load = checked_request_load
watcher = CourseWatch(engine, store, reader=lambda *args: [
    {'chapter_id': '101', 'available': True, 'pending': True}])
result = {'passed': False, 'network': 'disabled'}
try:
    watcher.configure({'enabled': True, 'interval_seconds': 60,
                       'courses': [{'course_id': '11', 'clazz_id': '12'}]})
    watcher.tick()
    assert engine._run_worker is not None, watcher.snapshot()
    engine._run_worker.join(5)
    assert not engine._run_worker.is_alive(), 'runner failed to finish'
    assert requests == [{'chapter_id': '101', 'use_cache': False}], requests
    assert executed == [{'chapter_id': '101', 'index': 1, 'name': 'Newly opened task'}], executed
    assert engine.queue[0] is existing, 'refresh must preserve the queue object'
    assert existing.status == 'done', existing.status
    assert store.get('task.progress.other-course') == {'0': {'state': 'done', 'fixture': 'preserve'}}
    result.update(passed=True, freshRequests=requests, executedTasks=executed,
                  queueObjectPreserved=True, unrelatedProgressPreserved=True)
finally:
    watcher.close()
    engine.stop_and_wait(timeout=5)
    if engine._load_worker:
        engine._load_worker.join(5)
    (RECORD / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(dict(result, record=str(RECORD)), ensure_ascii=True))
