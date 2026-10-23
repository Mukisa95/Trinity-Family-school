/* Shared school header, glass page header, real parent layout and navigation. No school data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webkit, chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { build, output: fixture } = require('./test-dashboard-theme-browser.cjs');
const output = path.resolve(__dirname, '../output/ios-chrome-qa');
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1';
const rect = locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; });

async function run() {
  await build({ navigation: true, pageLayers: true, appleFrame: true, adminPages: true });
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    if (['/fixture.js', '/fixture.css'].includes(req.url)) { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(fs.readFileSync(path.join(fixture, req.url.slice(1)))); }
    else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=yes,viewport-fit=cover"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const reports = [];
  try {
    for (const engine of ['webkit', 'chromium']) {
      const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ headless: true, channel: 'msedge' }));
      try {
        for (const standalone of [false, true]) {
          const page = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: iphone, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
          page.setDefaultTimeout(15000);
          const errors = []; page.on('pageerror', e => errors.push(e.message));
          if (standalone) await page.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); document.addEventListener('DOMContentLoaded', () => document.documentElement.dataset.homeScreen = 'true'); });
          await page.goto(url);
          await page.locator('[data-apple-mobile-workspace]').waitFor();
          const header = page.locator('.app-topbar'), glass = page.locator('.glass-page-topbar');
          const adminScroller = page.getByTestId('workspace-scroller');
          await page.waitForFunction(() => document.body.hasAttribute('data-scroll-locked'));
          if (await page.evaluate(() => CSS.supports('overscroll-behavior-y', 'none'))) {
            assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY), 'none');
            assert.equal(await adminScroller.evaluate(el => getComputedStyle(el).overscrollBehaviorY), 'none');
          }
          for (const adminPage of ['dashboard', 'pupil-detail']) {
            await page.evaluate(name => window.setAdminPage(name), adminPage);
            await page.evaluate(name => window.setFrameRoute(name === 'dashboard' ? '/' : '/pupil-detail'), adminPage);
            await page.waitForFunction(() => document.querySelector('[data-testid="workspace-scroller"]').scrollTop === 0);
            if (adminPage === 'dashboard') await page.locator('[data-admin-dashboard]').waitFor();
            else await glass.waitFor();
            for (const boundary of ['top', 'middle', 'bottom']) {
              await adminScroller.evaluate((el, boundary) => { el.style.scrollBehavior = 'auto'; el.scrollTop = boundary === 'top' ? 0 : boundary === 'middle' ? (el.scrollHeight - el.clientHeight) / 2 : el.scrollHeight; }, boundary);
              await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
              if (boundary !== 'middle') {
                if (boundary === 'bottom') await page.waitForFunction(() => { const el = document.querySelector('[data-testid="workspace-scroller"]'); return el.scrollTop + el.clientHeight >= el.scrollHeight - 1; });
                const touch = pinch => adminScroller.evaluate((el, { boundary, pinch }) => {
                  const dispatch = (type, y) => { const event = new Event(type, { bubbles: true, cancelable: true }); const touches = [{ clientX: 140, clientY: y, identifier: 1, target: el }]; if (pinch) touches.push({ clientX: 230, clientY: y, identifier: 2, target: el }); Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: touches } }); el.dispatchEvent(event); return event.defaultPrevented; };
                  dispatch('touchstart', 240); const blocked = dispatch('touchmove', boundary === 'top' ? 300 : 180); el.dispatchEvent(new Event('touchcancel', { bubbles: true })); return blocked;
                }, { boundary, pinch });
                assert.equal(await touch(false), true, adminPage + ': edge touch is contained even without CSS overscroll support');
                assert.equal(await touch(true), false, 'Native pinch remains available at scroll boundaries');
              }
              const frozenHeader = await rect(header);
              if (engine === 'chromium' && boundary !== 'middle') {
                const session = await page.context().newCDPSession(page);
                await page.evaluate(() => { window.navDrift = []; window.trackNavDrift = true; const track = () => { if (!window.trackNavDrift) return; window.navDrift.push([...document.querySelectorAll('.app-topbar, .glass-page-topbar, .glass-navigation-floating')].map(el => el.getBoundingClientRect().top)); requestAnimationFrame(track); }; track(); });
                await session.send('Input.synthesizeScrollGesture', { x: 195, y: 300, yDistance: boundary === 'top' ? 1500 : -1500, speed: 6000, gestureSourceType: 'touch' });
                const drift = await page.evaluate(() => { window.trackNavDrift = false; return window.navDrift; });
                assert.ok(drift.length > 0 && drift.every(sample => sample.length === drift[0].length && sample.every((top, index) => Math.abs(top - drift[0][index]) < 2)), adminPage + ': navigation stays stable throughout the edge gesture');
                await session.detach();
              }
              assert.ok(Math.abs((await rect(header)).top - frozenHeader.top) < 2, adminPage + ': main navigation does not shift');
              if (adminPage === 'pupil-detail') {
                assert.ok(Math.abs((await rect(glass)).top - (await rect(header)).bottom) < 2);
                const dock = await rect(page.locator('.glass-navigation-floating'));
                assert.ok(dock.bottom <= 844 && dock.bottom > 760);
              }
              assert.equal(await page.evaluate(() => window.scrollY), 0);
            }
          }
          assert.equal(await page.evaluate(() => {
            const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:120px;left:20px;height:180px;width:200px;overflow:auto;z-index:200'; probe.innerHTML = '<div style="height:1000px">Independent overlay</div>'; document.body.appendChild(probe); probe.scrollTop = 100;
            const dispatch = (type, y) => { const event = new Event(type, { bubbles: true, cancelable: true }); const touches = [{ clientX: 80, clientY: y, identifier: 1, target: probe }]; Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: touches } }); probe.dispatchEvent(event); return event.defaultPrevented; };
            dispatch('touchstart', 200); const blocked = dispatch('touchmove', 180); probe.dispatchEvent(new Event('touchcancel', { bubbles: true })); probe.remove(); return blocked;
          }), false, 'Independent overlays retain their own scrolling');
          for (const parent of [false, true]) {
            await page.evaluate(parent => window.setParentFrame(parent), parent);
            const scroller = parent ? page.locator('.parent-workspace > div > .overflow-y-auto') : page.getByTestId('workspace-scroller');
            const bottom = parent ? page.getByRole('navigation', { name: 'Parent navigation' }) : page.locator('.glass-navigation-floating');
            await bottom.waitFor();
            for (const dark of [false, true]) {
              await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
              for (const size of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 844, height: 390 }]) {
                await page.setViewportSize(size);
                await scroller.evaluate(el => el.scrollTop = 0);
                await page.waitForFunction(() => Math.abs(document.querySelector('[data-apple-mobile-workspace]').getBoundingClientRect().height - visualViewport.height) < 2);
                const before = await rect(header);
                await scroller.evaluate(el => el.scrollTop = 700);
                await page.waitForFunction(() => document.querySelector('.glass-page-topbar').getBoundingClientRect().top >= 0);
                const main = await rect(header), shared = await rect(glass);
                assert.ok(Math.abs(main.top - before.top) < 2 && main.top >= 0, 'School header remains visible');
                assert.ok(Math.abs(shared.top - main.bottom) < 2, 'Glass header stays immediately below school header');
                if (size.width < 640 || parent) {
                  const dock = await rect(bottom);
                  assert.ok(dock.bottom <= size.height && dock.top > size.height - 120, 'Bottom navigation stays at the bottom');
                  assert.ok(dock.left >= 0 && dock.right <= size.width, 'Bottom navigation fits the screen');
                }
                assert.equal(await page.evaluate(() => window.scrollY), 0, 'The outer document does not carry the workspace away');
                assert.ok(await scroller.evaluate(el => el.scrollTop > 0), 'Workspace content still scrolls');
                await scroller.evaluate(el => el.scrollTop = el.scrollHeight);
                assert.ok((await rect(glass)).top >= main.bottom - 2);
              }
              await page.setViewportSize({ width: 390, height: 844 });
              await bottom.waitFor();
              await page.waitForFunction(() => Math.abs(document.querySelector('[data-apple-mobile-workspace]').getBoundingClientRect().height - visualViewport.height) < 2 && [...document.querySelectorAll('.viewport-overlay')].filter(el => getComputedStyle(el).display !== 'none').every(el => Math.abs(el.getBoundingClientRect().width - visualViewport.width) < 2));
              const restoredDock = await rect(bottom);
              assert.ok(restoredDock.left >= 0 && restoredDock.right <= 390 && restoredDock.bottom <= 844);
              await page.screenshot({ path: path.join(output, `${engine}-${standalone ? 'installed' : 'safari'}-${parent ? 'parent' : 'staff'}-${dark ? 'dark' : 'light'}.png`) });
            }
            // Keyboard/browser chrome can resize and move the visible viewport
            // without changing CSS media queries or the page's layout dimensions.
            await page.evaluate(() => { Object.defineProperties(visualViewport, { height: { configurable: true, value: 470 }, offsetTop: { configurable: true, value: 52 } }); visualViewport.dispatchEvent(new Event('resize')); visualViewport.dispatchEvent(new Event('scroll')); });
            await page.waitForFunction(() => Math.abs(document.querySelector('.app-topbar').getBoundingClientRect().top - 52) < 2);
            const dock = await rect(bottom);
            assert.ok(dock.bottom <= 522 && dock.bottom > 470, 'Bottom controls follow the keyboard viewport');
            assert.ok(Math.abs((await rect(glass)).top - (await rect(header)).bottom) < 2);
            await page.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; visualViewport.dispatchEvent(new Event('resize')); });
            await page.waitForFunction(() => Math.abs(document.querySelector('.app-topbar').getBoundingClientRect().top) < 2);
            if (parent) {
              await bottom.getByRole('button', { name: 'Settings', exact: true }).click();
              await page.getByRole('link', { name: 'App Settings', exact: true }).waitFor();
              await bottom.getByRole('button', { name: 'Settings', exact: true }).click();
              await page.getByRole('link', { name: 'App Settings', exact: true }).waitFor({ state: 'hidden' });
            } else {
              await bottom.getByRole('button', { name: 'Pay', exact: true }).click();
              assert.equal(await page.evaluate(() => window.layerAction), 'Pay');
            }
          }
          await page.emulateMedia({ media: 'print' });
          assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'visible', 'Workspace touch locking must not clip printed pages');
          assert.equal(await page.locator('[data-apple-mobile-workspace]').evaluate(el => getComputedStyle(el).position), 'static');
          assert.equal(await page.getByRole('navigation', { name: 'Parent navigation' }).isVisible(), false);
          await page.emulateMedia({ media: 'screen' });
          if (engine === 'chromium') {
            const session = await page.context().newCDPSession(page);
            const initialHeight = await page.locator('[data-apple-mobile-workspace]').evaluate(el => el.getBoundingClientRect().height);
            const points = distance => [{ x: 150 - distance, y: 250, id: 1, radiusX: 3, radiusY: 3 }, { x: 230 + distance, y: 250, id: 2, radiusX: 3, radiusY: 3 }];
            await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0) });
            for (let step = 1; step <= 8; step++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(step * 10) }); await page.waitForTimeout(25); }
            await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await page.waitForFunction(() => visualViewport.scale > 1.2);
            assert.ok(Math.abs(await page.locator('[data-apple-mobile-workspace]').evaluate(el => el.getBoundingClientRect().height) - initialHeight) < 2, 'Native pinch zoom retains the workspace layout');
            await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
          }
          assert.deepEqual(errors, []);
          reports.push({ engine, standalone, staff: true, parent: true, lightDark: true, portraitLandscape: true, keyboardViewport: true });
          await page.close();
        }
        const android = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile Safari/537.36', hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
        await android.goto(url); await android.locator('.glass-page-topbar').waitFor();
        assert.equal(await android.locator('[data-apple-mobile-workspace]').count(), 0, 'Android retains its existing layout');
        await android.close();
      } finally { await browser.close(); }
    }
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ reports, physicalIPhoneTest: false }, null, 2));
    console.log('IOS_CHROME_OK: admin dashboard and pupil navigation, edge touch/drag stability, route scroll reset, independent overlays, staff/parent headers and bottom controls, Safari/Home Screen, light/dark, portrait/landscape, keyboard, print, native pinch and Android isolation.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
