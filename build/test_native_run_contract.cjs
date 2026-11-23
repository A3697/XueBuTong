'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),test=require('node:test');
const native=require('../src/fusion/native-star-settings.cjs');
const nativeRoot=path.join(__dirname,'../assets/star-native');
const manifest=JSON.parse(fs.readFileSync(path.join(nativeRoot,'_source-manifest.json'),'utf8'));
const html=fs.readFileSync(path.join(nativeRoot,'index.html'),'utf8');
const entry=html.match(/<script\b[^>]*\bsrc=["']\.\/([^"']+)["']/)?.[1];
assert(entry&&manifest.files.some(file=>file.path===entry),'native entry must come from the paired source manifest');
const original=fs.readFileSync(path.join(nativeRoot,entry),'utf8');
const action=/async function ([\w$]+)\(\)\{const [\w$]+=([\w$]+)\(\);await ([\w$]+)\("POST","\/run\/start",/.exec(original);
assert(action,'original run action changed; inspect upstream before updating test');
const start=original.lastIndexOf('function '+action[2]+'()',action.index),end=original.indexOf('async function ',action.index+1);
assert(start>=0&&end>action.index,'original run contract changed; inspect upstream before updating test');
const segment=original.slice(start,end),refresh=/,await ([\w$]+)\(\)\}$/.exec(segment)?.[1];
assert(refresh&&segment.includes('localStorage.getItem("xxtsk.runParams")'),'original storage/refresh contract changed');
async function upstream(raw){
 const writes=[];
 const context=vm.createContext({localStorage:{getItem:()=>raw===undefined?null:raw},[action[3]]:async(method,url,body)=>writes.push({method,url,body}),[refresh]:async()=>{}});
 vm.runInContext(segment,context);
 await context[action[1]]();
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
