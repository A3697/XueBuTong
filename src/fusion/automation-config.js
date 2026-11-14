(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionAutomationConfigs=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Field definitions from OCS Desktop v3.9.1; the retained desktop runtime uses these same definitions.
 const catalog=[
 {
  "name": "超星-自动登录",
  "configs": {
   "loginType": {
    "label": "登录方式",
    "value": "phone",
    "type": "select",
    "options": [
     {
      "label": "手机密码登录",
      "value": "phone"
     },
     {
      "label": "学校机构登录",
      "value": "unit"
     }
    ]
   },
   "phone": {
    "label": "手机号",
    "value": "",
    "type": "text",
    "required": true,
    "placeholder": "请输入手机号",
    "pattern": "^1[3-9]\\d{9}$",
    "patternMessage": "手机号格式不正确",
    "visibleWhen": {
     "key": "loginType",
     "value": "phone"
    }
   },
   "unit": {
    "label": "学校/单位",
    "value": "",
    "type": "text",
    "required": true,
    "placeholder": "请输入学校/单位名称",
    "visibleWhen": {
     "key": "loginType",
     "value": "unit"
    }
   },
   "id": {
    "label": "学号/工号",
    "value": "",
    "type": "text",
    "required": true,
    "placeholder": "请输入学号/工号",
    "visibleWhen": {
     "key": "loginType",
     "value": "unit"
    }
   },
   "password": {
    "label": "密码",
    "value": "",
    "type": "password",
    "required": true,
    "placeholder": "请输入密码"
   }
  },
  "needOCR": true,
  "timeout": 180000
 },
 {
  "name": "智慧树-自动登录",
  "configs": {
   "loginType": {
    "label": "登录方式",
    "value": "phone",
    "type": "select",
    "options": [
     {
      "label": "手机密码登录",
      "value": "phone"
     },
     {
      "label": "学校登录",
      "value": "unit"
     }
    ]
   },
   "phone": {
    "label": "手机号",
    "value": "",
    "type": "text",
    "required": true,
    "placeholder": "请输入手机号",
    "pattern": "^1[3-9]\\d{9}$",
    "patternMessage": "手机号格式不正确",
    "visibleWhen": {
     "key": "loginType",
     "value": "phone"
    }
   },
   "schoolname": {
    "label": "学校",
    "value": "",
    "type": "text",
    "required": true,
    "placeholder": "请输入学校名称",
    "visibleWhen": {
     "key": "loginType",
     "value": "unit"
    }
   },
   "id": {
    "label": "学号",
    "value": "",
    "type": "text",
    "required": true,
    "placeholder": "请输入学号",
    "visibleWhen": {
     "key": "loginType",
     "value": "unit"
    }
   },
   "password": {
    "label": "密码",
    "value": "",
    "type": "password",
    "required": true,
    "placeholder": "请输入密码"
   }
  },
  "needOCR": true,
  "timeout": 180000
 },
 {
  "name": "智慧职教-自动账号密码登录",
  "configs": {
   "username": {
    "label": "账号",
    "value": "",
    "type": "text",
    "required": true,
    "placeholder": "请输入账号"
   },
   "password": {
    "label": "密码",
    "value": "",
    "type": "password",
    "required": true,
    "placeholder": "请输入密码"
   }
  },
  "needOCR": true,
  "timeout": 180000
 },
 {
  "name": "职教云-自动账号密码登录",
  "configs": {
   "username": {
    "label": "账号",
    "value": "",
    "type": "text",
    "required": true,
    "placeholder": "请输入账号"
   },
   "password": {
    "label": "密码",
    "value": "",
    "type": "password",
    "required": true,
    "placeholder": "请输入密码"
   }
  },
  "needOCR": true,
  "timeout": 180000
 },
 {
  "name": "中国大学MOOC-自动账号登录",
  "configs": {
   "username": {
    "label": "手机号/邮箱",
    "value": "",
    "type": "text",
    "required": true,
    "placeholder": "请输入手机号或邮箱",
    "pattern": "^(1[3-9]\\d{9}|[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+)$",
    "patternMessage": "请输入正确的手机号或邮箱"
   },
   "password": {
    "label": "密码",
    "value": "",
    "type": "password",
    "required": true,
    "placeholder": "请输入密码"
   }
  },
  "needOCR": true,
  "timeout": 180000
 },
 {
  "name": "通用-新建页面",
  "configs": {
   "url": {
    "label": "网页链接",
    "value": "",
    "type": "url",
    "required": true,
    "placeholder": "请输入网页链接（如 www.example.com，自动补全 https:// 前缀）"
   }
  },
  "needOCR": false,
  "timeout": 60000
 }
];
 const aliases={
  '超星-手机密码登录':['超星-自动登录','phone'],'超星-学校机构登录':['超星-自动登录','unit'],'超星-登录':['超星-自动登录'],
  '智慧树-手机密码登录':['智慧树-自动登录','phone'],'智慧树-学校登录':['智慧树-自动登录','unit'],'智慧树-登录':['智慧树-自动登录'],
  '职教云-账号密码登录':['职教云-自动账号密码登录'],'智慧职教-账号密码登录':['智慧职教-自动账号密码登录']
 };
 const copy=value=>JSON.parse(JSON.stringify(value)),value=(script,key)=>{const entry=script?.configs?.[key];return entry&&typeof entry==='object'?entry.value:entry;};
 const find=name=>catalog.find(item=>item.name===(aliases[name]?.[0]||name));
 function normalize(script){
  if(!script||!find(script.name))return script;
  const base=find(script.name),result={...script,name:base.name,configs:{}};
  for(const [key,field]of Object.entries(base.configs)){
   const previous=script.configs?.[key],current=value(script,key);
   result.configs[key]={...(previous&&typeof previous==='object'?previous:{}),...copy(field),value:current===undefined?field.value:current};
   if(field.type==='select')result.configs[key].value=field.options.find(option=>option.label===result.configs[key].value)?.value??result.configs[key].value;
  }
  if(aliases[script.name]?.[1])result.configs.loginType.value=aliases[script.name][1];
  // Unknown structured fields may belong to a user's customized script. Retain them.
  for(const [key,field]of Object.entries(script.configs||{}))if(!(key in result.configs)&&key!=='browserName')result.configs[key]=copy(field);
  return result;
 }
 const normalizeScripts=scripts=>(Array.isArray(scripts)?scripts:[]).map(normalize);
 function importRow(name,cells){
  const base=find(name),row={};if(!base)return row;
  for(const [label,input]of Object.entries(cells||{})){
   const text=String(input??''),field=Object.entries(base.configs).find(([,field])=>field.label===label);
   if(field)row[field[0]]=text;
   if(label==='账号名称'||label==='浏览器名')row.browserName=text;
  }
  if(base.configs.loginType){
   const mode=base.configs.loginType.options.find(option=>option.label===row.loginType||option.value===row.loginType);
   row.loginType=mode?.value||(aliases[name]?.[1])||(!String(row.phone||'').trim()&&String(row.id||'').trim()&&String(row.unit||row.schoolname||'').trim()?'unit':'phone');
  }
  return row;
 }
 function visible(script,field){return !field?.hide&&(!field?.visibleWhen||value(script,field.visibleWhen.key)===field.visibleWhen.value);}
 function loginSpec(script){
  const canonical=normalize(script);if(!canonical)return null;
  const mode=value(canonical,'loginType');
  if(canonical.name==='超星-自动登录'&&['phone','unit'].includes(mode))return {kind:'cx-'+mode,platform:'chaoxing',username:mode==='unit'?'id':'phone',...(mode==='unit'?{unit:'unit'}:{})};
  if(canonical.name==='智慧树-自动登录'&&['phone','unit'].includes(mode))return {kind:'zhs-'+mode,platform:'zhihuishu',username:mode==='unit'?'id':'phone',...(mode==='unit'?{unit:'schoolname'}:{})};
  return ({'职教云-自动账号密码登录':{kind:'zjy',platform:'zjy',username:'username'},'智慧职教-自动账号密码登录':{kind:'icve',platform:'icve',username:'username'},'中国大学MOOC-自动账号登录':{kind:'icourse',platform:'icourse',username:'username'}})[canonical.name]||null;
 }
 function normalizeUrl(input){const text=String(input||'').trim(),url=new URL(/^[a-z][a-z\d+.-]*:/i.test(text)?text:'https://'+text);if(!['http:','https:'].includes(url.protocol)||!url.hostname)throw Error('请输入有效的 HTTP 或 HTTPS 网页链接。');return url.href;}
 return {catalog,aliases,find,value,normalize,normalizeScripts,importRow,visible,loginSpec,normalizeUrl};
});
