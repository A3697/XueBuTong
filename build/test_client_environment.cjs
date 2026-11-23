'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Environment=require('../src/fusion/client-environment.js');
const {IntegrationController}=require('../src/fusion/controller.cjs');
test('Electron renderer exposes environment helpers when CommonJS and window coexist',()=>{
 const vm=require('node:vm'),context={module:{exports:{}}};context.window=context;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/fusion/client-environment.js'),'utf8'),context);
 assert.equal(context.window.FusionClientEnvironment,context.module.exports);
 assert.equal(context.window.FusionClientEnvironment.defaults().deviceId,'');
 assert.equal(context.window.FusionClientEnvironment.normalize({model:'Pixel 7'}).model,'Pixel 7');
});
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'xbt-client-environment-'));
 t.after(()=>{assert(path.basename(root).startsWith('xbt-client-environment-'));fs.rmSync(root,{recursive:true,force:true});});
 return new IntegrationController({labRoot:root,vault:{encryptString:text=>Buffer.from(text),decryptString:value=>value.toString(),isEncryptionAvailable:()=>true}});
}
test('random identities are valid, distinct and do not randomize application protocol versions',()=>{
 const seen=new Set();for(let index=0;index<100;index++){const deviceId=Environment.randomDeviceId(),fingerprint=Environment.randomFingerprint();assert.equal(seen.has(deviceId),false);seen.add(deviceId);const value=Environment.normalize({deviceId,...fingerprint});assert.equal(value.deviceId,deviceId);assert.match(value.schildWebview,/^[0-9a-f]{32}$/);assert.notEqual(value.schildWebview,value.schildDalvik);assert.equal(Object.hasOwn(fingerprint,'deviceId'),false);}
});
test('unsafe or malformed UA and device fields are rejected before persistence',()=>{
 for(const input of [{deviceId:'bad'},{schildWebview:'a'.repeat(31)},{model:'Model; fake)'},{webviewBase:'Mozilla/5.0\nX-Header: injected'},{dalvikBase:'X (schild:bad)'},{chromeVersion:'not-a-version'}])assert.throws(()=>Environment.normalize(input));
 assert.equal(Environment.normalize({deviceId:'A'.repeat(32)}).deviceId,'a'.repeat(32));
});
test('complete UA overrides are optional single-line fields and are cleared for cloned identities',()=>{
 const webviewFull='FixtureWebView/2.0 (schild:'+'1'.repeat(32)+') ChaoXingStudy_fixture',dalvikFull='FixtureDalvik/2.0';
 const p=Environment.normalize({webviewFull,dalvikFull});assert.equal(p.webviewFull,webviewFull);assert.equal(p.dalvikFull,dalvikFull);assert.equal(Environment.normalize({model:'Legacy'}).webviewFull,'');
 for(const key of ['webviewFull','dalvikFull'])for(const value of ['a\r\nX-Test: value','a\n','a\tb','含中文','a'.repeat(2049),1])assert.throws(()=>Environment.normalize({[key]:value}));
 const cloned=Environment.forClone({...p,deviceId:'a'.repeat(32),schildWebview:'b'.repeat(32)});for(const key of ['webviewFull','dalvikFull','deviceId','schildWebview','schildDalvik'])assert.equal(cloned[key],'');
 assert.equal(Environment.randomFingerprint().webviewFull,'');assert.equal(Environment.randomFingerprint().dalvikFull,'');
});
test('saved device settings survive restart and duplicate rejection preserves prior settings',t=>{
 const controller=fixture(t),a='a'.repeat(32),b='b'.repeat(32),id='1'.repeat(32);
 let settings=controller.getSettings({uid:a});controller.saveSettings({uid:a,expectedRevision:settings.revision,settings:{...settings,searchMethods:settings.searchMethods.filter(method=>method.id!=='yanxi'),clientEnvironment:{deviceId:id,model:'Pixel 7'}}});
 settings=controller.getSettings({uid:b});const before=fs.readFileSync(controller.settingsFile,'utf8');
 assert.throws(()=>controller.saveSettings({uid:b,expectedRevision:settings.revision,settings:{...settings,searchMethods:settings.searchMethods.filter(method=>method.id!=='yanxi'),clientEnvironment:{deviceId:id}}}),/同一个星蝉设备号/);
 assert.equal(fs.readFileSync(controller.settingsFile,'utf8'),before);assert.equal(controller.getSettings({uid:b}).clientEnvironment.deviceId,'');
 const reloaded=new IntegrationController({labRoot:controller.labRoot,vault:controller.vault});assert.equal(reloaded.getSettings({uid:a}).clientEnvironment.model,'Pixel 7');
});
test('legacy persistent device is displayed and cannot be reused by another account',t=>{
 const controller=fixture(t),a='a'.repeat(32),b='b'.repeat(32),id='2'.repeat(32),file=path.join(controller.labRoot,'instances',a,'data/storage/state.json');
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({'ua.device_id':id}));
 controller.base(a);const settings=controller.getSettings({uid:b});assert.equal(controller.getSettings({uid:a}).clientEnvironmentDeviceId,id);
 assert.throws(()=>controller.saveSettings({uid:b,expectedRevision:settings.revision,settings:{...settings,searchMethods:settings.searchMethods.filter(method=>method.id!=='yanxi'),clientEnvironment:{deviceId:id}}}),/同一个星蝉设备号/);
});

