import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { devicePaletteCss, parseDevicePalette } from '../src/lib/theme/device-colors';
import { LOOK_AND_FEEL_BOOTSTRAP, parseLookAndFeel, THEME_PRESETS } from '../src/lib/theme/appearance-settings';
import captured from '../src/lib/theme/pixel-terracotta-palette.json';

test('Pixel Terracotta uses the complete public Android palette with paired roles', () => {
  const palette = parseDevicePalette(captured);
  assert.ok(palette);
  assert.equal(Object.keys(palette.palettes).length, 5);
  assert.equal(palette.light.primary, '#8F4C35');
  assert.equal(palette.dark.primary, '#FFB59D');
  assert.equal(palette.dark.background, '#2A170D');
  assert.equal(palette.light.background, '#FFFBFF');
});

test('saved preset works before first paint without requiring an Android bridge', () => {
  assert.ok(THEME_PRESETS.some(theme => theme.id === 'pixel-terracotta'));
  assert.equal(parseLookAndFeel({ preset: 'pixel-terracotta' }).preset, 'pixel-terracotta');
  const root = { dataset: {} as Record<string, string>, style: { setProperty() {} } };
  new Function('document', 'localStorage', LOOK_AND_FEEL_BOOTSTRAP)(
    { documentElement: root }, { getItem: () => JSON.stringify({ preset: 'pixel-terracotta', background: 'plain' }) },
  );
  assert.equal(root.dataset.appTheme, 'pixel-terracotta');
  assert.equal(root.dataset.appBackground, 'plain');
});

test('generated preset shares device roles while live colours can override it and print stays untouched', () => {
  const css = devicePaletteCss(parseDevicePalette(captured)!, {
    light: '[data-app-theme="pixel-terracotta"]',
    dark: '.dark[data-app-theme="pixel-terracotta"], .dark [data-app-theme="pixel-terracotta"]',
  });
  assert.ok(css.startsWith('@media screen'));
  for (const role of ['card', 'popover', 'glass-surface', 'navigation-surface', 'chart-axis', 'schedule-bg', 'ui-neutral-slate-900']) assert.ok(css.includes(`--${role}:`));
  assert.ok(readFileSync('src/app/brand-theme.css', 'utf8').includes(css), 'Generated CSS must be rebuilt when shared role mapping changes');
  assert.ok(devicePaletteCss(parseDevicePalette(captured)!).includes('html.dark[data-device-colors="true"]'), 'Live Android colours have greater selector specificity');
  assert.ok(!css.includes('--destructive:'));
});
