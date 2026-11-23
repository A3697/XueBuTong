"""Opening priority against the shipped engine/scheduler; synthetic acquisition only."""
from pathlib import Path
from types import SimpleNamespace
import json, os, socket, sys, tempfile, threading, time

SOURCE=Path(__file__).resolve().parents[1]
RUNTIME=Path(os.environ['XBT_RUNTIME_ROOT'])/'star-runtime'
RECORD=Path(tempfile.mkdtemp(prefix='course-watch-runtime-',dir=os.environ['XBT_QA_ROOT']))
os.chdir(RECORD)
sys.path[:0]=[str(SOURCE/'src/fusion'),str(RUNTIME)]
HANDLES=[os.add_dll_directory(str(p)) for p in {RUNTIME,*[x.parent for x in RUNTIME.rglob('*.pyd')]}]
def blocked(*a,**k):raise AssertionError('runtime fixture forbids network')
socket.socket.connect=blocked;socket.socket.connect_ex=blocked;socket.create_connection=blocked
import core.paths
core.paths.user_data_dir=lambda:RECORD
from core.storage import KeyValueStore
from core.models import Course,TaskPoint
from core.taskpoint import Chapter
from core.scheduler import TaskResult
from engine.models import QueueItem
from engine.app import AppEngine
from integration_state import IntegrationState
from queue_prune import install as install_queue_prune
from course_watch import CourseWatch

store=KeyValueStore(RECORD/'store.json');store.set('config.max_retry',0)
store.set('task.progress.keep-fixture',{'0':{'state':'done','fixture':'preserve'}})
events=[]
engine=AppEngine(store=store,emit=events.append,base_dir=RECORD)
engine.session=SimpleNamespace();engine.user=SimpleNamespace(uid='qa-fixture',name='Synthetic')
old_course=Course(course_id='21',clazz_id='22',name='Interrupted synthetic course')
new_course=Course(course_id='11',clazz_id='12',name='Opening synthetic course')
engine.courses=[old_course,new_course]
def fill(item,cid):
    item.chapters=[Chapter(chapter_id=cid,name='Synthetic chapter',jobcount=1,unfinishcount=1)]
    item.tasks=[TaskPoint(chapter_id=cid,name='Synthetic task',task_type='workid',index=0)]
    item.chapter_points={cid:item.tasks};item.chapter_state={cid:'pending'};item.status='ready'
old_item=QueueItem(course=old_course,chapter_id='0',lazy=True)
fill(old_item,'201');engine.queue.append(old_item)
state=IntegrationState(engine,store,instrument_video=False)
started=threading.Event();calls=[];counts={'active':0,'max':0}
def execute(task,runner):
    counts['active']+=1;counts['max']=max(counts['max'],counts['active'])
    calls.append(task.chapter_id)
    try:
        if task.chapter_id=='201' and calls.count('201')==1:
            started.set();deadline=time.monotonic()+5
            while not engine._stop_requested and time.monotonic()<deadline:time.sleep(.01)
            assert engine._stop_requested,'priority did not stop the first worker'
            return TaskResult(success=False,finished=False,message='Synthetic interrupted task')
        task.finished=True;task.extra['completion_verified']=True
        return TaskResult(success=True,finished=True,message='Synthetic confirmed task')
    finally:counts['active']-=1
executor=SimpleNamespace(execute=execute)
engine.ensure_chapter_points=lambda item,chapter:item.chapter_points[chapter.chapter_id]
engine.request_load=lambda item:fill(item,str(item.chapter_id))
engine._run_one=lambda item,index,args:AppEngine._run_lazy(engine,item,index,{'workid':executor},
    {'course_id':item.course.course_id,'clazz_id':item.course.clazz_id},bool(args.get('ignore_progress')))
original_runner=engine._make_runner
def make_runner(*a,**k):
    runner=original_runner(*a,**k);runner.max_retry=0;return runner
engine._make_runner=make_runner
install_queue_prune(engine,store,state)
watcher=CourseWatch(engine,store,reader=lambda *a:[{'chapter_id':'101','available':True,'pending':True},
                                                  {'chapter_id':'102','available':True,'pending':True}])
result={}
try:
    watcher.configure({'enabled':True,'interval_seconds':60,'courses':[{'course_id':'11','clazz_id':'12'}]})
    engine.start_run({'ignore_progress':False})
    assert started.wait(2),'initial worker did not start'
    watcher.tick()
    worker=engine._run_worker
    worker.join(6)
    assert not worker.is_alive(),'replacement worker failed to finish'
    assert calls==['201','101','102','201'],calls
    assert counts['max']==1,counts
    assert engine.queue[-1] is old_item,'original queue object changed'
    assert [q.chapter_id for q in engine.queue]==['101','102','0']
    assert store.get('task.progress.keep-fixture')=={'0':{'state':'done','fixture':'preserve'}}
    assert all(q.status=='done' for q in engine.queue),[q.status for q in engine.queue]
    result={'passed':True,'executionOrder':calls,'maxConcurrentExecutors':counts['max'],
            'originalQueueObjectPreserved':True,'existingProgressPreserved':True,
            'queueOrder':[q.chapter_id for q in engine.queue],'network':'disabled'}
finally:
    watcher.close();engine.stop_and_wait(timeout=5)
    (RECORD/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(result,record=str(RECORD)),ensure_ascii=True))
