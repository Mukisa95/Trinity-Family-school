/* Actual login page/CSS, synthetic settings, no production accounts or requests. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),ts=require('typescript'),playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/ios-form-sizing');
const mocks={
 'next/navigation':`const router={push:()=>{},prefetch:()=>{}};export const useRouter=()=>router;`,
 'next/image':`import React from'react';export default function Image({fill,priority,...props}){return <img {...props}/>}`,
 '@/lib/contexts/auth-context':`export const useAuth=()=>({isLoading:false,login:async()=>false,loginWithPasskey:async()=>false});`,
 '@/lib/services/passkey.service':`export const PasskeyService={supported:async()=>false};`,
 '@/hooks/use-toast':`export const useToast=()=>({toast:()=>{}});`,
 '@/lib/hooks/use-school-settings':`export const useSchoolSettings=()=>({data:undefined});`,
 '@/lib/hooks/use-photos':`export const usePhotos=()=>({data:undefined});`,
};
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 await esbuild.build({absWorkingDir:root,stdin:{resolveDir:root,loader:'tsx',contents:`import React from'react';import{createRoot}from'react-dom/client';import Login from'./src/app/login/page';createRoot(document.getElementById('app')).render(<Login/>);`},bundle:true,jsx:'automatic',platform:'browser',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},outfile:path.join(output,'fixture.js'),plugins:[{name:'synthetic-login',setup(build){build.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));}}]});
 const config={exports:{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText)(require,config,config.exports);
 const css=['globals.css','theme.css','brand-theme.css'].map(file=>fs.readFileSync(path.join(root,'src/app',file),'utf8')).join('\n').replace(/^@import[^;]+;/,'');
 const built=await require('postcss')([require('tailwindcss')({...config.exports.default,content:[path.join(root,'src/app/login/page.tsx')]})]).process(css,{from:path.join(root,'src/app/globals.css')});
 fs.writeFileSync(path.join(output,'fixture.css'),built.css);
 const layout=fs.readFileSync(path.join(root,'src/app/layout.tsx'),'utf8');
 assert.match(layout,/width: 'device-width', initialScale: 1/);
 assert.doesNotMatch(layout,/maximumScale|userScalable/);
 const server=http.createServer((request,response)=>{
  const file=request.url.split('?')[0];
  if(['/fixture.js','/fixture.css'].includes(file)){response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');response.end(fs.readFileSync(path.join(output,file.slice(1))));return}
  response.setHeader('Content-Type','text/html');response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{for(const engine of ['chromium','webkit']){
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}:{})});
  for(const installed of [false,true])for(const viewport of [{width:390,height:844},{width:844,height:390}]){
   const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:3,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Version/16.4 Mobile/15E148 Safari/604.1',reducedMotion:'reduce'});
   await context.addInitScript(installed=>{if(installed)document.addEventListener('DOMContentLoaded',()=>document.documentElement.dataset.homeScreen='true')},installed);
   await context.route('https://**/*',route=>route.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'Log In',exact:true}).click();
   const inputs=page.locator('.mfield input');assert.equal(await inputs.count(),2);
   for(const input of await inputs.all()){
    assert.ok(await input.evaluate(element=>parseFloat(getComputedStyle(element).fontSize)>=16));
    await input.focus();assert.equal(await page.evaluate(()=>visualViewport.scale),1);
   }
   // Check the shared rule against smaller inline text too, outside the login form.
   assert.equal(await page.evaluate(()=>{const input=document.createElement('input');input.style.fontSize='12px';document.body.append(input);const size=parseFloat(getComputedStyle(input).fontSize);input.remove();return size}),16);
   await page.evaluate(()=>document.documentElement.style.fontSize='150%');
   await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.mfield input')).fontSize)>=24);
   assert.equal(await inputs.first().evaluate(element=>parseFloat(getComputedStyle(element).fontSize)),24);
   assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(output,`${engine}-${installed?'app':'safari'}-${viewport.width}.png`),fullPage:true});
   await context.close();console.log(`IOS_FORM_SIZING_OK ${engine} ${installed?'Home Screen':'Safari'} ${viewport.width}: actual login fields >=16px, focus scale 1, larger text preserved.`);
  }
  await browser.close();browser=undefined;
 }}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
