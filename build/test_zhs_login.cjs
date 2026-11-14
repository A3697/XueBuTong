'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const API=require('../src/fusion/login-api.cjs'),{verify}=require('../src/fusion/zhs-login.cjs');
function fixture({mismatch=false,rejected=false,noResponse=false,stall=false}={}){
 const login={kind:'zhs-unit',platform:'zhihuishu',username:'fixture-id',unit:'学校甲',password:'fixture-secret'};
 const context=new EventEmitter();context.addCookies=async()=>{};context.cookies=async()=>[];context.newPage=async()=>({setDefaultTimeout(){}});
 let closes=0,options,launched;
 const browser={newContext:async()=>context,close:async()=>{closes++;}};
 const runner={run:async(_page,configs,opts)=>{
  assert.equal(configs.schoolname,login.unit);options=opts;
  if(stall)await new Promise(()=>{});
  if(!noResponse)context.emit('response',{url:()=> 'https://user.zhihuishu.com/zhsuser/login/code',request:()=>({method:()=> 'POST',postData:()=>JSON.stringify(API.aes(JSON.stringify({code:mismatch?'another-id':login.username,password:login.password,schoolId:'123'}),'bdas85990328dfpl','563216db1e1744c7'))}),json:async()=>rejected?{status:-2,msg:'账号或密码错误'}:{status:1,rt:{uuid:'fixture-uuid',realName:'合成测试甲'}}});
 }};
 return {get closes(){return closes;},get options(){return options;},get launched(){return launched;},args:{chromium:{launch:async config=>{launched=config;return browser;}},executablePath:'fixture-browser',login,http:{schoolId:'123',request:async()=>({status:200,rt:{realName:'合成测试甲'}})},ocrApiUrl:'http://127.0.0.1:18539/ocr',timeoutMs:15,automation:{ZHSUnitLoginScript:runner,ZHSPhoneLoginScript:runner}}};
}
test('headless ZHS verification delegates captcha to OCS and confirms the matching credential submission',async()=>{
 const f=fixture(),result=await verify(f.args);assert.equal(result.state,'success');assert.equal(result.name,'合成测试甲');assert.equal(f.launched.headless,true);assert.equal(f.options.ocrApiUrl,'http://127.0.0.1:18539/ocr');assert.equal(f.options.detTargetKey,'det_target');assert.equal(f.closes,1);
});
test('a different account, no authentication response and timeouts cannot pass ZHS verification',async()=>{
 for(const scenario of [{mismatch:true},{noResponse:true},{stall:true}]){const f=fixture(scenario);assert.equal(await verify(f.args),null);assert.equal(f.closes,1);}
 const f=fixture({rejected:true});assert.equal((await verify(f.args)).state,'invalid');assert.equal(f.closes,1);
});
