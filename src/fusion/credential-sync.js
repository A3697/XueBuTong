(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionCredentialSync=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function create({bridge,readNative,writeNative,onUpdate=()=>{},onError=()=>{}}){
  let alive=true;
  const signatures=new Map(),jobs=new Map(),next=new Map(),failures=new Map(),initialized=new Set();
  const stamp=value=>JSON.stringify([value?.kind||'none',value?.username||'',value?.password||'',value?.unit||'',value?.hasNativeSelection===true]);
  const latest=uid=>readNative().find(item=>item.uid===uid);
  // Star settings contain derived login metadata; they never write credentials back.
  function fromStar(uid,value){if(alive)onUpdate(uid,value);}
  async function synchronize(item){
   let current=latest(item.uid);if(!alive||!current)return;
   if(!initialized.has(item.uid)){
    const saved=await bridge.getSettings({uid:item.uid});
    current=latest(item.uid);if(!alive||!current)return;
    // Migrate only old releases that had no native login selected at all.
    // Once nativeLoginConfigured is recorded, deleting a login stays deleted.
    if(saved.nativeLoginConfigured!==true&&current.kind==='none'&&current.hasNativeSelection!==true&&saved.username&&saved.hasPassword&&saved.password){
     const written=await writeNative({uid:item.uid,kind:'cx-phone',migrate:true,username:saved.username,password:saved.password,unit:''});
     current=latest(item.uid);if(!alive||!current)return;
     if(written===false||current.kind==='none'&&current.hasNativeSelection!==true)throw Error('旧版账号登录配置尚未迁移，请重新打开账号设置后重试。');
    }
    initialized.add(item.uid);
   }
   let retries=2;
   while(alive&&current){
    const signature=stamp(current);signatures.set(item.uid,signature);
    try{
     const {uid,...login}=current;
     const result=await bridge.syncNativeLogin({uid,login});
     if(!alive)return;
     const newest=latest(uid);
     if(!newest)return;
     if(stamp(newest)!==signature){next.set(uid,{...newest});return;}
     failures.delete(uid);onUpdate(uid,result);return;
    }catch(error){
     const newest=latest(item.uid);if(!alive||!newest)return;
     if(stamp(newest)!==signature){next.set(item.uid,{...newest});return;}
     if(retries--<=0||!String(error.message||'').includes('配置已在其他'))throw error;
     current=newest;
    }
   }
  }
  function queue(item){
   if(!alive)return Promise.resolve();next.set(item.uid,{...item});
   if(jobs.has(item.uid))return jobs.get(item.uid);
   const job=Promise.resolve().then(async()=>{
    while(alive&&next.has(item.uid)){
     const current=next.get(item.uid);next.delete(item.uid);await synchronize(current);
    }
   }).catch(error=>{if(alive&&latest(item.uid)){failures.set(item.uid,error);onError(error);}}).finally(()=>jobs.delete(item.uid));
   jobs.set(item.uid,job);return job;
  }
  function nativeChanged(items=readNative()){
   if(!alive)return;
   const present=new Set(items.map(item=>item.uid));
   for(const uid of new Set([...signatures.keys(),...failures.keys(),...initialized]))if(!present.has(uid)){signatures.delete(uid);initialized.delete(uid);next.delete(uid);failures.delete(uid);}
   for(const item of items){const value=stamp(item);if(signatures.get(item.uid)===value)continue;signatures.set(item.uid,value);queue(item);}
  }
  async function initialize(){nativeChanged();while(alive&&jobs.size)await Promise.all([...jobs.values()]);}
  async function flush(){
   for(let attempt=0;alive&&attempt<4;attempt++){
    const items=readNative();nativeChanged(items);
    for(const item of items)if(failures.has(item.uid)&&!jobs.has(item.uid))queue(item);
    while(alive&&jobs.size)await Promise.all([...jobs.values()]);
    if(!alive)return;
    const current=readNative();
    if(current.every(item=>signatures.get(item.uid)===stamp(item))){if(failures.size)throw [...failures.values()][0];return;}
   }
   if(alive)throw Error('账号登录配置仍在变化，请完成编辑后再启动。');
  }
  return {initialize,nativeChanged,fromStar,flush,dispose(){alive=false;next.clear();signatures.clear();initialized.clear();failures.clear();}};
 }
 return {create};
});
