'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const Order=require('../src/fusion/account-order.js'),Merge=require('../src/fusion/config-merge.cjs'),{ConfigTransfer}=require('../src/fusion/config-transfer.cjs');
const account=(uid,parent='root',login)=>({uid,parent,type:'browser',name:uid,notes:'',tags:[],playwrightScripts:login?[{name:'超星-手机密码登录',configs:{phone:{value:login},password:{value:'test-password'}}}]:[],cachePath:'$CACHE_PATH'});
const folder=(uid,items,parent='root')=>({uid,parent,type:uid==='root'?'root':'folder',name:uid,children:Object.fromEntries(items.map(item=>[item.uid,{...item,parent:uid}]))});
const doc=(items,orders)=>({render:{browser:{root:folder('root',items),...(orders?{accountOrders:orders}:{}),tags:{},search:{value:'',tags:[]}},setting:{},scripts:[]}});
const ids=(document,uid='root')=>Order.snapshot(document.render.browser)[uid];
const transfer=()=>new ConfigTransfer({root:path.resolve('nonexistent-order-fixture'),controller:{data:{profiles:{}},plainSecret:()=>''},nativeStore:{store:{paths:{userDataDirsFolder:path.resolve('nonexistent-order-fixture/cache')}}},vault:{encryptString:v=>Buffer.from(v)},htmlPreferences:{get:()=>({})},workspacePreferences:{get:()=>({})}});

test('optional OCS enhancement preferences survive export and import into an empty installation',()=>{
 const t=transfer(),source=doc([account('a')]);source.render.setting.fusionOcsPlugins={enhanced:false,selected:'latest',autoUpdate:false};
 const exported=t.snapshot(source),parsed=t.parse(JSON.stringify(exported));exported.render=parsed.render;
 const merged=Merge.prepare(t.snapshot(doc([])),exported).finish({});
 assert.deepEqual(t.parse(JSON.stringify(merged)).render.setting.fusionOcsPlugins,source.render.setting.fusionOcsPlugins);
});
test('official unified login modes and dormant fields survive export, empty-install merge and import',()=>{
 const Automation=require('../src/fusion/automation-config.js'),Profiles=require('../src/fusion/login-profiles.js');
 const input=doc([account('school'),account('mooc')],{root:['mooc','school']});
 input.render.browser.root.children.school.playwrightScripts=[Automation.normalize({name:'智慧树-学校登录',configs:{schoolname:{value:'合成学校'},id:{value:'fixture-id'},phone:{value:'fixture-phone'},password:{value:' p '}}})];
 input.render.browser.root.children.mooc.playwrightScripts=[Automation.normalize({name:'中国大学MOOC-自动账号登录',configs:{username:{value:'fixture@example.test'},password:{value:' p '}}})];
 const t=transfer(),exported=t.snapshot(input),parsed=t.parse(JSON.stringify(exported));exported.render=parsed.render;
 const plan=Merge.prepare(t.snapshot(doc([])),exported);assert.equal(plan.conflicts.length,0);
 const result=t.parse(JSON.stringify(plan.finish({})));
 for(const id of ['school','mooc']){const before=input.render.browser.root.children[id].playwrightScripts,after=result.render.browser.root.children[id].playwrightScripts;assert.deepEqual(after,before);assert.equal(Profiles.signature(Profiles.parse(after)),Profiles.signature(Profiles.parse(before)));}
 assert.deepEqual(result.render.browser.accountOrders.root,['mooc','school']);
});
test('export snapshots the visible order of each group, including accounts never explicitly sorted',()=>{
 const source=doc([account('a'),account('b'),account('new'),folder('group',[account('x'),account('y')])],{root:['b','a'],group:['y','x']});
 const snapshot=transfer().snapshot(source);assert.deepEqual(snapshot.render.browser.accountOrders,{root:['b','a','new'],group:['y','x']});assert.deepEqual(source.render.browser.accountOrders.root,['b','a']);
 const plain=transfer().snapshot(doc([account('b'),account('a')]));assert.deepEqual(plain.render.browser.accountOrders,{root:['b','a']});
});
test('export, validate, merge into an empty install and reparse preserves root and nested order without conflicts',()=>{
 const t=transfer(),source=doc([account('a'),account('b'),folder('group',[account('x'),account('y')])],{root:['b','a'],group:['y','x']});
 const exported=t.snapshot(source),parsed=t.parse(JSON.stringify(exported));exported.render=parsed.render;
 const plan=Merge.prepare(t.snapshot(doc([])),exported);assert.equal(plan.conflicts.length,0);const merged=plan.finish({});const final=t.parse(JSON.stringify(merged));
 assert.deepEqual(final.render.browser.accountOrders,{root:['b','a'],group:['y','x']});
});
test('order conflicts offer overwrite or skip without reordering unrelated local accounts',()=>{
 for(const choice of ['overwrite','skip']){
  const current=doc([account('a'),account('keep'),account('b')],{root:['a','keep','b']}),incoming=doc([account('a'),account('b'),account('new')],{root:['b','new','a']});
  const plan=Merge.prepare(current,incoming);assert.deepEqual(plan.conflicts.map(c=>c.id),['account-order:root']);
  const result=plan.finish({'account-order:root':choice});assert.deepEqual(ids(result),choice==='overwrite'?['b','keep','new','a']:['a','keep','b','new']);
 }
});
test('matching by login remaps exported account and root IDs before restoring order',()=>{
 const current=doc([account('local-a','root','fixture-a'),account('local-b','root','fixture-b')],{root:['local-a','local-b']});
 const incoming=doc([account('remote-a','root','fixture-a'),account('remote-b','root','fixture-b')],{root:['remote-b','remote-a']});
 incoming.render.browser.root.uid='remote-root';for(const item of Object.values(incoming.render.browser.root.children))item.parent='remote-root';incoming.render.browser.accountOrders={'remote-root':['remote-b','remote-a']};
 const plan=Merge.prepare(current,incoming),decisions=Object.fromEntries(plan.conflicts.map(c=>[c.id,c.id.startsWith('account-order:')?'overwrite':'skip']));const out=plan.finish(decisions);
 assert.deepEqual(ids(out),['local-b','local-a']);assert(!out.render.browser.root.children['remote-a']);
});
test('legacy OCS data without ordering metadata imports without an order conflict',()=>{
 const plan=Merge.prepare(doc([account('a'),account('b')],{root:['b','a']}),doc([account('a'),account('b'),account('c')]));assert.equal(plan.conflicts.length,0);assert.deepEqual(ids(plan.finish({})),['b','a','c']);
});
test('stale, duplicate and foreign group IDs cannot drop or move accounts; invalid metadata is rejected',()=>{
 const t=transfer(),source=doc([account('a'),account('b'),folder('group',[account('x')])],{root:['missing','b','b','x'],group:['a']});const parsed=t.parse(JSON.stringify(source));
 assert.deepEqual(parsed.render.browser.accountOrders,{root:['b','a'],group:['x']});
 source.render.browser.accountOrders='invalid';assert.throws(()=>t.parse(JSON.stringify(source)),/账号排序配置格式无效/);
});
