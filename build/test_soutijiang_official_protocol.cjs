'use strict';
// Opt-in checks against the untouched official website package. They never install an
// extension, open a real profile, or send network traffic. The fixtures remain
// outside the source release; set its path to replay the compatibility proof.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {createChromeSession,EXTENSION_ID}=require('../src/fusion/soutijiang.cjs');
const specs=[
 {version:'1.17.6',env:'XBT_STJ_OFFICIAL_1176',options:'17bccdd0ba5f7c729bef5224b037e3d38ed8a91486b9865dfdca365c7f3a6de1',background:'f8e4a30f3d55cf6b103884fe255732e33e1bf32a2f3228d67236dcfd0d06cacc'}
];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const silent={log(){},info(){},warn(){},error(){}};
function registry(spec,background=false){
 const root=process.env[spec.env],relative=background?'static/background/index.js':'options.2a742e8f.js';
 const source=fs.readFileSync(path.join(root,relative),'utf8');
 assert.equal(hash(source),spec[background?'background':'options'],'use the recorded official bytes');
 const suffix=/,\[[^\]]*\],"[^"]+","parcelRequire4416"\),globalThis\.define=[A-Za-z];\s*$/g;
 assert.equal([...source.matchAll(suffix)].length,1,'unique Parcel bootstrap suffix');
 const context=vm.createContext({console:silent,navigator:{userAgent:'Windows',onLine:true},URL,Headers,FormData,Blob,AbortController,atob,setTimeout,clearTimeout,fetch(){throw Error('network forbidden');}});
 // Register original factories without running the extension entry point.
 vm.runInContext(source.replace(suffix,',[],null,"parcelRequire4416"),globalThis.define=undefined;'),context,{timeout:3000});
 const require=context.parcelRequire4416;assert.equal(typeof require,'function');
 return {context,require,modules:require.modules,stub(owner,name,value){const id=require.modules[owner][1][name];assert.ok(id,name);require.register(id,value);}};
}
function emitter(){const listeners=[];return {addListener(fn){listeners.push(fn);},emit(value){for(const fn of [...listeners])fn(value);}};}
function setupOptions(spec){
 const bundle=registry(spec),values=new Map([['userInfo',{uid:'mock-provider'}],['sourceAppId','mock-source']]),cookieWrites=[],requests=[],notifications=[];
 const storage={get:async key=>values.get(key),set:async(key,value)=>{values.set(key,value);},remove:async key=>{values.delete(key);}};
 const cookie={name:'DXUSS',value:'mock-credential',domain:'.daxuesoutijiang.com',path:'/',httpOnly:true,expirationDate:2000000000};
 const chrome={runtime:{lastError:null},tabs:{query:(_,cb)=>cb([{id:1}])},cookies:{get:(_,cb)=>cb({...cookie}),getAll:async()=>[{...cookie}],set:(value,cb)=>{cookieWrites.push(value);if(cb)cb(value);return Promise.resolve(value);}}};
 Object.assign(bundle.context,{chrome});
 bundle.stub('785n3','@utils/storage',{storage});
 bundle.stub('785n3','@api/index',{reportLogRequest(){}});
 bundle.stub('785n3','@utils/authGate',{loadLoginRequired:async()=>true});
 bundle.stub('5YoFV','./chrome',{sendToCurrentTab:message=>notifications.push(message)});
 bundle.stub('7FtHO','@utils/util',{getOperatingSystem:()=> 'Windows'});
 bundle.stub('7FtHO','~utils/aegis',{APMPlusSendEvent(){}});
 bundle.stub('7FtHO','@api/reportLog',{reportLogRequest(){}});
 bundle.stub('4sjF7','@common/message/requestApi',{requestApi(){throw Error('unexpected background API request');}});
 let response={errNo:0,data:{sessionId:'mock-session'}};
 bundle.context.fetch=async(url,options)=>{requests.push({url,options});return {status:200,headers:new Headers(),json:async()=>response};};
 bundle.require('4sjF7').enableDirectApiRequests();
 return {...bundle,values,storage,chrome,cookieWrites,requests,notifications,respond:value=>{response=value;}};
}
function setupSse(spec){
 const bundle=registry(spec,true),onConnect=emitter(),requests=[];
 let events=[{event:'recognition',data:JSON.stringify({errNo:0,data:{contentType:28}})},{event:'notification',data:JSON.stringify({errNo:0,data:{content:JSON.stringify({questionList:[{question:'mock question',answer:'mock answer'}],showVipMask:false})}})},{event:'finish',data:'{"errNo":0}'}];
 bundle.context.chrome={runtime:{onConnect}};
 bundle.stub('d2JDW','@api/index',{reportLogRequest(){}});
 bundle.stub('d2JDW','~utils/aegis',{APMPlusSendEvent(){}});
 bundle.stub('d2JDW','@microsoft/fetch-event-source',{fetchEventSource:async(url,options)=>{
  requests.push({url,options});await options.onopen({ok:true,status:200});
  for(const event of events){if(options.signal.aborted)break;if(event.transportError){options.onerror(Error('mock transport'));break;}options.onmessage(event);}
 }});
 bundle.require('d2JDW').registerSsePortRouter();
 const connect=({name})=>{
  const toUi=emitter(),toBg=emitter(),disconnect=emitter();
  const bg={name,sender:{tab:{id:1}},onMessage:toBg,onDisconnect:disconnect,postMessage:event=>toUi.emit(event)};
  const ui={onMessage:toUi,onDisconnect:disconnect,postMessage:event=>toBg.emit(event),disconnect:()=>disconnect.emit()};
  onConnect.emit(bg);return ui;
 };
 return {...bundle,requests,connect,events:value=>{events=value;}};
}
async function coreSession(options,sse){
 const prefix=`chrome-extension://${EXTENSION_ID}/`;options.chrome.runtime.connect=sse.connect;
 const page={url:()=>prefix+'options.html#/installed',goto:async()=>{},waitForFunction:async()=>{},isClosed:()=>false,evaluate:async(fn,args)=>{
  options.context.__input=args;return vm.runInContext('('+String(fn)+')(__input)',options.context,{timeout:3000});
 }};
 const context={serviceWorkers:()=>[{url:()=>prefix+'static/background/index.js'}],pages:()=>[page],close:async()=>{}};
 return createChromeSession({root:'.',profile:'mock-profile',extension:{directory:'mock-extension'},chromium:{launchPersistentContext:async()=>context}});
}
function setupSolve(spec){
 const bundle=registry(spec,true),requests=[],invalid=[],notifications=[];let response={errNo:0,data:{option:'B'}};
 bundle.stub('az30U','@api/core/request',{requestByContext:async input=>{requests.push(input);return response;}});
 const api=bundle.require('az30U');
 bundle.stub('4DEGm','@api/index',{solveExercise:api.solveExercise,reportLogRequest(){},fetchVIPStatus:async()=>({errNo:0,data:{isActive:true}})});
 bundle.stub('4DEGm','~utils/aegis',{APMPlusSendEvent(){}});
 bundle.stub('4DEGm','~utils/loginState',{handleLoginInvalidState:async code=>invalid.push(code)});
 bundle.stub('4DEGm','@utils/chrome',{sendToCurrentTab:event=>notifications.push(event)});
 return {...bundle,requests,invalid,notifications,handle:bundle.require('4DEGm').handleSolveExercise,respond:value=>{response=value;}};
}
for(const spec of specs){
 const skip=process.env[spec.env]?false:`set ${spec.env} to the extracted official package`;
 test(`official ${spec.version}: manifest identity, exact modules, and existing message routes`,{skip},()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(process.env[spec.env],'manifest.json'),'utf8'));
  assert.equal(manifest.version,spec.version);assert.equal(manifest.manifest_version,3);assert.equal(manifest.background.service_worker,'static/background/index.js');
  assert.equal(hash(Buffer.from(manifest.key,'base64')).slice(0,32).replace(/[0-9a-f]/g,n=>String.fromCharCode(97+parseInt(n,16))),EXTENSION_ID);
  const options=registry(spec),background=registry(spec,true),constants=options.require('8YU2f'),types=options.require('DqRFE').CommonMsgEventType;
  assert.equal(constants.VERSION,spec.version);assert.equal(constants.StoragePrefix,'college_ai_');assert.equal(constants.SOURCE_APP_ID_STORAGE_KEY,'sourceAppId');
  assert.equal(options.require('6YnMs').default(),Number(spec.version.replaceAll('.','')));
  for(const [name,value]of Object.entries({CreateSSE:21,CloseSSE:22,SSEData:23,SSEOpen:24,SSEError:25,SSEClose:26}))assert.equal(constants.MessageType[name],value);
  for(const [name,value]of Object.entries({GetUserInfo:'getUserInfo',UpdateUserInfo:'updateUserInfo',LogOut:'LogOut',SolveExercise:'SolveExercise'}))assert.equal(types[name],value);
  const dispatcher=String(background.modules['3W0M0'][0]);
  assert.match(dispatcher,/CommonMsgEventType\.SolveExercise:\{let \w+=await \(0,\w+\.handleSolveExercise\)\(e\.data,t\)/);
  assert.match(dispatcher,/CommonMsgEventType\.LogOut:\{let e=!1;try\{e=await \(0,\w+\.doLogout\)\(\)/);
  assert.ok(dispatcher.includes('CommonMsgEventType.GetUserInfo:'));assert.ok(dispatcher.includes('CommonMsgEventType.UpdateUserInfo:'));
 });
 test(`official ${spec.version}: session uses official VC, signature, source app and included cookies`,{skip},async()=>{
  const b=setupOptions(spec),result=await b.require('785n3').fetchSessionId();assert.equal(result.data.sessionId,'mock-session');
  assert.equal(b.requests.length,1);const {url,options}=b.requests[0],params=new URLSearchParams(options.body);
  assert.equal(url,'https://www.daxuesoutijiang.com/dxkits/aisearch/pc/session/create');assert.equal(options.method,'POST');assert.equal(options.credentials,'include');
  assert.equal(params.get('uid'),'mock-provider');assert.equal(params.get('appId'),'collegepcpi');assert.equal(params.get('skip'),'rdqa');assert.equal(params.get('sourceAppId'),'mock-source');
  assert.equal(params.get('vcname'),spec.version);assert.equal(params.get('vc'),spec.version.replaceAll('.',''));assert.match(params.get('fkey'),/^[0-9a-f]{32}$/);assert.match(params.get('ftime'),/^\d+$/);
  assert.equal(b.values.get('sessionId').sessionId,'mock-session');assert.ok(b.cookieWrites.some(x=>x.url==='https://apivip.zuoyebang.com'&&x.name==='DXUSS'));
  b.values.delete('userInfo');assert.equal(await b.require('785n3').fetchSessionId(),undefined);assert.equal(b.requests.length,1);
 });
 test(`official ${spec.version}: login fields and invalidation remain compatible`,{skip},async()=>{
  const b=setupOptions(spec),login=b.require('5YoFV');await login.syncWechatLoginCookie(' mock-wechat ');await login.setLoginSourceAppId(123);
  assert.equal(b.values.get('dxuss'),'mock-wechat');assert.equal(b.values.get('sourceAppId'),'123');assert.equal(b.cookieWrites.length,2);
  for(const cookie of b.cookieWrites){assert.equal(cookie.name,'DXUSS');assert.equal(cookie.value,'mock-wechat');assert.equal(cookie.secure,true);assert.equal(cookie.httpOnly,true);assert.equal(cookie.sameSite,'no_restriction');}
  b.values.set('sessionId','stale');b.values.set('operateType','stale');await login.handleLoginInvalidState(303);
  assert.equal(b.values.get('userInfo'),'');assert.equal(b.values.get('isVp'),false);for(const key of ['sourceAppId','operateType','sessionId'])assert.equal(b.values.has(key),false);
  assert.equal(b.notifications[0].ext.errNo,303);assert.equal(b.requests.length,0);
 });
 test(`official ${spec.version}: Core screenshot crosses real session and SSE modules with mocked transport`,{skip},async()=>{
  const options=setupOptions(spec),sse=setupSse(spec),session=await coreSession(options,sse);
  try{
   const result=await session.screenshot('data:image/jpeg;base64,bW9jaw==',3000);
   assert.deepEqual(plain(result),{protocol:'sse',message:{errNo:0,list:[{question:'mock question',answer:'mock answer'}],info:{showVipMask:false}}});
   assert.equal(sse.requests.length,1);const request=sse.requests[0],params=new URLSearchParams(request.options.body);
   assert.equal(request.url,'https://www.daxuesoutijiang.com/dxkits/aisearch/pc/askstream');assert.equal(request.options.credentials,'include');assert.equal(request.options.method,'POST');
   assert.equal(params.get('sessionId'),'mock-session');assert.equal(params.get('vc'),spec.version.replaceAll('.',''));assert.equal(params.get('messageCategory'),'257');assert.equal(params.get('image'),'bW9jaw==');assert.equal(JSON.parse(params.get('questionData')).text,'pc截图搜题');assert.equal(request.options.signal.aborted,true);
  }finally{await session.close();}
 });
 test(`official ${spec.version}: Core SSE preserves auth failures and stops transport errors`,{skip},async()=>{
  const options=setupOptions(spec),sse=setupSse(spec),session=await coreSession(options,sse);
  try{
   sse.events([{event:'message',data:'{"errNo":303,"errstr":"mock expired"}'}]);const result=await session.screenshot('data:image/jpeg;base64,bW9jaw==',3000);assert.equal(result.message.errNo,303);assert.equal(sse.requests.length,1);
   sse.events([{transportError:true}]);await assert.rejects(session.screenshot('data:image/jpeg;base64,bW9jaw==',3000),/official_screenshot_transport_error/);assert.equal(sse.requests.length,2);
   options.respond({errNo:303,data:{}});const before=sse.requests.length,failed=await session.screenshot('data:image/jpeg;base64,bW9jaw==',3000);assert.equal(failed.message.errNo,303);assert.equal(sse.requests.length,before);
  }finally{await session.close();}
 });
 test(`official ${spec.version}: solve handler and API preserve request fields and response`,{skip},async()=>{
  const b=setupSolve(spec),input={base64:'data:image/jpeg;base64,bW9jaw==',questionText:'mock question',options:[{label:'A',text:'one'},{label:'B',text:'two'}],questionType:'single',questionId:'mock-id',index:7,iframeIndex:0,questionFrom:'mock-platform',blankNum:0,historyResult:'[]'};
  const result=await b.handle(input,{tab:{id:1,url:'https://mock.invalid/'}});assert.equal(result.errNo,0);assert.equal(result.result.option,'B');assert.equal(result.result.questionId,'mock-id');assert.equal(result.result.index,7);
  assert.equal(b.requests.length,1);const request=b.requests[0];assert.equal(request.url,'/dxai/submit/exercise/solve');assert.equal(request.options.method,'FILE');assert.equal(request.options.host,'https://www.daxuesoutijiang.com');assert.equal(request.options.needSignature,false);
  assert.equal(require('../src/fusion/soutijiang-browser-quota.cjs').methodFor(request.options.host+request.url),'solve','browser quota observer recognizes the actual official endpoint');
  const params=request.options.params;assert.equal(params.questionText,'mock question');assert.equal(params.questionType,'single');assert.deepEqual(JSON.parse(params.options),input.options);assert.equal(params.image.type,'image/jpeg');assert.equal(params.image.size,4);assert.match(params.picMD5,/^[0-9a-f]{32}$/);
 });
 test(`official ${spec.version}: solve auth, quota, and verification errors remain distinct`,{skip},async()=>{
  const b=setupSolve(spec),input={questionText:'mock question',options:[],questionType:'single'};
  for(const code of [3,303,4002,410004]){b.respond({errNo:code});const result=await b.handle(input,{tab:{id:1}});assert.equal(result.errNo,code);if(code===4002)assert.equal(result.result.isVip,true);}
  assert.deepEqual(b.invalid,[3,303]);assert.equal(b.notifications.length,1);assert.equal(b.notifications[0].ext.errNo,410004);assert.equal(b.requests.length,4);
 });
}
