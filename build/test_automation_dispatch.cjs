'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const Config=require('../src/fusion/automation-config.js'),{PlaywrightScript}=require('../src/ocs-app/lib/src/scripts/script.js');
test('official unified modes invoke the retained platform flows and release all forwarding listeners',async()=>{
 const calls=[],runners={};
 for(const id of ['CXUnitLoginScript','CXPhoneLoginScript','ZHSUnitLoginScript','ZHSPhoneLoginScript','ZJYLoginScript','ICVELoginScript','ICourseLoginScript']){
  runners[id]=new EventEmitter();runners[id].run=async(page,configs,options)=>{calls.push({id,configs,options});runners[id].emit('script-data','fixture');if(options.fail)throw Error('fixture failure');};
 }
 const file=path.join(__dirname,'../src/ocs-app/lib/src/scripts/index.js'),exports={};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{exports,__dirname:path.dirname(file),require:id=>{
  if(id.includes('/automation/wk/'))return runners;
  if(id==='./script')return {PlaywrightScript};
  if(id.endsWith('automation-config.js'))return Config;
  return require(id);
 }});
 const cx=exports.scripts.find(s=>s.name==='超星-自动登录'),zhs=exports.scripts.find(s=>s.name==='智慧树-自动登录');
 let forwarded=0;zhs.on('script-data',()=>forwarded++);
 await zhs.run({}, {loginType:'unit',id:'fixture-id',schoolname:'学校甲',password:'fixture'},{});
 await zhs.run({}, {loginType:'phone',phone:'fixture-phone',password:'fixture'},{});
 await cx.run({}, {loginType:'unit'},{});await cx.run({}, {loginType:'phone'},{});
 assert.deepEqual(calls.map(c=>c.id),['ZHSUnitLoginScript','ZHSPhoneLoginScript','CXUnitLoginScript','CXPhoneLoginScript']);
 assert.equal(forwarded,2);assert.equal(calls[0].configs.schoolname,'学校甲');
 await assert.rejects(zhs.run({}, {loginType:'unit'},{fail:true}),/fixture failure/);
 for(const runner of Object.values(runners)){assert.equal(runner.listenerCount('script-data'),0);assert.equal(runner.listenerCount('script-error'),0);}
 const mooc=exports.scripts.find(s=>s.name==='中国大学MOOC-自动账号登录');await mooc.run({}, {username:'fixture@example.test'},{});assert.equal(calls.at(-1).id,'ICourseLoginScript');
});
