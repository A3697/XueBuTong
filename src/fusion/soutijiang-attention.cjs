'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const WAIT_MS=10*60*1000;
const REASONS=Object.freeze({
 soutijiang_login_required:'登录已失效，请重新登录',
 soutijiang_verification_required:'需要本人验证或稍后重新登录',
 soutijiang_answer_restricted:'当前账号权限受限，请检查官方账号状态',
 soutijiang_session_unavailable:'登录窗口不可用，请重新登录',
});
// This ledger never waits on a user or stores credentials. Pending and skipped
// entries are both excluded immediately; the deadline only retires the prompt.
class SoutijiangAttention{
 constructor({home,clock=Date.now,notify=()=>{}}){
  this.file=path.join(home,'attention.json');this.clock=clock;this.notify=notify;this.recovering=new Set();this.closed=false;
  this.items=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):[];
  if(!Array.isArray(this.items)||this.items.length>2000||this.items.some(x=>!x||!this.valid(x.uid,x.slotId)||!Object.hasOwn(REASONS,x.code)||!['pending','skipped'].includes(x.state)||!Number.isFinite(x.deadline)))throw Error('搜题酱异常状态无法读取，请保留原文件后检查');
  this.expire();this.schedule();
 }
 valid(uid,id){return typeof uid==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(uid)&&typeof id==='string'&&/^(?:default|[a-f0-9]{24})$/.test(id);}
 find(uid,id){return this.items.find(x=>x.uid===uid&&x.slotId===id);}
 save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp-'+crypto.randomBytes(6).toString('hex');try{fs.writeFileSync(tmp,JSON.stringify(this.items),{flag:'wx',mode:0o600});fs.renameSync(tmp,this.file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
 publish(){if(!this.closed)try{Promise.resolve(this.notify(this.snapshot())).catch(()=>{});}catch{}}
 snapshot(){this.expire();return {items:this.items.filter(x=>x.state==='pending').map(x=>({...x,message:REASONS[x.code]}))};}
 expire(){let changed=false;for(const item of this.items)if(item.state==='pending'&&this.clock()>=item.deadline){item.state='skipped';changed=true;}if(changed)this.save();return changed;}
 schedule(){clearTimeout(this.timer);if(this.closed)return;const deadlines=this.items.filter(x=>x.state==='pending').map(x=>x.deadline);if(!deadlines.length)return;this.timer=setTimeout(()=>{this.expire();this.publish();this.schedule();},Math.max(1,Math.min(...deadlines)-this.clock()));this.timer.unref?.();}
 mark(uid,slotId,code){
  if(!Object.hasOwn(REASONS,code)||!this.valid(uid,slotId))return false;
  if(!this.find(uid,slotId)){if(this.items.length>=2000)throw Error('搜题酱异常记录已满');this.items.push({uid,slotId,code,state:'pending',deadline:this.clock()+WAIT_MS});this.save();this.schedule();this.publish();}
  return true;
 }
 skip(uid,slotId){const item=this.find(uid,slotId);if(item){item.state='skipped';this.save();this.schedule();this.publish();}return !!item;}
 beginRecovery(uid,id){if(this.find(uid,id))this.recovering.add(uid+'\0'+id);}
 recovered(uid,id){if(!this.recovering.delete(uid+'\0'+id))return false;return this.remove(uid,id);}
 remove(uid,id){const size=this.items.length;this.items=this.items.filter(x=>x.uid!==uid||x.slotId!==id);this.recovering.delete(uid+'\0'+id);if(this.items.length!==size){this.save();this.schedule();this.publish();return true;}return false;}
 dispose(){this.closed=true;clearTimeout(this.timer);this.recovering.clear();}
}
module.exports={SoutijiangAttention,REASONS,WAIT_MS};
