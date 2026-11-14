'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {prepareBrowserProfile,MARKER}=require('../src/fusion/browser-profile-isolation.cjs');
const qa=path.resolve(process.env.XBT_QA_ROOT||path.join(__dirname,'../..'));
fs.mkdirSync(qa,{recursive:true});
const base=fs.mkdtempSync(path.join(qa,'browser-profile-unit-'));
let sequence=0;
function fixture(){const root=path.join(base,String(++sequence)),cacheRoot=path.join(root,'profiles'),userDataRoot=path.join(root,'application-data');fs.mkdirSync(userDataRoot,{recursive:true});return{root,cacheRoot,userDataRoot};}
function input(f,uid='account-A'){return{uid,cacheRoot:f.cacheRoot,profilePath:path.join(f.cacheRoot,uid),userDataRoot:f.userDataRoot,protectedRoots:[]};}
const rejected=fn=>assert.throws(fn,error=>error.code==='FUSION_BROWSER_PROFILE');

test('legacy normal profile remains in place and a custom plain cache root is accepted',()=>{
 const f=fixture(),a=input(f),cookie=path.join(a.profilePath,'Default/Network/Cookies');
 fs.mkdirSync(path.dirname(cookie),{recursive:true});fs.writeFileSync(cookie,'synthetic-existing-cookie-file');
 assert.equal(prepareBrowserProfile(a),a.profilePath);
 assert.equal(fs.readFileSync(cookie,'utf8'),'synthetic-existing-cookie-file');
 const first=fs.readFileSync(path.join(a.profilePath,MARKER),'utf8');
 assert.equal(prepareBrowserProfile(a),a.profilePath);
 assert.equal(fs.readFileSync(path.join(a.profilePath,MARKER),'utf8'),first);
 assert.equal(JSON.parse(first).owner,f.userDataRoot);
});
test('different account cannot use another account directory or its ownership marker',()=>{
 const f=fixture(),a=input(f),b=input(f,'account-B');prepareBrowserProfile(a);
 rejected(()=>prepareBrowserProfile({...b,profilePath:a.profilePath}));
 fs.mkdirSync(b.profilePath);fs.copyFileSync(path.join(a.profilePath,MARKER),path.join(b.profilePath,MARKER));
 rejected(()=>prepareBrowserProfile(b));
 assert.equal(JSON.parse(fs.readFileSync(path.join(a.profilePath,MARKER))).uid,a.uid);
});
test('other application data root and corrupt markers stop without replacing stored files',()=>{
 const f=fixture(),a=input(f);prepareBrowserProfile(a);const marker=path.join(a.profilePath,MARKER),before=fs.readFileSync(marker);
 rejected(()=>prepareBrowserProfile({...a,userDataRoot:path.join(f.root,'other-installation')}));
 assert.deepEqual(fs.readFileSync(marker),before);
 fs.writeFileSync(marker,'invalid fixture');rejected(()=>prepareBrowserProfile(a));assert.equal(fs.readFileSync(marker,'utf8'),'invalid fixture');
});
test('directory links in a cache root or inside a profile are refused before marker creation',()=>{
 const f=fixture(),real=path.join(f.root,'real'),linked=path.join(f.root,'linked');fs.mkdirSync(real);fs.symlinkSync(real,linked,process.platform==='win32'?'junction':'dir');
 const a=input(f);rejected(()=>prepareBrowserProfile({...a,cacheRoot:linked,profilePath:path.join(linked,a.uid)}));
 assert.deepEqual(fs.readdirSync(real),[]);
 fs.mkdirSync(a.profilePath,{recursive:true});fs.symlinkSync(real,path.join(a.profilePath,'Default'),process.platform==='win32'?'junction':'dir');
 rejected(()=>prepareBrowserProfile(a));assert.equal(fs.existsSync(path.join(a.profilePath,MARKER)),false);
});
test('original OCS profile locations and invalid identifiers are rejected',()=>{
 const f=fixture(),a=input(f),ocs=path.join(f.root,'original-ocs');
 rejected(()=>prepareBrowserProfile({...a,cacheRoot:path.join(ocs,'userDataDirs'),profilePath:path.join(ocs,'userDataDirs',a.uid),protectedRoots:[ocs]}));
 for(const uid of ['../other','CON','constructor',''])rejected(()=>prepareBrowserProfile({...a,uid}));
 assert.equal(fs.existsSync(ocs),false);
});
test('Windows case aliases cannot give two account IDs the same profile',()=>{
 const f=fixture(),a=input(f,'Account-A');prepareBrowserProfile(a);
 if(process.platform==='win32')rejected(()=>prepareBrowserProfile(input(f,'account-a')));
 else rejected(()=>prepareBrowserProfile({...input(f,'account-a'),profilePath:a.profilePath}));
});
test('actual worker launch calls profile validation and stops before Chromium on a bad account path',async()=>{
 const f=fixture(),a=input(f),source=fs.readFileSync(path.join(__dirname,'../src/ocs-app/lib/src/worker/index.js'),'utf8');
 const prefix=source.slice(0,source.indexOf('Object.defineProperty(exports,')),code=source.slice(source.indexOf('class ScriptWorker {'),source.indexOf('exports.ScriptWorker = ScriptWorker;'));
 const launched=[],errors=[];
 const context={console:{log(){},error(...args){errors.push(args.join(' '));}},process:{platform:'linux'},fs_1:{default:fs},path_1:{default:path},formatExtensionArguments:()=>[],send(){},
  launchBrowser:async options=>launched.push(options.userDataDir),require:file=>{if(file.endsWith('browser-profile-isolation.cjs'))return{prepareBrowserProfile};throw Error('Unexpected require '+file);}};
 vm.createContext(context);vm.runInContext(prefix+code+';this.Worker=ScriptWorker;',context);
 const worker=new context.Worker();worker.uid=a.uid;worker.fusionRoot=f.root;worker.store={paths:{userDataDirsFolder:f.cacheRoot,'user-data-path':f.userDataRoot},server:{port:1}};worker.config={};worker.debug=()=>{};let closed=false;worker.close=async()=>{closed=true;};
 await worker.launch({executablePath:process.execPath,userDataDir:path.join(f.cacheRoot,'other-account')});
 assert.equal(launched.length,0);assert.equal(closed,true);assert.match(errors.join('\n'),/缓存目录与当前账号不匹配/);
 closed=false;await worker.launch({executablePath:process.execPath,userDataDir:a.profilePath});assert.deepEqual(launched,[a.profilePath]);assert.equal(closed,false);
});
