'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
test('OCR uses an absolute executable path, tolerates stderr and cleans images on success and errors',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'xbt OCR 路径 '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(__dirname,'../src/ocs-app/lib/src/utils/ocr.js'),calls=[];let output='1234',failure;
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync(source,'utf8'),{module:mod,process,__dirname:path.dirname(source),require:name=>name==='../store'?{store:{store:{paths:{downloadFolder:root}}}}:name==='node:child_process'?{execFile:(file,args,options,callback)=>{calls.push({file,args,options});callback(failure,output,'native library warning');}}:name==='node:util'?{promisify:fn=>(...args)=>new Promise((resolve,reject)=>fn(...args,(err,stdout,stderr)=>err?reject(err):resolve({stdout,stderr})))}:require(name)});const exports=mod.exports;
 assert.equal(await exports.ocr('aGVsbG8='),'1234');assert.equal(calls[0].file,path.join(root,'apps/ocr/ocr.exe'));assert.equal(calls[0].options.windowsHide,true);assert.equal(calls[0].options.timeout,60000);assert.equal(calls[0].options.shell,undefined);assert.equal(calls[0].args[0],'--ocr');
 const cache=path.join(root,'apps/ocr/img_cache');assert.deepEqual(fs.readdirSync(cache),[]);
 output="{'x': 20}";assert.equal((await exports.det('aA==','Yg==')).x,20);
 output='invalid';await assert.rejects(exports.det('aA==','Yg=='),/位置无效/);assert.deepEqual(fs.readdirSync(cache),[]);
 failure=Object.assign(Error('process timeout'),{killed:true});await assert.rejects(exports.ocr('aA=='),/timeout/);assert.deepEqual(fs.readdirSync(cache),[]);
});
