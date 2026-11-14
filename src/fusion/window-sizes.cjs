'use strict';
const fs=require('node:fs'),path=require('node:path');
const {uidOf}=require('./controller.cjs');
function validKey(key){
 if(key==='main')return true;
 if(typeof key!=='string')return false;
 const prefix=key.match(/^(?:browser|panel)-/);if(!prefix)return false;
 try{uidOf(key.slice(prefix[0].length));return true;}catch{return false;}
}
function size(value){return value&&Number.isInteger(value.width)&&Number.isInteger(value.height)&&value.width>=400&&value.width<=16384&&value.height>=300&&value.height<=16384?{width:value.width,height:value.height,...(value.content===true?{content:true}:{})}:null;}
function normalize(value={}){return Object.fromEntries(Object.entries(value||{}).filter(([key,v])=>validKey(key)&&size(v)).map(([key,v])=>[key,size(v)]));}
function location(root,key){if(!validKey(key))throw Error('窗口标识无效');return path.join(root,'bridge-data/window-sizes',key+'.json');}
function read(root,key){try{return size(JSON.parse(fs.readFileSync(location(root,key),'utf8')));}catch{return null;}}
function write(root,key,value){const next=size(value);if(!next)return;const file=location(root,key);if(JSON.stringify(read(root,key))===JSON.stringify(next))return;fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify(next));fs.renameSync(temp,file);}
function snapshot(root){const dir=path.join(root,'bridge-data/window-sizes');if(!fs.existsSync(dir))return {};return Object.fromEntries(fs.readdirSync(dir).filter(name=>name.endsWith('.json')&&validKey(name.slice(0,-5))).flatMap(name=>{const key=name.slice(0,-5),value=read(root,key);return value?[[key,value]]:[];}));}
function enabled(root){try{return JSON.parse(fs.readFileSync(path.join(root,'bridge-data/workspace-preferences.json'),'utf8')).rememberWindowSizes===true;}catch{return false;}}
function fit(value,area,min={width:700,height:400}){return {width:Math.round(Math.min(area.width,Math.max(min.width,value.width))),height:Math.round(Math.min(area.height,Math.max(min.height,value.height)))};}
function attachElectron(win,{root,key,screen}){
 const area=screen.getDisplayMatching(win.getBounds()).workArea;
 const saved=enabled(root)&&read(root,key);if(saved){const fitted=fit(saved,area,key==='main'?{width:700,height:400}:{width:850,height:560});if(saved.content)win.setContentSize(fitted.width,fitted.height);else win.setSize(fitted.width,fitted.height);}
 let timer;
 const save=()=>{clearTimeout(timer);if(!win.isDestroyed()&&!win.isMinimized()&&!win.isMaximized()&&enabled(root))write(root,key,{...win.getContentBounds(),content:true});};
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(save,350);};
 win.on('resize',schedule);win.on('close',save);win.on('hide',save);win.on('closed',()=>clearTimeout(timer));
 return {save};
}
async function attachBrowser(context,{root,uid}){
 const key='browser-'+uid;location(root,key);
 const session=await context.browser().newBrowserCDPSession();let timer,watcher,closed=false,busy=false,last;
 const target=async()=>{const {targetInfos}=await session.send('Target.getTargets');const page=targetInfos.find(t=>t.type==='page');return page?session.send('Browser.getWindowForTarget',{targetId:page.targetId}):null;};
 const sample=async()=>{if(closed||busy||!enabled(root))return;busy=true;try{const info=await target();if(info?.bounds.windowState==='normal'){last=size(info.bounds);if(last)write(root,key,last);}}catch{}finally{busy=false;}};
 const saved=enabled(root)&&read(root,key);
 if(saved){try{const info=await target();if(info){const page=context.pages()[0],area=await page.evaluate(()=>({width:screen.availWidth,height:screen.availHeight}));await session.send('Browser.setWindowBounds',{windowId:info.windowId,bounds:{windowState:'normal'}});await session.send('Browser.setWindowBounds',{windowId:info.windowId,bounds:fit(saved,area)});}}catch{}}
 const update=()=>{clearInterval(timer);if(!closed&&enabled(root)){void sample();timer=setInterval(sample,1000);timer.unref?.();}};
 const directory=path.join(root,'bridge-data');fs.mkdirSync(directory,{recursive:true});watcher=fs.watch(directory,(_event,name)=>{if(String(name)==='workspace-preferences.json')update();});watcher.unref();update();
 const dispose=async()=>{if(closed)return;await sample();closed=true;clearInterval(timer);watcher.close();await session.detach().catch(()=>{});};context.on('close',()=>void dispose());
 return {dispose};
}
module.exports={size,normalize,location,read,write,snapshot,enabled,fit,attachElectron,attachBrowser};
