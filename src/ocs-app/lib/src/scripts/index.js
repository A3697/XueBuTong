"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scripts = exports.normalizeScript = void 0;
const cx_1 = require("./automation/wk/cx");
const zhs_1 = require("./automation/wk/zhs");
const icve_1 = require("./automation/wk/icve");
const zjy_1 = require("./automation/wk/zjy");
const path = require('node:path'), fs = require('node:fs');
const sourceConfig=path.resolve(__dirname,'../../../../fusion/automation-config.js');
const Config=require(fs.existsSync(sourceConfig)?sourceConfig:path.resolve(__dirname,'../../../../../..','src/automation-config.js'));
const {PlaywrightScript}=require('./script');
const {ICourseLoginScript}=require('./automation/wk/icourse');
exports.normalizeScript=Config.normalize;
exports.scripts=Config.catalog.map(schema=>new PlaywrightScript(JSON.parse(JSON.stringify(schema.configs)),{
 name:schema.name,
 async run(page,configs,options){
  if(schema.name==='通用-新建页面')return page.goto(Config.normalizeUrl(configs.url));
  const selected=schema.name==='超星-自动登录'?(configs.loginType==='unit'?cx_1.CXUnitLoginScript:cx_1.CXPhoneLoginScript):
   schema.name==='智慧树-自动登录'?(configs.loginType==='unit'?zhs_1.ZHSUnitLoginScript:zhs_1.ZHSPhoneLoginScript):
   schema.name==='职教云-自动账号密码登录'?zjy_1.ZJYLoginScript:
   schema.name==='智慧职教-自动账号密码登录'?icve_1.ICVELoginScript:ICourseLoginScript;
  const data=(...args)=>this.emit('script-data',...args),error=(...args)=>this.emit('script-error',...args);
  selected.on('script-data',data);selected.on('script-error',error);
  try{return await selected.run(page,configs,options);}finally{selected.removeListener('script-data',data);selected.removeListener('script-error',error);}
 }
}));
