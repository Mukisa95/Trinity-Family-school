import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DEV_CONTROL_PATHS, isDevControlPath } from '@/config/dev-control';
import { navItems } from '@/config/nav';
import { isNavGroup, type SystemUser } from '@/types';
import { APP_VERSION, CHANGELOG } from '@/lib/constants/version';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('Dev Contral is one administration menu containing the four existing routes', () => {
  const group = navItems.find(item => item.title === 'Dev Contral');
  assert.ok(group && isNavGroup(group));
  assert.equal(group.section, 'Administration');
  assert.deepEqual(group.items.map(item => item.href), Object.values(DEV_CONTROL_PATHS));

  const settings = navItems.find(item => item.title === 'Settings');
  assert.ok(settings && isNavGroup(settings));
  for (const path of Object.values(DEV_CONTROL_PATHS)) {
    assert.equal(isDevControlPath(path), true);
    assert.equal(isDevControlPath(`${path}/details`), true);
    assert.equal(settings.items.some(item => item.href === path), false);
  }
  assert.equal(isDevControlPath('/history-log'), false);
});

test('every Dev Contral route is role-gated on desktop, mobile, and direct navigation', () => {
  const layout = read('src/components/layout/app-layout.tsx');
  const desktop = read('src/components/layout/sidebar-nav.tsx');
  const mobile = read('src/components/layout/mobile-sidebar.tsx');
  const gate = read('src/components/layout/dev-control-gate.tsx');

  assert.match(layout, /const isAdminOnlyRoute = isDevControlPath\(pathname\)/);
  assert.equal((layout.match(/<DevControlGate>\{children\}<\/DevControlGate>/g) || []).length, 2);
  assert.match(desktop, /if \(isDevControlPath\(href\)\) return user\?\.role === 'Admin'/);
  assert.match(mobile, /if \(isDevControlPath\(href\)\) return user\?\.role === 'Admin'/);
  assert.match(gate, /SecureAuthService\.verifyCredentials\(user\.username, password\)/);
  assert.match(gate, /verifiedUser\?\.id !== user\.id \|\| verifiedUser\.role !== 'Admin'/);
  assert.match(gate, /if \(isUnlocked\) \{[\s\S]*?\{children\}/);
  assert.doesNotMatch(read('src/app/history-log/page.tsx'), /href="\/history-log\/system-audit"/);
});

test('staff cannot retain historical seeding through an old granular grant', () => {
  const staff = {
    id: 'staff-1', role: 'Staff',
    granularPermissions: [{
      moduleId: 'pupils',
      pages: [{ pageId: 'historical_seeding', canAccess: true, actions: [{ actionId: 'create_historical_pupil', allowed: true }] }],
    }],
  } as unknown as SystemUser;
  const admin = { id: 'admin-1', role: 'Admin' } as SystemUser;

  assert.equal(GranularPermissionService.canAccessPage(staff, 'pupils', 'historical_seeding'), false);
  assert.equal(GranularPermissionService.canPerformAction(staff, 'pupils', 'historical_seeding', 'create_historical_pupil'), false);
  assert.equal(GranularPermissionService.canAccessPage(admin, 'pupils', 'historical_seeding'), true);
  assert.equal(GranularPermissionService.canPerformAction(admin, 'pupils', 'historical_seeding', 'create_historical_pupil'), true);
});

test('v6 is current and retains the dated v5 release history', () => {
  assert.equal(APP_VERSION, '6');
  assert.equal(CHANGELOG[0].version, '6');
  assert.equal(CHANGELOG[0].date, '2026-09-25');
  assert.ok(CHANGELOG[0].improvements.length >= 10);
  assert.ok(CHANGELOG[0].bugFixes.length >= 10);
  assert.ok(CHANGELOG.some(entry => entry.version === '5' && entry.date === '2026-06-06'));
});
