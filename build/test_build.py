"""Offline checks for the portable build guards; no product execution."""
from pathlib import Path
import importlib.util
import json
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('portable_build', HERE/'build.py')
kit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit)


class BuildGuards(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='.build-check-', dir=HERE)
        self.root = Path(self.temporary.name).resolve()
        self.assertTrue(self.root.is_relative_to(HERE))
        self.addCleanup(self.cleanup)
        self.payload = self.root/'payload.txt'
        self.payload.write_text('synthetic offline source', encoding='utf-8')
        self.rows = [{'path': 'payload.txt', 'size': self.payload.stat().st_size, 'sha256': kit.digest(self.payload)}]
        self.manifest = self.root/'manifest.json'
        self.write_manifest()

    def cleanup(self):
        # TemporaryDirectory deletes recursively; keep its resolved target scoped.
        if not self.root.is_relative_to(HERE) or not self.root.name.startswith('.build-check-'):
            raise RuntimeError('unsafe test cleanup root')
        self.temporary.cleanup()

    def write_manifest(self):
        self.manifest.write_text(json.dumps({'files': self.rows}), encoding='utf-8')

    def verify(self):
        return kit.verify_tree(self.root, self.manifest, exclude=('manifest.json',))

    def test_exact_file_set_and_hash(self):
        self.assertEqual(self.verify(), 1)
        self.payload.write_text('changed', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '文件已改变'): self.verify()

    def test_extra_and_missing_files_rejected(self):
        extra = self.root/'extra.txt'
        extra.write_text('extra', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '新增'): self.verify()
        extra.unlink()
        self.payload.unlink()
        with self.assertRaisesRegex(ValueError, '缺少'): self.verify()

    def test_manifest_paths_cannot_escape_or_alias(self):
        for name in ('../outside.txt', '/absolute.txt', 'c:/outside.txt', 'folder\\file', './payload.txt', 'a//file', ''):
            self.rows[0]['path'] = name
            self.write_manifest()
            with self.subTest(path=name), self.assertRaises(ValueError): kit.manifest_entries(self.manifest)

    def test_duplicate_paths_and_invalid_metadata_rejected(self):
        self.rows.append({**self.rows[0], 'path': 'PAYLOAD.TXT'})
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, '重复'): kit.manifest_entries(self.manifest)
        self.rows.pop()
        for key, value in (('size', True), ('size', -1), ('sha256', 'invalid')):
            row = dict(self.rows[0]);self.rows[0][key] = value;self.write_manifest()
            with self.subTest(key=key, value=value), self.assertRaises(ValueError): kit.manifest_entries(self.manifest)
            self.rows[0] = row

    def test_reparse_point_is_rejected_before_resolution(self):
        original = Path.lstat
        def observed(path, *args, **kwargs):
            return SimpleNamespace(st_file_attributes=stat.FILE_ATTRIBUTE_REPARSE_POINT) if path == self.payload else original(path, *args, **kwargs)
        with mock.patch.object(Path, 'lstat', observed), self.assertRaisesRegex(ValueError, '重解析点'):
            kit.no_links(self.payload)

    def test_nonempty_work_is_preserved(self):
        before = self.payload.read_bytes()
        with self.assertRaisesRegex(ValueError, '不会清空'): kit.claim_empty(self.root)
        self.assertEqual(self.payload.read_bytes(), before)
        new = self.root/'new-work';kit.claim_empty(new);self.assertTrue(new.is_dir())


if __name__ == '__main__':
    unittest.main(verbosity=2)
