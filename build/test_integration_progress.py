"""Offline evidence aggregation tests. No engine login, HTTP, or real user data."""
import copy
from dataclasses import dataclass, field
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src' / 'fusion'))
from integration_state import IntegrationState, QUEUE_KEY, _item_key


@dataclass
class Course:
    course_id: str = 'course'
    clazz_id: str = 'class'
    name: str = 'Synthetic course'


@dataclass
class Chapter:
    chapter_id: str = 'c'
    jobcount: int = 2
    finishcount: int = 0


@dataclass
class Task:
    name: str = 'Synthetic task'
    chapter_id: str = 'c'
    index: int = 0
    task_type: str = 'video'
    finished: bool = False
    extra: dict = field(default_factory=dict)


@dataclass
class Item:
    course: Course = field(default_factory=Course)
    chapter_id: str = '0'
    mode: str = 'task'
    lazy: bool = True
    status: str = 'done'
    chapters: list = field(default_factory=list)
    chapter_state: dict = field(default_factory=lambda: {'c': 'done'})
    chapter_points: dict = field(default_factory=dict)
    tasks: list = field(default_factory=list)
    homeworks: list = field(default_factory=list)


class Store:
    def __init__(self):
        self.data = {}

    def get(self, key, default=None):
        return copy.deepcopy(self.data.get(key, default))

    def set(self, key, value):
        self.data[key] = copy.deepcopy(value)


class Engine:
    def __init__(self, items, store):
        self.queue, self.store = items, store
        self.logged_in = False
        self._emit_fn = lambda event: None

    def cache_chapter_points(self, item, cid, points):
        self.store.set('engine.chapter_cache.course.class', {
            str(cid): [{'name': task.name, 'type': task.task_type, 'done': task.finished} for task in points]
        })
        return 'original-result'


MODELS = {'Course': Course, 'TaskPoint': Task, 'QueueItem': Item, 'Chapter': Chapter}


def adapter(items, store=None):
    store = store or Store()
    engine = Engine(items, store)
    return IntegrationState(engine, store, model_types=MODELS, instrument_video=False)


def event(state, status, index=1, chapter='c'):
    state.observe({'type': 'task.event', 'payload': {
        'queue_index': 0, 'chapter_id': chapter, 'index': index, 'status': status
    }})


class ProgressTests(unittest.TestCase):
    def test_homework_only_does_not_retry_unrelated_chapter_quiz_cache(self):
        item=Item(mode='homework',status='done',tasks=[])
        item._fusion_homework_loaded=True
        store=Store()
        store.set('config.fusion_answer_policy',{'settings':{'work-when-no-job':True}})
        store.set('engine.chapter_cache.course.class',{'c':[{'type':'work','index':0,'done':False,'completion_verified':False}]})
        state=adapter([item],store)
        state._reconcile_completion(item)
        self.assertEqual(state._retry_chapters(item),{})
        self.assertEqual(item.status,'done')

    def test_explicit_empty_homework_is_complete_but_unloaded_is_unknown(self):
        item=Item(mode='homework',tasks=[])
        state=adapter([item])
        self.assertFalse(state._queue_progress()['task_counts_complete'])
        item._fusion_homework_loaded=True
        state._summaries[_item_key(item)]={'tasks':[{'finished':True,'server_done':True}]}
        self.assertTrue(state._queue_progress()['task_counts_complete'])
        self.assertEqual(state._queue_progress()['course_done'],1)
        self.assertEqual(state._queue_progress()['task_total'],0)
        item._fusion_homework_loaded=False
        self.assertFalse(state._queue_progress()['task_counts_complete'])

    def test_partial_event_overrides_full_item_chapter_and_old_platform_snapshot(self):
        tasks = [Task(finished=True), Task(index=1, task_type='work', finished=True,
                                         extra={'completion_verified': True})]
        state = adapter([Item(chapters=[Chapter(finishcount=2)], chapter_points={'c': tasks})])
        event(state, 'partial')
        self.assertEqual(state._queue_progress()['task_done'], 1)
        self.assertEqual(state._queue_progress()['task_total'], 2)
        self.assertEqual(state._queue_progress()['task_percent'], 50)
        self.assertEqual(state._queue_progress()['course_done'], 0)
        event(state, 'failed')
        self.assertEqual(state._queue_progress()['task_done'], 1)

    def test_successful_run_and_chapter_flags_are_not_completion_evidence(self):
        item = Item(chapters=[Chapter()], chapter_points={'c': [Task(), Task(index=1, task_type='work')]})
        state = adapter([item])
        self.assertEqual(state._queue_progress()['task_done'], 0)
        self.assertEqual(state._queue_progress()['course_done'], 0)
        item.chapter_points = {}
        self.assertEqual(state._queue_progress()['task_done'], 0)

    def test_events_for_unloaded_child_still_override_catalogue_totals(self):
        state = adapter([Item(chapters=[Chapter(finishcount=2)], chapter_points={'c': [Task(finished=True)]})])
        event(state, 'partial')
        self.assertEqual(state._queue_progress()['task_done'], 1)

    def test_smaller_catalogue_jobcount_cannot_hide_a_partial_child(self):
        tasks = [Task(finished=True), Task(index=1, task_type='work')]
        state = adapter([Item(chapters=[Chapter(jobcount=1, finishcount=1)], chapter_points={'c': tasks})])
        event(state, 'partial')
        progress = state._queue_progress()
        self.assertEqual(progress['task_total'], 2)
        self.assertEqual(progress['task_done'], 1)
        self.assertEqual(progress['task_percent'], 50)
        self.assertEqual(progress['course_done'], 0)

    def test_flat_and_homework_progress_do_not_use_item_done(self):
        for mode in ('task', 'homework'):
            with self.subTest(mode=mode):
                state = adapter([Item(mode=mode, lazy=False, tasks=[Task(task_type='work')])])
                event(state, 'partial', index=0, chapter='homework' if mode == 'homework' else 'c')
                self.assertEqual(state._queue_progress()['task_done'], 0)
                self.assertEqual(state._queue_progress()['course_done'], 0)

    def test_both_mode_requires_confirmed_homework_too(self):
        homework = Task(task_type='homework')
        state = adapter([Item(mode='both', chapters=[Chapter(jobcount=1, finishcount=1)],
                              chapter_points={'c': [Task(finished=True)]}, homeworks=[homework])])
        event(state, 'partial', index=0, chapter='homework')
        self.assertEqual(state._queue_progress()['task_done'], 1)
        self.assertEqual(state._queue_progress()['task_total'], 2)
        self.assertEqual(state._queue_progress()['course_done'], 0)
        homework.extra['completion_verified'] = True
        event(state, 'ok', index=0, chapter='homework')
        self.assertEqual(state._queue_progress()['course_done'], 1)
        self.assertTrue(state.homework_tasks(0)['tasks'][0]['completion_verified'])

    def test_video_local_skip_survives_but_old_quiz_ok_needs_proof(self):
        quiz = Task(index=1, task_type='work')
        state = adapter([Item(chapters=[Chapter()], chapter_points={'c': [Task(), quiz]})])
        key = _item_key(state.engine.queue[0])
        state._task_states[key] = {'c:0': 'skipped', 'c:1': 'ok'}
        self.assertEqual(state._queue_progress()['task_done'], 1)
        quiz.finished = True
        self.assertEqual(state._queue_progress()['task_done'], 2, 'Real platform finished remains authoritative')
        quiz.finished = False
        quiz.extra['isPassed'] = True
        self.assertEqual(state._queue_progress()['task_done'], 2)
        quiz.extra = {'completion_verified': True}
        self.assertEqual(state._queue_progress()['task_done'], 2)

    def test_current_ok_is_evidence_but_legacy_restored_ok_is_not(self):
        state = adapter([Item(chapters=[Chapter(jobcount=1)], chapter_points={'c': [Task(task_type='work')]})])
        event(state, 'ok', index=0)
        self.assertEqual(state._queue_progress()['task_done'], 1)
        restored = adapter([], state.store)
        self.assertEqual(restored._queue_progress()['task_done'], 0)
        cache = state.store.get('engine.chapter_cache.course.class')['c'][0]
        self.assertFalse(cache['done'])

    def test_summary_and_standard_cache_keep_verified_marker_without_erasing_history(self):
        tasks = [Task(), Task(index=1, task_type='work', extra={'completion_verified': True})]
        store = Store()
        history = {'video': {'done': True}, 'old-quiz': {'done': True}}
        store.set('task.progress', history)
        state = adapter([Item(chapters=[Chapter()], chapter_points={'c': tasks})], store)
        event(state, 'skipped', index=0)
        event(state, 'ok', index=1)
        result = state.engine.cache_chapter_points(state.engine.queue[0], 'c', tasks)
        self.assertEqual(result, 'original-result')
        self.assertTrue(store.get('engine.chapter_cache.course.class')['c'][1]['completion_verified'])
        self.assertTrue(store.get(QUEUE_KEY)['items'][0]['chapter_points']['c'][1]['completion_verified'])
        restored = adapter([], store)
        self.assertEqual(restored._queue_progress()['task_done'], 2)
        cache = store.get('engine.chapter_cache.course.class')['c']
        self.assertTrue(cache[0]['done'])
        self.assertTrue(cache[1]['done'])
        self.assertTrue(cache[1]['completion_verified'])
        self.assertEqual(store.get('task.progress'), history)

    def test_unknown_counts_do_not_become_full_course_progress(self):
        state = adapter([Item(status='done')])
        progress = state._queue_progress()
        self.assertIsNone(progress['task_total'])
        self.assertIsNone(progress['course_done'])
        self.assertFalse(progress['course_counts_complete'])

    def test_optional_parser_finished_is_not_relabelled_as_server_confirmation(self):
        task = Task(task_type='work', finished=True, extra={'is_job': False})
        state = adapter([Item(chapters=[Chapter(jobcount=1)], chapter_points={'c': [task]})])
        state.engine.cache_chapter_points(state.engine.queue[0], 'c', [task])
        cache = state.store.get('engine.chapter_cache.course.class')['c'][0]
        self.assertFalse(cache['server_done'])
        task.extra['isPassed'] = True
        state.engine.cache_chapter_points(state.engine.queue[0], 'c', [task])
        self.assertTrue(state.store.get('engine.chapter_cache.course.class')['c'][0]['server_done'])


if __name__ == '__main__':
    unittest.main()
