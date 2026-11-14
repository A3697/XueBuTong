'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {uidOf}=require('./controller.cjs');
const KEYS=['xxtsk.runParams','xxtsk.theme','xxtsk.announce.seen'];
const DEFAULT_RUN={beisu:1,vgqtlv:85,auto_submit:true,ignore_progress:false};
function normalize(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('原生星蝉面板设置无效');
 const out={};
 for(const key of KEYS)if(Object.hasOwn(value,key)){
  if(typeof value[key]!=='string'||value[key].length>8192)throw Error('原生星蝉面板设置过长或无效');
  if(key==='xxtsk.runParams')runOptions(value[key]);
  out[key]=value[key];
 }
 return out;
}
function runOptions(raw){
 let value=raw===undefined?{}:JSON.parse(raw);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('原生星蝉执行设置无效');
 value={...DEFAULT_RUN,...value};
 if(typeof value.beisu!=='number'||!Number.isFinite(value.beisu)||value.beisu<1||value.beisu>1000||typeof value.vgqtlv!=='number'||!Number.isFinite(value.vgqtlv)||value.vgqtlv<0||value.vgqtlv>100||typeof value.auto_submit!=='boolean'||typeof value.ignore_progress!=='boolean')throw Error('原生星蝉执行设置无效，请在原生控制面板中调整');
 // Match the upstream start payload, including its zero-threshold fallback.
 return {...Object.fromEntries(Object.keys(DEFAULT_RUN).map(key=>[key,value[key]])),beisu:Number(value.beisu)||1,vgqtlv:Number(value.vgqtlv)||85};
}
function location(root,uid){return path.join(root,'instances',uidOf(uid),'data-native','panel.json');}
function read(root,uid){const file=location(root,uid);return fs.existsSync(file)?normalize(JSON.parse(fs.readFileSync(file,'utf8'))):{};}
function write(root,uid,value){const file=location(root,uid),data=normalize(value);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);return data;}
// Original backend custom settings. Never include login sessions, cookies or local HTTP tokens.
const FACE_KEYS=new Set(['face.object_id','face.photo_file','face.uploaded_at','face.bytes','face.filename']);
const photoName=value=>typeof value==='string'&&/^photo\.(?:png|jpe?g|webp|gif|bmp)$/i.test(value);
function customKey(key){return key.startsWith('config.')&&!['config.host','config.token','config.fusion_answer_policy'].includes(key)||FACE_KEYS.has(key);}
function snapshot(root,uid){
 const file=path.join(root,'instances',uidOf(uid),'data-native/storage/state.json');
 const state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 const settings=Object.fromEntries(Object.entries(state).filter(([key])=>customKey(key))),panel=read(root,uid),assets=[];
 const name=settings['face.photo_file'];
 if(photoName(name)){
  const image=path.join(path.dirname(file),'face',name);
  if(fs.existsSync(image)){const bytes=fs.readFileSync(image);if(bytes.length>8*1024*1024)throw Error('原生星蝉照片超过 8 MB');assets.push({name,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),content:bytes.toString('base64')});}
 }
 return {settings,panel,assets};
}
function prepare(root,uid,input){
 uidOf(uid);if(!input||typeof input!=='object'||Array.isArray(input)||!input.settings||typeof input.settings!=='object'||Array.isArray(input.settings)||Object.keys(input.settings).some(key=>!customKey(key)))throw Error('原生星蝉自定义设置无效');
 const settings=input.settings,panel=normalize(input.panel||{}),assets=input.assets||[];
 if(settings['face.photo_file']&&!photoName(settings['face.photo_file']))throw Error('原生星蝉照片名称无效');
 if(!Array.isArray(assets)||assets.length>2)throw Error('原生星蝉照片设置无效');
 const file=path.join(root,'instances',uid,'data-native/storage/state.json'),current=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 const retained=Object.fromEntries(Object.entries(current).filter(([key])=>!customKey(key)));
 const writes=[{file,value:{...retained,...settings}},{file:location(root,uid),value:panel}];
 for(const asset of assets){if(!asset||!photoName(asset.name)||typeof asset.content!=='string'||asset.content.length>12*1024*1024||typeof asset.sha256!=='string')throw Error('原生星蝉照片内容无效');const bytes=Buffer.from(asset.content,'base64');if(bytes.length>8*1024*1024||crypto.createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('原生星蝉照片校验失败');writes.push({file:path.join(path.dirname(file),'face',asset.name),raw:bytes});}
 return writes;
}
module.exports={KEYS,DEFAULT_RUN,normalize,runOptions,location,read,write,customKey,snapshot,prepare};
