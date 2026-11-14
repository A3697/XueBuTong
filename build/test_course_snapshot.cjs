'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../src/star-panel/app.js'),'utf8');
const functions=app.slice(app.indexOf('function acceptCourses('),app.indexOf('\nasync function addAllUnfinished()'));
const course={course_id:'1',clazz_id:'2',name:'Synthetic course'};
function harness(api){
 const context={S:{courses:[course]},api,guard:fn=>fn(),renderCourses(){},refreshCompletionList(){},refreshProgress:async()=>{},setStatus(){}};
 vm.runInNewContext(functions+';this.accept=acceptCourses;this.cached=refreshCachedCourses;this.reload=reloadCourses;',context);return context;
}
test('names-only snapshots and transient empty lists cannot replace usable course records',()=>{
 const h=harness();for(const value of [['Synthetic course'],[],null,[{name:'Missing IDs'}]])assert.equal(h.accept(value),false);
 assert.equal(h.S.courses[0],course);assert.equal(h.accept([{...course,clazz_id:'3'}]),true);assert.equal(h.S.courses[0].clazz_id,'3');
 h.S.courses=[];assert.equal(h.accept([]),true);
});
test('names-only snapshot recovery shares one cached HTTP read and preserves records on failure',async()=>{
 let resolve,count=0;const h=harness(()=>{count++;return new Promise(r=>resolve=r);});
 const a=h.cached(),b=h.cached();assert.equal(a,b);assert.equal(count,1);resolve({courses:[{...course,clazz_id:'3'}]});await a;assert.equal(h.S.courses[0].clazz_id,'3');
 h.api=async()=>{throw Error('offline');};await assert.rejects(h.cached(),/offline/);assert.equal(h.S.courses[0].clazz_id,'3');
});
test('refresh resolves backend name summaries through the full-record endpoint',async()=>{
 const calls=[],h=harness(async(method,url)=>{calls.push([method,url]);return{courses:method==='POST'?['Synthetic course']:[{...course,clazz_id:'4'}]};});
 await h.reload();assert.deepEqual(calls,[['POST','/api/courses/reload'],['GET','/api/courses']]);assert.equal(h.S.courses[0].clazz_id,'4');
});
test('an empty refresh retains the last complete course list',async()=>{
 const h=harness(async()=>({courses:[]}));await h.reload();assert.equal(h.S.courses[0],course);
});
