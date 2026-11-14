'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),State=require('../src/star-panel/task-state.js');
test('new task results reconcile stale chapter catalogue badges',()=>{
 const chapter={id:'27',has_points:true,catalog_state:'pending',catalog_unfinished:1,tasks:[{done:true},{status:'pending',finished:true}]};
 assert.deepEqual(State.chapter(chapter),{status:'done',remaining:0});
 chapter.tasks[1]={status:'pending'};assert.deepEqual(State.chapter(chapter),{status:'pending',remaining:1});
 chapter.catalog_state='done';assert.equal(State.chapter(chapter).status,'pending');
 assert.equal(State.chapter(chapter,(t,i)=>State.status(t,i===1?{status:'running'}:null)).status,'running');
 assert.equal(State.chapter(chapter,(t,i)=>State.status(t,i===1?{status:'failed'}:null)).status,'failed');
 assert.equal(State.chapter({...chapter,tasks:[]}).status,'done');
});
test('current task belongs only to the executing course and uses stable chapter/task identity',()=>{
 const data={queueIndex:1,currentChapter:'27',run:{running:true,active_index:1,task_index:2},live:[{chapter_id:'26',index:0,status:'running'},{chapter_id:'27',index:1,status:'running'}]};
 assert.deepEqual(State.active(data),{chapter:'27',index:1,key:'1:27:1'});
 assert.equal(State.active({...data,queueIndex:0}),null);assert.equal(State.active({...data,run:{...data.run,running:false}}),null);
 assert.equal(State.active({...data,currentChapter:'28'}).index,2);
 assert.equal(State.active({...data,run:{...data.run,task_index:1},live:[{chapter_id:'27',index:1,status:'done'}]}),null);
});
test('course completion needs a full, nonempty task tree and reconciles stale catalogue counts',()=>{
 const complete={id:'27',has_points:true,catalog_state:'pending',catalog_unfinished:1,tasks:[{done:true}]};
 assert.equal(State.course([complete]).complete,true);
 assert.equal(State.course([complete,{id:'28',has_points:true,catalog_state:'pending',tasks:[]}]),null);
 assert.equal(State.course([{id:'0',is_container:true},{id:'1',has_points:false}]),null);
 assert.equal(State.course([]),null);
 assert.equal(State.course([complete],()=> 'running').complete,false);
});

test('task evidence separates quiz confirmation from valid video local skips',()=>{
 const quiz={task_type:'work',done:true,local_done:true};
 assert.equal(State.status(quiz),'unverified');
 assert.equal(State.status({...quiz,status:'ok'}),'unverified','Persisted old ok is not a submission readback');
 assert.equal(State.status(quiz,{status:'skipped'}),'unverified');
 assert.equal(State.status({...quiz,completion_verified:true},{status:'skipped'}),'local_done');
 assert.equal(State.status({...quiz,finished:true},{status:'skipped'}),'done');
 assert.equal(State.status({...quiz,server_done:true}),'server_done');
 assert.equal(State.status({...quiz,extra:{isPassed:true}}),'done');
 assert.equal(State.status({...quiz,isPassed:true}),'done');
 assert.equal(State.status({task_type:'video',status:'ready',finished:false}),'pending');
 assert.equal(State.status(quiz,{status:'ok'}),'ok','A current scheduler finished event is affirmative evidence');
 assert.equal(State.status({task_type:'video',local_done:true},{status:'skipped'}),'local_done');
 assert(State.done.has('local_done'));assert(!State.done.has('skipped'));assert(!State.done.has('unverified'));
});

test('partial and failure override old flags and cannot complete chapters or courses',()=>{
 for(const state of ['partial','failed']){
  const task={task_type:'work',done:true,finished:true,server_done:true,completion_verified:true};
  assert.equal(State.status(task,{status:state}),state);
  const chapter={id:'c',state:'done',catalog_state:'done',finished:true,has_points:true,tasks:[task]};
  const summary=State.chapter(chapter,t=>State.status(t,{status:state}));
  assert.equal(summary.status,state);assert.equal(summary.remaining,1);
  assert.equal(State.course([chapter],t=>State.status(t,{status:state})).complete,false);
  assert.equal(State.chapter({...chapter,state,tasks:[]}).status,state);
 }
 const stale={id:'c',state:'done',catalog_state:'done',has_points:true,tasks:[{type:'workid',done:true}]};
 assert.equal(State.chapter(stale).status,'unverified');assert.equal(State.course([stale]).known,false);
});
