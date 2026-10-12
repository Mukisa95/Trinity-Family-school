import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';

function fixture() {
  const records=new Map<string,any>(),commits:any[][]=[];let serial=0,failNext=false;
  const db={};
  const merge=(base:any,patch:any):any=>{const result={...base};for(const [key,value] of Object.entries(patch)){result[key]=value&&typeof value==='object'&&'incrementBy' in value?Number(base?.[key]||0)+(value as any).incrementBy:value&&typeof value==='object'&&!Array.isArray(value)?merge(base?.[key]||{},value):value;}return result;};
  const sdk={collection:(_:unknown,name:string)=>({path:name}),doc:(...parts:any[])=>parts.length===1?{path:parts[0].path+'/'+(++serial)}:{path:parts[1]+'/'+parts[2]},
    increment:(n:number)=>({incrementBy:n}),Timestamp:{now:()=> 'timestamp'},
    getDoc:async(ref:any)=>({id:ref.path.split('/').at(-1),exists:()=>records.has(ref.path),data:()=>records.get(ref.path)}),
    writeBatch:()=>{const writes:any[]=[];return {set:(ref:any,data:any)=>writes.push(['set',ref.path,data]),update:(ref:any,data:any)=>writes.push(['update',ref.path,data]),delete:(ref:any)=>writes.push(['delete',ref.path]),commit:async()=>{if(failNext){failNext=false;throw new Error('Commit rejected');}const next=new Map(records);for(const [kind,key,data] of writes){if(kind==='delete')next.delete(key);else next.set(key,merge(next.get(key),data));}records.clear();next.forEach((v,k)=>records.set(k,v));commits.push(writes);}};}};
  const modules=new Map<string,any>();
  const load=(file:string):any=>{if(modules.has(file))return modules.get(file);const module={exports:{}};modules.set(file,module.exports);const code=ts.transpileModule(fs.readFileSync('src/lib/services/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    vm.runInNewContext(code,{module,exports:module.exports,console:{error:()=>{}},require:(name:string)=>{if(name==='firebase/firestore')return sdk;if(name.includes('firebase'))return {db};if(name==='./history-log.service')return {HistoryLogService:{log:async()=>{}}};return load(name.replace('./',''));}});return module.exports;};
  return {records,commits,reject:()=>{failNext=true;},requirements:load('requirements.service').RequirementsService,uniforms:load('uniforms.service').UniformsService,days:load('excluded-days.service').ExcludedDaysService};
}

for(const [name,service,create,update,toggle,remove] of [
  ['requirements','requirements','createRequirement','updateRequirement','toggleRequirementStatus','deleteRequirement'],
  ['uniforms','uniforms','createUniform','updateUniform','toggleUniformStatus','deleteUniform'],
  ['excludedDays','days','createExcludedDay','updateExcludedDay',undefined,'deleteExcludedDay'],
] as const) {
 test(name+' publishes revision atomically for every catalogue mutation',async()=>{
  const f=fixture(),api=f[service];const id=await api[create]({name:'Initial',group:'Books',price:100});
  await api[update](id,{name:'Changed',price:200});if(toggle)await api[toggle](id,false);await api[remove](id);
  const count=toggle?4:3;assert.equal(f.commits.length,count);
  assert.equal(f.records.get('settings/data-revisions-reference')[name],count);
  assert.equal(f.records.get('settings/school-settings').dataRevisions[name],count);
  assert.ok(!f.records.has(name+'/'+id));
  for(const batch of f.commits){assert.equal(batch.length,3);assert.ok(batch.some(([,key])=>key.startsWith(name+'/')));assert.ok(batch.some(([,key])=>key==='settings/data-revisions-reference'));}
  f.reject();await assert.rejects(api[create]({name:'Rejected',group:'Books'}),/Commit rejected/);
  assert.equal(f.records.get('settings/data-revisions-reference')[name],count);assert.equal(f.commits.length,count);
 });
}
