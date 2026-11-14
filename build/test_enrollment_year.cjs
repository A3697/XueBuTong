'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const Enrollment=require('../src/fusion/enrollment-year.js'),{IntegrationController}=require('../src/fusion/controller.cjs');
const {query}=require('../src/fusion/browser-search.cjs'),{createGateway}=require('../src/fusion/gateway/index.cjs');
const vault={isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from(v),decryptString:v=>v.toString('utf8')};
const methods=[{id:'xingchan-ai',enabled:true},{id:'xingchan-bank',enabled:false}];
const question={title:'Fixture',type:'single',options:[{label:'A',text:'one'},{label:'B',text:'two'}],courseName:'合成课程',images:[]};
function fixture(t){
 const parent=path.resolve(__dirname),root=fs.mkdtempSync(path.join(parent,'enrollment-test-'));
 t.after(()=>{assert.equal(path.dirname(root),parent);assert(path.basename(root).startsWith('enrollment-test-'));fs.rmSync(root,{recursive:true,force:true});});
 return new IntegrationController({labRoot:root,vault});
}
function save(c,uid,settings){const p=c.base(uid);return c.saveSettings({uid,expectedRevision:p.revision,settings:{ai:p.ai,searchMethods:p.searchMethods,...settings}});}
test('enrollment years validate, persist independently and do not reset during unrelated saves',t=>{
 const c=fixture(t);assert.equal(c.getSettings({uid:'a'}).enrollmentYear,null);
 save(c,'a',{enrollmentYear:2025});save(c,'b',{enrollmentYear:2024});save(c,'a',{keepPlayingOnLeave:true});
 const reloaded=new IntegrationController({labRoot:c.labRoot,vault});assert.equal(reloaded.getSettings({uid:'a'}).enrollmentYear,2025);assert.equal(reloaded.getSettings({uid:'b'}).enrollmentYear,2024);
 for(const value of [true,2025.5,1949,new Date().getFullYear()+1,'2025级',{}])assert.throws(()=>save(c,'a',{enrollmentYear:value}),/入学年份/);
 assert.equal(c.getSettings({uid:'a'}).enrollmentYear,2025);save(c,'a',{enrollmentYear:null});assert.equal(c.getSettings({uid:'a'}).enrollmentYear,null);
 assert.equal(Enrollment.normalize('2025'),2025);
});
test('browser AI requests use the current account enrollment year, not page-supplied data',async t=>{
 const c=fixture(t);for(const [uid,year]of [['a',2025],['b',2024]])save(c,uid,{enrollmentYear:year,aiConfigurations:[{id:'xingchan-ai',name:'fixture',model:'fixture',baseUrl:'https://example.invalid/v1',type:'openai',key:'fixture-key'}],searchMethods:methods});
 const captured=[];const provider=async(root,source,payload)=>{captured.push(payload.enrollmentYear);return{kind:'hit',answer:'B'};};
 await query(c,'a',{...question,enrollmentYear:2000},{provider});await query(c,'b',question,{provider});save(c,'a',{enrollmentYear:2023});await query(c,'a',question,{provider});
 assert.deepEqual(captured,[2025,2024,2023]);
});
test('star AI gateway preserves each account enrollment year through the protected-provider adapter',async t=>{
 const captured=[];const server=http.createServer(async(req,res)=>{let raw='';for await(const part of req)raw+=part;captured.push(JSON.parse(raw));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({kind:'hit',answer:'B'}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const gateway=createGateway({mode:'live',accounts:[2025,2024].map((year,i)=>({id:'a'+i,enrollmentYear:year,searchMethods:methods,aiProviders:[{id:'xingchan-ai',driver:'xingchan-original-ai',model:'fixture',type:'openai',apiKey:'fixture-key',baseUrl:'https://example.invalid/v1',endpoint:'http://127.0.0.1:'+server.address().port+'/query',sessionToken:'fixture',timeoutMs:1000}]}))});
 t.after(()=>gateway.close());await gateway.queryBrowser('a0',question);await gateway.queryBrowser('a1',question);
 assert.deepEqual(captured.map(p=>p.enrollmentYear),[2025,2024]);assert(captured.every(p=>p.courseName==='合成课程'));
});
