'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {GitHubUpdates,parseRelease,selectRelease,trustedUrl,newer}=require('../src/fusion/github-updates.cjs');
const bytes=Buffer.from('synthetic update package'),sha=crypto.createHash('sha256').update(bytes).digest('hex');
const release=()=>({tag_name:'v2.5.11',draft:false,prerelease:false,assets:[{name:'XueBuTong-2.5.11-win-x64-setup.exe',state:'uploaded',size:bytes.length,digest:'sha256:'+sha,browser_download_url:'https://github.com/A3697/XueBuTong/releases/download/v2.5.11/XueBuTong-2.5.11-win-x64-setup.exe'}]});
function response(body,statusCode=200){return Object.assign(Readable.from([body]),{statusCode});}
test('release selection requires stable semver, correct asset and digest',()=>{assert(newer('2.5.10','2.5.9'));assert(!newer('2.5.9','2.5.10'));assert.equal(parseRelease(null,'2.5.10').status,'unpublished');assert.equal(parseRelease(release(),'2.5.11').status,'current');let r=release();r.assets=[];assert.equal(parseRelease(r,'2.5.10').status,'manual');r=release();r.assets[0].digest='';assert.throws(()=>parseRelease(r,'2.5.10'),/校验/);r=release();r.prerelease=true;assert.throws(()=>parseRelease(r,'2.5.10'),/正式/);});
test('update cannot redirect to arbitrary origins or another project',()=>{for(const url of ['http://github.com/A3697/XueBuTong/releases/download/v2/x.exe','https://github.com/other/repo/releases/download/v2/x.exe','https://example.com/payload','https://user@github.com/A3697/XueBuTong/releases/download/v2/x.exe','https://api.github.com/repos/other/repo/releases/latest'])assert.throws(()=>trustedUrl(url,true));trustedUrl('https://release-assets.githubusercontent.com/asset?signature=example',true);});
test('download, hash verification and later tamper detection preserve user data',async()=>{const root=fs.mkdtempSync(path.join(process.cwd(),'xbt-update-'));try{fs.writeFileSync(path.join(root,'fusion-install.json'),JSON.stringify({version:'2.5.10'}));fs.mkdirSync(path.join(root,'bridge-data'));fs.writeFileSync(path.join(root,'bridge-data','fixture'),'preserved');const u=new GitHubUpdates({root,fetchResponse:async(url,o)=>response(o.asset?bytes:Buffer.from(JSON.stringify(release())))});assert.equal((await u.check()).status,'available');assert.equal((await u.download()).status,'ready');const pkg=await u.verifiedPackage();assert.equal(fs.readFileSync(path.join(root,'bridge-data','fixture'),'utf8'),'preserved');fs.appendFileSync(pkg.file,'changed');await assert.rejects(u.verifiedPackage(),/改变/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('bad hash and interrupted downloads cannot become installable',async()=>{const root=fs.mkdtempSync(path.join(process.cwd(),'xbt-update-'));try{fs.writeFileSync(path.join(root,'fusion-install.json'),JSON.stringify({version:'2.5.10'}));const u=new GitHubUpdates({root,fetchResponse:async(url,o)=>response(o.asset?Buffer.alloc(bytes.length):Buffer.from(JSON.stringify(release())))});await u.check();await assert.rejects(u.download(),/校验/);await assert.rejects(u.verifiedPackage(),/先下载/);assert.equal(fs.readdirSync(path.join(root,'updates')).length,0);}finally{fs.rmSync(root,{recursive:true,force:true});}});

function compatibilityFixture(){
 const doc=release(),baseline={metadataSha256:'a'.repeat(64),backendManifestSha256:'b'.repeat(64)};
 const delta={...doc.assets[0],name:'XueBuTong-Update-2.5.11-win-x64.exe',browser_download_url:'https://github.com/A3697/XueBuTong/releases/download/v2.5.11/XueBuTong-Update-2.5.11-win-x64.exe'};
 const info={passed:true,version:'2.5.11',requiresExistingInstall:true,package:delta.name,size:bytes.length,sha256:sha,compatibleBase:{version:'2.5.10',...baseline}};
 doc.assets.push(delta);const encoded=Buffer.from(JSON.stringify(info)),manifest={name:'XueBuTong-Update-2.5.11-win-x64.manifest.json',state:'uploaded',size:encoded.length,digest:'sha256:'+crypto.createHash('sha256').update(encoded).digest('hex'),browser_download_url:delta.browser_download_url.replace('.exe','.manifest.json')};doc.assets.push(manifest);
 return {doc,baseline,info,manifest,encoded,fetch:async()=>response(encoded)};
}
test('matching declared baseline selects delta; version distance is not used',async()=>{
 const f=compatibilityFixture();assert.equal((await selectRelease(f.doc,'2.5.10',f.baseline,f.fetch)).packageKind,'incremental');
 for(const current of ['2.5.9','2.4.10','2.5.1'])assert.equal((await selectRelease(f.doc,current,f.baseline,f.fetch)).packageKind,'full');
 // A release is allowed to explicitly support an older baseline, independent of gaps.
 f.info.compatibleBase.version='2.5.1';const data=Buffer.from(JSON.stringify(f.info));f.manifest.size=data.length;f.manifest.digest='sha256:'+crypto.createHash('sha256').update(data).digest('hex');
 assert.equal((await selectRelease(f.doc,'2.5.1',f.baseline,async()=>response(data))).packageKind,'incremental');
});
test('same version with changed build or backend selects full installer',async()=>{
 const f=compatibilityFixture();for(const base of [{...f.baseline,metadataSha256:'c'.repeat(64)},{...f.baseline,backendManifestSha256:'c'.repeat(64)},{}])assert.equal((await selectRelease(f.doc,'2.5.10',base,f.fetch)).packageKind,'full');
});
test('missing, tampered, mismatched and unavailable manifests safely select full',async()=>{
 const f=compatibilityFixture();for(const fetch of [async()=>response(Buffer.alloc(f.encoded.length)),async()=>response(Buffer.from('{')),async()=>response(Buffer.alloc(0),403),async()=>{throw Error('offline');}])assert.equal((await selectRelease(f.doc,'2.5.10',f.baseline,fetch)).packageKind,'full');
 f.info.sha256='c'.repeat(64);const data=Buffer.from(JSON.stringify(f.info));f.manifest.size=data.length;f.manifest.digest='sha256:'+crypto.createHash('sha256').update(data).digest('hex');assert.equal((await selectRelease(f.doc,'2.5.10',f.baseline,async()=>response(data))).packageKind,'full');
 f.doc.assets.pop();assert.equal((await selectRelease(f.doc,'2.5.10',f.baseline,f.fetch)).packageKind,'full');
});
test('only a compatible delta is accepted when full package is absent',async()=>{
 const f=compatibilityFixture();f.doc.assets.shift();assert.equal((await selectRelease(f.doc,'2.5.10',f.baseline,f.fetch)).packageKind,'incremental');assert.equal((await selectRelease(f.doc,'2.5.9',f.baseline,f.fetch)).status,'manual');
});
test('installed metadata hashes are actually checked by updater check',async t=>{
 const root=fs.mkdtempSync(path.join(process.cwd(),'xbt-update-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const metadata=Buffer.from(JSON.stringify({version:'2.5.10'})),backend=Buffer.from('{}');fs.writeFileSync(path.join(root,'fusion-install.json'),metadata);fs.mkdirSync(path.join(root,'star-runtime'));fs.writeFileSync(path.join(root,'star-runtime/_backend-prepared-manifest.json'),backend);
 const f=compatibilityFixture();for(const [key,data]of [['metadataSha256',metadata],['backendManifestSha256',backend]])f.info.compatibleBase[key]=crypto.createHash('sha256').update(data).digest('hex');const data=Buffer.from(JSON.stringify(f.info));f.manifest.size=data.length;f.manifest.digest='sha256:'+crypto.createHash('sha256').update(data).digest('hex');
 const u=new GitHubUpdates({root,fetchResponse:async(url,o)=>response(o.asset?data:Buffer.from(JSON.stringify(f.doc)))});assert.equal((await u.check()).packageKind,'incremental');fs.appendFileSync(path.join(root,'star-runtime/_backend-prepared-manifest.json'),' ');assert.equal((await u.check()).packageKind,'full');
});
