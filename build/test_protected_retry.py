"""Offline two-run regression against the shipped protected engine/scheduler.

Run using the isolated Python 3.14 runtime, with -I -S -B. Each case runs in a
fresh child process and an owned empty data directory. Network is disabled.
Only task acquisition and the executor factory are synthetic; start_run,
_run_loop, _run_lazy, _make_runner and TaskRunner execute their shipped code.
"""
from pathlib import Path
import argparse
import dataclasses
import json
import os
import socket
import subprocess
import sys
import tempfile
import traceback

SOURCE = Path(os.environ.get('XBT_SOURCE_ROOT', Path(__file__).resolve().parents[1])).resolve()
RECORD = Path(os.environ.get('XBT_QA_ROOT', SOURCE.parent)).resolve()
RUNTIME_ROOT = Path(os.environ.get('XBT_RUNTIME_ROOT', RECORD / '隔离应用')).resolve()
CASES = ('baseline_partial', 'fixed_partial', 'fixed_failed', 'fixed_completed',
         'migrated_forced', 'migrated_optional', 'migrated_completed', 'live_optional_forced',
         'cached_optional_partial', 'cached_optional_completed')


def run_case(name):
    runtime = RUNTIME_ROOT / 'star-runtime'
    if not runtime.is_dir() or not (SOURCE / 'src/fusion/integration_state.py').is_file():
        raise RuntimeError('Missing isolated runtime/source; set XBT_RUNTIME_ROOT and XBT_SOURCE_ROOT. '
                           'XBT_QA_ROOT selects the owned evidence directory.')
    probe_root = RECORD / 'engine-retry-probe'
    probe_root.mkdir(parents=True, exist_ok=True)
    data = Path(tempfile.mkdtemp(prefix=name + '-', dir=probe_root))
    os.chdir(data)
    sys.path[:0] = [str(SOURCE / 'src/fusion'), str(runtime)]
    dll_handles = [os.add_dll_directory(str(p)) for p in
                   {runtime, *[f.parent for f in runtime.rglob('*.pyd')]}]

    def blocked(*args, **kwargs):
        raise RuntimeError('Offline retry fixture: all network disabled')

    socket.socket.connect = blocked
    socket.socket.connect_ex = blocked
    socket.create_connection = blocked
    import core.paths
    core.paths.user_data_dir = lambda: data
    from core.log import setup_app_logging
    setup_app_logging(log_dir=data / 'logs', console=False)
    from core.models import Course, TaskPoint
    from core.storage import KeyValueStore
    from core.scheduler import TaskResult
    from core.taskpoint import Chapter
    from engine.app import AppEngine
    from engine.models import QueueItem
    from types import SimpleNamespace
    from integration_state import IntegrationState
    from answer_confirmation import migrate_unverified_cache

    migrated = name.startswith('migrated_')
    cached_optional = name.startswith('cached_optional_')
    optional = migrated or name == 'live_optional_forced' or cached_optional
    adapter = name != 'baseline_partial'
    force = optional and name != 'migrated_optional'
    completed = name in ('fixed_completed', 'migrated_completed', 'cached_optional_completed')
    store = KeyValueStore(data / 'store.json')
    store.set('config.fusion_answer_policy', {'settings': {'work-when-no-job': force}})
    store.set('config.max_retry', 0)
    events, calls, runner_keys = [], [], []
    course = Course(course_id='fixture-course', clazz_id='fixture-class')
    chapter = Chapter(chapter_id='fixture', name='Synthetic chapter', jobcount=1,
                      finishcount=1, unfinishcount=0)
    video = TaskPoint(chapter_id='fixture', name='Completed local video', task_type='video', index=0)
    quiz = TaskPoint(chapter_id='fixture', name='Synthetic saved quiz', task_type='workid',
                     index=1 if migrated else 0, finished=optional,
                     extra={'is_job': not optional})
    points = [video, quiz] if migrated else [quiz]
    old_history = {'0': {'state': 'done', 'fixture': 'video'},
                   '1': {'state': 'done', 'fixture': 'unverified quiz'}}
    progress_key = 'task.progress.fixture-course.fixture-class.fixture'
    if migrated:
        old_rows = [{'chapter_id': 'fixture', 'index': task.index, 'name': task.name,
                     'task_type': task.task_type, 'finished': True} for task in points]
        store.set('integration.queue', {'schema': 1, 'items': [{
            'course': dataclasses.asdict(course), 'chapter_id': '0', 'mode': 'task',
            'lazy': True, 'status': 'done', 'chapters': [dataclasses.asdict(chapter)],
            'chapter_state': {'fixture': 'done'}, 'tasks': old_rows,
            'chapter_points': {'fixture': old_rows}, 'task_states': {'fixture:0': 'ok', 'fixture:1': 'ok'}
        }]})
        store.set('engine.chapter_cache.fixture-course.fixture-class', {'fixture': [
            {'name': task.name, 'type': task.task_type, 'done': True} for task in points]})
        store.set('task.progress.fixture-history', old_history)
        store.set(progress_key, old_history)
        migrate_unverified_cache(store)
        assert store.get(progress_key) == old_history
    engine = AppEngine(store=store, emit=events.append, base_dir=data)
    if not migrated:
        engine.queue.append(QueueItem(course=course, chapter_id='0', lazy=True, status='ready',
                            chapters=[chapter], chapter_points={'fixture': points},
                            chapter_state={'fixture': 'pending'}, tasks=points))
    state = IntegrationState(engine, store, instrument_video=False) if adapter else None
    item = engine.queue[0]
    engine.session = SimpleNamespace()
    engine.user = SimpleNamespace(uid='offline-fixture', name='Synthetic fixture')
    if optional:
        from answer_policy import install
        install(store)
    out = {'case': name, 'data': str(data), 'rounds': [], 'initialTodo':
           [c.chapter_id for c in item.todo_chapters()], 'initialRunnable': engine.runnable_indexes()}
    if migrated:
        out['migration'] = {'snapshot': store.get('integration.queue'),
                            'cache': store.get('engine.chapter_cache.fixture-course.fixture-class'),
                            'historyUnchanged': store.get('task.progress.fixture-history') == old_history}
        assert out['migration']['historyUnchanged']
        assert out['migration']['cache']['fixture'][0]['done'] is True
        assert out['migration']['cache']['fixture'][1]['done'] is False

    def acquire(current, current_chapter):
        if optional and not cached_optional:
            from core.taskpoint import parse_task_points
            parsed = parse_task_points({'attachments': [{
                'type': 'workid', 'job': False, 'isPassed': False,
                'property': {'workid': 'fixture-work', 'title': 'Synthetic saved quiz'}
            }]}, chapter_id='fixture')
            assert len(parsed) == 1, parsed
            parsed[0].index = 1 if migrated else 0
            points[-1] = parsed[0]
        current.chapter_points['fixture'] = points
        return points

    def execute(task, runner):
        calls.append(task.task_type)
        if completed:
            task.extra['completion_verified'] = True
            task.finished = True
        return TaskResult(success=name != 'fixed_failed', finished=completed,
                          message='Synthetic confirmed' if completed else 'Synthetic saved; not submitted')

    engine.ensure_chapter_points = acquire
    executor = SimpleNamespace(execute=execute)
    executors = {'workid': executor, 'video': executor}
    context = {'course_id': 'fixture-course', 'clazz_id': 'fixture-class'}
    # The factory normally constructs network executors. Keep all subsequent
    # chapter selection, progress, result and lifecycle code unmodified.
    engine._run_one = lambda current, index, args: AppEngine._run_lazy(
        engine, current, index, executors, context, bool(args.get('ignore_progress')))
    make_runner = engine._make_runner

    def capture_runner(*args, **kwargs):
        key = kwargs.get('state_key', args[3] if len(args) > 3 else '')
        if migrated:
            assert key == progress_key
        runner_keys.append(key)
        runner = make_runner(*args, **kwargs)
        runner.max_retry = 0
        return runner

    engine._make_runner = capture_runner
    try:
        for number in (1, 2):
            before = len(calls)
            event_start = len(events)
            runnable = engine.runnable_indexes()
            if runnable:
                engine.start_run({'ignore_progress': not optional and number == 1})
                worker = engine._run_worker
                if worker:
                    worker.join(5)
                    if worker.is_alive():
                        engine.stop_and_wait()
                        raise RuntimeError('Protected run loop timeout')
            out['rounds'].append({'round': number, 'started': bool(runnable),
                'quizCalls': calls[before:].count('workid'), 'videoCalls': calls[before:].count('video'),
                'itemStatus': item.status, 'chapterState': dict(item.chapter_state),
                'todo': [c.chapter_id for c in item.todo_chapters()],
                'taskEvents': [e['payload'].get('status') for e in events[event_start:]
                               if e.get('type') == 'task.event'],
                'progress': state._queue_progress() if state else None})
        expected = [1, 0] if name == 'baseline_partial' or completed else (
                   [0, 0] if name == 'migrated_optional' else [1, 1])
        assert [row['quizCalls'] for row in out['rounds']] == expected, out['rounds']
        assert not any(row['videoCalls'] for row in out['rounds']), out['rounds']
        if name == 'fixed_partial':
            assert all(row['itemStatus'] == 'partial' and row['chapterState']['fixture'] == 'partial'
                       for row in out['rounds']), out['rounds']
        if completed:
            assert out['rounds'][-1]['itemStatus'] == 'done', out['rounds']
        if cached_optional:
            assert quiz.finished is True, 'Runner normalization must use a copy'
            assert bool(quiz.extra.get('completion_verified')) == completed
        if migrated:
            assert store.get('task.progress.fixture-history') == old_history
            assert all(store.get(key)['0'] == old_history['0'] for key in runner_keys)
        out['passed'] = True
    except Exception as exc:
        out['passed'] = False
        out['error'] = type(exc).__name__ + ': ' + str(exc)
        out['traceback'] = traceback.format_exc()
    finally:
        out['executorCalls'] = {'quiz': calls.count('workid'), 'video': calls.count('video')}
        out['runnerKeys'] = runner_keys
        out['events'] = events
        if state:
            out['persistenceError'] = state.persistence_error
        result = data / 'result.json'
        result.write_text(json.dumps(out, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        print(json.dumps({'case': name, 'passed': out.get('passed', False), 'result': str(result),
                          'roundCalls': [r['quizCalls'] for r in out['rounds']],
                          'videoCalls': calls.count('video'), 'error': out.get('error', '')}, ensure_ascii=False))
    return 0 if out.get('passed') else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--case', choices=CASES)
    args = parser.parse_args()
    if args.case:
        return run_case(args.case)
    rows = []
    for name in CASES:
        child = subprocess.run([sys.executable, '-I', '-S', '-B', '-X', 'utf8',
                                str(Path(__file__).resolve()), '--case', name],
                               capture_output=True, text=True, encoding='utf-8', timeout=30)
        try:
            row = json.loads(child.stdout.strip().splitlines()[-1])
        except (ValueError, IndexError):
            row = {'case': name, 'passed': False, 'error': child.stderr[-2000:]}
        rows.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
    (RECORD / 'engine-retry-probe' / 'suite-result.json').write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
    return 0 if all(row['passed'] for row in rows) else 1


if __name__ == '__main__':
    raise SystemExit(main())
