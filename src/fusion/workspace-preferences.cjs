'use strict';
const fs=require('node:fs'),path=require('node:path');
const valid=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
function normalize(value={}){
 const cardOrder=Array.isArray(value.cardOrder)?[...new Set(value.cardOrder.filter(valid))].slice(0,10000):[];
 const columns=[1,2,3,4].includes(value.columns)?value.columns:2;
 const number=(n,min,max,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
 const launchPlans={};for(const [uid,plan]of Object.entries(value.launchPlans||{}))if(valid(uid)&&plan&&typeof plan==='object')launchPlans[uid]={bulkBrowser:plan.bulkBrowser===true,bulkStar:plan.bulkStar===true,autoMode:['browser','xingchan'].includes(plan.autoMode)?plan.autoMode:'off',autoRunStar:plan.autoRunStar===true};
 const speeds={};for(const [uid,speed]of Object.entries(value.speeds||{}))if(valid(uid)&&typeof speed==='number'&&Number.isFinite(speed)&&speed>=1&&speed<=1000)speeds[uid]=speed;
 return {cardOrder,columns,rememberWindowSizes:value.rememberWindowSizes===true,closeBehavior:value.closeBehavior==='exit'?'exit':'tray',autoVideo2x:value.autoVideo2x!==false,previewEnabled:value.previewEnabled!==false,onlyFailed:value.onlyFailed===true,guideDismissed:value.guideDismissed===true,trayNoticeAccepted:value.trayNoticeAccepted===true,
  starCardHeight:number(value.starCardHeight,360,1800,760),starTaskRatio:number(value.starTaskRatio,.2,.8,.6),starColumnRatio:number(value.starColumnRatio,.25,.75,.58),browserLogHeight:number(value.browserLogHeight,80,720,180),launchPlans,speeds};
}
class WorkspacePreferences {
 constructor(root){this.file=path.join(root,'bridge-data/workspace-preferences.json');this.data=normalize(fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{});}
 get(){return structuredClone(this.data);}
 set(value){const next=normalize(value);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({schema:1,...next},null,2),'utf8');fs.renameSync(this.file+'.tmp',this.file);this.data=next;return this.get();}
}
module.exports={WorkspacePreferences,normalize};
