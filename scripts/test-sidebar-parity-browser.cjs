const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { build, output: fixture } = require('./test-dashboard-theme-browser.cjs');
const output = path.resolve(__dirname, '../output/sidebar-parity-qa');

const appearance = root => root.locator('.sidebar-nav-link').evaluateAll(links => links.map(link => {
  const style = getComputedStyle(link), icon = link.querySelector('svg');
  return { text: link.textContent.trim(), size: style.fontSize, weight: style.fontWeight, color: style.color,
    background: style.backgroundColor, radius: style.borderRadius, paddingLeft: style.paddingLeft,
    paddingRight: style.paddingRight, iconSize: icon?.getAttribute('width'), iconColor: icon && getComputedStyle(icon).color };
}));

async function run() {
  await build({ navigation: true });
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const asset = ['/fixture.js', '/fixture.css'].includes(req.url) && req.url.slice(1);
    if (asset) { res.setHeader('Content-Type', asset.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(fs.readFileSync(path.join(fixture, asset))); }
    else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.THEME_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.locator('.app-topbar').waitFor();
    const desktop = page.locator('[data-sidebar="sidebar"]');
    const desktopAppearance = await appearance(desktop);
    assert.ok(desktopAppearance.length > 5);
    const desktopSections = await desktop.locator('[data-sidebar="group-label"]').allTextContents();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('open-mobile').click();
    const mobile = page.getByRole('dialog', { name: 'School navigation' });
    await mobile.waitFor();
    await page.mouse.move(385, 830);
    assert.deepEqual(await appearance(mobile), desktopAppearance, 'Mobile uses desktop icons, typography, padding, colors and selected treatment');
    assert.deepEqual(await mobile.locator('[data-sidebar="group-label"]').allTextContents(), desktopSections);
    assert.equal(await mobile.evaluate(el => el.getBoundingClientRect().width), 256);
    assert.ok(await mobile.locator('.sidebar-nav-link').evaluateAll(links => links.every(link => link.getBoundingClientRect().height >= 44)), 'Mobile retains comfortable tap areas');
    assert.equal(await mobile.locator('.sidebar-nav-item-enter').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await mobile.locator('[aria-current="page"]').count(), 1);
    await mobile.getByRole('button', { name: 'Pupils', exact: true }).click();
    await mobile.getByRole('link', { name: 'Pupils Management', exact: true }).waitFor();
    assert.equal(await mobile.getByRole('button', { name: 'Pupils', exact: true }).getAttribute('aria-expanded'), 'true');
    await mobile.getByRole('button', { name: 'Pupils', exact: true }).click();
    assert.equal(await mobile.getByRole('link', { name: 'Pupils Management', exact: true }).count(), 0);
    await page.mouse.move(385, 830);
    await page.screenshot({ path: path.join(output, 'mobile-light.png') });
    await mobile.getByRole('switch', { name: 'Dark theme' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('dark') && !document.documentElement.dataset.themeReveal);
    await page.screenshot({ path: path.join(output, 'mobile-dark.png') });
    await mobile.locator('[data-sidebar="footer"]').getByRole('button').first().click();
    await page.getByRole('menu').waitFor();
    await page.keyboard.press('Escape'); await page.getByRole('menu').waitFor({ state: 'hidden' });
    assert.ok(await mobile.isVisible(), 'Escape dismisses a portalled account menu before the drawer');
    await page.keyboard.press('Escape'); await mobile.waitFor({ state: 'detached' });
    assert.equal(await page.getByTestId('open-mobile').evaluate(el => el === document.activeElement), true, 'Escape returns focus to the opener');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByTestId('open-mobile').click();
    const animations = await mobile.locator('.sidebar-nav-item-enter').evaluateAll(rows => rows.map(row => {
      const s = getComputedStyle(row); return { name: s.animationName, duration: parseFloat(s.animationDuration), delay: parseFloat(s.animationDelay), willChange: s.willChange };
    }));
    assert.ok(animations.every(a => a.name === 'sidebar-item-entrance' && a.duration <= .2 && a.delay <= .09 && a.willChange === 'auto'), 'A short capped CSS entrance needs no permanently promoted layers');
    await page.waitForTimeout(350);
    assert.equal(await mobile.locator('.sidebar-nav-item-enter').evaluateAll(rows => rows.flatMap(row => row.getAnimations()).length), 0, 'Entrance stops completely after settling');
    await mobile.getByRole('button', { name: 'Close sidebar' }).click();
    await page.setViewportSize({ width: 320, height: 568 }); await page.getByTestId('open-mobile').click();
    assert.ok(await mobile.evaluate(el => el.getBoundingClientRect().right <= innerWidth && el.scrollWidth <= el.clientWidth));
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Collapse Sidebar', exact: true }).click();
    await desktop.getByRole('button', { name: 'Pupils', exact: true }).hover();
    await page.getByRole('link', { name: 'Pupils Management', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ desktopAppearance, desktopSections, animations, errors }, null, 2));
    console.log('SIDEBAR_PARITY_OK: shared desktop/mobile appearance, tap targets, groups, selected state, Escape/focus, compact desktop popover, capped CSS entrance and reduced motion.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
