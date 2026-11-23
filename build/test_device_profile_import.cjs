'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Import=require('../src/fusion/device-profile-import.cjs'),Environment=require('../src/fusion/client-environment.js');
const ID='0123456789abcdef0123456789abcdef',SCHILD='abcdef0123456789abcdef0123456789';
const UA='Mozilla/5.0 (Linux; Android 14; Fixture Phone Build/TEST.202601; wv) AppleWebKit/537.36 Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 (schild:'+SCHILD+') (device:Fixture Phone) Language/zh_CN com.chaoxing.mobile/ChaoXingStudy_3_6.7.8_android_phone_10946_316 (@Kalimdor)_'+ID;
function fixture(capture={},other={}){return {schema_version:2,study_capture:{user_agent:UA,study_ua_marker:true,...capture},...other};}
function parse(capture={},other={}){return Import.parse(JSON.stringify(fixture(capture,other)));}
function rejects(value,code){assert.throws(()=>Import.parse(typeof value==='string'?value:JSON.stringify(value)),error=>error.code===code);}

test('schema 2 actual WebView capture maps only verified UA components',()=>{
 const result=parse();
 assert.deepEqual(result.patch,{webviewFull:UA,deviceId:ID,androidVersion:'14',model:'Fixture Phone',buildNumber:'TEST.202601',chromeVersion:'126.0.6478.122',schildWebview:SCHILD});
 assert.deepEqual(result.fields,Object.keys(result.patch));assert.deepEqual(result.source,{schemaVersion:2,uaKind:'webview',hasDeviceFeatureCode:false});
 const saved=Environment.normalize({...Environment.defaults(),dalvikFull:'ExistingDalvik/1.0',schildDalvik:'9'.repeat(32),...result.patch});
 assert.equal(saved.dalvikFull,'ExistingDalvik/1.0');assert.equal(saved.schildDalvik,'9'.repeat(32));
});
test('source app version is not a schema version and BOM is accepted',()=>{
 for(const version of ['0.2.0','0.3.0','future']){
  const result=Import.parse('\uFEFF'+JSON.stringify(fixture({}, {reference:{version_name:version}}))+'\n');assert.equal(result.patch.webviewFull,UA);
 }
});
test('reference templates, interpretation, credentials and identities cannot enter the preview',()=>{
 const privateValue='SYNTHETIC-SENSITIVE-EXCLUDED';
 const result=parse({uid:privateValue,name:privateValue,record_id:privateValue,flag_plaintext:privateValue,token:privateValue},{original:{unique_id:{value:privateValue},http_ua:{value:privateValue},webview_ua:{value:privateValue},study_706_template_http_ua:{value:privateValue}},reference:{imei:{value:privateValue},android_id:{value:privateValue},model:privateValue},interpretation:{ua_instance:{value:privateValue},schild:{value:privateValue}},native_probe:{trace:privateValue}});
 assert.equal(JSON.stringify(result).includes(privateValue),false);assert.equal(Object.hasOwn(result.patch,'dalvikFull'),false);assert.equal(Object.hasOwn(result.patch,'dalvikBase'),false);assert.equal(result.patch.deviceId,ID);
});
test('device feature code is presence only and never substitutes its plaintext for device ID',()=>{
 const raw='SYNTHETIC-PRIVATE-FLAG\n',plain='f'.repeat(64),result=parse({flag_info:raw,flag_plaintext:plain,flag_round_trip_verified:true});
 assert.equal(result.source.hasDeviceFeatureCode,true);assert.equal(result.patch.deviceId,ID);assert.equal(JSON.stringify(result).includes(raw.trim()),false);assert.equal(JSON.stringify(result).includes(plain),false);assert.ok(result.warnings.some(x=>x.includes('此项未导入、不会发送')));
 for(const value of [undefined,null,'',' \n '])assert.equal(parse({flag_info:value}).source.hasDeviceFeatureCode,false);
});
test('capture cannot be replaced by original or reference values',()=>{
 for(const study_capture of [undefined,null,[],false,'capture'])rejects({schema_version:2,study_capture,original:{webview_ua:{value:UA},unique_id:{value:ID}},reference:{webview_default_ua:{value:UA}}},'device_import_capture');
});
test('unknown schema, type and malformed JSON fail without echoing input',()=>{
 for(const schema_version of [undefined,1,3,'2',null])rejects({schema_version,study_capture:fixture().study_capture},'device_import_schema');
 for(const value of [[],null,true,12,'{}'])rejects(value,'device_import_schema');
 const sensitive='SYNTHETIC-PASSWORD-NOT-JSON';assert.throws(()=>Import.parse(sensitive),error=>error.code==='device_import_json'&&!error.message.includes(sensitive));
 assert.throws(()=>Import.parse({}),error=>error.code==='device_import_type');
});
test('missing, injected, oversized and non-ASCII UA fields are rejected',()=>{
 for(const user_agent of [undefined,null,0,{},'',UA+'\n',UA+'\rX:bad',UA+'\u0000',UA+'\t',UA+'中文','x'.repeat(2049)])rejects(fixture({user_agent}),'device_import_ua');
});
test('actual marker and reported marker must agree; other UA kinds are not converted',()=>{
 for(const study_ua_marker of [undefined,false,'true',1])rejects(fixture({study_ua_marker}),'device_import_source');
 rejects(fixture({user_agent:UA.replace('com.chaoxing.mobile/','local.reader/')}),'device_import_source');
 rejects(fixture({user_agent:UA.replace('Mozilla/5.0','Dalvik/2.1.0')}),'device_import_ua_kind');
});
test('missing optional fields preserve existing values and never invent a device identity',()=>{
 const reduced='Mozilla/5.0 com.chaoxing.mobile/ChaoXingStudy_unknown';
 const result=parse({user_agent:reduced});assert.deepEqual(result.patch,{webviewFull:reduced});assert.equal(result.warnings.filter(x=>x.startsWith('未唯一识别')).length,6);
 const before={...Environment.defaults(),deviceId:'b'.repeat(32),model:'Keep Model',dalvikFull:'Keep/1'};const after=Environment.normalize({...before,...result.patch});assert.equal(after.deviceId,before.deviceId);assert.equal(after.model,before.model);assert.equal(after.dalvikFull,before.dalvikFull);
});
test('ambiguous or unsupported components are omitted without rewriting the full capture',()=>{
 const cases=[['deviceId',UA+' (@Azeroth)_'+'b'.repeat(32)],['deviceId',UA.replace(ID,'not-an-instance')],['model',UA.replace('(device:Fixture Phone)','(device:Model; unsupported)')],['chromeVersion',UA.replace('126.0.6478.122','not-a-version')],['schildWebview',UA.replace(SCHILD,'short')],['schildWebview',UA.replace(SCHILD,'')],['buildNumber',UA.replace('TEST.202601','bad!build')],['androidVersion',UA.replace('Android 14','Android future')]];
 for(const [key,user_agent] of cases){const result=parse({user_agent});assert.equal(result.patch.webviewFull,user_agent);assert.equal(Object.hasOwn(result.patch,key),false);assert.ok(result.warnings.some(x=>x.includes('保持原配置')));}
});
test('Azeroth instance and uppercase identifiers normalize while complete UA remains exact',()=>{
 const user_agent=UA.replace('Kalimdor','Azeroth').replace(ID,ID.toUpperCase()).replace(SCHILD,SCHILD.toUpperCase());const result=parse({user_agent});assert.equal(result.patch.deviceId,ID);assert.equal(result.patch.schildWebview,SCHILD);assert.equal(result.patch.webviewFull,user_agent);
});
test('size, nesting and dangerous keys are rejected before preview',()=>{
 rejects(' '.repeat(Import.MAX_BYTES+1),'device_import_size');rejects('汉'.repeat(Math.floor(Import.MAX_BYTES/3)+1),'device_import_size');
 let nested={};for(let i=0;i<34;i++)nested={child:nested};rejects(fixture({}, {reference:nested}),'device_import_depth');
 for(const key of ['__proto__','constructor','prototype'])rejects('{"schema_version":2,"study_capture":'+JSON.stringify(fixture().study_capture)+',"reference":{"'+key+'":{"polluted":true}}}','device_import_field');assert.equal({}.polluted,undefined);
});
test('malformed feature code metadata is not treated as a valid import',()=>{
 for(const flag_info of [{},false,12,'x'.repeat(8193)])rejects(fixture({flag_info}),'device_import_flag');
});
test('parse is deterministic and cannot mutate another account settings object',()=>{
 const input=JSON.stringify(fixture()),first=Import.parse(input),second=Import.parse(input);assert.deepEqual(first,second);first.patch.model='Changed';first.warnings.push('Changed');assert.equal(second.patch.model,'Fixture Phone');assert.equal(second.warnings.includes('Changed'),false);
});
test('import exposes only Star environment fields and cannot replace independent OCS browser settings',()=>{
 const browserSettings={profileDirectory:'synthetic-browser-profile',userAgent:'IndependentBrowser/1',cookies:[{name:'synthetic',value:'kept'}]},before=structuredClone(browserSettings);
 const result=parse({}, {browserSettings,profileDirectory:'untrusted',proxy:'untrusted'});
 const account={browserSettings,clientEnvironment:Environment.defaults()};account.clientEnvironment={...account.clientEnvironment,...result.patch};
 assert.deepEqual(account.browserSettings,before);assert.deepEqual(result.fields,['webviewFull','deviceId','androidVersion','model','buildNumber','chromeVersion','schildWebview']);
 for(const key of ['browserSettings','profileDirectory','proxy','userAgent','cookies'])assert.equal(Object.hasOwn(result.patch,key),false);
 assert.ok(result.warnings.some(x=>x.includes('仅对星蝉增强模式生效')));assert.ok(result.warnings.some(x=>x.includes('可能仍含原身份')));assert.ok(result.warnings.some(x=>x.includes('不会自动改写')));
});
