import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import {GranularPermissionService} from '../src/lib/services/granular-permissions.service';

function loadRoute(user: any = {id:'staff',role:'Admin'}) {
  const calls: any[]=[];
  class SchoolPayExcessError extends Error {constructor(message:string,public status=409){super(message);}}
  const mod={exports:{} as any};
  const output=ts.transpileModule(fs.readFileSync('src/app/api/schoolpay/excess/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(output,{module:mod,exports:mod.exports,Error,require:(name:string)=>{
    if(name==='next/server')return{NextResponse:{json:(body:any,options:any={})=>({body,status:options.status||200,headers:options.headers})}};
    if(name.endsWith('/app-auth'))return{requireAppUser:async()=>{if(!user)throw Error('AUTH_REQUIRED');return{user}}};
    if(name.endsWith('/granular-permissions.service'))return{GranularPermissionService};
    if(name.endsWith('/schoolpay-excess.server'))return{SchoolPayExcessError,previewSchoolPayExcess:async(...args:any[])=>{calls.push(['preview',...args]);return{excessAmount:300000}},transferSchoolPayExcess:async(...args:any[])=>{calls.push(['transfer',...args]);return{transferAmount:200000}}};
    throw Error('Unexpected import '+name);
  }});
  const input={pupilId:'babra',receipt:'receipt',target:'brother',version:'a'.repeat(64),operationId:'test-operation-1234'};
  const request=(data:any=input)=>({nextUrl:new URL('https://school.example/api/schoolpay/excess?pupilId=babra&receipt=receipt'),json:async()=>data});
  return{route:mod.exports,calls,request,input};
}
test('excess endpoint rejects unauthenticated and parent access before reading or transferring funds',async()=>{
  for(const user of [null,{id:'parent',role:'Parent'}]){
    const h=loadRoute(user);
    assert.equal((await h.route.GET(h.request())).status,user?403:401);
    assert.equal((await h.route.POST(h.request())).status,user?403:401);
    assert.equal(h.calls.length,0);
  }
});
test('transfers require both record and revert permission, while preview only needs fee collection access',async()=>{
  const user={id:'staff',role:'Staff',granularPermissions:[{moduleId:'fees',pages:[{pageId:'collect',canAccess:true,actions:[{actionId:'record_payment',allowed:true},{actionId:'revert_payment',allowed:false}]}]}]};
  const h=loadRoute(user);
  assert.equal((await h.route.GET(h.request())).status,200);
  assert.equal((await h.route.POST(h.request())).status,403);
  assert.deepEqual(h.calls.map(call=>call[0]),['preview']);
});
test('authorized transfer passes the signed-in actor and keeps previews uncached',async()=>{
  const h=loadRoute();
  const preview=await h.route.GET(h.request());assert.equal(preview.headers['Cache-Control'],'no-store');
  const result=await h.route.POST(h.request());assert.equal(result.status,200);assert.equal(result.body.transferAmount,200000);
  assert.equal(h.calls[1][2].id,'staff');
});
test('invalid identifiers, preview hashes and operation IDs cannot reach transfer execution',async()=>{
  for(const patch of [{pupilId:'wrong/id'},{receipt:'wrong/id'},{version:'stale'},{operationId:'short'},{target:''}]){
    const h=loadRoute();assert.equal((await h.route.POST(h.request({...h.input,...patch}))).status,400);assert.equal(h.calls.length,0);
  }
});
