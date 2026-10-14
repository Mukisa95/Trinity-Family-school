const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const scope={self:{addEventListener(){}},TextDecoder};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8'),scope);
const read=vm.runInNewContext('androidRouteBuildFromBytes',scope);
const root=Buffer.from('0:{"b":"current-build","f":[],"S":false}\n');
test('reads ordinary root records after import rows',()=>{
  assert.equal(read(Buffer.concat([Buffer.from('1:I[123,[],"Page"]\n'),root])),'current-build');
});
test('skips length-prefixed UTF-8 metadata, embedded newlines and a false root',()=>{
  const text=Buffer.from('School 😀\n0:{"b":"wrong-build"}\n'+'é'.repeat(2048));
  assert.equal(read(Buffer.concat([Buffer.from('1:T'+text.length.toString(16)+','),text,root])),'current-build');
});
test('skips binary records with no line separator',()=>{
  const data=Buffer.from([0,10,58,44,255,0]);
  assert.equal(read(Buffer.concat([Buffer.from('1:A6,'),data,root])),'current-build');
});
test('accepts resource hints with an omitted record ID',()=>{
  const text=Buffer.from('School metadata'.repeat(200));
  assert.equal(read(Buffer.concat([Buffer.from(':HL["/style.css","style"]\n1:T'+text.length.toString(16)+','),text,root])),'current-build');
});
test('rejects truncated lengths, invalid rows and missing build identifiers',()=>{
  for(const input of ['1:Tffff,short','1:Txyz,data','invalid:{"b":"wrong"}\n','0:{"b":null}\n','0:{"b":""}\n'])assert.throws(()=>read(Buffer.from(input)));
});
