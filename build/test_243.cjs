'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const banks=require('../src/fusion/question-bank-config.js'),model=require('../src/fusion/ocs-ui/renderer.js').model;
const key='sk-ABCD-fixture-secret-WXYZ';
test('API preview excludes sk prefix and preserves already masked values',()=>{
 assert.equal(banks.preview(key),'ABCD…WXYZ');assert.equal(model.apiPreview(key,true),'ABCD…WXYZ');assert.equal(model.apiPreview(banks.preview(key),true),'ABCD…WXYZ');assert.equal(model.apiPreview('',false),'');assert.equal(banks.preview('tiny'),'********');
});
test('question bank key markers accept current and previous version without changing stored secrets',()=>{
 const original=banks.parse([{name:'Fixture bank',url:'https://example.com/query',data:{token:key},handler:'return r=>[r.question,r.answer]'}]);
 const masked=JSON.parse(banks.display(original));assert.equal(masked[0].data.token,'<已保存：ABCD…WXYZ>');assert.equal(banks.parse(masked,{saved:original}).entries[0].data.token,key);
 masked[0].data.token='<已保存：sk-A…WXYZ>';assert.equal(banks.parse(masked,{saved:original}).entries[0].data.token,key);masked[0].data.token='<已保存：fake…WXYZ>';assert.throws(()=>banks.parse(masked,{saved:original}),/标记无效/);
});
