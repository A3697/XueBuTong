"""Raw and hydrated public player markup; synthetic IDs, no network or engine."""
from pathlib import Path
from types import SimpleNamespace
import html, json, sys, tempfile, unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src/fusion'))
import video_speed_policy as policy

class RawCardPermissionTests(unittest.TestCase):
    def task(self, data, attrs='', defaults=None):
        text='<iframe module="insertvideo" '+attrs+' data="'+html.escape(json.dumps(data),quote=True)+'"></iframe>'
        point=SimpleNamespace(extra={'property':{'objectid':'synthetic-object','doublespeed':1},'job_id':'synthetic-job'})
        point.extra[policy.POLICY_KEY]=policy._metadata({'defaults':defaults or {'cFid':'12345'},policy.CARD_KEY:policy._frames(text)},point)
        return point
    def test_raw_data_only_ids_enable_the_explicit_video_permission(self):
        task=self.task({'objectid':'synthetic-object','_jobid':'synthetic-job','jobid':'synthetic-job','doublespeed':1})
        self.assertEqual(policy.permission(task),('allowed','video_allowed'))
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            prefs=Path(directory)/'preferences.json';prefs.write_text('{"autoVideo2x":true}')
            self.assertEqual(policy.select_speed(task,5,prefs)['beisu'],2)
    def test_original_attributes_and_matching_json_ids_remain_supported(self):
        task=self.task({'doublespeed':1},'objectid="synthetic-object" jobid="synthetic-job"')
        self.assertEqual(policy.permission(task)[0],'allowed')
        task=self.task({'objectid':'synthetic-object','jobid':'synthetic-job','doublespeed':1},'objectid="synthetic-object" jobid="synthetic-job"')
        self.assertEqual(policy.permission(task)[0],'allowed')
    def test_prohibition_and_missing_or_conflicting_identity_do_not_enable_two(self):
        for data,attrs,expected in [
            ({'objectid':'synthetic-object','jobid':'synthetic-job','doublespeed':0},'','disallowed'),
            ({'objectid':'synthetic-object','jobid':'different-job','doublespeed':1},'','unknown'),
            ({'objectid':'synthetic-object','_jobid':'different-job','jobid':'synthetic-job','doublespeed':1},'','unknown'),
            ({'objectid':'synthetic-object','jobid':'synthetic-job','doublespeed':1},'objectid="different-object"','unknown'),
            ({'objectid':'synthetic-object','jobid':'synthetic-job'},'','unknown')]:
            with self.subTest(data=data):self.assertEqual(policy.permission(self.task(data,attrs))[0],expected)

if __name__=='__main__':unittest.main()
