"""Offline contract tests against the shipped homework parser and engine binding."""
from pathlib import Path
import html.parser  # Match the host's stdlib-first loading before protected modules.
import json, os, socket, sys, tempfile, threading, time, unittest
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch

SOURCE=Path(__file__).resolve().parents[1]
RUNTIME=Path(os.environ['XBT_RUNTIME_ROOT'])/'star-runtime'
DATA=Path(tempfile.mkdtemp(prefix='homework-',dir=os.environ['XBT_QA_ROOT']))
sys.dont_write_bytecode=True
sys.path[:0]=[str(SOURCE/'src/fusion'),str(RUNTIME)]
DLLS=[os.add_dll_directory(str(d)) for d in {RUNTIME,*[f.parent for f in RUNTIME.rglob('*.pyd')]}]
os.chdir(DATA)
import core.paths
core.paths.user_data_dir=lambda:DATA
def blocked(*args,**kwargs):raise RuntimeError('Offline test: network disabled')
socket.socket.connect=socket.create_connection=blocked
import requests
import core.homework as upstream
import engine.app as app
import homework_catalog as catalog

def page(ids,done=0,total=None,number=1,pages=1,states=None,course='100',clazz='200'):
    states=states or ['已完成' if i<done else '未交' for i in range(len(ids))]
    rows=''.join(f'<li onclick="goTask(this);" data="https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task?workId={uid}&amp;answerId=0" aria-label="合成作业 ; {status}"><p class="overHidden2 fl">合成作业</p></li>' for uid,status in zip(ids,states))
    return (f'<input value="{course}" id="courseId"><input id="classId" value="{clazz}"><input id="status" value="0">'
            f'<span>{done}/{len(ids) if total is None else total}</span>'+rows+('' if ids else '暂无作业')+
            f'<script>$("#page").paging({{nowPage : {number},pageNum : {pages},callback:function(num){{}}}});</script>')

class Session(requests.Session):
    def __init__(self,pages,entry='<input value="fixture" name="workEnc">'):
        super().__init__();self.pages=pages;self.entry=entry;self.calls=[];self.inflight=0;self.peak=0
    def get(self,url,**kwargs):
        self.calls.append(url);self.inflight+=1;self.peak=max(self.peak,self.inflight)
        try:
            time.sleep(.001)
            value=self.entry if '/visit/' in url else self.pages[int(parse_qs(urlsplit(url).query)['pageNum'][0])]
            if isinstance(value,Exception):raise value
            status,text,redirect=value if isinstance(value,tuple) else (200,value,url)
            response=requests.Response();response.status_code=status;response.url=redirect;response._content=text.encode('utf-8');response.encoding='utf-8';return response
        finally:self.inflight-=1

class HomeworkCatalog(unittest.TestCase):
    def setUp(self):self.interval=patch.object(catalog,'_INTERVAL',0);self.interval.start()
    def tearDown(self):self.interval.stop()
    def read(self,s):return catalog.fetch_homework_list(s,'100','200','300',timeout=5)
    def assert_code(self,code,s):
        with self.assertRaises(catalog.HomeworkListError) as result:self.read(s)
        self.assertEqual(result.exception.code,code)
    def test_all_three_pages_and_pending_grading(self):
        statuses=['已完成']*13+['待批阅']*6+['未交']*8
        s=Session({i+1:page(list(range(i*12+1,min(i*12+13,28))),19,27,i+1,3,statuses[i*12:(i+1)*12]) for i in range(3)})
        rows=self.read(s);self.assertEqual(len(rows),27);self.assertEqual(sum(x['done'] for x in rows),19);self.assertEqual([x['work_id'] for x in rows],[str(i) for i in range(1,28)]);self.assertEqual(len(s.calls),4)
    def test_two_pages_and_refresh(self):
        s=Session({1:page(list(range(1,13)),12,14,1,2),2:page([13,14],12,14,2,2,['未交','未交'])})
        self.assertEqual(len(self.read(s)),14);self.assertEqual(len(self.read(s)),14);self.assertEqual(len(s.calls),6)
    def test_explicit_empty_catalogue(self):self.assertEqual(self.read(Session({1:page([])})),[])
    def test_closed_deadline_does_not_imply_submission(self):
        self.assertFalse(self.read(Session({1:page([1],0,1,states=['已截止'])}))[0]['done'])
    def test_verification_is_not_a_missing_entry_or_empty_list(self):
        self.assert_code('verification_required',Session({},(202,'verify','https://mooc1.chaoxing.com/antispiderShowVerify.ac')))
    def test_blocked_response_on_second_page_discards_partial_results(self):
        self.assert_code('verification_required',Session({1:page(list(range(1,13)),0,14,1,2),2:(202,'verify','https://mooc1.chaoxing.com/antispiderShowVerify.ac')}))
    def test_login_redirect_is_not_empty(self):self.assert_code('login_required',Session({},(200,'login','https://passport2.chaoxing.com/login')))
    def test_non_success_status(self):self.assert_code('http_error',Session({},(503,'error','https://mooc1.chaoxing.com/visit/stucoursemiddle')))
    def test_missing_entry(self):self.assert_code('missing_entry',Session({},'<html>unexpected</html>'))
    def test_html_error_with_success_status(self):self.assert_code('unexpected_page',Session({1:'<html>error</html>'}))
    def test_wrong_course_or_filtered_subset(self):
        for html in [page([1],course='different'),page([1]).replace('id="status" value="0"','id="status" value="1"')]:
            with self.subTest(html=html):self.assert_code('unexpected_page',Session({1:html}))
    def test_missing_total(self):self.assert_code('missing_total',Session({1:page([]).replace('<span>0/0</span>','')}))
    def test_empty_error_is_not_an_empty_course(self):self.assert_code('incomplete_page',Session({1:page([]).replace('暂无作业','error')}))
    def test_missing_pagination_detected_by_total(self):self.assert_code('count_mismatch',Session({1:page([1,2],0,3)}))
    def test_repeated_page_cannot_silently_drop_tasks(self):self.assert_code('duplicate_page',Session({1:page([1,2],0,3,1,2),2:page([1],0,3,2,2)}))
    def test_changed_inventory_fails_closed(self):self.assert_code('catalogue_changed',Session({1:page([1,2],0,3,1,2),2:page([3,4],0,4,2,2)}))
    def test_wrong_page_number(self):self.assert_code('invalid_pagination',Session({1:page([1],0,2,2,2)}))
    def test_incomplete_status_parse_never_claims_complete(self):self.assert_code('count_mismatch',Session({1:page([1],1,1,states=['未知状态'])}))
    def test_timeout_discards_partial_results(self):
        with self.assertRaises(requests.Timeout):self.read(Session({1:page([1],0,2,1,2),2:requests.Timeout()}))
    def test_blocked_account_cooldown_does_not_block_other_account(self):
        s=Session({},(202,'verify','https://mooc1.chaoxing.com/antispiderShowVerify.ac'))
        self.assert_code('verification_required',s);self.assert_code('verification_required',s);self.assertEqual(len(s.calls),1)
        self.assertEqual(self.read(Session({1:page([])})),[])
        s.cookies.set('manual-login','new-session');s.entry='<input id="workEnc" value="fixture">';s.pages={1:page([])}
        self.assertEqual(self.read(s),[]);self.assertEqual(len(s.calls),3)
    def test_parallel_reads_are_serialized_per_session(self):
        s=Session({1:page([1])});errors=[]
        def read():
            try:self.read(s)
            except Exception as e:errors.append(e)
        threads=[threading.Thread(target=read) for _ in range(3)]
        for t in threads:t.start()
        for t in threads:t.join()
        self.assertEqual(errors,[]);self.assertEqual(s.peak,1)
    def test_engine_and_completion_share_adapter(self):
        original=upstream.fetch_homework_list
        original_load=app.AppEngine._load_item
        bindings=[(m,k) for n,m in tuple(sys.modules.items()) if n.startswith(('engine.','core.','server.')) and m for k,v in tuple(vars(m).items()) if v is original]
        self.assertTrue(any(m.__name__.startswith('engine.') for m,k in bindings))
        try:
            catalog.install();catalog.install()
            for m,k in bindings:self.assertIs(getattr(m,k),catalog.fetch_homework_list)
        finally:
            for m,k in bindings:setattr(m,k,original)
            app.AppEngine._load_item=original_load


class HomeworkQueue(unittest.TestCase):
    def setUp(self):
        self.original=upstream.fetch_homework_list;self.original_load=app.AppEngine._load_item
        self.bindings=[(m,k) for n,m in tuple(sys.modules.items()) if n.startswith(('engine.','core.','server.')) and m for k,v in tuple(vars(m).items()) if v is self.original]
        self.interval=patch.object(catalog,'_INTERVAL',0);self.interval.start();catalog.install()
        from core.storage import KeyValueStore
        from core.models import Course
        from engine.models import QueueItem
        self.events=[]
        self.engine=app.AppEngine(store=KeyValueStore(DATA/(self.id()+'.json')),emit=self.events.append,base_dir=DATA)
        self.item=QueueItem(course=Course(course_id='100',clazz_id='200',cpi='300',name='Synthetic'),mode='homework')
        self.engine.queue.append(self.item)
    def tearDown(self):
        for m,k in self.bindings:setattr(m,k,self.original)
        app.AppEngine._load_item=self.original_load;self.interval.stop()
    def load(self,pages):
        self.engine.session=Session(pages)
        self.engine._load_item(self.item,force=True)
    def test_empty_course_clears_failed_chapter_status_and_reload_succeeds(self):
        self.item.status='failed';self.item.error='old failure';self.item.empty_reason='old chapters'
        self.load({1:page([])});self.assertEqual(self.item.status,'done');self.assertEqual(self.item.error,'');self.assertTrue(self.item._fusion_homework_loaded)
        self.engine._load_item(self.item,force=True);self.assertEqual(self.item.status,'done');self.assertEqual(len(self.engine.session.calls),4)
        self.assertEqual([e['payload']['item']['status'] for e in self.events if e['type']=='queue.item'],['loading','done','loading','done'])
    def test_queue_contains_pending_homeworks_from_all_three_pages(self):
        states=['已完成']*13+['待批阅']*6+['未交']*8
        self.load({i+1:page(list(range(i*12+1,min(i*12+13,28))),19,27,i+1,3,states[i*12:(i+1)*12]) for i in range(3)})
        self.assertEqual(self.item.status,'ready');self.assertEqual(len(self.item.tasks),8)
        self.assertEqual([x.extra['work_id'] for x in self.item.tasks],[str(i) for i in range(20,28)])
    def test_failed_reload_cannot_reuse_verified_empty_flag(self):
        self.load({1:page([])})
        self.engine.session=Session({},(202,'verify','https://mooc1.chaoxing.com/antispiderShowVerify.ac'))
        try:self.engine._load_item(self.item,force=True)
        except catalog.HomeworkListError:pass
        self.assertEqual(self.item.status,'failed');self.assertFalse(self.item._fusion_homework_loaded)
        self.assertIn('验证',self.item.error)
    def test_non_homework_modes_use_original_loading(self):
        from unittest.mock import Mock
        original=Mock(return_value='unchanged')
        for m,k in self.bindings:setattr(m,k,self.original)
        app.AppEngine._load_item=original;catalog.install()
        for mode in ('task','both'):
            self.item.mode=mode
            self.assertEqual(self.engine._load_item(self.item,force=True),'unchanged')
            original.assert_called_with(self.engine,self.item,force=True)

if __name__=='__main__':unittest.main(verbosity=2)
