import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devicePaletteCss, parseDevicePalette } from '../src/lib/theme/device-colors';
import { parseLookAndFeel } from '../src/lib/theme/appearance-settings';
const roles=['background','surface','foreground','muted','mutedForeground','outline','primary','onPrimary','primaryContainer','onPrimaryContainer','secondary','onSecondary','secondaryContainer','onSecondaryContainer'];
const tones=[0,10,50,100,200,300,400,500,600,700,800,900,1000];
const fixture=()=>({supported:true,palettes:Object.fromEntries(['primary','secondary','tertiary','neutral','neutralVariant'].map(f=>[f,Object.fromEntries(tones.map(t=>[t,'#123456']))])),light:Object.fromEntries(roles.map(r=>[r,'#123456'])),dark:Object.fromEntries(roles.map(r=>[r,'#ABCDEF']))});
test('validates complete device colours and strips unknown bridge properties',()=>{
  const palette=parseDevicePalette({...fixture(),injected:'color:red'});assert.ok(palette);assert.equal('injected' in palette,false);
});
test('rejects unsupported devices, incomplete palettes and CSS injection',()=>{
  assert.equal(parseDevicePalette({supported:false}),null);const missing=fixture();delete missing.dark.primary;assert.equal(parseDevicePalette(missing),null);
  const corrupt=fixture();corrupt.light.primary='red;display:none';assert.equal(parseDevicePalette(corrupt),null);
  const tone=fixture();tone.palettes.primary[600]='url(https://bad.invalid)';assert.equal(parseDevicePalette(tone),null);
});
test('device preference defaults off and stays independent from appearance/preset/background',()=>{
  assert.equal(parseLookAndFeel({}).deviceColors,false);assert.equal(parseLookAndFeel({deviceColors:'true'}).deviceColors,false);
  assert.deepEqual(parseLookAndFeel({deviceColors:true,preset:'soft-indigo',background:'plain',dimming:50}),{deviceColors:true,preset:'soft-indigo',background:'plain',dimming:50});
});
test('wallpaper roles are screen-only, preserve status colours, and produce paired light/dark CSS',()=>{
  const palette=parseDevicePalette(fixture())!;const css=devicePaletteCss(palette);
  assert.ok(css.startsWith('@media screen'));assert.ok(css.includes('html.dark[data-device-colors="true"]'));
  assert.ok(css.includes('--primary-foreground:'));assert.ok(css.includes('--brand-secondary-surface-50:'));
  assert.equal(css.includes('--lesson-green-'),false);assert.equal(css.includes('--destructive:'),false);assert.equal(css.includes('!important'),false);
  assert.ok(css.includes('--lesson-indigo-ink:67 56 202;'));
  assert.ok(css.includes('--lesson-indigo-ink:165 180 252;'));
  assert.ok(css.includes('--lesson-violet-ink:109 40 217;'));
});

test('device palettes reach legacy neutral surfaces and all their opacity/gradient variants',()=>{
  const palette=parseDevicePalette(fixture())!;
  for(const family of ['slate','gray','zinc','neutral','stone'])for(const shade of [50,100,200,300,400,500,600,700,800,900,950]){
    assert.ok(devicePaletteCss(palette).includes(`--ui-neutral-${family}-${shade}:`));
  }
  const css=devicePaletteCss(palette);
  for(const role of ['calendar-text','calendar-hover','calendar-control-bg','chart-thumb-top','chart-thumb-middle','chart-thumb-edge','schedule-empty-bg','night-background','scrollbar-track'])assert.ok(css.includes(`--${role}:`),role);
  assert.ok(css.includes('--ui-neutral-slate-950:171 205 239;'),'darkest legacy surface uses the device background');
});
