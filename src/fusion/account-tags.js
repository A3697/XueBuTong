(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionAccountTags=api;})(globalThis,()=>{
 function collect(tree){const tags=Object.create(null);function visit(item){if(item?.type==='browser')for(const raw of item.tags||[]){const t=typeof raw==='string'?{name:raw}:raw;if(!t||typeof t.name!=='string'||!t.name.trim()||['__proto__','constructor','prototype'].includes(t.name))continue;tags[t.name]??={color:typeof t.color==='string'?t.color:'#409eff',count:0};tags[t.name].count++;}else for(const child of Object.values(item?.children||{}))visit(child);}visit(tree);return {...tags};}
 function repair(browser){const tags=collect(browser.root);browser.tags=tags;if(browser.search)browser.search.tags=(browser.search.tags||[]).filter(name=>Object.hasOwn(tags,name));return browser;}
 return {collect,repair};
});
