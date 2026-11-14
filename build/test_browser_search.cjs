'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {query,originalQuery}=require('../src/fusion/browser-search.cjs');
const Shared=require('../src/fusion/browser-answer-settings.cjs'),Answer=require('../src/fusion/answer-settings.js');
const a='ocs-11111111',b='ocs-22222222';
const question={title:'Test question',type:'single',options:[{label:'A',text:'one'},{label:'B',text:'two'}],blankCount:0,images:[]};
const methods=ids=>[...ids.map(id=>({id,enabled:true})),...['xingchan-ai','xingchan-bank'].filter(id=>!ids.includes(id)).map(id=>({id,enabled:false}))];
async function fixture(t){
 const calls=[],responses=new Map([[a,{answer:'two'}],[b,{answer:'one'}]]);
 const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw);calls.push({id:req.url.slice(1),input});const value=responses.get(req.url.slice(1));if(value==='error'){res.writeHead(503);res.end('{}');}else res.end(JSON.stringify(value));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const profiles={first:{ai:{baseUrl:'http://127.0.0.1',model:'model-A',type:'openai'},secrets:{}},second:{ai:{baseUrl:'http://127.0.0.1',model:'model-B',type:'openai'},secrets:{}}};
 const owner={labRoot:'fixture',data:{profiles},answerSettings:()=>Answer.normalize({period:1}),plainSecret:(uid,key)=>key==='aiConfigurations'?'':uid+'-'+key,bankConfig:()=>({banks:[a,b].map(id=>({id,wrapper:{name:id,url:'http://127.0.0.1:'+server.address().port+'/'+id,method:'post',data:{title:'${title}',images:{handler:'return env=>env.images'}},handler:'return r=>[undefined,r.answer]'}}))}),getSettings:()=>({searchMethods:methods([a,b,'xingchan-ai','xingchan-bank'])})};
 const provider=async(root,source,payload)=>{calls.push({id:source,key:payload.key,model:payload.ai?.model});return {kind:'hit',answer:'B'};};
 return {owner,provider,responses,calls};
}
test('browser searches in order, stops at first hit, then falls through miss/error to AI',async t=>{
 const f=await fixture(t);assert.deepEqual(await query(f.owner,'first',question,{provider:f.provider}),{kind:'hit',answer:'two'});assert.deepEqual(f.calls.map(x=>x.id),[a]);
 f.calls.length=0;f.responses.set(a,{answer:null});f.responses.set(b,'error');
 assert.deepEqual(await query(f.owner,'first',question,{provider:f.provider}),{kind:'hit',answer:'B'});assert.deepEqual(f.calls.map(x=>x.id),[a,b,'ai']);
 f.calls.length=0;f.owner.getSettings=()=>({searchMethods:methods(['xingchan-bank',a])});await query(f.owner,'first',question,{provider:f.provider});assert.deepEqual(f.calls.map(x=>x.id),['original-bank']);
});
test('explicit all-miss permits fallback; one error prevents fallback',async t=>{
 const f=await fixture(t);f.owner.getSettings=()=>({searchMethods:methods([a,b])});f.responses.set(a,{answer:null});f.responses.set(b,{answer:null});assert.deepEqual(await query(f.owner,'first',question),{kind:'miss'});
 f.responses.set(a,'error');await assert.rejects(query(f.owner,'first',question),e=>e.code==='search_incomplete_due_to_errors');
});
test('concurrent accounts keep their own keys/models and latest saved order',async t=>{
 const f=await fixture(t);f.owner.getSettings=()=>({searchMethods:methods(['xingchan-ai'])});
 await Promise.all(['first','second'].map(uid=>query(f.owner,uid,question,{provider:f.provider})));
 assert.deepEqual(f.calls.map(x=>[x.key,x.model]).sort(),[['first-aiKey','model-A'],['second-aiKey','model-B']]);
 f.calls.length=0;f.owner.getSettings=()=>({searchMethods:methods([b])});await query(f.owner,'first',question,{provider:f.provider});assert.deepEqual(f.calls.map(x=>x.id),[b]);
});
test('shipped generated wrapper preserves blanks/images and rejects ambiguous provider errors',async t=>{
 const f=await fixture(t);Shared.install(f.owner);const wrapper=Shared.read({uid:'first',configKey:Shared.capability('test','first')},'test',{}).store['common.settings.answererWrappers'][0];
 const payload=Function(wrapper.data.question.handler)()({type:'completion',title:'Fill',options:'',blankCount:3,images:['data:image/png;base64,fixture']});
 assert.equal(payload.blankCount,3);assert.deepEqual(payload.options,[]);assert.equal(payload.images.length,1);
 const handler=Function(wrapper.handler)();assert.throws(()=>handler({error:'failed'}),/failed/);assert.throws(()=>handler({kind:'miss'}),/无效/);
 assert.equal(handler({kind:'miss',explicitMiss:true,title:'Fill'})[2].fusionExplicitMiss,true);
 assert.equal(handler({kind:'hit',title:'Fill',answer:['x','y']})[1],'["x","y"]');
 await assert.rejects(Shared.answer({uid:'second',configKey:Shared.capability('test','first')},'test',{question}),/授权/);
});
test('protected original AI provider runs stateless against a local fixture',{skip:!process.env.XBT_PROVIDER_FIXTURE},async t=>{
 const requests=[];const server=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;requests.push({url:req.url,body:JSON.parse(body)});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'{"answer":"B"}'}}]}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const result=await originalQuery(process.env.XBT_PROVIDER_FIXTURE,'ai',{...question,key:'fixture-no-real-key',ai:{baseUrl:'http://127.0.0.1:'+server.address().port+'/v1',model:'fixture-model',type:'openai'}},15000);
 assert.equal(result.kind,'hit');assert.equal(result.answer,'B');assert.equal(requests.length,1);assert.equal(requests[0].body.model,'fixture-model');
 const fs=require('node:fs'),path=require('node:path');
 assert.equal(fs.existsSync(path.join(process.env.XBT_PROVIDER_FIXTURE,'star-runtime/logs/ai.log')),false,'stateless queries must not write shared runtime logs');
});
