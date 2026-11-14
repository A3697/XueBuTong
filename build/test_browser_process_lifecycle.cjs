'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const source=fs.readFileSync(path.join(__dirname,'../src/ocs-app/public/assets/index.c87a5b08.js'),'utf8');
const code=source.slice(source.indexOf('class Process extends '),source.indexOf('const processes = reactive([]);'));
test('late old-worker close/exit never removes the replacement process or releases its lease',async()=>{
 const processes=[],released=[],shells=[];
 const context={events:{exports:EventEmitter},__publicField:(obj,key,value)=>obj[key]=value,processes,process:{env:{}},console,AbortController,setTimeout,clearTimeout,
  child_process:{fork(){const shell=new EventEmitter();shell.connected=true;shells.push(shell);return shell;}},
  createRemoteScriptWorker:()=>()=>{},remote:{path:{call:async()=> 'fixture-script.js'},app:{call:async()=> 'fixture-root'}},
  store:{paths:{},render:{setting:{browser:{}}}},window:{xingchanBridge:{releaseBrowser:async x=>released.push(x)}}};
 vm.createContext(context);vm.runInContext(code+';this.Process=Process;',context);const Process=context.Process;
 const browser={uid:'fixture',cachePath:'fixture',playwrightScripts:[]},old=new Process(browser,{});old.fusionLease={id:'old'};processes.push(old);await old.init();
 const closed=old.close();old.emit('browser-closed');await closed;
 const replacement=new Process(browser,{});replacement.fusionLease={id:'new'};processes.push(replacement);await replacement.init();
 shells[0].emit('exit',0);shells[0].emit('message',{event:'browser-closed',args:[]});
 assert.equal(Process.from('fixture'),replacement);assert.deepEqual(released.map(x=>x.id),['old']);
 shells[1].emit('exit',0);assert.equal(Process.from('fixture'),undefined);assert.deepEqual(released.map(x=>x.id),['old','new']);
});
