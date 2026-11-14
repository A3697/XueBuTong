'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function port(){
 const mod={exports:{}},calls={clicks:0};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/ocs-app/lib/src/scripts/utils/zhs-captcha.js'),'utf8'),{module:mod,console:{log(){}},require:name=>name==='axios'?{post:async()=>({data:{canOCR:false}})}:{getBase64:async()=> 'fixture',handleOcrMissing:options=>!!options.ocrManual,visualClick:async()=>{calls.clicks++;}}});
 return {api:mod.exports,calls};
}
test('ported official captcha attempts are bounded and a completed login requires no retry',async()=>{
 const {api,calls}=port(),page={waitForTimeout:async()=>{},url:()=> 'https://login.zhihuishu.com/',evaluate:async fn=>fn.toString().includes('el-form-item__error')?[]:false,$:async()=>null};
 await assert.rejects(api.loopVerify(page,{}),/滑块识别失败/);assert.equal(calls.clicks,5);
 page.url=()=> 'https://onlineweb.zhihuishu.com/onlinestuh5';await api.loopVerify(page,{});assert.equal(calls.clicks,5);
});
test('ported captcha reports a missing OCR service and retains the official manual fallback',async()=>{
 const {api}=port(),page={evaluate:async()=>{},$:async()=>({getAttribute:async()=> 'https://captcha.example.test/image'})};
 await assert.rejects(api.verify(page,{detTargetKey:'det_target',detBackgroundKey:'det_bg'}),/未检测到图片验证码识别模块/);
 await api.verify(page,{detTargetKey:'det_target',detBackgroundKey:'det_bg',ocrManual:true});
});
