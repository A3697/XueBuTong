'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const vm=require('node:vm');
try{
 const box=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
 // Only JSON literals enter the context. No host functions, Node globals or network handles are exposed.
 const script=new vm.Script('JSON.stringify((function(){'+workerData.handler+'})()('+JSON.stringify(workerData.value)+'))');
 const encoded=script.runInContext(box,{timeout:600});
 const value=encoded===undefined?null:JSON.parse(encoded);
 if(JSON.stringify(value).length>1048576)throw Error();
 parentPort.postMessage({ok:true,value});
}catch{parentPort.postMessage({ok:false});}
