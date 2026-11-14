import copy
from pathlib import Path
import sys
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src/fusion'))
import answer_confirmation as confirmation


class Store:
    def __init__(self, values): self.values = copy.deepcopy(values)
    def get(self, key, default=None): return self.values.get(key, default)
    def set(self, key, value): self.values[key] = value
    def keys(self): return list(self.values)


class ConfirmationTests(unittest.TestCase):
    def setUp(self):
        self.task = NS(task_type='workid', extra={})
        self.executor = NS(session=object())
        self.runner = NS(wait_if_paused=lambda: True)
        self.state = {'answer_fields': {'answer1': 'A'}, 'did_submit': True,
                      'submit_kwargs': {'submit': True, 'timeout': 20}}
        self.saved = NS(fields=[('answer1', 'A')])
        self.blank = NS(fields=[('answer1', '')])
        self.calls = []

    def submit(self, *args, **kwargs):
        self.calls.append(kwargs)
        return NS(ok=True)

    def confirm(self):
        return confirmation.confirm(self.executor, self.task, self.runner, None,
                                    self.state, self.submit)

    def test_success_ack_with_editable_saved_form_is_not_completion(self):
        with patch.object(confirmation, '_read', return_value=(self.saved, False)):
            finished, message = self.confirm()
        self.assertFalse(finished)
        self.assertIn('仍可作答', message)
        self.assertFalse(self.calls)

    def test_missing_answers_retry_save_only_once_and_verify_readback(self):
        with patch.object(confirmation, '_read', side_effect=[(self.blank, False), (self.saved, False)]):
            finished, message = self.confirm()
        self.assertFalse(finished)
        self.assertIn('已保存', message)
        self.assertEqual(len(self.calls), 1)
        self.assertIs(self.calls[0]['submit'], False)

    def test_failed_save_does_not_claim_saved_or_completed(self):
        with patch.object(confirmation, '_read', return_value=(self.blank, False)):
            finished, message = self.confirm()
        self.assertFalse(finished)
        self.assertIn('未确认答案保存', message)
        self.assertEqual(len(self.calls), 1)

    def test_network_failure_does_not_resubmit(self):
        with patch.object(confirmation, '_read', side_effect=TimeoutError):
            finished, message = self.confirm()
        self.assertFalse(finished)
        self.assertIn('暂不标记完成', message)
        self.assertFalse(self.calls)

    def test_graded_but_platform_job_pending_stays_pending(self):
        with patch.object(confirmation, '_read', return_value=(None, True)), \
                patch.object(confirmation, '_job_complete', return_value=False):
            finished, message = self.confirm()
        self.assertFalse(finished)
        self.assertIn('任务点仍未完成', message)

    def test_platform_confirmed_completion_sets_evidence_marker(self):
        with patch.object(confirmation, '_read', return_value=(None, True)), \
                patch.object(confirmation, '_job_complete', return_value=True):
            finished, _ = self.confirm()
        self.assertTrue(finished)
        self.assertTrue(self.task.extra['completion_verified'])

    def test_new_question_ids_never_receive_old_answers(self):
        with patch.object(confirmation, '_read', return_value=(NS(fields=[('answer2', '')]), False)):
            finished, _ = self.confirm()
        self.assertFalse(finished)
        self.assertFalse(self.calls)

    def test_migration_preserves_queue_video_credentials_and_progress(self):
        original = {
            'auth.session': 'fixture-session',
            'task.progress.c.g.h': {'0': {'state': 'done'}},
            'engine.chapter_cache.c.g': {'h': [
                {'type': 'video', 'done': True}, {'type': 'workid', 'done': True},
                {'type': 'workid', 'done': True, 'completion_verified': True}]},
            'integration.queue': {'schema': 1, 'items': [{
                'status': 'done', 'chapter_state': {'h': 'done'},
                'task_states': {'h:0': 'ok', 'h:1': 'ok'},
                'chapter_points': {'h': [
                    {'index': 0, 'task_type': 'video', 'finished': True},
                    {'index': 1, 'task_type': 'workid', 'finished': True}]}}]}}
        store = Store(original)
        confirmation.migrate_unverified_cache(store)
        cached = store.get('engine.chapter_cache.c.g')['h']
        self.assertEqual([row['done'] for row in cached], [True, False, True])
        item = store.get('integration.queue')['items'][0]
        self.assertEqual(item['status'], 'ready')
        self.assertEqual(item['task_states'], {'h:0': 'ok', 'h:1': 'pending'})
        self.assertEqual(store.get('auth.session'), original['auth.session'])
        self.assertEqual(store.get('task.progress.c.g.h'), original['task.progress.c.g.h'])
        snapshot = copy.deepcopy(store.values)
        confirmation.migrate_unverified_cache(store)
        self.assertEqual(snapshot, store.values)


if __name__ == '__main__': unittest.main()
