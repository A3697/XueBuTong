"""Backend account IDs follow the desktop account contract; no network or user data."""
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src/backend-host'))
from run_integrated_backend import identifiers
from account_environment import prepare_account_environment, normalize_preferences

VALID = ('qa_lifecycle_b', 'QA_lifecycle-b', 'a', '_', '-', 'A' * 80, 'a' * 32)
INVALID = ('', 'a' * 81, '../account', r'..\account', 'a/b', r'a\b', 'a:b',
           'a.json', '中文', 'a\n', '__proto__', 'constructor', 'prototype', None, 42)


class AccountIdContract(unittest.TestCase):
    def test_host_accepts_desktop_ids_without_changing_case(self):
        for uid in VALID:
            with self.subTest(uid=uid):
                self.assertEqual(identifiers(uid, 'session-1'), (uid, 'session-1'))

    def test_host_rejects_invalid_ids_and_keeps_session_checks(self):
        for uid in INVALID:
            with self.subTest(uid=uid):
                with self.assertRaises(ValueError):
                    identifiers(uid, 'session-1')
        for session in ('', '../session', 'CON', 'LPT1', 's' * 65, None):
            with self.subTest(session=session):
                with self.assertRaises(ValueError):
                    identifiers('qa_lifecycle_b', session)

    def test_environment_accepts_same_ids_and_retains_exact_owner(self):
        store = object()
        for uid in VALID:
            installed = {'uid': uid, 'store': store, 'preferences': normalize_preferences(None)}
            with self.subTest(uid=uid), patch.dict(sys.modules, {
                    'core.auth': types.SimpleNamespace(_fusion_account_environment=installed)}):
                self.assertIs(prepare_account_environment(store, uid), installed)

    def test_environment_rejects_invalid_owner_before_store_access(self):
        for uid in INVALID:
            with self.subTest(uid=uid):
                with self.assertRaisesRegex(ValueError, 'invalid account environment owner'):
                    prepare_account_environment(None, uid)

    def test_device_and_schild_formats_are_not_account_ids(self):
        for field in ('deviceId', 'schildWebview', 'schildDalvik'):
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    normalize_preferences({field: 'qa_lifecycle_b'})
                self.assertEqual(normalize_preferences({field: 'A' * 32})[field], 'a' * 32)


if __name__ == '__main__':
    unittest.main(verbosity=2)
