'use strict';
const crypto=require('node:crypto'),Answer=require('./answer-settings.js');
let controller;
function install(value){controller=value;}
function capability(secret,uid){return crypto.createHmac('sha256',secret).update('fusion-browser-settings:'+uid).digest('hex');}
function authorize(query,secret){
 const uid=query?.uid,token=query?.configKey;
 if(uid===undefined&&token===undefined)return null;
 if(typeof uid!=='string'||!(/^[A-Za-z0-9_-]{1,80}$/).test(uid)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!secret||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(capability(secret,uid))))throw Error('账号配置授权无效');
 const profiles=controller?.data.profiles;
 if(!profiles||!Object.hasOwn(profiles,uid))return {enabled:false,store:{}};
 return {uid,profile:profiles[uid]};
}
function read(query,secret,legacy){
 const auth=authorize(query,secret);if(!auth||!auth.profile)return auth;
 const {uid,profile}=auth;
 if(query.ocsMode==='official'||controller.ocsEnhancementsEnabled?.(uid)===false)return {enabled:false,store:{}};
 const config=controller.bankConfig(uid),methods=controller.getSettings({uid}).searchMethods;
 const AIConfig=require('./ai-config.js'),ais=AIConfig.read(controller,uid);
 const usable=methods.filter(m=>m.enabled&&(config.banks.some(b=>b.id===m.id)||AIConfig.isId(m.id)&&AIConfig.configured(ais.find(ai=>ai.id===m.id))||m.id==='soutijiang'&&profile.soutijiangEnabled===true&&controller.soutijiang?.configured?.(uid)===true||m.id==='xingchan-bank'&&profile.secrets?.xingchanBankKey||m.id==='yanxi'&&profile.secrets?.yanxiToken));
 const names=usable.map(m=>config.banks.find(b=>b.id===m.id)?.wrapper.name||(AIConfig.isId(m.id)?'AI · '+ais.find(ai=>ai.id===m.id).name:m.id==='soutijiang'?'大学搜题酱':m.id==='xingchan-bank'?'万能题库':'言溪题库'));
 // One authenticated wrapper preserves the app's ordered fallback semantics.
 // Provider keys stay in the main process; only this account's capability is sent.
 const banks=names.length?[{name:'学不通 · '+names.join(' → '),homepage:'http://127.0.0.1:18539/index.html#/browser',url:'http://127.0.0.1:18539/fusion/answer?uid='+encodeURIComponent(uid)+'&configKey='+capability(secret,uid),method:'post',type:'GM_xmlhttpRequest',contentType:'json',headers:{'Content-Type':'application/json'},fusionManaged:true,
  data:{question:{handler:'return env => ({title:env.title,type:env.type,courseName:globalThis.XBTExtraTasks?.courseName?.() || "",options:(env.fusionOptions || String(env.options || "").split(/\\r?\\n/).filter(Boolean)).map((text,i)=>({label:String.fromCharCode(65+i),text})),blankCount:env.blankCount || (env.type === "completion" ? 1 : 0),images:env.images || [],suggestion_title:env.suggestion_title || "",suggestion_options:env.suggestion_options || ""})'}},
  handler:'return res => { if (res.error) throw Error(res.error); if(res.kind === "miss" && res.explicitMiss === true)return [res.title,undefined,{fusionExplicitMiss:true}]; if(res.kind !== "hit")throw Error("学不通搜题响应无效");return [res.title,Array.isArray(res.answer)?JSON.stringify(res.answer):String(res.answer),{fusionManaged:true}];}'
 }]:[];
 const owned=Answer.ocsStore(controller.answerSettings?controller.answerSettings(uid):profile.answerSettings||{},banks);
 const inherited={...(legacy||{})};delete inherited['cx.new.study.enableChapterTest'];
 return {enabled:true,store:{...inherited,...owned,'fusion.managedAnswers':true,'fusion.hasUsableAnswerSource':names.length>0,'fusion.managedAnswerKeys':Object.keys(owned)}};
}
async function answer(query,secret,body){
 const auth=authorize(query,secret);if(!auth?.profile)throw Error('account_settings_unauthorized');
 if(query.ocsMode==='official'||controller.ocsEnhancementsEnabled?.(auth.uid)===false)throw Error('该账号已关闭 OCS 增强，请在浏览器中配置题库');
 const question=body?.question;if(!question||typeof question!=='object')throw Error('invalid_question');
 const result=await require('./browser-search.cjs').query(controller,auth.uid,question);
 return {...result,title:question.title,...(result.kind==='miss'?{explicitMiss:true}:{})};
}
module.exports={install,read,answer,capability};
