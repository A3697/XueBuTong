'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const profiles=require('../src/fusion/login-profiles.js');
test('duplicate account identity excludes password, trims inputs and distinguishes login method',()=>{
 const a={kind:'cx-phone',username:' fixture-user ',password:'one'};
 assert.equal(profiles.accountKey(a),profiles.accountKey({...a,username:'fixture-user',password:'two'}));
 assert.notEqual(profiles.accountKey(a),profiles.accountKey({...a,kind:'zhs-phone'}));
 assert.notEqual(profiles.accountKey(a),profiles.accountKey({...a,username:'another'}));
 assert.notEqual(profiles.signature(a),profiles.signature({...a,password:'two'}));
});
test('school account identity is scoped to school; incomplete and ambiguous identities never collide',()=>{
 const a={kind:'zhs-unit',username:'fixture-student',unit:'学校甲'};
 assert.notEqual(profiles.accountKey(a),profiles.accountKey({...a,unit:'学校乙'}));
 for(const value of [{...a,unit:''},{...a,username:''},{kind:'none'},{kind:'ambiguous'},null])assert.equal(profiles.accountKey(value),'');
 for(const [name,spec] of Object.entries(profiles.definitions)){
  const parsed=profiles.parse([{name,configs:{[spec.username]:{value:'fixture-account'},password:{value:'fixture-password'},...(spec.unit?{[spec.unit]:{value:'学校甲'}}:{})}}]);
  assert(profiles.accountKey(parsed));assert(profiles.complete(parsed));
 }
});
