'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),test=require('node:test');
const native=require('../src/fusion/native-star-settings.cjs');
const original=fs.readFileSync(path.join(__dirname,'../assets/star-native/assets/index-CV2OgwTP.js'),'utf8');
const start=original.indexOf('function qu()'),end=original.indexOf('async function qf()',start);
assert(start>=0&&end>start,'original run contract changed; inspect upstream before updating test');
async function upstream(raw){
 const writes=[];
 const context=vm.createContext({localStorage:{getItem:()=>raw===undefined?null:raw},G:async(method,url,body)=>writes.push({method,url,body}),as:async()=>{}});
 vm.runInContext(original.slice(start,end),context);
 await context.Gf();
 assert.equal(writes.length,1);
 assert.equal(writes[0].url,'/run/start');
 return JSON.parse(JSON.stringify(writes[0].body));
}
test('native monitor run options match the unchanged upstream start action',async()=>{
 for(const value of [undefined,{}, {beisu:2,vgqtlv:67,auto_submit:false,ignore_progress:false},
                     {beisu:1,vgqtlv:0,auto_submit:true,ignore_progress:true}]){
  const raw=value===undefined?undefined:JSON.stringify(value);
  assert.deepEqual(native.runOptions(raw),await upstream(raw),JSON.stringify(value));
 }
});
