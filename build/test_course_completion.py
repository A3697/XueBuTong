"""Completion responses seen on the platform, including an empty valid catalogue."""
from pathlib import Path
import sys,unittest,types
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src/fusion'))
from course_completion import explicit_remaining,read_completion

class CourseCompletion(unittest.TestCase):
 def test_live_braces_quotes_and_zero_are_explicit(self):
  for value,expected in [('{nextChapterId:0,unfinishCount:0}',0),('{nextChapterId:7,unfinishCount:92}',92),('{&quot;unfinishCount&quot;: 4}',4),('unfinishCount:3',3),('{unfinishCount:-1}',None),('{unfinishCount:1.5}',None),('{unfinishCount:0oops}',None),('nextChapterId:0',None)]:
   with self.subTest(value=value):self.assertEqual(explicit_remaining('<input id="_studystate" value="'+value+'"/>'),expected)
  self.assertIsNone(explicit_remaining('<html><li>empty error page</li></html>'))
 def test_empty_catalogue_requires_explicit_platform_state(self):
  course=types.SimpleNamespace(course_id='c',clazz_id='l',cpi='p',finished=False)
  engine=types.SimpleNamespace(find_course=lambda *_:course,course_progress=lambda **_: {},session=None)
  for html,known in [('<input id="_studystate" value="{nextChapterId:0,unfinishCount:0}"/>',True),('<html>login required</html>',False)]:
   engine.session=types.SimpleNamespace(get=lambda *_,**__:types.SimpleNamespace(status_code=200,text=html))
   def fetch(session,**_):session.get('fixture');return {},{}
   with patch.dict(sys.modules,{'core':types.ModuleType('core'),'core.taskpoint':types.SimpleNamespace(fetch_catalog_progress=fetch)}):
    result=read_completion(engine,'c','l',False)['task'];self.assertEqual(result['known'],known)
    if known:self.assertTrue(result['complete'])

if __name__=='__main__':unittest.main(verbosity=2)
