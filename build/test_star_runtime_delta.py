import hashlib
import json
import os
import shutil
import tempfile
import unittest
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_public_update
from public_scope import public_source
from star_runtime_delta import allowed_path, make_review, validate_review


class StarDeltaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="xbt-star-delta-fixture-", dir=os.environ.get('XBT_TEST_TMP'))
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.candidate, self.deps = [self.root / name for name in ("source", "candidate", "deps")]
        for folder in (self.source, self.candidate, self.deps):
            folder.mkdir()
        self.old_data = {
            "fusion-install.json": json.dumps({"version": "2.5.12", "dependencies": {"xingchan": "1.3.0"}}),
            "src/fixture.cjs": "module.exports = 1;",
            "star-runtime/_backend-prepared-manifest.json": '{"schema":1,"files":[]}',
            "star-runtime/core/version.json": '{"version":"1.3.0"}',
            "star-runtime/core/constant.txt": "unchanged runtime fixture",
            "assets/star-native/index.html": "<html>old version</html>",
            "assets/star-native/assets/old.js": "console.log('old');",
            "LICENSE": "Synthetic fixture license",
            "LICENSES/notice.txt": "Synthetic fixture notice",
        }
        self.new_data = dict(self.old_data)
        self.new_data.update({"fusion-install.json": json.dumps({"version": "2.5.13", "dependencies": {"xingchan": "1.3.1"}}),
                              "src/fixture.cjs": "module.exports = 2;",
                              "star-runtime/_backend-prepared-manifest.json": '{"schema":1,"files":[],"version":"1.3.1"}',
                              "star-runtime/core/version.json": '{"version":"1.3.1"}',
                              "assets/star-native/index.html": "<html>new version</html>",
                              "assets/star-native/assets/new.js": "console.log('new');"})
        del self.new_data["assets/star-native/assets/old.js"]
        for name, value in self.new_data.items():
            target = self.candidate / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(value, encoding="utf-8")
        self.baseline, self.manifest, self.review = [self.root / name for name in ("baseline.json", "candidate-manifest.json", "review.json")]
        self.write_manifest(self.baseline, self.old_data)
        self.write_manifest(self.manifest, self.new_data)
        self.write_review()

    def write_manifest(self, target, files):
        rows = [{"path": name, "sha256": hashlib.sha256(value.encode()).hexdigest(), "size": len(value.encode())}
                for name, value in sorted(files.items())]
        target.write_text(json.dumps({"files": rows}), encoding="utf-8")

    def write_review(self):
        value = make_review(self.baseline, self.manifest, "1.3.0", "1.3.1")
        self.review.write_text(json.dumps(value), encoding="utf-8")
        return value

    def test_valid_exact_delta(self):
        result = validate_review(self.review, self.baseline, self.manifest, self.candidate)
        self.assertEqual(result["toVersion"], "1.3.1")
        self.assertEqual(sum(row["action"] == "remove" for row in result["files"]), 1)
        self.assertNotIn("src/fixture.cjs", [row["path"] for row in result["files"]])

    def test_candidate_bytes_must_match_complete_manifest(self):
        (self.candidate / "star-runtime/core/version.json").write_text("changed after review", encoding="utf-8")
        with self.assertRaises(ValueError):
            validate_review(self.review, self.baseline, self.manifest, self.candidate)

    def test_review_is_exact_not_a_wildcard(self):
        value = json.loads(self.review.read_text())
        value["files"] = value["files"][:-1]
        self.review.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, "stale, incomplete"):
            validate_review(self.review, self.baseline, self.manifest, self.candidate)

    def test_baseline_binding(self):
        value = json.loads(self.baseline.read_text())
        value["files"][0]["sha256"] = "0" * 64
        self.baseline.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, "stale, incomplete"):
            validate_review(self.review, self.baseline, self.manifest, self.candidate)

    def test_candidate_version_must_match_star_version(self):
        value = json.loads(self.review.read_text())
        value["toVersion"] = "1.3.2"
        self.review.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, "version"):
            validate_review(self.review, self.baseline, self.manifest, self.candidate)

    def test_nonstar_private_changes_still_denied(self):
        self.new_data["python3144/python.exe"] = "unreviewed other binary"
        self.write_manifest(self.manifest, self.new_data)
        with self.assertRaisesRegex(ValueError, "outside"):
            self.write_review()

    def test_public_removals_are_not_silently_authorized(self):
        del self.new_data["src/fixture.cjs"]
        self.write_manifest(self.manifest, self.new_data)
        with self.assertRaisesRegex(ValueError, "outside"):
            self.write_review()

    def test_paths_and_state_are_not_allowed(self):
        for path in ["star-runtime/../private/session.json", "star-runtime/storage/config.json", "star-runtime/core/*.pyc",
                     "assets/star-native/Cookies", "assets/star-native/cache/a", "star-runtime/a:stream", "star-runtime/core/a. ",
                     "star-runtime//a.pyc", "assets/star-native/sessions/x.json"]:
            self.assertFalse(allowed_path(path), path)
        self.assertTrue(allowed_path("star-runtime/core/auth.pyc"))

    def test_case_only_rename_is_not_an_install_delete(self):
        del self.new_data["star-runtime/core/constant.txt"]
        self.new_data["star-runtime/core/Constant.txt"] = "unchanged runtime fixture"
        self.write_manifest(self.manifest, self.new_data)
        with self.assertRaisesRegex(ValueError, "Case-only"):
            self.write_review()

    def test_publication_boundary_unchanged(self):
        self.assertTrue(public_source("src/star-panel/course-watch.js"))
        self.assertTrue(public_source("docs/2.5.13修复验收.md"))
        self.assertFalse(public_source("assets/star-native/index.html"))
        self.assertFalse(public_source("src/star-panel/app.js"))
        self.assertFalse(public_source("star-runtime/core/auth.pyc"))

    def prepare_fixture(self, component=True):
        (self.source / "build").mkdir()
        here = Path(__file__).parent
        for name in ["installer.iss", "installer-file-checks.iss", "installer-uninstall.iss", "release-privacy-check.iss", "release_privacy.py"]:
            shutil.copy2(here / name, self.source / "build" / name)
        (self.source / "LICENSES").mkdir()
        (self.source / "LICENSE").write_text(self.new_data["LICENSE"])
        (self.source / "LICENSES/notice.txt").write_text(self.new_data["LICENSES/notice.txt"])
        (self.source / "assets").mkdir()
        (self.source / "assets/fusion.ico").write_bytes(b"fixture")
        (self.deps / "tools").mkdir()
        (self.deps / "tools/fixture.txt").write_text("no compiler is run")
        return SimpleNamespace(source=str(self.source), candidate=str(self.candidate), dependencies=str(self.deps),
                               baseline=str(self.baseline), work=str(self.root / "work"), output=str(self.root / "output"),
                               star_runtime_delta=str(self.review) if component else None,
                               candidate_manifest=str(self.manifest) if component else None, prepare_only=True)

    def test_default_builder_still_rejects_private_deletions(self):
        args = self.prepare_fixture(component=False)
        with self.assertRaisesRegex(ValueError, "does not delete"):
            build_public_update.build_update(args)

    def test_default_public_update_still_works_without_component_permission(self):
        self.new_data = dict(self.old_data)
        self.new_data["src/fixture.cjs"] = "module.exports = 2;"
        self.new_data["fusion-install.json"] = json.dumps({"version": "2.5.13", "dependencies": {"xingchan": "1.3.0"}})
        for path in self.candidate.rglob("*"):
            if path.is_file():
                path.unlink()
        for name, value in self.new_data.items():
            target = self.candidate / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(value, encoding="utf-8")
        args = self.prepare_fixture(component=False)
        plan = build_public_update.build_update(args)
        self.assertFalse(plan["closedComponentsIncluded"])
        self.assertFalse(plan["removedFiles"])
        self.assertFalse(any(row["path"].startswith("star-runtime/") for row in plan["files"]))
        self.assertNotIn("[InstallDelete]", (self.root / "work/installer.iss").read_text("utf-8-sig"))

    def test_private_json_state_rejected_even_when_explicitly_listed(self):
        name = "assets/star-native/settings.json"
        self.new_data[name] = json.dumps({"password": "synthetic-not-a-real-password"})
        (self.candidate / name).write_text(self.new_data[name], encoding="utf-8")
        self.write_manifest(self.manifest, self.new_data)
        self.write_review()
        args = self.prepare_fixture()
        with self.assertRaisesRegex(ValueError, "privacy|Privacy|隐私|populated-private-state"):
            build_public_update.build_update(args)

    def test_prepared_installer_is_exact_hashed_and_reinstallable(self):
        args = self.prepare_fixture()
        with mock.patch.object(build_public_update.subprocess, "run", side_effect=AssertionError("must not compile")):
            plan = build_public_update.build_update(args)
        self.assertTrue(plan["closedComponentsIncluded"])
        self.assertFalse(plan["compiled"])
        iss = (self.root / "work/installer.iss").read_text("utf-8-sig")
        deletes = iss.split("[InstallDelete]\n", 1)[1].split("[Icons]", 1)[0]
        self.assertEqual(deletes.strip(), 'Type: files; Name: "{app}\\assets\\star-native\\assets\\old.js"')
        self.assertNotIn("filesandordirs", deletes)
        self.assertIn("CheckRemovedUpdateFile('assets\\star-native\\assets\\old.js'", iss)
        self.assertIn("BackupUpdateFile('assets\\star-native\\assets\\old.js'", iss)
        self.assertIn("CheckUpdateFile('star-runtime\\core\\constant.txt'", iss)
        self.assertIn("程序文件与兼容版本不符", iss)
        self.assertIn("星蝉 1.3.1 运行组件更新", (self.root / "work/release-docs/使用说明.txt").read_text("utf-8-sig"))
        self.assertFalse(list((self.root / "output").glob("*.exe")))
        actual = {path.relative_to(self.root / "work/candidate").as_posix() for path in (self.root / "work/candidate").rglob("*") if path.is_file()}
        self.assertNotIn("assets/star-native/assets/old.js", actual)
        self.assertIn("star-runtime/core/version.json", actual)


if __name__ == "__main__":
    unittest.main()
