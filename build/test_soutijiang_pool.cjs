'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createPool}=require('../src/fusion/soutijiang-pool.cjs'),Auth=require('../src/fusion/soutijiang-auth.cjs'),Accounts=require('../src/fusion/soutijiang-accounts.cjs');
const question={type:'single',title:'一加一等于多少？',options:[{label:'A',text:'2'},{label:'B',text:'3'}],images:[]};
const hit={message:{errNo:0,list:[{question:question.title,answer:'2'}]}};
const empty=()=>({schema:1,storage:{},cookies:[]});
const login=id=>({schema:1,storage:{college_ai_userInfo:JSON.stringify({uid:id,nickname:'用户 '+id}),college_ai_dxuss:JSON.stringify('private-'+id),college_ai_sourceAppId:'"collegepcpi"'},cookies:[{name:'DXUSS',value:'private-'+id,domain:'passport.daxuesoutijiang.com',path:'/',secure:true,httpOnly:true,sameSite:'no_restriction'}]});
function fixture(t){
 const base=path.resolve(process.env.XBT_TEST_TMP||process.cwd()),root=fs.mkdtempSync(path.join(base,'souti-pool-'));let now=Date.parse('2026-11-22T09:00:00Z');
 const profiles={A:{soutijiangEnabled:true},B:{soutijiangEnabled:true}},auth=new Map(),calls=[],replies=new Map();
 const factory=async input=>{let closed=false;const file=input.profile;auth.set(file,auth.get(file)||empty());return {
  readAuth:async()=>structuredClone(auth.get(file)),applyAuth:async value=>auth.set(file,structuredClone(Auth.normalize(value))),user:async()=>Auth.user(auth.get(file)),image:async()=> 'data:image/jpeg;base64,Zml4dHVyZQ==',loginQr:async()=>({qrImage:'data:image/png;base64,Zml4dHVyZQ=='}),closed:()=>closed,close:async()=>{closed=true;},
  message:async type=>{if(type==='updateUserInfo')return {};if(type==='LogOut'){auth.set(file,empty());return {success:true};}return request(type);},screenshot:async()=>request('screenshot')
 };function request(type){const id=Auth.user(auth.get(file)).providerUid;calls.push({id,type});const value=replies.get(id)?.shift()||structuredClone(hit);if(value instanceof Error)throw value;return typeof value==='function'?value():value;}};
 const controller={data:{profiles},persist(){}},pools=[];const reload=()=>{const next=createPool({root,controller,clock:()=>now,minimumIntervalMs:0,sessionFactory:factory});next.engine.extension=()=>({installed:true,compatible:true,version:'1.17.6'});pools.push(next);return next;},pool=reload();
 t.after(async()=>{for(const entry of pools)await entry.dispose();assert.equal(path.dirname(root),base);fs.rmSync(root,{recursive:true,force:true});});
 const seed=(uid,id,provider)=>{const profile=pool.profile(uid,id);fs.mkdirSync(profile,{recursive:true});auth.set(profile,login(provider));};
 const add=async(uid,provider)=>{const state=await pool.change(uid,{action:'add'}),id=state.selectedId;seed(uid,id,provider);await pool.state(uid,{slotId:id,connect:true});return id;};
 return {root,pool,profiles,auth,calls,replies,seed,add,reload,setNow:value=>{now=value;}};
}
test('legacy profile is retained and each additional login has a distinct owner-scoped path',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.pool.state('A',{connect:true});const second=await f.add('A','two');
 assert.equal(f.pool.profile('A','default'),path.join(f.root,'bridge-data/soutijiang/A/profile'));assert.notEqual(f.pool.profile('A',second),f.pool.profile('B',second));assert.equal(f.pool.view('A').accounts.length,2);assert.equal(f.pool.configured('A'),true);assert.equal(f.pool.configured('B'),false);
 assert.equal(f.pool.view('A').accounts[0].name,'用户 one');
});
test('remarks and order are persisted as portable descriptors, without credentials',async t=>{
 const f=fixture(t);const second=await f.add('A','two');await f.pool.change('A',{action:'rename',id:second,remark:'我的备用'});await f.pool.change('A',{action:'reorder',order:[second,'default']});
 assert.deepEqual(f.profiles.A.soutijiangAccounts.items,[{id:second,remark:'我的备用'},{id:'default',remark:''}]);assert(!JSON.stringify(f.profiles).includes('private-'));
 assert.throws(()=>Accounts.normalize({items:[{id:'../other',remark:''}]}));await assert.rejects(f.pool.change('A',{action:'reorder',order:[second,second]}));
});
test('an answer stops at the first account and counts only the successful method',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.add('A','two');assert.deepEqual(await f.pool.query('A',question),{kind:'hit',answer:'A'});assert.deepEqual(f.calls,[{id:'one',type:'screenshot'}]);
 const row=f.pool.view('A').accounts[0];assert.equal(row.screenshotUsed,1);assert.equal(row.solveUsed,0);assert.equal(row.officialUsed,null);
});
test('both explicit quota limits advance to the next account, in user order',async t=>{
 const f=fixture(t);f.seed('A','default','one');const second=await f.add('A','two');f.replies.set('one',[{message:{errNo:1},transport:{errstr:'今日截图搜题次数已耗尽'}},{errNo:4002}]);
 assert.deepEqual(await f.pool.query('A',question),{kind:'hit',answer:'A'});assert.deepEqual(f.calls.map(x=>x.id),['one','one','two']);assert.equal(f.pool.view('A').browserAccountId,second);
 assert.equal(f.pool.view('A').accounts[0].screenshotExhausted,true);assert.equal(f.pool.view('A').accounts[0].solveExhausted,true);
 await f.pool.query('A',{...question,title:'二加一等于多少？'});assert.equal(f.calls.filter(x=>x.id==='one').length,2);
 f.setNow(Date.parse('2026-11-22T16:00:01Z'));await f.pool.query('A',question);assert.equal(f.calls.at(-1).id,'one');assert.equal(f.pool.view('A').accounts[0].screenshotUsed,1);
});
for(const [label,response,code]of [['verification',{message:{errNo:410004}},'soutijiang_verification_required'],['login',{message:{errNo:303}},'soutijiang_login_required'],['network',Error('network'),'soutijiang_request_failed']])test(label+' never advances to another login',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.add('A','two');f.replies.set('one',[response]);await assert.rejects(f.pool.query('A',question),error=>error.code===code);assert.equal(f.calls.length,1);assert.equal(f.calls[0].id,'one');assert.equal(f.pool.view('A').accounts[0].screenshotUsed,0);
});
test('clear no-answer does not spend the next provider account quota',async t=>{const f=fixture(t);f.seed('A','default','one');await f.add('A','two');f.replies.set('one',[{message:{errNo:0,list:[]}}]);assert.deepEqual(await f.pool.query('A',question),{kind:'miss',explicitMiss:true});assert.equal(f.calls.length,1);});
test('same official login shares quota accounting across local records',async t=>{const f=fixture(t);f.seed('A','default','same');await f.add('A','same');await f.pool.query('A',question);assert.deepEqual(f.pool.view('A').accounts.map(x=>x.screenshotUsed),[1,1]);});
test('repeated concurrent requests share one official query',async t=>{const f=fixture(t);f.seed('A','default','one');const results=await Promise.all([f.pool.query('A',question),f.pool.query('A',question)]);assert.deepEqual(results[0],results[1]);assert.equal(f.calls.length,1);});
test('a bank login supplies the plugin without a second login operation',async t=>{
 const f=fixture(t);f.seed('A','default','one');const ticket=f.pool.ticket('A');const result=await f.pool.exchange(ticket.token,{snapshot:empty(),revision:0});assert.equal(Auth.user(result.snapshot).providerUid,'one');assert.equal(f.calls.length,0);assert.equal(f.pool.view('B').accounts[0].configured,false);
 assert(!JSON.stringify(f.pool.view('A')).includes('private-'));assert(!fs.readFileSync(f.pool.file,'utf8').includes('private-'));
});
test('a login performed in the plugin is adopted by the same owner bank',async t=>{
 const f=fixture(t);const ticket=f.pool.ticket('A');const first=await f.pool.exchange(ticket.token,{snapshot:login('one'),revision:0});assert.equal(f.pool.configured('A'),true);assert.equal(f.pool.view('A').name,'用户 one');assert.equal(first.snapshot,null);
 const next=await f.pool.exchange(ticket.token,{snapshot:empty(),revision:first.revision});assert.equal(f.pool.configured('A'),false);assert.equal(Auth.user(f.auth.get(f.pool.profile('A','default'))).loggedIn,false);assert.equal(next.snapshot,null);
});
test('different existing browser login is preserved before selecting the ordered login',async t=>{
 const f=fixture(t);f.seed('A','default','bank');const ticket=f.pool.ticket('A');const result=await f.pool.exchange(ticket.token,{snapshot:login('browser'),revision:0});const rows=f.pool.view('A').accounts;
 assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>x.name),['用户 bank','用户 browser']);assert.equal(Auth.user(result.snapshot).providerUid,'bank');
});
test('old browser snapshots cannot overwrite a new account order',async t=>{
 const f=fixture(t);f.seed('A','default','one');const second=await f.add('A','two'),ticket=f.pool.ticket('A');const first=await f.pool.exchange(ticket.token,{snapshot:empty(),revision:0});await f.pool.change('A',{action:'reorder',order:[second,'default']});
 const next=await f.pool.exchange(ticket.token,{snapshot:first.snapshot,revision:first.revision});assert.equal(Auth.user(next.snapshot).providerUid,'two');assert.equal(Auth.user(f.auth.get(f.pool.profile('A','default'))).providerUid,'one');
});
test('replaced browser ticket and other-owner credentials are not accepted',async t=>{const f=fixture(t);const old=f.pool.ticket('A');f.pool.ticket('A');await assert.rejects(f.pool.exchange(old.token,{snapshot:login('one'),revision:0}));await assert.rejects(f.pool.exchange('bad',{snapshot:login('one'),revision:0}));assert.equal(f.pool.configured('B'),false);});
test('auth copy allowlist excludes learning cookies, other storage and private browser settings',()=>{
 const raw=login('one');raw.storage.accountPassword='secret';raw.cookies.push({name:'DXUSS',value:'fake',domain:'chaoxing.com',path:'/'},{name:'_uid',value:'fake',domain:'passport.daxuesoutijiang.com',path:'/'});
 const clean=Auth.normalize(raw);assert.equal(clean.cookies.length,1);assert.equal(clean.storage.accountPassword,undefined);assert.equal(Auth.digest(clean),Auth.digest(Auth.normalize(clean)));
});

test('a pending QR survives browser heartbeats and is restored until its owner stops',async t=>{
 const f=fixture(t);f.seed('A','default','one');const ticket=f.pool.ticket('A'),first=await f.pool.exchange(ticket.token,{snapshot:empty(),revision:0});
 const added=await f.pool.change('A',{action:'add'}),second=added.selectedId;const qr=await f.pool.login('A',{slotId:second});assert.equal(qr.phase,'awaiting-login');
 const waiting=f.pool.engine.sessions.get('A');await f.pool.exchange(ticket.token,{snapshot:first.snapshot,revision:first.revision});assert.equal(waiting.closed(),false);
 const restored=await f.pool.state('A',{slotId:second,refresh:true});assert.equal(restored.phase,'awaiting-login');assert(restored.qrDataUrl);assert.equal(f.pool.engine.sessions.get('A'),waiting);
 await f.pool.state('A',{slotId:'default',connect:true});await f.pool.stop('A');assert.equal(waiting.closed(),true);assert.equal(f.pool.parked.size,0);assert.equal(f.pool.configured('A'),true);
});

test('removing one login keeps the other login and other learning owner intact',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.pool.state('A',{connect:true});const second=await f.add('A','two');f.seed('B','default','three');await f.pool.state('B',{connect:true});
 const file=f.pool.profile('A','default'),other=f.pool.profile('A',second),owner=f.pool.profile('B','default');fs.writeFileSync(path.join(file,'private-marker'),'one');
 await f.pool.change('A',{action:'remove',id:'default'});assert.equal(fs.existsSync(file),false);assert.equal(fs.existsSync(other),true);assert.equal(fs.existsSync(owner),true);
 assert.deepEqual(f.pool.view('A').accounts.map(row=>row.id),[second]);assert.equal(f.pool.engine.bindings.A,undefined);assert.equal(f.pool.saved.A.default,undefined);assert.equal(f.pool.configured('B'),true);
});

test('a failed account configuration save restores the login directory before reporting failure',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.pool.state('A',{connect:true});const folder=f.pool.profile('A','default'),marker=path.join(folder,'private-marker');fs.writeFileSync(marker,'retained');
 f.pool.controller.persist=()=>{throw Error('disk unavailable');};await assert.rejects(f.pool.change('A',{action:'remove',id:'default'}),/disk unavailable/);
 assert.equal(fs.readFileSync(marker,'utf8'),'retained');assert.equal(f.pool.view('A').accounts.length,1);assert.equal(f.pool.configured('A'),true);assert.equal(fs.readdirSync(path.dirname(folder)).some(name=>name.includes('.removing-')),false);assert.deepEqual(f.pool.removedIdentities('A'),[]);
});

for(const point of ['binding','state'])test('a failed '+point+' save during removal preserves the login and account descriptor',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.pool.state('A',{connect:true});const folder=f.pool.profile('A','default'),marker=path.join(folder,'private-marker');fs.writeFileSync(marker,'retained');const alreadyRemoved=[Auth.identity(login('previously-removed'))];f.pool.saved.A._removedIdentities=alreadyRemoved;f.pool.persistState();let fail=true;
 if(point==='binding'){const original=f.pool.engine.setConfigured.bind(f.pool.engine);f.pool.engine.setConfigured=(uid,value)=>{original(uid,value);if(!value&&fail){fail=false;throw Error('binding save failed');}};}
 else{const original=f.pool.persistState.bind(f.pool);f.pool.persistState=()=>{if(fail){fail=false;throw Error('state save failed');}return original();};}
 await assert.rejects(f.pool.change('A',{action:'remove',id:'default'}),/save failed/);assert.equal(fs.readFileSync(marker,'utf8'),'retained');assert.equal(f.pool.view('A').accounts.length,1);assert.equal(f.pool.configured('A'),true);assert.equal(f.pool.saved.A.default.providerUid,'one');assert.deepEqual(f.pool.removedIdentities('A'),alreadyRemoved);assert.deepEqual(JSON.parse(fs.readFileSync(f.pool.file,'utf8')).A._removedIdentities,alreadyRemoved);
});

test('bank disable stops its helpers without revoking the independent plugin login ticket',async t=>{
 const f=fixture(t);f.seed('A','default','one');const ticket=f.pool.ticket('A'),first=await f.pool.exchange(ticket.token,{snapshot:empty(),revision:0});f.profiles.A.soutijiangEnabled=false;await f.pool.stop('A');
 const next=await f.pool.exchange(ticket.token,{snapshot:first.snapshot,revision:first.revision});assert.equal(next.snapshot,null);assert.equal(f.pool.view('A').name,'用户 one');await assert.rejects(f.pool.query('A',question),error=>error.code==='soutijiang_disabled');assert.equal(f.calls.length,0);
});

test('relogging an already saved official identity replaces its credentials without adding a duplicate',async t=>{
 const f=fixture(t);f.seed('A','default','one');const second=await f.add('A','two'),ticket=f.pool.ticket('A'),first=await f.pool.exchange(ticket.token,{snapshot:empty(),revision:0});
 const fresh=login('two');fresh.storage.college_ai_dxuss='"refreshed-token"';fresh.cookies[0].value='refreshed-token';await f.pool.exchange(ticket.token,{snapshot:fresh,revision:first.revision});
 assert.equal(f.pool.view('A').accounts.length,2);assert.equal(f.pool.view('A').browserAccountId,second);assert.equal(f.auth.get(f.pool.profile('A',second)).cookies[0].value,'refreshed-token');
});

test('an explicit bank logout wins over a stale browser snapshot changed during the logout',async t=>{
 const f=fixture(t);f.seed('A','default','one');const ticket=f.pool.ticket('A'),first=await f.pool.exchange(ticket.token,{snapshot:empty(),revision:0});await f.pool.logout('A',{slotId:'default'});
 const stale=structuredClone(first.snapshot);stale.storage.college_ai_isVp='true';const next=await f.pool.exchange(ticket.token,{snapshot:stale,revision:first.revision});
 assert.equal(Auth.user(next.snapshot).loggedIn,false);assert.equal(f.pool.configured('A'),false);assert.equal(f.pool.view('A').accounts.length,1);
});

test('a newly scanned bank login is not replaced by the previous browser identity',async t=>{
 const f=fixture(t);f.seed('A','default','one');const ticket=f.pool.ticket('A'),first=await f.pool.exchange(ticket.token,{snapshot:empty(),revision:0});f.auth.set(f.pool.profile('A','default'),login('two'));await f.pool.state('A',{refresh:true});
 const stale=structuredClone(first.snapshot);stale.storage.college_ai_isVp='true';const next=await f.pool.exchange(ticket.token,{snapshot:stale,revision:first.revision});assert.equal(Auth.user(next.snapshot).providerUid,'two');assert.equal(f.pool.view('A').accounts.length,1);
});

test('a later browser launch cannot restore the cached identity after explicit bank logout',async t=>{
 const f=fixture(t);f.seed('A','default','one');const first=await f.pool.exchange(f.pool.ticket('A').token,{snapshot:empty(),revision:0});await f.pool.logout('A',{slotId:'default'});
 const reopened=await f.pool.exchange(f.pool.ticket('A').token,{snapshot:first.snapshot,revision:0});assert.equal(Auth.user(reopened.snapshot).loggedIn,false);assert.equal(f.pool.configured('A'),false);
 const fresh=login('two');const next=await f.pool.exchange([...f.pool.tickets.keys()][0],{snapshot:fresh,revision:reopened.revision});assert.equal(next.snapshot,null);assert.equal(f.pool.configured('A'),true);assert.equal(f.pool.view('A').name,'用户 two');
});

test('a first sync checks stale bank credentials before replacing the same browser identity',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.pool.state('A',{connect:true});const session=f.pool.engine.sessions.get('A'),old=session.message;
 session.message=async type=>{if(type==='updateUserInfo'){f.auth.set(f.pool.profile('A','default'),empty());return {};}return old(type);};
 const fresh=login('one');fresh.storage.college_ai_dxuss='"fresh-official-login"';fresh.cookies[0].value='fresh-official-login';const result=await f.pool.exchange(f.pool.ticket('A').token,{snapshot:fresh,revision:0});assert.equal(result.snapshot,null);assert.equal(f.auth.get(f.pool.profile('A','default')).cookies[0].value,'fresh-official-login');
});

test('stop rejects a late answer instead of delivering it after cancellation',async t=>{
 const f=fixture(t);f.seed('A','default','one');let started,finish;const began=new Promise(resolve=>{started=resolve;}),answer=new Promise(resolve=>{finish=resolve;});f.replies.set('one',[()=>{started();return answer;}]);
 const pending=f.pool.query('A',question);await began;await f.pool.stop('A');finish(structuredClone(hit));await assert.rejects(pending,error=>error.code==='soutijiang_cancelled');
});

test('dispose rejects queued account mutations before they can save metadata',async t=>{
 const f=fixture(t);let release,started;const held=new Promise(resolve=>{release=resolve;}),began=new Promise(resolve=>{started=resolve;});const first=f.pool.lock('A',()=>{started();return held;});await began;const queued=f.pool.change('A',{action:'add'}),rejected=assert.rejects(queued,/已关闭/);const closed=f.pool.dispose();release();await Promise.all([first,rejected,closed]);assert.equal(f.pool.definition('A').items.length,1);
});

function applicationHandler(name,pool,invalidated){
 const source=fs.readFileSync(path.join(__dirname,'../src/fusion/electron-bootstrap.cjs'),'utf8'),match=source.match(new RegExp('^ '+name+':(.+),\\r?$','m'));assert(match,'Real application handler must remain inspectable');
 return vm.runInNewContext('('+match[1]+')',{soutijiang:pool,connectionChecks:{invalidate:(uid,provider)=>invalidated.push([uid,provider])}});
}

test('actual state and account-change handlers retain connection checks for viewing and remarks only',async t=>{
 const f=fixture(t),invalidated=[];f.seed('A','default','one');await f.pool.state('A',{connect:true});const second=await f.add('A','two');
 const get=applicationHandler('getSoutijiangState',f.pool,invalidated),change=applicationHandler('changeSoutijiangAccounts',f.pool,invalidated),before=f.pool.view('A').connectionKey;
 const selected=await get({uid:'A',slotId:second,refresh:true});assert.equal(selected.name,'用户 two');assert.equal(selected.connectionKey,before);assert.equal(invalidated.length,0);
 await change({uid:'A',action:'rename',id:second,remark:'新备注'});assert.equal(f.pool.view('A').connectionKey,before);assert.equal(invalidated.length,0);
 await change({uid:'A',action:'reorder',order:['default',second]});assert.equal(invalidated.length,0);
 await change({uid:'A',action:'reorder',order:[second,'default']});assert.equal(invalidated.length,1);assert.notEqual(f.pool.view('A').connectionKey,before);
 f.auth.set(f.pool.profile('A',second),login('three'));await get({uid:'A',slotId:second,refresh:true});assert.equal(invalidated.length,2);
 const added=await change({uid:'A',action:'add'});assert.equal(invalidated.length,3);await change({uid:'A',action:'remove',id:added.selectedId});assert.equal(invalidated.length,4);
 assert(invalidated.every(([uid,provider])=>uid==='A'&&provider==='soutijiang'));
});

test('actual explicit login and logout handlers still refresh connection checks',async t=>{
 const f=fixture(t),invalidated=[];f.seed('A','default','one');await f.pool.state('A',{connect:true});
 await applicationHandler('loginSoutijiang',f.pool,invalidated)({uid:'A',slotId:'default'});await applicationHandler('logoutSoutijiang',f.pool,invalidated)({uid:'A',slotId:'default'});assert.deepEqual(invalidated,[['A','soutijiang'],['A','soutijiang']]);
});

test('removed browser identity stays removed across pool restart and unchanged cache retransmissions',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.pool.state('A',{connect:true});const second=await f.add('A','two'),first=await f.pool.exchange(f.pool.ticket('A').token,{snapshot:empty(),revision:0});
 await f.pool.change('A',{action:'remove',id:'default'});await f.pool.dispose();const pool=f.reload(),ticket=pool.ticket('A');let result=await pool.exchange(ticket.token,{snapshot:first.snapshot,revision:0});
 assert.deepEqual(pool.view('A').accounts.map(row=>row.id),[second]);assert.equal(Auth.user(result.snapshot).providerUid,'two');
 result=await pool.exchange(ticket.token,{snapshot:first.snapshot,revision:result.revision});const cosmetic=structuredClone(first.snapshot);cosmetic.storage.college_ai_isVp='true';result=await pool.exchange(ticket.token,{snapshot:cosmetic,revision:result.revision});assert.equal(pool.view('A').accounts.length,1);
 const fresh=login('one');fresh.storage.college_ai_dxuss='"fresh-after-removal"';fresh.cookies[0].value='fresh-after-removal';await pool.exchange(ticket.token,{snapshot:fresh,revision:result.revision});assert.equal(pool.view('A').accounts.length,2);assert.equal(pool.view('A').name,'用户 one');
 assert(!JSON.stringify(f.profiles.A.soutijiangAccounts).includes('providerUid'));assert(!JSON.stringify(f.profiles.A.soutijiangAccounts).includes('fresh-after-removal'));assert(!JSON.stringify(pool.view('A')).includes('_removedIdentities'));assert.deepEqual(pool.removedIdentities('A'),[]);
});

test('removing the last record rejects old cache but accepts a fresh login after the empty sync',async t=>{
 const f=fixture(t);f.seed('A','default','one');const old=await f.pool.exchange(f.pool.ticket('A').token,{snapshot:empty(),revision:0});await f.pool.change('A',{action:'remove',id:'default'});await f.pool.dispose();const pool=f.reload(),ticket=pool.ticket('A');
 let result=await pool.exchange(ticket.token,{snapshot:old.snapshot,revision:0});assert.equal(pool.view('A').accounts.length,0);assert.equal(Auth.user(result.snapshot).loggedIn,false);result=await pool.exchange(ticket.token,{snapshot:old.snapshot,revision:result.revision});assert.equal(pool.view('A').accounts.length,0);
 const fresh=login('one');fresh.storage.college_ai_dxuss='"new-scan"';fresh.cookies[0].value='new-scan';await pool.exchange(ticket.token,{snapshot:fresh,revision:result.revision});assert.equal(pool.view('A').accounts.length,1);assert.equal(pool.view('A').name,'用户 one');assert.equal(pool.configured('A'),true);
});

test('a removed identity is not suppressed for another learning owner or a retained duplicate slot',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.pool.state('A',{connect:true});const duplicate=await f.add('A','one');await f.pool.change('A',{action:'remove',id:'default'});const a=await f.pool.exchange(f.pool.ticket('A').token,{snapshot:login('one'),revision:0});assert.equal(f.pool.view('A').accounts.length,1);assert.equal(f.pool.view('A').accounts[0].id,duplicate);assert.equal(a.snapshot,null);
 await f.pool.change('A',{action:'remove',id:duplicate});await f.pool.exchange(f.pool.ticket('B').token,{snapshot:login('one'),revision:0});assert.equal(f.pool.view('B').name,'用户 one');assert.equal(f.pool.view('A').accounts.length,0);
});

test('logging out before removal does not discard the identity needed to reject its stale cache',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.pool.state('A',{connect:true});const second=await f.add('A','two');await f.pool.logout('A',{slotId:'default'});await f.pool.change('A',{action:'remove',id:'default'});
 await f.pool.exchange(f.pool.ticket('A').token,{snapshot:login('one'),revision:0});assert.deepEqual(f.pool.view('A').accounts.map(row=>row.id),[second]);
});

test('an empty pool preserves a different existing browser login on its first share',async t=>{
 const f=fixture(t);f.seed('A','default','one');await f.pool.state('A',{connect:true});await f.pool.change('A',{action:'remove',id:'default'});
 const result=await f.pool.exchange(f.pool.ticket('A').token,{snapshot:login('different'),revision:0});assert.equal(result.snapshot,null);assert.equal(f.pool.view('A').accounts.length,1);assert.equal(f.pool.view('A').name,'用户 different');assert.deepEqual(f.pool.removedIdentities('A'),[Auth.identity(login('one'))]);
});

test('acknowledging the remaining login cannot unblock the removed credentials, even after restart',async t=>{
 const f=fixture(t);f.seed('A','default','one');const second=await f.add('A','two'),old=await f.pool.exchange(f.pool.ticket('A').token,{snapshot:empty(),revision:0});
 await f.pool.change('A',{action:'remove',id:'default'});await f.pool.dispose();let pool=f.reload(),ticket=pool.ticket('A');let result=await pool.exchange(ticket.token,{snapshot:old.snapshot,revision:0});
 assert.equal(Auth.user(result.snapshot).providerUid,'two');result=await pool.exchange(ticket.token,{snapshot:login('two'),revision:result.revision});assert.equal(result.snapshot,null);
 result=await pool.exchange(ticket.token,{snapshot:old.snapshot,revision:result.revision});assert.deepEqual(pool.view('A').accounts.map(row=>row.id),[second]);assert.equal(Auth.user(result.snapshot).providerUid,'two');
 await pool.dispose();pool=f.reload();ticket=pool.ticket('A');result=await pool.exchange(ticket.token,{snapshot:login('two'),revision:0});assert.equal(result.snapshot,null);
 result=await pool.exchange(ticket.token,{snapshot:old.snapshot,revision:result.revision});assert.deepEqual(pool.view('A').accounts.map(row=>row.id),[second]);
 const fresh=login('one');fresh.storage.college_ai_dxuss='"new-post-ack-login"';fresh.cookies[0].value='new-post-ack-login';await pool.exchange(ticket.token,{snapshot:fresh,revision:result.revision});assert.equal(pool.view('A').accounts.length,2);assert.equal(pool.view('A').name,'用户 one');
 assert(!fs.readFileSync(pool.file,'utf8').includes('private-one'));assert(!fs.readFileSync(pool.file,'utf8').includes('new-post-ack-login'));assert(!JSON.stringify(f.profiles.A.soutijiangAccounts).includes('_removed'));
});
