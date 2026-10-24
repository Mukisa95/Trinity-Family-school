import assert from 'node:assert/strict';
import test from 'node:test';
import { GranularPermissionService } from '../src/lib/services/granular-permissions.service';
import type { SystemUser } from '../src/types';

const linkedStaff: SystemUser = {
  id: 'user-ada',
  username: 'ada',
  role: 'Staff',
  isActive: true,
  staffId: 'staff-ada',
  createdAt: '2026-10-24T00:00:00.000Z',
};

test('linked staff receive only personal clocking access by default', () => {
  assert.equal(GranularPermissionService.canAccessPage(linkedStaff, 'staff_clocking', 'clock'), true);
  assert.equal(GranularPermissionService.canPerformAction(linkedStaff, 'staff_clocking', 'clock', 'clock_self'), true);
  assert.equal(GranularPermissionService.canAccessPage(linkedStaff, 'staff_clocking', 'record'), false);
  assert.equal(GranularPermissionService.canAccessPage(linkedStaff, 'staff_clocking', 'records'), false);
  assert.equal(GranularPermissionService.canPerformAction(linkedStaff, 'staff_clocking', 'records', 'export_records'), false);
});

test('an explicit record grant does not rely on legacy staff access', () => {
  const timekeeper: SystemUser = {
    ...linkedStaff,
    id: 'user-timekeeper',
    granularPermissions: [{
      moduleId: 'staff_clocking',
      pages: [{
        pageId: 'record',
        canAccess: true,
        actions: [{ actionId: 'display_qr', allowed: true }],
      }],
    }],
  };

  assert.equal(GranularPermissionService.canAccessPage(timekeeper, 'staff_clocking', 'record'), true);
  assert.equal(GranularPermissionService.canPerformAction(timekeeper, 'staff_clocking', 'record', 'display_qr'), true);
  assert.equal(GranularPermissionService.canPerformAction(timekeeper, 'staff_clocking', 'record', 'manage_schedules'), false);
});
