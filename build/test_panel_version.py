"""Version labels in static link previews must match the release metadata."""
from pathlib import Path
import importlib.util
import json
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('xbt_build_version_test', SOURCE/'build/build.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PanelVersionTests(unittest.TestCase):
    def test_current_source_and_each_stale_or_missing_label(self):
        version = json.loads((SOURCE/'fusion-install.json').read_text(encoding='utf-8-sig'))['version']
        builder.verify_panel_version(SOURCE, version)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            file = root/'src/star-panel/index.html'
            file.parent.mkdir(parents=True)
            for title, badge in [('2.5.9', version), (version, '2.5.9'), ('', version), (version, '')]:
                with self.subTest(title=title, badge=badge):
                    file.write_text(f'<title>学不通 {title}</title><small id="version">v{badge}</small>', encoding='utf-8')
                    with self.assertRaises(ValueError):
                        builder.verify_panel_version(root, version)


if __name__ == '__main__':
    unittest.main()
