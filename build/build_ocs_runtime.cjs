'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),adapter=require('../src/fusion/ocs-enhancement.cjs');
const result=adapter.compose(fs.readFileSync(path.join(root,'assets/defaults/ocs.upstream.user.js')),{root,enhanced:true});
fs.writeFileSync(path.join(root,'assets/defaults/ocs.user.js'),result.code);
const file=path.join(root,'assets/defaults/ocs-script.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
manifest.sha256=result.runtimeSha256;manifest.upstreamSha256=result.sha256;manifest.fusionRevision=result.revision;
fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({version:result.version,revision:result.revision,sha256:result.runtimeSha256}));
