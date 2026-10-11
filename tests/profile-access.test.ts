import test from 'node:test';
import assert from 'node:assert/strict';
import type { SystemUser } from '@/types';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getRoutePagePermission } from '@/types/permissions';

const staff = {
  id: 'staff-1', username: 'teacher.one', role: 'Staff', isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  granularPermissions: GranularPermissionService.getDefaultPermissions('Staff'),
} satisfies SystemUser;

test('the profile route is accessible to existing staff with only default pupil permissions', () => {
  const route = getRoutePagePermission('/profile');
  assert.ok(route);
  assert.equal(GranularPermissionService.canAccessPage(staff, 'pupils', 'list'), true);
  assert.equal(GranularPermissionService.canAccessPage(staff, route.moduleId, route.pageId), true);
});

test('self profile access needs no account-module grant for any signed-in role', () => {
  for (const role of ['Admin', 'Staff', 'Parent'] as const) {
    assert.equal(GranularPermissionService.canAccessPage({ ...staff, role, granularPermissions: [] }, 'account', 'profile'), true);
  }
  assert.equal(GranularPermissionService.canAccessPage(null, 'account', 'profile'), false);
  assert.equal(GranularPermissionService.canAccessPage({ ...staff, granularPermissions: undefined,
    modulePermissions: [{ module: 'pupils', permission: 'view_only' }] }, 'account', 'profile'), true);
});

test('self profile access does not grant account actions or access to other users and school records', () => {
  assert.equal(GranularPermissionService.canPerformAction(staff, 'account', 'profile', 'edit_profile'), false);
  assert.equal(GranularPermissionService.canPerformAction(staff, 'account', 'profile', 'change_password'), false);
  for (const [module, page] of [['account', 'history_log'], ['settings', 'school'], ['users', 'list'], ['payroll', 'detail'], ['pupils', 'detail']]) {
    assert.equal(GranularPermissionService.canAccessPage(staff, module, page), false);
  }
});
