'use strict';
const https=require('node:https'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises'),{Transform}=require('node:stream');
const REPO='A3697/XueBuTong',PROJECT_URL=`https://github.com/${REPO}`;
const MAX_PACKAGE=2*1024*1024*1024;
function versionParts(value){if(typeof value!=='string'||!/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(value))throw Error('更新版本格式无效');return value.split('.').map(Number);}
function newer(a,b){const x=versionParts(a),y=versionParts(b);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
function trustedUrl(value,asset=false){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw Error('更新下载地址不受信任');
 const allowed=asset?['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com']:['api.github.com'];
 if(!allowed.includes(u.hostname))throw Error('更新下载地址不受信任');
 if(u.hostname==='github.com'&&!u.pathname.startsWith(`/${REPO}/releases/download/`))throw Error('更新文件不属于本项目');
 if(u.hostname==='api.github.com'&&!u.pathname.startsWith(`/repos/${REPO}/`))throw Error('更新接口不属于本项目');
 return u;
}
function request(url,{asset=false,signal,redirects=0}={}){
 return new Promise((resolve,reject)=>{
  const u=trustedUrl(url,asset);
  const req=https.get(u,{agent:new https.Agent({keepAlive:false}),signal,headers:{'User-Agent':'XueBuTong-Updater','Accept':asset?'application/octet-stream':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}},res=>{
   if([301,302,303,307,308].includes(res.statusCode)){
    res.resume();if(redirects>=5)return reject(Error('更新下载重定向过多'));
    let next;try{next=trustedUrl(new URL(res.headers.location,u).href,asset);}catch(e){return reject(e);}
    request(next.href,{asset,signal,redirects:redirects+1}).then(resolve,reject);return;
   }
   resolve(res);
  });req.setTimeout(30000,()=>req.destroy(Error('连接 GitHub 超时，请稍后重试')));req.on('error',reject);
 });
}
async function releaseInfo(fetchResponse=request){
 const response=await fetchResponse(`https://api.github.com/repos/${REPO}/releases/latest`,{signal:AbortSignal.timeout(30000)});
 if(response.statusCode===404){response.resume();return null;}
 if(response.statusCode!==200){response.resume();throw Error(response.statusCode===403||response.statusCode===429?'GitHub 请求暂时受限，请稍后重试':`获取更新失败（HTTP ${response.statusCode}）`);}
 let size=0;const chunks=[];for await(const chunk of response){size+=chunk.length;if(size>2*1024*1024){response.destroy();throw Error('更新信息过大');}chunks.push(chunk);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function checkedAsset(asset,limit=MAX_PACKAGE){
 if(!Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>limit||!/^sha256:[a-f0-9]{64}$/i.test(asset.digest||''))throw Error('更新包缺少有效的大小或 SHA-256 校验信息');
 trustedUrl(asset.browser_download_url,true);return asset;
}
function parseRelease(release,current,{incremental=false,reason=''}={}){
 if(!release)return {status:'unpublished',message:'项目尚未发布可安装更新。'};
 if(release.draft||release.prerelease)throw Error('更新不是正式发布版本');
 const version=String(release.tag_name||'').replace(/^v/,'');versionParts(version);
 if(!newer(version,current))return {status:'current',version,message:`当前 ${current} 已是最新版本。`};
 const name=incremental?`XueBuTong-Update-${version}-win-x64.exe`:`XueBuTong-${version}-win-x64-setup.exe`;
 const asset=(release.assets||[]).find(a=>a.name===name&&a.state==='uploaded');
 if(!asset)return {status:'manual',version,message:`发现 ${version}，尚无已确认适配本机的安装包，请查看项目发布页。`};
 checkedAsset(asset);
 return {status:'available',version,name,packageKind:incremental?'incremental':'full',size:asset.size,sha256:asset.digest.slice(7).toLowerCase(),url:asset.browser_download_url,message:`发现新版本 ${version}，使用${incremental?'增量包':'完整安装包'}。${reason}下载后需确认安装，保留账号与用户数据。`};
}
async function selectRelease(release,current,baseline,fetchResponse=request){
 const fallback=parseRelease(release,current);
 if(['current','unpublished'].includes(fallback.status))return fallback;
 const version=String(release.tag_name).replace(/^v/,''),name=`XueBuTong-Update-${version}-win-x64`;
 const asset=release.assets?.find(a=>a.name===name+'.exe'&&a.state==='uploaded');
 const manifest=release.assets?.find(a=>a.name===name+'.manifest.json'&&a.state==='uploaded');
 if(asset&&manifest&&baseline.metadataSha256&&baseline.backendManifestSha256)try{
  checkedAsset(asset);checkedAsset(manifest,4*1024*1024);
  const res=await fetchResponse(manifest.browser_download_url,{asset:true,signal:AbortSignal.timeout(30000)});
  if(res.statusCode!==200){res.resume();throw Error('manifest_unavailable');}
  let size=0;const chunks=[];for await(const chunk of res){size+=chunk.length;if(size>manifest.size){res.destroy();throw Error('manifest_size');}chunks.push(chunk);}
  const data=Buffer.concat(chunks);if(size!==manifest.size||crypto.createHash('sha256').update(data).digest('hex')!==manifest.digest.slice(7).toLowerCase())throw Error('manifest_digest');
  const info=JSON.parse(data.toString('utf8')),base=info.compatibleBase;
  if(info.passed===true&&info.requiresExistingInstall===true&&info.version===version&&info.package===asset.name&&info.sha256===asset.digest.slice(7).toLowerCase()&&info.size===asset.size&&base?.version===current&&base.metadataSha256===baseline.metadataSha256&&base.backendManifestSha256===baseline.backendManifestSha256)
   return parseRelease(release,current,{incremental:true});
 }catch{/* Unavailable or incompatible delta metadata falls back to the verified full installer. */}
 return fallback.status==='available'?{...fallback,message:`发现新版本 ${version}；增量包未确认适用于当前安装，已选择完整安装包。保留账号与用户数据。`}:fallback;
}
async function digestFile(file){const hash=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))hash.update(b);return hash.digest('hex');}
class GitHubUpdates{
 constructor({root,fetchResponse=request}){this.root=root;this.fetchResponse=fetchResponse;this.state={status:'idle',message:'从 GitHub 检查学不通更新。'};this.busy=null;this.package=null;}
 snapshot(){const {url,sha256,...state}=this.state;return {...state,projectUrl:PROJECT_URL};}
 async check(){
  if(this.busy)throw Error('正在处理更新，请稍候');
  this.state={status:'checking',message:'正在连接 GitHub…'};
  this.busy=(async()=>{try{const file=path.join(this.root,'fusion-install.json'),current=JSON.parse(fs.readFileSync(file,'utf8')).version;const hash=name=>{try{return crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');}catch{return '';}};const baseline={metadataSha256:hash(file),backendManifestSha256:hash(path.join(this.root,'star-runtime/_backend-prepared-manifest.json'))};this.state=await selectRelease(await releaseInfo(this.fetchResponse),current,baseline,this.fetchResponse);this.package=null;return this.snapshot();}catch(e){this.state={status:'error',message:e.message};throw e;}finally{this.busy=null;}})();return this.busy;
 }
 async download(){
  if(this.busy)throw Error('正在处理更新，请稍候');
  if(this.state.status!=='available')throw Error('请先检查更新');
  const release={...this.state},folder=path.join(this.root,'updates'),file=path.join(folder,release.name),partial=file+'.part';
  if(fs.existsSync(folder)&&fs.lstatSync(folder).isSymbolicLink())throw Error('更新目录不能是链接');
  fs.mkdirSync(folder,{recursive:true});
  this.state={...release,status:'downloading',received:0,message:'正在下载更新…'};
  this.busy=(async()=>{try{
   const response=await this.fetchResponse(release.url,{asset:true,signal:AbortSignal.timeout(15*60000)});
   if(response.statusCode!==200){response.resume();throw Error(`更新包下载失败（HTTP ${response.statusCode}）`);}
   let received=0;const hash=crypto.createHash('sha256');
   const counter=new Transform({transform:(chunk,enc,done)=>{received+=chunk.length;if(received>release.size)return done(Error('更新包大小不符'));hash.update(chunk);this.state.received=received;done(null,chunk);}});
   // A previous failed download is expendable; never follow an existing link.
   if(fs.existsSync(partial))fs.unlinkSync(partial);
   await pipeline(response,counter,fs.createWriteStream(partial,{flags:'wx'}));
   if(received!==release.size||hash.digest('hex')!==release.sha256)throw Error('更新包校验失败，请重新检查更新并下载');
   if(fs.existsSync(file))fs.unlinkSync(file);fs.renameSync(partial,file);
   this.package={...release,file};this.state={...release,status:'ready',message:'更新包已下载并通过 SHA-256 校验。请停止运行中的账号后安装。'};return this.snapshot();
  }catch(e){if(fs.existsSync(partial))fs.unlinkSync(partial);this.state={status:'error',message:e.message};throw e;}finally{this.busy=null;}})();return this.busy;
 }
 async verifiedPackage(){if(!this.package||this.state.status!=='ready')throw Error('请先下载更新');if(await digestFile(this.package.file)!==this.package.sha256)throw Error('更新包已经改变，请重新下载');return {...this.package};}
}
module.exports={GitHubUpdates,PROJECT_URL,REPO,newer,parseRelease,selectRelease,trustedUrl,digestFile};
