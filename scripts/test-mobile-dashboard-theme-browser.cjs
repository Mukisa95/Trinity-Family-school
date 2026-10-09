/* Exercise actual dashboard cards at phone/tablet widths with web and native palettes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { build, output: fixture } = require('./test-dashboard-theme-browser.cjs');
const palette = require('../tests/fixtures/android-device-palette.json');
const output = path.resolve(__dirname, '../output/mobile-dashboard-theme');
const cards = ['enrollment', 'attendance', 'calendar', 'term', 'slideshow', 'empty-slideshow'];
const frame = locator => locator.evaluate(el => {
  const s = getComputedStyle(el);
  return { background: s.backgroundColor, image: s.backgroundImage, color: s.color, border: s.border, shadow: s.boxShadow, radius: s.borderRadius };
});
const stats = page => page.locator('.stat-card').evaluateAll(elements => elements.map(el => {
  const card = getComputedStyle(el), label = getComputedStyle(el.querySelector('.dashboard-stat-label'));
  return { accent: card.borderLeftColor, background: card.backgroundImage, label: label.color, surface: getComputedStyle(el.querySelector('.dashboard-stat-surface')).backgroundColor };
}));
async function run() {
  await build(); fs.mkdirSync(output, { recursive: true });
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>';
  const server = http.createServer((req, res) => {
    const uri = req.url.split('?')[0];
    if (['/fixture.js', '/fixture.css'].includes(uri)) {
      res.setHeader('Content-Type', uri.endsWith('js') ? 'text/javascript' : 'text/css');
      res.end(fs.readFileSync(path.join(fixture, uri.slice(1))));
    } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.THEME_BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(colors => {
      window.nativePalette = colors;
      window.TrinityOffline = { postMessage(raw) {
        const request = JSON.parse(raw);
        queueMicrotask(() => window.TrinityOffline.onmessage?.({ data: JSON.stringify({ id: request.id, success: true, ...(request.action === 'deviceColors' ? { palette: window.nativePalette } : {}) }) }));
      } };
    }, palette);
    await page.clock.setFixedTime(new Date('2026-10-09T10:00:00'));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('.dashboard-timetable-card').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="enrollment"] svg text')].some(text => text.textContent === '95'));
    const apply = async (preset, dark, deviceColors) => {
      await page.evaluate(settings => {
        const value = JSON.stringify({ ...settings, background: 'plain', dimming: 37 });
        localStorage.setItem('trinity-look-and-feel', value);
        window.dispatchEvent(new StorageEvent('storage', { key: 'trinity-look-and-feel', newValue: value }));
      }, { preset, deviceColors });
      await page.waitForFunction(enabled => (document.documentElement.dataset.deviceColors === 'true') === enabled, deviceColors);
      if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark) {
        await page.getByRole('switch', { name: 'Dark theme' }).first().click();
        await page.waitForFunction(dark => document.documentElement.classList.contains('dark') === dark && !document.documentElement.dataset.themeReveal, dark);
      }
      await page.waitForTimeout(350); // Allow existing card colour transitions to settle.
    };
    const reports = [];
    const verify = async name => {
      await page.waitForTimeout(350);
      const timetable = await frame(page.locator('.dashboard-timetable-card'));
      for (const id of cards) assert.deepEqual(await frame(page.getByTestId(id).locator('.dashboard-mobile-timetable-card')), timetable, `${name}/${id} must share the timetable frame`);
      const colours = await stats(page); assert.equal(colours.length, 6);
      for (const colour of colours) assert.deepEqual(colour, colours[0], `${name}: every statistic matches Total Pupils`);
      assert.equal(await page.locator('.dashboard-mobile-timetable-card > .dashboard-card-decoration').evaluateAll(els => els.some(el => getComputedStyle(el).display !== 'none')), false);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Phone has no horizontal overflow');
      reports.push({ name, timetable, statistic: colours[0] });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, name + '.png') });
    };
    for (const preset of ['trinity-classic', 'soft-indigo']) for (const dark of [false, true]) {
      await apply(preset, dark, false); await verify(preset + '-' + (dark ? 'dark' : 'light'));
    }
    for (const dark of [false, true]) {
      await apply('trinity-classic', dark, true); await verify('material-you-' + (dark ? 'dark' : 'light'));
    }
    // A wallpaper palette update recolours the open dashboard without reloading it.
    await page.evaluate(() => {
      window.nativePalette.palettes.primary = window.nativePalette.palettes.secondary;
      window.nativePalette.light.primary = window.nativePalette.light.secondary;
      window.nativePalette.dark.primary = window.nativePalette.dark.secondary;
      window.dispatchEvent(new Event('trinity-android-colors-change'));
    });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim() === '90 123 145');
    await verify('material-you-cool-dark');
    assert.notDeepEqual(reports.at(-1).statistic, reports.at(-2).statistic, 'Statistic accents follow refreshed device colours');
    assert.notEqual(reports.at(-1).timetable.shadow, reports.at(-2).timetable.shadow, 'Card glow follows refreshed device colours');
    await page.setViewportSize({ width: 768, height: 1024 }); await verify('tablet-device-dark');
    await page.setViewportSize({ width: 390, height: 844 });
    // Exercise the cycling attendance card after its status/colour config changes.
    const lastLabel = page.locator('.stat-card').last().locator('.dashboard-stat-label');
    const status = await lastLabel.textContent(); await page.waitForFunction(previous => document.querySelectorAll('.dashboard-stat-label')[5].textContent !== previous, status);
    await page.waitForTimeout(350); await verify('cycled-attendance-dark');
    const slide = page.getByTestId('slideshow');
    await slide.getByRole('button', { name: 'Pause slideshow' }).click();
    await slide.getByRole('button', { name: 'Show photo 1' }).click();
    await slide.getByRole('button', { name: 'Next photo', exact: true }).click();
    await page.waitForTimeout(900);
    assert.equal(await slide.getByRole('button', { name: 'Show photo 2' }).getAttribute('aria-current'), 'true');
    await slide.getByRole('button', { name: 'Open Sample second moment in a larger viewer' }).click();
    await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    await slide.getByRole('button', { name: 'Previous photo', exact: true }).click();
    await page.waitForTimeout(900);
    assert.equal(await slide.getByRole('button', { name: 'Show photo 1' }).getAttribute('aria-current'), 'true');
    await slide.screenshot({ path: path.join(output, 'slideshow-device-dark.png') });
    await page.emulateMedia({ media: 'print' });
    assert.notDeepEqual((await stats(page))[1], (await stats(page))[0], 'Mobile recolouring is screen-only');
    await page.emulateMedia({ media: 'screen' }); await apply('trinity-classic', false, false);
    await page.setViewportSize({ width: 1440, height: 1050 });
    const desktopStats = await stats(page); assert.equal(new Set(desktopStats.map(s => s.accent)).size, 6, 'Desktop category colours remain distinct');
    assert.notEqual((await frame(page.getByTestId('enrollment').locator('.dashboard-mobile-timetable-card'))).shadow, (await frame(page.locator('.dashboard-timetable-card'))).shadow, 'Desktop card depth stays unchanged');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ reports, desktopCategories: 6, slideshowControls: true, printIsolation: true, errors }, null, 2));
    console.log('MOBILE_DASHBOARD_THEME_OK: six actual statistics (including cycling/expandable cards), all chart/slideshow frames, Classic/Indigo/device light and dark, live palette refresh, tablet, photo controls, print isolation and unchanged desktop.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
