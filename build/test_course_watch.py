"""Deterministic monitor transitions; no network, coursework or user profiles."""
from pathlib import Path
import sys
import threading
import types
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src/fusion'))
from course_watch import CourseWatch, MonitorBlocked, CONFIG, SEEN, SUSPENDED, normalize, read_course


class Store(dict):
    def set(self, key, value):
        self[key] = value


class Engine:
    def __init__(self, store):
        self.store, self.logged_in, self.is_running = store, True, True
        self.course = types.SimpleNamespace(course_id='1', clazz_id='2', cpi='3')
        self.queue = [types.SimpleNamespace(course=self.course, chapter_id='0', status='running')]
        self.calls, self.events = [], []
        self.stops = True
    def emit(self, event):
        self.events.append(event)
    def find_course(self, *_):
        return self.course
    def queue_add(self, course, chapter_id, mode):
        self.calls.append('add:' + chapter_id)
        item = types.SimpleNamespace(course=course, chapter_id=chapter_id, status='ready')
        self.queue.append(item)
        return item
    def queue_remove(self, index):
        self.queue.pop(index)
    def request_load(self, item, *, force=False):
        assert force and item.status == 'loading'
        self.calls.append('reload:' + item.chapter_id)
        item.status = 'ready'
    def queue_move(self, index, offset):
        self.calls.append('move')
        self.queue.insert(index + offset, self.queue.pop(index))
    def stop(self):
        self.calls.append('stop')
    def pause(self):
        self.calls.append('pause')
    def resume(self):
        self.calls.append('resume')
    def stop_and_wait(self, **_):
        self.stop()
        if self.stops:
            self.is_running = False
        return self.stops
    def start_run(self, options):
        assert not self.is_running, 'must not create two workers'
        self.calls.append(('start', options))
        self.is_running = True


class WatchTests(unittest.TestCase):
    def make(self, rows=None):
        store = Store({CONFIG: {'enabled': True, 'interval_seconds': 60,
            'courses': [{'course_id': '1', 'clazz_id': '2'}]}})
        engine = Engine(store)
        clock = [100]
        self.rows = rows if rows is not None else [{'chapter_id': '4', 'available': True, 'pending': True}]
        watcher = CourseWatch(engine, store, reader=lambda *_: self.rows, clock=lambda: clock[0])
        return watcher, engine, store, clock

    def test_strict_config(self):
        for value in ({'enabled': True}, {'interval_seconds': True}, {'interval_seconds': 1},
                      {'courses': [{'course_id': '../bad', 'clazz_id': '2'}]}, {'courses': None}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize(value)
        self.assertEqual(normalize({})['interval_seconds'], 300)

    def test_opening_stops_joins_prioritizes_and_preserves_original(self):
        watch, engine, store, _ = self.make()
        original = engine.queue[0]
        watch.tick()
        self.assertEqual(engine.calls[:3], ['stop', 'add:4', 'move'])
        self.assertIs(engine.queue[1], original)
        self.assertEqual(engine.calls[-1][0], 'start')
        self.assertIs(engine.calls[-1][1]['ignore_progress'], False)
        self.assertEqual(store[SEEN], {'1:2:4': True})
        self.assertFalse(watch.suspended)

    def test_unknown_does_not_requeue_and_close_reopen_does(self):
        watch, engine, _, clock = self.make()
        watch.tick()
        count = len(engine.calls)
        self.rows = []; clock[0] += 61; watch.tick()
        self.rows = [{'chapter_id': '4', 'available': True, 'pending': True}]; clock[0] += 61; watch.tick()
        self.assertEqual(len(engine.calls), count)
        self.rows = [{'chapter_id': '4', 'available': False}]; clock[0] += 61; watch.tick()
        self.rows = [{'chapter_id': '4', 'available': True, 'pending': True}]; clock[0] += 61; watch.tick()
        self.assertEqual(len(engine.queue), 2)
        self.assertGreater(len(engine.calls), count)

    def test_failed_stop_never_reorders_or_starts(self):
        watch, engine, store, _ = self.make(); engine.stops = False
        watch.tick()
        self.assertEqual(engine.calls, ['stop'])
        self.assertTrue(watch.suspended)
        self.assertEqual(store.get(SEEN, {}), {})

    def test_current_chapter_already_running_is_not_restarted(self):
        watch, engine, store, _ = self.make()
        engine._active_index = 0
        engine.queue[0].current_chapter_id = '4'
        watch.tick()
        self.assertEqual(engine.calls, [])
        self.assertEqual(store[SEEN], {'1:2:4': True})

    def test_existing_completed_chapter_is_refreshed_before_start(self):
        watch, engine, store, _ = self.make()
        item = types.SimpleNamespace(course=engine.course, chapter_id='4', status='done')
        engine.queue.append(item)
        watch.tick()
        self.assertEqual(engine.calls[:3], ['stop', 'reload:4', 'move'])
        self.assertIs(engine.queue[0], item)
        self.assertEqual(store[SEEN], {'1:2:4': True})

    def test_manual_stop_during_switch_has_priority(self):
        watch, engine, _, _ = self.make()
        def join(**_):
            worker = threading.Thread(target=engine.stop)
            worker.start(); worker.join(1)
            self.assertFalse(worker.is_alive(), 'stop join must not hold gate')
            engine.is_running = False
            return True
        engine.stop_and_wait = join
        watch.tick()
        self.assertEqual(engine.calls, ['stop'])
        self.assertTrue(watch.suspended)

    def test_blacklist_read_again_before_switch(self):
        watch, engine, _, _ = self.make()
        blocked = []
        watch.blacklist = lambda: blocked
        def reader(*_):
            blocked.append('1:2')
            return self.rows
        watch.reader = reader
        watch.tick()
        self.assertEqual(engine.calls, [])

    def test_edit_while_scanning_invalidates_result(self):
        watch, engine, _, _ = self.make()
        def reader(*_):
            watch.configure({'enabled': False})
            return self.rows
        watch.reader = reader
        watch.tick()
        self.assertEqual(engine.calls, [])
        self.assertEqual(watch.next_scan, 0)

    def test_pause_persists_but_host_shutdown_does_not(self):
        watch, engine, store, _ = self.make()
        engine.pause(); watch.tick()
        self.assertEqual(engine.calls, ['pause'])
        self.assertTrue(store[SUSPENDED])
        watch.resume(); watch.close(); engine.stop()
        self.assertFalse(store[SUSPENDED])

    def test_logged_out_and_error_never_start_work(self):
        watch, engine, _, clock = self.make()
        engine.logged_in = False; watch.tick()
        self.assertEqual(watch.status, 'waiting_login')
        engine.logged_in = True
        watch.reader = lambda *_: (_ for _ in ()).throw(OSError('timeout'))
        watch.tick()
        self.assertEqual(engine.calls, [])
        self.assertEqual(watch.next_scan, clock[0] + 60)
        self.assertFalse(watch.suspended)

    def test_verification_suspends_instead_of_repeated_scanning(self):
        watch, engine, _, _ = self.make()
        watch.reader = lambda *_: (_ for _ in ()).throw(MonitorBlocked('需本人验证'))
        watch.tick()
        self.assertTrue(watch.suspended)
        self.assertEqual(engine.calls, [])

    def test_manual_start_rejected_only_during_transition(self):
        watch, engine, _, _ = self.make()
        watch.transition = True
        with self.assertRaises(RuntimeError): engine.start_run({})
        engine.stop()
        self.assertTrue(watch.suspended)

    def test_manual_removal_while_loading_cancels_automatic_restart(self):
        watch, engine, store, _ = self.make()
        original = engine.queue[0]
        loading = threading.Event()
        add = engine.queue_add
        def delayed_add(*args, **kwargs):
            item = add(*args, **kwargs)
            item.status = 'loading'
            loading.set()
            return item
        engine.queue_add = delayed_add
        worker = threading.Thread(target=watch.tick)
        worker.start()
        try:
            self.assertTrue(loading.wait(1))
            # Wait until dispatch releases its short gate after moving the item.
            with watch.gate:
                index = next(i for i, item in enumerate(engine.queue) if item.chapter_id == '4')
                engine.queue_remove(index)
            worker.join(1)
            self.assertFalse(worker.is_alive())
            self.assertEqual(engine.queue, [original])
            self.assertTrue(watch.suspended)
            self.assertFalse(any(isinstance(call, tuple) and call[0] == 'start' for call in engine.calls))
            self.assertEqual(store.get(SEEN, {}), {})
        finally:
            watch.close()
            worker.join(1)

    def test_shutdown_during_read_prevents_more_requests_or_dispatch(self):
        watch, engine, store, _ = self.make()
        entered, requests = threading.Event(), []
        class Session:
            def get(self, *args, **kwargs):
                requests.append('GET')
                entered.set()
                self.assert_stopped = watch.closed.wait(1)
                return object()
        engine.session = Session()
        def tree(session, **kwargs):
            session.get('https://example.invalid/catalogue')
            self.fail('cancelled GET must be rejected before catalogue parsing')
        fake = types.SimpleNamespace(fetch_chapter_tree=tree, fetch_task_points_ex=lambda *a, **k: self.fail('extra card request'))
        watch.reader = read_course
        with patch.dict(sys.modules, {'core': types.ModuleType('core'), 'core.taskpoint': fake}):
            watch.start()
            self.assertTrue(entered.wait(1))
            self.assertTrue(watch.close())
        self.assertEqual(requests, ['GET'])
        self.assertEqual(engine.calls, [])
        self.assertEqual(store.get(SEEN, {}), {})
        self.assertFalse(store.get(SUSPENDED, False))

    def test_close_reports_a_thread_that_did_not_stop(self):
        watch, _, _, _ = self.make()
        calls = []
        watch.thread = types.SimpleNamespace(join=lambda **kw: calls.append(kw), is_alive=lambda: True)
        self.assertFalse(watch.close())
        self.assertTrue(watch.closed.is_set())
        self.assertEqual(calls, [{'timeout': 25}])

    def test_closed_time_and_unknown_cards(self):
        watch, engine, _, _ = self.make()
        chapters = [types.SimpleNamespace(chapter_id=str(i), status=status, parent_node_id='0')
                    for i, status in [(4, 'close'), (5, 'time'), (6, 'task'), (7, '1'), (8, 'open')]]
        tree = types.SimpleNamespace(chapters=chapters, face_check=False, status=types.SimpleNamespace(face_check=False, filed=False))
        calls = []
        def fetch(*_, chapter_id, **kwargs):
            calls.append(chapter_id)
            point = types.SimpleNamespace(task_type='work', finished=chapter_id == '8', extra={'is_job': True})
            return types.SimpleNamespace(face_check=False, diag={}, points=[] if chapter_id == '7' else [point])
        fake = types.SimpleNamespace(fetch_chapter_tree=lambda *_, **__: tree, fetch_task_points_ex=fetch)
        engine.session = object()
        with patch.dict(sys.modules, {'core': types.ModuleType('core'), 'core.taskpoint': fake}):
            rows = read_course(engine, engine.course, lambda: False)
        self.assertEqual(calls, ['6', '7', '8'])
        self.assertEqual(rows, [{'chapter_id': '4', 'available': False}, {'chapter_id': '5', 'available': False},
            {'chapter_id': '6', 'available': True, 'pending': True}, {'chapter_id': '8', 'available': True, 'pending': False}])


if __name__ == '__main__':
    unittest.main(verbosity=2)
