const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync('android-app/app/src/main/res/raw/document_bridge.js','utf8');
function fixture(options={}) {
  const calls=[],files=new Map(),listeners=new Map(),window=new EventTarget();window.top=window;
  class Reader { readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result='data:application/octet-stream;base64,'+Buffer.from(bytes).toString('base64');this.onload();});} }
  const bridge={postMessage(raw){
    const input=JSON.parse(raw);calls.push(input);let result={id:input.id,ok:true};
    if(input.action==='prepare'&&options.cancelFolder)result={...result,ok:false,error:'Folder selection cancelled'};
    if(input.action==='begin')files.set(input.fileId,{bytes:[],expected:input.bytes});
    if(input.action==='chunk'){
      if(options.failChunk)result={...result,ok:false,error:'Storage unavailable'};
      else files.get(input.fileId).bytes.push(Buffer.from(input.data,'base64'));
    }
    if(input.action==='commit'){const file=files.get(input.fileId);assert.equal(Buffer.concat(file.bytes).length,file.expected);result.saved=true;}
    if(input.action==='reuse')result.saved=true;
    queueMicrotask(()=>bridge.onmessage({data:JSON.stringify(result)}));
  }};
  window.TrinityDocuments=bridge;
  const context={window,document:{addEventListener(name,listener){listeners.set(name,listener)}},Blob,FileReader:Reader,Element:class{},URL,location:{origin:'https://school.example',href:'https://school.example/dashboard'},crypto:crypto.webcrypto,setTimeout,clearTimeout,Event,fetch:options.fetch||fetch};
  vm.runInNewContext(source,context);return {api:window.trinityFiles,calls,files,window,context,listeners};
}
test('native exports stream bounded acknowledged chunks and preserve every byte',async()=>{
  const f=fixture(),bytes=crypto.randomBytes(260000),blob=new Blob([bytes]);
  assert.equal((await f.api.save(blob,'report.pdf')).saved,true);
  const chunks=f.calls.filter(c=>c.action==='chunk');assert.equal(chunks.length,3);
  assert.deepEqual(chunks.map(c=>c.sequence),[0,1,2]);assert.ok(chunks.every(c=>Buffer.from(c.data,'base64').length<=96*1024));
  const output=Buffer.concat([...f.files.values()][0].bytes);
  assert.equal(crypto.createHash('sha256').update(output).digest('hex'),crypto.createHash('sha256').update(bytes).digest('hex'));
});
test('saving an already-created PDF reuses the native file without duplicating it',async()=>{
  const f=fixture(),blob=new Blob(['%PDF-1.7 example']);await f.api.save(blob,'a.pdf');await f.api.save(blob,'a.pdf');
  assert.equal(f.calls.filter(c=>c.action==='begin').length,1);assert.equal(f.calls.filter(c=>c.action==='reuse').length,1);
});
test('rapid repeat download taps share one transfer',async()=>{
  const f=fixture(),blob=new Blob(['%PDF-1.7 example']);await Promise.all([f.api.save(blob,'a.pdf'),f.api.save(blob,'a.pdf')]);
  assert.equal(f.calls.filter(c=>c.action==='begin').length,1);
});
test('cancelled folder selection cannot start or upload a document',async()=>{
  const f=fixture({cancelFolder:true});await assert.rejects(f.api.start({jobId:crypto.randomUUID(),title:'Example',fileName:'a.pdf'}),/cancelled/);
  assert.deepEqual(f.calls.map(c=>c.action),['prepare']);
});
test('a failed chunk stops the transfer and releases its native work',async()=>{
  const f=fixture({failChunk:true});await assert.rejects(f.api.save(new Blob(['%PDF-1.7']),'a.pdf'),/Storage unavailable/);
  assert.equal(f.calls.filter(c=>c.action==='commit').length,0);assert.equal(f.calls.at(-1).action,'cancel');
  assert.equal(f.calls.at(-1).jobId,f.calls.find(c=>c.action==='begin').fileId);
});
test('oversized blobs are rejected before a folder prompt or native allocation',async()=>{
  class Large extends Blob {get size(){return 100*1024*1024+1;}}
  const f=fixture();await assert.rejects(f.api.save(new Large(['x']),'a.pdf'),/100 MB/);assert.equal(f.calls.length,0);
});
test('leaving the page cancels independent jobs, while progress is throttled',async()=>{
  const f=fixture(),first=crypto.randomUUID(),second=crypto.randomUUID();
  await f.api.start({jobId:first,fileName:'a.pdf'});await f.api.start({jobId:second,fileName:'b.pdf'});
  f.api.progress(first,10,'Creating');f.api.progress(first,11,'Creating');f.api.progress(first,98,'Finishing');
  assert.equal(f.calls.filter(c=>c.action==='progress').length,2);
  f.window.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(new Set(f.calls.filter(c=>c.action==='cancel').map(c=>c.jobId)),new Set([first,second]));
});
test('a foreign URL cannot use the app to download an arbitrary document',async()=>{
  const f=fixture();await f.api.downloadURL('https://foreign.example/private.pdf','private.pdf');
  assert.deepEqual(f.calls.map(c=>c.action),['notice','cancel']);
});
test('blob URLs are acquired before the exporter can revoke them or a picker delays saving',async()=>{
  let revoked=false,acquired=false;
  const f=fixture({fetch:async()=>{if(revoked)throw Error('Revoked URL');acquired=true;return new Response('%PDF-1.7 fixture',{headers:{'content-type':'application/pdf'}});}});
  const downloading=f.api.downloadURL('blob:https://school.example/temporary','a.pdf');revoked=true;await downloading;
  assert.equal(acquired,true);assert.equal(f.calls.filter(c=>c.action==='commit').length,1);
});
