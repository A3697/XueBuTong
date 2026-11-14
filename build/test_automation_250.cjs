'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Automation=require('../src/fusion/automation-config.js'),Profiles=require('../src/fusion/login-profiles.js');
const values=script=>Object.fromEntries(Object.entries(script.configs).map(([key,item])=>[key,item?.value]));
test('legacy batch spreadsheets infer school mode without losing name or whitespace in passwords',()=>{
 const zhs=Automation.importRow('智慧树-自动登录',{'浏览器名':'旧账号','学校':'学校甲','学号':'fixture-id','密码':' p '});
 assert.deepEqual(zhs,{browserName:'旧账号',schoolname:'学校甲',id:'fixture-id',password:' p ',loginType:'unit'});
 const cx=Automation.importRow('超星-自动登录',{'学校/单位':'学校甲','学号/工号':'fixture-id','密码':' p '});assert.equal(cx.loginType,'unit');
 const phone=Automation.importRow('智慧树-自动登录',{'手机号':'fixture-phone','密码':'p'});assert.equal(phone.loginType,'phone');
 const explicit=Automation.importRow('智慧树-自动登录',{'登录方式':'手机密码登录','学校':'学校甲','学号':'fixture-id','手机号':'fixture-phone','密码':'p'});assert.equal(explicit.loginType,'phone');
 assert.deepEqual(Automation.importRow('智慧树-自动登录',{}),{loginType:'phone'});
});
test('Electron renderer uses the injected configuration rather than resolving a relative CommonJS path',()=>{
 const vm=require('node:vm'),context={module:{exports:{}},require:()=>{throw Error('renderer relative require must not be used');},FusionAutomationConfigs:Automation};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/fusion/login-profiles.js'),'utf8'),context);
 assert.equal(context.FusionLoginProfiles.parse([{name:'智慧树-学校登录',configs:{id:{value:'fixture'},schoolname:{value:'学校'},password:{value:'fixture'}}}]).kind,'zhs-unit');
});
test('all previous login identities migrate to the official unified schema without losing passwords or school',()=>{
 const cases=[['超星-手机密码登录','cx-phone',{phone:'fixture-phone',password:' p ' }],['超星-学校机构登录','cx-unit',{id:'fixture-student',unit:'学校甲',password:' p '}],['智慧树-手机密码登录','zhs-phone',{phone:'fixture-phone',password:' p '}],['智慧树-学校登录','zhs-unit',{id:'fixture-student',schoolname:'学校甲',password:' p '}],['职教云-账号密码登录','zjy',{username:'fixture-user',password:' p '}],['智慧职教-账号密码登录','icve',{username:'fixture-user',password:' p '}]];
 for(const [name,kind,input]of cases){const original={name,configs:Object.fromEntries(Object.entries(input).map(([k,v])=>[k,{label:k,value:v}]))},before=Profiles.parse([original]),next=Automation.normalize(original),after=Profiles.parse([next]);assert.equal(after.kind,kind);assert.equal(Profiles.signature(before),Profiles.signature(after));assert.equal(Profiles.accountKey(before),Profiles.accountKey(after));assert.equal(values(next).password,' p ');assert.deepEqual(Automation.normalize(next),next);assert.deepEqual(values(original),input);}
});
test('a unified platform choice exposes only its active fields while retaining alternate credentials',()=>{
 const script=Automation.normalize({name:'智慧树-自动登录',configs:{loginType:{value:'unit'},phone:{value:'retained-phone'},id:{value:'fixture-id'},schoolname:{value:'学校甲'},password:{value:'fixture-password'}}});
 assert.deepEqual(Object.keys(script.configs).filter(k=>Automation.visible(script,script.configs[k])),['loginType','schoolname','id','password']);
 assert.equal(Profiles.parse([script]).kind,'zhs-unit');script.configs.loginType.value='phone';assert.equal(Profiles.parse([script]).kind,'zhs-phone');assert.equal(script.configs.id.value,'fixture-id');
});
test('unified and transitional official script names preserve their meaning and MOOC is supported without star',()=>{
 const aliases=[['超星-登录','cx-unit'],['智慧树-登录','zhs-unit']];
 for(const [name,kind]of aliases){const p=Profiles.parse([{name,configs:{loginType:{value:'unit'},id:{value:'id'},password:{value:'pw'},unit:{value:'学校'},schoolname:{value:'学校'}}}]);assert.equal(p.kind,kind);assert(Profiles.complete(p));}
 const p=Profiles.parse([{name:'中国大学MOOC-自动账号登录',configs:{username:{value:'fixture@example.test'},password:{value:'fixture'}}}]);assert.equal(p.kind,'icourse');assert.equal(p.starEligible,false);assert(Profiles.complete(p));
});
test('custom automation fields and explicit blank values survive schema refresh; obsolete batch display-name field is omitted',()=>{
 const custom={name:'用户脚本',configs:{anything:{value:'kept'}}};assert.equal(Automation.normalize(custom),custom);
 const input={name:'超星-手机密码登录',configs:{phone:{value:''},password:{value:'fixture'},custom:{value:'kept'},browserName:'old-name'}};
 const output=Automation.normalize(input);assert.equal(output.configs.phone.value,'');assert.equal(output.configs.custom.value,'kept');assert(!('browserName' in output.configs));assert.equal(input.configs.browserName,'old-name');
});
test('new-page URL normalization adds HTTPS and rejects executable schemes',()=>{
 assert.equal(Automation.normalizeUrl('example.test/a'),'https://example.test/a');assert.equal(Automation.normalizeUrl('http://example.test'),'http://example.test/');
 for(const value of ['javascript:alert(1)','file:///C:/x','data:text/html,x'])assert.throws(()=>Automation.normalizeUrl(value));
});
test('batch creation ignores login-mode defaults and uses the same conditional fields as the account drawer',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ocs-app/public/assets/index.ce0090a0.js'),'utf8');
 const expr=source.match(/function getValidData\(\) \{\s*return ([\s\S]*?);\s*\}/)[1];
 const run=new Function('data','arrayLikeConfigs','return '+expr);
 const config={value:Automation.find('智慧树-自动登录').configs},array={value:Object.keys(config.value).map(key=>({key,...config.value[key]}))};
 const actual=run({value:[{}, {loginType:'phone'},{loginType:'unit'}, {loginType:'unit',id:'a',schoolname:'学校',password:'p'}, {phone:'b',password:'q'}]},array);
 assert.equal(actual.length,2);assert.equal(actual[0].id,'a');assert.equal(actual[1].phone,'b');
});
