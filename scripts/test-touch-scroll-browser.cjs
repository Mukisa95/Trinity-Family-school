const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/touch-scroll-qa');
fs.mkdirSync(output, { recursive: true });

const fixture = `import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import * as Menu from './src/components/ui/dropdown-menu';
import * as RawMenu from '@radix-ui/react-dropdown-menu';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from './src/components/ui/select';
import {Popover,PopoverTrigger,PopoverContent} from './src/components/ui/popover';
import {ModernDialog,ModernDialogTrigger} from './src/components/ui/modern-dialog';
import {useTouchSwipe} from './src/lib/hooks/use-touch-swipe';
function App(){
 const [selected,setSelected]=useState(0),[dialog,setDialog]=useState(false),[controlled,setControlled]=useState(false);
 const renders=useRef(0);window.renderCount=++renders.current;window.selected=selected;window.dialog=dialog;
 const swipe=useTouchSwipe({direction:'right',startMaxX:80,onSwipe:()=>window.swipeCount++});
 const closeSwipe=useTouchSwipe({direction:'left',onSwipe:()=>window.closeSwipeCount++});
 window.swipeCount??=0;window.closeSwipeCount??=0;window.rejectedCount??=0;
 const baseline=location.pathname==='/baseline';const Root=baseline?RawMenu.Root:Menu.DropdownMenu;
 const Trigger=baseline?RawMenu.Trigger:Menu.DropdownMenuTrigger;
 function Row({id}){return <div className="row">
 <Root defaultOpen={location.pathname==='/default-open'&&id===0}><Trigger asChild><button id={'actions-'+id}><span>Actions</span></button></Trigger>
 <Menu.DropdownMenuContent aria-label="Pupil management">{Array.from({length:25},(_,i)=><Menu.DropdownMenuItem key={i} onClick={()=>setSelected(n=>n+1)}>Edit pupil {i}</Menu.DropdownMenuItem>)}</Menu.DropdownMenuContent></Root>
 <Popover><PopoverTrigger asChild><button id={'guardian-'+id}>Guardians</button></PopoverTrigger><PopoverContent>Guardian details</PopoverContent></Popover>
 <ModernDialog open={dialog} onOpenChange={setDialog}><ModernDialogTrigger asChild><button id={'photo-'+id}>Photo</button></ModernDialogTrigger></ModernDialog>
 <Select><SelectTrigger id={'class-'+id}><SelectValue placeholder="Class"/></SelectTrigger><SelectContent><SelectItem value="p1">P1</SelectItem><SelectItem value="p2">P2</SelectItem></SelectContent></Select>
 </div>}
 return <><main id="list" {...swipe}>{Array.from({length:40},(_,id)=><Row key={id} id={id}/>)}</main>
 <div id="sidebar-fixture" {...closeSwipe}/>
 <div id="extra"><Menu.DropdownMenu open={controlled} onOpenChange={setControlled}><Menu.DropdownMenuTrigger id="controlled">Controlled</Menu.DropdownMenuTrigger><Menu.DropdownMenuContent><Menu.DropdownMenuItem>Controlled item</Menu.DropdownMenuItem></Menu.DropdownMenuContent></Menu.DropdownMenu>
 <Menu.DropdownMenu><Menu.DropdownMenuTrigger disabled id="disabled">Disabled</Menu.DropdownMenuTrigger><Menu.DropdownMenuContent>Disabled content</Menu.DropdownMenuContent></Menu.DropdownMenu>
 <Menu.DropdownMenu><Menu.DropdownMenuTrigger id="rejected" onClick={e=>{e.preventDefault();window.rejectedCount++}}>Rejected</Menu.DropdownMenuTrigger><Menu.DropdownMenuContent>Rejected content</Menu.DropdownMenuContent></Menu.DropdownMenu>
 <Menu.DropdownMenu><Menu.DropdownMenuTrigger id="prevent-down" onPointerDown={e=>e.preventDefault()}>Prevent down</Menu.DropdownMenuTrigger><Menu.DropdownMenuContent>Prevented content</Menu.DropdownMenuContent></Menu.DropdownMenu></div>
 {dialog&&<div id="photo-dialog" role="dialog"><button onClick={()=>setDialog(false)}>Close photo</button></div>}</>;
}
createRoot(document.getElementById('app')).render(<App/>);`;

async function run() {
  await esbuild.build({ absWorkingDir: root, stdin: { contents: fixture, resolveDir: root, loader: 'tsx' }, bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(fs.readFileSync(path.join(output, 'fixture.js'))); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      body{margin:0;font:16px sans-serif}#list{height:650px;overflow:auto}.row{height:150px;display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid #ccc}
      button{min-height:44px;min-width:60px}button[role=combobox]{width:70px}[role=menu]{background:white;border:1px solid;max-height:280px;overflow:auto;z-index:50}[role=menuitem]{padding:14px}#extra{position:fixed;bottom:0;background:white}#sidebar-fixture{position:fixed;right:0;top:0;width:20px;height:150px;touch-action:pan-y}#photo-dialog{position:fixed;inset:20%;background:white;border:1px solid}
      </style><div id="app"></div><script src="/fixture.js"></script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const result = {};
  try {
    const context = await browser.newContext({ viewport: { width: 430, height: 800 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];page.on('pageerror', e => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    const url = `http://127.0.0.1:${server.address().port}`;
    async function touch(type, points) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x,y],id)=>({x,y,id})) }); }
    async function point(selector) { const box = await page.locator(selector).first().boundingBox();assert.ok(box);return [box.x+box.width/2,box.y+box.height/2]; }
    async function pan(selector, dx=0, dy=-120) {
      const [x,y]=await point(selector);await touch('touchStart',[[x,y]]);
      for(let i=1;i<=8;i++){await touch('touchMove',[[x+dx*i/8,y+dy*i/8]]);await page.waitForTimeout(20);}
      await touch('touchEnd',[]);await page.waitForTimeout(180);
    }
    async function reload(route='/') { await page.goto(url+route);await page.waitForFunction(()=>window.renderCount); }
    await reload('/baseline');
    const [bx,by]=await point('#actions-2');await touch('touchStart',[[bx,by]]);await page.waitForTimeout(80);
    assert.equal(await page.getByRole('menu').count(),1,'Baseline reproduces popup at the start of a scroll');
    result.baselineOpenedOnTouchStart=true;await touch('touchEnd',[]);
    await reload();
    const [x,y]=await point('#actions-2');await touch('touchStart',[[x,y]]);await page.waitForTimeout(80);
    assert.equal(await page.getByRole('menu').count(),0,'Finger down alone must not open a popup');
    await touch('touchCancel',[]);
    const renders=await page.evaluate(()=>renderCount);
    await pan('#actions-2');
    assert.equal(await page.getByRole('menu').count(),0);
    assert.ok(await page.locator('#list').evaluate(el=>el.scrollTop)>60,'Starting a pan on the action button still scrolls the pupil list');
    assert.equal(await page.evaluate(()=>renderCount),renders,'Touch tracking must not rerender the layout');
    assert.equal(await page.evaluate(()=>swipeCount),0);
    result.scrollFromActionButton=true;result.rendersDuringPan=0;
    await page.locator('#list').evaluate(el=>el.scrollTop=0);
    await pan('#actions-2',90,-120);assert.equal(await page.getByRole('menu').count(),0);assert.equal(await page.evaluate(()=>swipeCount),0);
    for(const control of ['guardian','photo','class']){
      await reload();await pan('#'+control+'-2');assert.equal(await page.getByRole('menu').count(),0);assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('listbox').count(),0);assert.equal(await page.getByText('Guardian details',{exact:true}).count(),0);
      assert.ok(await page.locator('#list').evaluate(el=>el.scrollTop)>60,control+' still allows native scrolling');
    }
    await reload();await page.locator('#actions-2 span').tap();await page.getByRole('menu').waitFor();
    await pan('[role=menuitem]:nth-child(4)',0,-80);
    assert.equal(await page.evaluate(()=>selected),0,'Scrolling an open menu cannot select a pupil action');
    assert.equal(await page.getByRole('menu').count(),1);
    assert.ok(await page.getByRole('menu').evaluate(el=>el.scrollTop)>20);
    await page.getByRole('menuitem').filter({hasText:'Edit pupil 8'}).tap();
    await page.waitForFunction(()=>selected===1);assert.equal(await page.getByRole('menu').count(),0);
    await page.locator('#controlled').tap();await page.getByRole('menu').waitFor();await page.keyboard.press('Escape');await page.getByRole('menu').waitFor({state:'hidden'});
    await page.locator('#disabled').tap({force:true});assert.equal(await page.getByRole('menu').count(),0);
    await page.locator('#rejected').tap();assert.equal(await page.getByRole('menu').count(),0);assert.equal(await page.evaluate(()=>rejectedCount),1);
    await page.locator('#prevent-down').tap();assert.equal(await page.getByRole('menu').count(),0,'Consumers can veto pointer activation');
    await page.locator('#photo-2').tap();await page.getByRole('dialog').waitFor();await page.getByText('Close photo').tap();
    await page.locator('#guardian-2').tap();await page.getByText('Guardian details',{exact:true}).waitFor();await page.keyboard.press('Escape');
    await page.locator('#class-2').tap();await page.getByRole('listbox').waitFor();await page.getByRole('option',{name:'P2',exact:true}).tap();assert.equal(await page.locator('#class-2').innerText(),'P2');
    // Synthetic events cover cancelled and short drags that some WebViews turn
    // into clicks; native CDP gestures above cover actual browser scrolling.
    await page.locator('#actions-2').evaluate(el=>{
      el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true,clientX:20,clientY:20}));
      el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'touch',clientX:20,clientY:35}));
      el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));
    });assert.equal(await page.getByRole('menu').count(),0);
    await page.locator('#actions-2').evaluate(el=>{
      el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true}));
      el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerType:'touch'}));
      el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));
    });assert.equal(await page.getByRole('menu').count(),0,'A cancelled gesture cannot produce a ghost tap');
    // Exercise sidebar axis locking, cancellation, multitouch, and stale state.
    await page.locator('#list').evaluate(el=>{
      const fire=(type,points,changed=points)=>el.dispatchEvent(new TouchEvent(type,{bubbles:true,touches:points.map(([x,y],i)=>new Touch({identifier:i,target:el,clientX:x,clientY:y})),changedTouches:changed.map(([x,y],i)=>new Touch({identifier:i,target:el,clientX:x,clientY:y}))}));
      fire('touchstart',[[10,300]]);fire('touchmove',[[12,320]]);fire('touchmove',[[140,335]]);fire('touchend',[],[[140,335]]);
      fire('touchstart',[[10,300]]);fire('touchmove',[[120,302]]);fire('touchcancel',[]);fire('touchend',[],[[120,302]]);
      fire('touchstart',[[10,300]]);fire('touchmove',[[120,302],[150,300]]);fire('touchend',[],[[120,302]]);
      fire('touchstart',[[10,300]]);fire('touchend',[],[[10,300]]);
    });assert.equal(await page.evaluate(()=>swipeCount),0);
    await page.locator('#list').evaluate(el=>{
      const fire=(type,x,touches)=>el.dispatchEvent(new TouchEvent(type,{bubbles:true,touches:touches?[new Touch({identifier:0,target:el,clientX:x,clientY:300})]:[],changedTouches:[new Touch({identifier:0,target:el,clientX:x,clientY:300})]}));
      fire('touchstart',10,true);fire('touchmove',120,true);fire('touchend',120,false);
    });assert.equal(await page.evaluate(()=>swipeCount),1,'Intentional horizontal sidebar opening still works');
    await page.locator('#sidebar-fixture').evaluate(el=>{
      const fire=(type,x,touches)=>el.dispatchEvent(new TouchEvent(type,{bubbles:true,touches:touches?[new Touch({identifier:0,target:el,clientX:x,clientY:40})]:[],changedTouches:[new Touch({identifier:0,target:el,clientX:x,clientY:40})]}));
      fire('touchstart',400,true);fire('touchmove',290,true);fire('touchend',290,false);
    });assert.equal(await page.evaluate(()=>closeSwipeCount),1,'Intentional sidebar closing still works');
    const desktop=await browser.newPage({viewport:{width:1000,height:800}});await desktop.goto(url);await desktop.locator('#actions-2').click();await desktop.getByRole('menu').waitFor();await desktop.keyboard.press('Escape');
    for(const key of ['Enter','Space','ArrowDown']){await desktop.locator('#actions-2').focus();await desktop.keyboard.press(key);await desktop.getByRole('menu').waitFor();await desktop.keyboard.press('Escape');}
    await desktop.goto(url+'/default-open');await desktop.getByRole('menu').waitFor();await desktop.keyboard.press('Escape');await desktop.getByRole('menu').waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);result.touchAndKeyboardTaps=true;result.cancelledGesturesIgnored=true;result.sidebarAxisLock=true;
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
    console.log('TOUCH_SCROLL_BROWSER_OK',JSON.stringify(result));
  } finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
