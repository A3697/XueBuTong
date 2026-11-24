"""Delayed restore -> real protected scheduler through the JS startup controller.

Task acquisition/execution is synthetic. Only loopback HTTP is permitted; this
test never logs in or opens a real course. Wall-clock restoration exceeds 30s.
"""
from pathlib import Path
from types import SimpleNamespace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json, os, socket, subprocess, sys, tempfile, threading, time

SOURCE=Path(__file__).resolve().parents[1]
RUNTIME=Path(os.environ['XBT_RUNTIME_ROOT'])/'star-runtime'
RECORD=Path(tempfile.mkdtemp(prefix='startup-runtime-',dir=os.environ['XBT_QA_ROOT']))
os.chdir(RECORD)
sys.path[:0]=[str(SOURCE/'src/fusion'),str(RUNTIME)]
HANDLES=[os.add_dll_directory(str(p)) for p in {RUNTIME,*[x.parent for x in RUNTIME.rglob('*.pyd')]}]
original_connect=socket.socket.connect
def local_only(sock,address):
    if not isinstance(address,tuple) or address[0]!='127.0.0.1':raise AssertionError('External network forbidden')
    return original_connect(sock,address)
socket.socket.connect=local_only
import core.paths
core.paths.user_data_dir=lambda:RECORD
from core.storage import KeyValueStore
from core.models import Course,TaskPoint
from core.taskpoint import Chapter
from core.scheduler import TaskResult
from engine.models import QueueItem
from engine.app import AppEngine
from integration_state import IntegrationState

fixtures=[]
for number,(size,delay) in enumerate(((14,35),(4,40))):
    data=RECORD/str(number);data.mkdir()
    store=KeyValueStore(data/'store.json');store.set('config.max_retry',0)
    engine=AppEngine(store=store,emit=lambda _:None,base_dir=data)
    engine.session=SimpleNamespace();engine.user=SimpleNamespace(uid='qa'+str(number),name='Synthetic')
    calls=[]
    for index in range(size):
        cid=str(100+index)
        course=Course(course_id=str(1000+index),clazz_id='1',name='Synthetic course')
        chapter=Chapter(chapter_id=cid,name='Synthetic chapter',jobcount=1,unfinishcount=1)
        task=TaskPoint(chapter_id=cid,name='Synthetic task',task_type='workid',index=0)
        engine.queue.append(QueueItem(course=course,chapter_id='0',lazy=True,status='loading',chapters=[chapter],chapter_points={cid:[task]},chapter_state={cid:'pending'},tasks=[task]))
    state=IntegrationState(engine,store,instrument_video=False)
    engine.ensure_chapter_points=lambda item,chapter:item.chapter_points[chapter.chapter_id]
    def execute(task,runner,_calls=calls):
        _calls.append(task.chapter_id);task.finished=True;task.extra['completion_verified']=True
        return TaskResult(success=True,finished=True,message='Synthetic confirmed')
    executor=SimpleNamespace(execute=execute)
    engine._run_one=lambda item,index,args,_engine=engine,_executor=executor:AppEngine._run_lazy(_engine,item,index,{'workid':_executor},{'course_id':item.course.course_id,'clazz_id':item.course.clazz_id},False)
    fixtures.append({'engine':engine,'state':state,'calls':calls,'size':size,'delay':delay,'starts':0})
started=time.monotonic()
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):self.handle_request()
    def do_POST(self):self.handle_request()
    def handle_request(self):
        uid,route=self.path.lstrip('/').split('/',1);f=fixtures[int(uid)];engine=f['engine'];route='/'+route
        elapsed=time.monotonic()-started
        if elapsed>=f['delay']:
            for item in engine.queue:
                if item.status=='loading':item.status='ready'
        if route=='/api/integration/monitor-progress':result=f['state'].monitor_progress()
        elif route=='/api/integration/run-options':result={'ignore_progress':False}
        elif route=='/api/run/start':
            assert elapsed>=f['delay'],'Started before queue restoration'
            f['starts']+=1;engine.start_run({'ignore_progress':False});result={'accepted':True}
        elif route=='/api/run':result={'running':bool(getattr(engine,'_run_worker',None) and engine._run_worker.is_alive()),'paused':False,'stopping':False}
        else:raise AssertionError(route)
        payload=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
script=RECORD/'exercise.cjs'
script.write_text("""
const {applyStarStartup}=require(process.argv[2]),{StarMonitor}=require(process.argv[3]);
const events=[];
Promise.all(['0','1'].map(async uid=>{
 const runtime={uid,loggedIn:true,port:1,abort:new AbortController(),enhanced:true};
 const controller={runtimes:new Map([[uid,runtime]]),appendLog:(id,level,message)=>events.push({id,level,message}),openHtml:async()=>{throw Error('Unexpected empty panel');},
 request:async(_r,method,url,body)=>{const response=await fetch(process.argv[4]+'/'+uid+url,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});if(!response.ok)throw Error('HTTP failed');return response.json();}};
 await applyStarStartup({uid,controller,starMonitor:new StarMonitor(controller),sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms)),preferences:{speeds:{},launchPlans:{[uid]:{autoRunStar:true}}}});
 if(runtime.startupSetup.state!=='done')throw Error('Startup failed: '+runtime.startupSetup.state);
})).then(()=>console.log(JSON.stringify({passed:true,events}))).catch(e=>{console.error(e);process.exitCode=1;});
""",encoding='utf-8')
result={'passed':False}
try:
    completed=subprocess.run([r'C:\Program Files\nodejs\node.exe',str(script),str(SOURCE/'src/fusion/star-startup.cjs'),str(SOURCE/'src/fusion/star-monitor.cjs'),'http://127.0.0.1:'+str(server.server_port)],capture_output=True,text=True,encoding='utf-8',timeout=65)
    assert completed.returncode==0,completed.stderr
    output=json.loads(completed.stdout)
    for f in fixtures:
        worker=getattr(f['engine'],'_run_worker',None)
        if worker:worker.join(5)
        assert f['starts']==1 and len(f['calls'])==f['size'],(f['starts'],len(f['calls']),f['size'])
    result={'passed':True,'seconds':time.monotonic()-started,'cases':[{'courses':f['size'],'restoreSeconds':f['delay'],'startRequests':f['starts'],'executedTasks':len(f['calls'])} for f in fixtures],'controller':output,'network':'loopback only; no real accounts','backend':'shipped protected engine and scheduler; synthetic acquisition/executors'}
finally:
    server.shutdown();server.server_close()
    for f in fixtures:f['engine'].stop_and_wait(timeout=5)
    (RECORD/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(result,record=str(RECORD)),ensure_ascii=True))
