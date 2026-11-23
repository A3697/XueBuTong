'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {installAbout}=require('../src/fusion/about-window.cjs');

function fixture(){
 const handlers=new Map(),opened=[],messages=[];let window;
 class Window {
  constructor(){window=this;this.destroyed=false;this.webContents={mainFrame:{},session:{},setWindowOpenHandler(){},on(){}};}
  isDestroyed(){return this.destroyed;}
  setMenu(){} on(){} async loadFile(){} show(){} focus(){}
 }
 const show=installAbout({root:path.resolve(__dirname,'..'),app:{},BrowserWindow:Window,ipcMain:{handle:(name,handler)=>handlers.set(name,handler)},shell:{openExternal:async url=>opened.push(url)},dialog:{showMessageBox:async(_,message)=>messages.push(message)},directNetwork:{prepare:async()=>{}}});
 return {show,opened,messages,open:kind=>handlers.get('xuebutong-about:open')({sender:window.webContents,senderFrame:window.webContents.mainFrame},kind),handler:()=>handlers.get('xuebutong-about:open'),window:()=>window};
}

test('about channels open only the two fixed author-supplied URLs',async()=>{
 const f=fixture();await f.show();
 assert.equal(await f.open('ocs-channel'),true);
 assert.equal(await f.open('xingchan-channel'),true);
 assert.deepEqual(f.opened,['https://pd.qq.com/g/du8ic7y5zw','https://pd.qq.com/g/x786s240s3']);
});

test('about external links reject arbitrary URLs, unrelated senders and subframes',async()=>{
 const f=fixture();await f.show();
 for(const kind of ['https://example.com/','https://pd.qq.com/g/not-reviewed','constructor','__proto__',null,{}])await assert.rejects(f.open(kind),/未授权/);
 const handler=f.handler(),window=f.window();
 await assert.rejects(handler({sender:{},senderFrame:window.webContents.mainFrame},'ocs-channel'),/未授权/);
 await assert.rejects(handler({sender:window.webContents,senderFrame:{}},'xingchan-channel'),/未授权/);
 window.destroyed=true;
 await assert.rejects(f.open('ocs-channel'),/未授权/);
 assert.deepEqual(f.opened,[]);
});

test('adding Star channel does not reclassify it as an official website',async()=>{
 const f=fixture();await f.show();
 await f.open('xingchan');
 assert.equal(f.messages.length,1);
 assert.equal(f.messages[0].message,'暂无官网');
 assert.deepEqual(f.opened,[]);
 await f.open('github');
 await f.open('releases');
 assert.deepEqual(f.opened,['https://github.com/A3697/XueBuTong','https://github.com/A3697/XueBuTong/releases']);
});
