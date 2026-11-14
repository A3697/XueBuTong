"""Offline tests against the shipped parser, form builder and AI provider.

No network and no user data: fake HTTP responses exercise the actual protected
public API, including failure/ambiguous-write paths.
"""
import copy
from datetime import date
import html.parser  # Same stdlib-first resolution as the packaged backend host.
import json
import os
from pathlib import Path
import socket
import sys
import tempfile
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1]
RUNTIME = Path(os.environ['XBT_RUNTIME_ROOT']) / 'star-runtime'
RECORD = Path(os.environ['XBT_QA_ROOT'])
DATA = Path(tempfile.mkdtemp(prefix='extra-task-', dir=RECORD))
sys.dont_write_bytecode = True
sys.path[:0] = [str(SOURCE / 'src/fusion'), str(RUNTIME)]
DLLS = [os.add_dll_directory(str(p)) for p in {RUNTIME, *[p.parent for p in RUNTIME.rglob('*.pyd')]}]
os.chdir(DATA)

def blocked(*args, **kwargs):
    raise RuntimeError('Offline fixture: network is disabled')

socket.socket.connect = socket.socket.connect_ex = socket.create_connection = blocked
import core.paths
core.paths.user_data_dir = lambda: DATA
import requests
from core import taskpoint, work
from core.models import TaskPoint
from core.question_bank.models import Answer, QueryResult, Question, QuestionType
import supplemental_tasks as extra
import original_search_bridge as bridge
from answer_policy import KEY, SearchBatch, SearchFailure

POLICY = {'baseUrl':'http://127.0.0.1:12345/v1', 'apiKey':'fixture' * 8,
          'settings':{'thread':1, 'period':1, 'stopSecondWhenFinish':3,
          'answerWrapperHandlerTimeout':30, 'randomWork-choice':True,
          'randomWork-complete':True, 'randomWork-completeTexts-textarea':'fixture',
          'upload':80}}
TOPIC = 'a' * 32
CARD = '<input id="isFinished" value=""><div id="topicMainDiv" data="https://groupweb.chaoxing.com/course/topic/v3/bbs/'+ 'b'*32 + '/'+TOPIC+'/replysList"></div>'

class Store:
    def __init__(self): self.values = {KEY:copy.deepcopy(POLICY)}
    def get(self, key, default=None): return self.values.get(key, default)
    def set(self, key, value): self.values[key] = value

class Session(requests.Session):
    def __init__(self):
        super().__init__(); self.calls=[]; self.confirmed=False; self.fail_post=False; self.token=True
    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        if method == 'POST' and self.fail_post: raise requests.Timeout('fixture')
        body = CARD
        if '/getTopic?' in url:
            body = json.dumps({'status':True,'datas':{'title':'我眼中的思想家','text_content':'请结合课程回答', 'userAuth':{'operationAuth':{'reply':1}}}}, ensure_ascii=False)
        if url.endswith('/replysList'):
            body = '<script>window.obj = {urlToken:"fixture-page-token-261114"};</script>' if self.token else '<p>页面已过期</p>'
        if method == 'POST': body = '{"status":true,"datas":{"reply":{"id":"fixture"}}}'
        response=requests.Response(); response.status_code=200; response.url=url
        response.encoding='utf-8'; response._content=body.encode('utf-8'); return response

def result(answer='从课程学习的角度，这位思想家重视理论与实际相结合，并对相关时代问题进行了深入研究。'):
    return QueryResult(success=True, answer=Answer(raw=answer, normalized=answer, parts=[answer]))

class ExtraTests(unittest.TestCase):
    def setUp(self):
        self.store=Store(); self.session=Session(); self.executor=extra.Executor(self.session,self.store)
        self.task=TaskPoint(chapter_id='300',name='主观讨论',task_type='discussion',extra={'job_id':'600','is_job':True,'property':{'module':'insertbbs','mid':'700','title':'我眼中的思想家','replywordnum':20}})
        self.runner=NS(context={'course_id':'100','clazz_id':'200','cpi':'400','course_name':'思想理论课'},wait_if_paused=lambda:True,sleep=lambda _:True)
    def execute(self, query=None, confirmed=False):
        point=TaskPoint(finished=confirmed,extra={'job_id':'600'})
        with patch.object(SearchBatch,'query',query or (lambda *_:result())), patch.object(taskpoint,'fetch_task_points',return_value=[point]):
            return self.executor.execute(self.task,self.runner)
    def posts(self): return [call for call in self.session.calls if call[0]=='POST']
    def test_subjective_discussion_uses_answer_and_requires_platform_completion(self):
        value=self.execute(); self.assertTrue(value.success); self.assertFalse(value.finished)
        self.assertEqual(len(self.posts()),1); self.assertIn('%',self.posts()[0][2]['data']['topic_content'])
        payload=self.posts()[0][2]['data'];self.assertEqual(payload['urlToken'],'fixture-page-token-261114');self.assertEqual(payload['classId'],'200');self.assertEqual(payload['bbsid'],'b'*32)
        self.assertEqual(self.posts()[0][2]['headers']['X-Requested-With'],'XMLHttpRequest')
        self.assertFalse(self.task.extra['completion_verified'])
    def test_missing_page_token_never_posts(self):
        self.session.token=False; value=self.execute();self.assertFalse(value.finished);self.assertFalse(self.posts());self.assertIn('提交凭据',value.message)
    def test_confirmed_completion_is_explicit_and_retries_do_not_duplicate_reply(self):
        value=self.execute(confirmed=True); self.assertTrue(value.finished)
        self.assertTrue(self.task.extra['completion_verified']); self.execute(confirmed=True)
        self.assertEqual(len(self.posts()),1)
    def test_timeout_after_post_never_causes_blind_retry(self):
        self.session.fail_post=True; value=self.execute(); self.assertFalse(value.finished)
        self.session.fail_post=False; self.execute(); self.assertEqual(len(self.posts()),1)
    def test_miss_error_and_short_answer_never_publish(self):
        for query in (lambda *_:QueryResult(success=False),lambda *_:result('太短'),lambda *_:(_ for _ in ()).throw(SearchFailure())):
            with self.subTest(query=query):
                value=self.execute(query); self.assertFalse(value.finished); self.assertTrue(self.task.extra['manual_required'])
        self.assertFalse(self.posts())
    def test_save_or_nomove_never_publish_discussion(self):
        for upload in ('save','nomove'):
            self.store.values[KEY]['settings']['upload']=upload
            value=self.execute(); self.assertFalse(value.finished); self.assertFalse(self.posts())
    def test_random_answer_settings_are_disabled_for_supplemental_tasks(self):
        def query(batch,*_):
            self.assertFalse(batch.state['settings']['randomWork-choice'])
            self.assertFalse(batch.state['settings']['randomWork-complete'])
            return QueryResult(success=False)
        self.execute(query); self.assertTrue(self.store.values[KEY]['settings']['randomWork-choice'])
    def test_unknown_insertbbs_is_mapped_without_changing_video(self):
        extra.install(self.store)
        data={'defaults':{'courseid':'100','clazzId':'200'},'attachments':[
            {'type':'unknown','job':True,'jobid':'1','property':{'module':'insertbbs','title':'Discussion'}},
            {'type':'video','job':True,'jobid':'2','property':{'module':'insertvideo','title':'Video'}}]}
        points=taskpoint.parse_task_points(data,'300')
        self.assertEqual([point.task_type for point in points],['discussion','video'])
        self.assertEqual(points[0].extra[extra.DEFAULTS_KEY]['courseid'],'100')
    def test_independent_questionnaire_is_manual_not_falsely_complete(self):
        self.task.task_type='survey'; self.task.extra['property']['module']='questionnaire'
        value=self.execute(); self.assertFalse(value.finished); self.assertFalse(self.session.calls)
    def test_questionnaire_uses_original_answer_fields_and_does_not_mark_save_complete(self):
        self.task.task_type='survey'; self.task.extra['property'].update(module='insertvote',id='900')
        form=work.WorkForm(action='https://mooc1.chaoxing.com/submit',fields=[('answerwqbid','q1'),('typeq1','4')],questions=[work.WorkQuestion(stem='你的理解',qtype=4,question_id='q1')])
        self.store.values[KEY]['settings']['upload']='save'
        with patch.object(work,'parse_work_page',return_value=form),patch.object(work,'page_is_graded',return_value=False),patch.object(work,'submit_work',return_value=work.WorkSubmitResult(ok=True,message='Saved')) as submit:
            value=self.execute(); self.assertTrue(value.success); self.assertFalse(value.finished)
            self.assertFalse(submit.call_args.kwargs['submit'])
            fields=submit.call_args.args[2]; self.assertTrue(any('课程学习' in str(v) for v in fields.values()),fields)
    def test_course_name_reaches_gateway_without_changing_title(self):
        captured=[]
        class Gateway(Session):
            def request(_,method,url,**kwargs):
                captured.append(kwargs['json']); response=requests.Response();response.status_code=200;response._content=b'{"kind":"hit","answer":"Answer"}';return response
        state={**copy.deepcopy(POLICY),'runner':self.runner,'queried':0,'found':0}
        batch=SearchBatch(state)
        try:
            with patch.object(requests,'Session',Gateway):batch.query(Question(stem='raw title',qtype=QuestionType.SHORT_ANSWER),None)
        finally:batch.close()
        self.assertEqual(captured[0]['courseName'],'思想理论课');self.assertEqual(captured[0]['title'],'raw title')
    def test_questionnaire_completion_callback_requires_confirmed_submission(self):
        self.task.task_type='survey';self.task.extra.update(jtoken='fixture-token');self.task.extra['property'].update(module='insertvote',id='900')
        form=work.WorkForm(action='https://mooc1.chaoxing.com/submit',fields=[('answerwqbid','q1'),('typeq1','4')],questions=[work.WorkQuestion(stem='你的理解',qtype=4,question_id='q1')])
        original_get=self.session.get
        def get(url,**kwargs):
            if '/job/vote?' in url:
                self.session.calls.append(('GET',url,kwargs));response=requests.Response();response.status_code=200;response.url=url;response._content=b'{"status":true}';return response
            return original_get(url,**kwargs)
        for graded in (False,True):
            self.session.calls.clear()
            with patch.object(self.session,'get',side_effect=get),patch.object(work,'parse_work_page',return_value=form),patch.object(work,'page_is_graded',side_effect=[False,graded]),patch.object(work,'submit_work',return_value=work.WorkSubmitResult(ok=True,message='Accepted')):
                value=self.execute(confirmed=True)
                callbacks=[call for call in self.session.calls if '/job/vote?' in call[1]]
                self.assertEqual(len(callbacks),int(graded));self.assertEqual(value.finished,graded)
    def test_untrusted_task_url_is_rejected(self):
        for url in ('http://groupweb.chaoxing.com/a','https://chaoxing.com.evil.example/a','https://user@groupweb.chaoxing.com/a'):
            with self.assertRaises(ValueError):extra.checked_url(url)

class AIPromptTests(unittest.TestCase):
    def test_actual_provider_gets_course_prompt_and_parses_short_answers(self):
        bridge.install_short_answer_prompt(); payloads=[]
        class AI(Session):
            answer='这是课程概念的回答。'
            def request(self,method,url,**kwargs):
                payloads.append(kwargs.get('json'));response=requests.Response();response.status_code=200
                response._content=json.dumps({'choices':[{'message':{'content':json.dumps({'answer':self.answer},ensure_ascii=False)}}]},ensure_ascii=False).encode('utf-8');return response
        payload={'title':'我的理解','type':'short','options':[],'key':'fixture-key','courseName':'思想理论课','enrollmentYear':date.today().year-(date.today().month<9)-1,'ai':{'model':'fixture','baseUrl':'https://example.invalid/v1','type':'openai'}}
        service=bridge.OriginalSearchService(session_factory=AI)
        value=service.query('ai',payload);self.assertEqual(value,{'kind':'hit','answer':'这是课程概念的回答.'})
        self.assertIn('我是一名大二学生，这是[思想理论课]课上的题目。',json.dumps(payloads,ensure_ascii=False))
        for answer in (None,'无法解答','抱歉，我无法回答这个问题'):
            AI.answer=answer
            self.assertEqual(service.query('ai',payload),{'kind':'miss','explicitMiss':True})

class ReadingContractTests(unittest.TestCase):
    def test_original_reader_matches_the_official_readv2_request_and_requires_success(self):
        from core.other_tasks import ReadExecutor
        from urllib.parse import urlsplit, parse_qs
        calls=[]
        class Reading(Session):
            success=True
            def request(self,method,url,**kwargs):
                calls.append((method,url));response=requests.Response();response.status_code=200;response.url=url
                response._content=json.dumps({'status':self.success}).encode();return response
        task=TaskPoint(chapter_id='300',name='阅读样本',task_type='read',extra={'job_id':'600','is_job':True,'jtoken':'fixture'})
        runner=NS(context={'course_id':'100','clazz_id':'200'},wait_if_paused=lambda:True,sleep=lambda _:True)
        reader=ReadExecutor(session=Reading())
        for success in (True,False):
            Reading.success=success;value=reader.execute(task,runner)
            self.assertEqual(value.finished,success)
        method,url=calls[0];self.assertEqual(method,'GET');self.assertEqual(urlsplit(url).path,'/mooc-ans/job/readv2')
        params=parse_qs(urlsplit(url).query);self.assertEqual(params['courseid'],['100']);self.assertEqual(params['clazzid'],['200']);self.assertEqual(params['knowledgeid'],['300']);self.assertEqual(params['jtoken'],['fixture'])

if __name__=='__main__':unittest.main()
