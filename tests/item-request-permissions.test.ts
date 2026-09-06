import test from 'node:test';
import assert from 'node:assert/strict';
import type { SystemUser } from '@/types';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';

const requester: SystemUser = {
  id: 'requester-1',
  username: 'teacher.one',
  role: 'Staff',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  granularPermissions: [{
    moduleId: 'item_requests',
    pages: [{
      pageId: 'request',
      canAccess: true,
      actions: [
        { actionId: 'access_page', allowed: true },
        { actionId: 'create_request', allowed: true },
        { actionId: 'view_own_requests', allowed: true },
      ],
    }],
  }],
};

test('request-only permission does not expose inventory or release actions', () => {
  assert.equal(GranularPermissionService.canAccessPage(requester, 'item_requests', 'request'), true);
  assert.equal(GranularPermissionService.canPerformAction(requester, 'item_requests', 'request', 'create_request'), true);
  assert.equal(GranularPermissionService.canAccessPage(requester, 'item_requests', 'release'), false);
  assert.equal(GranularPermissionService.canPerformAction(requester, 'item_requests', 'release', 'release_items'), false);
  assert.equal(GranularPermissionService.canPerformAction(requester, 'item_requests', 'release', 'start_restock'), false);
  assert.equal(GranularPermissionService.canAccessPage(requester, 'inventory', 'dashboard'), false);
});

test('legacy inventory access cannot silently grant item-request release authority', () => {
  const inventoryUser: SystemUser = {
    ...requester,
    id: 'inventory-1',
    granularPermissions: undefined,
    modulePermissions: [{ module: 'inventory', permission: 'full_access' }],
  };
  assert.equal(GranularPermissionService.canAccessPage(inventoryUser, 'inventory', 'dashboard'), true);
  assert.equal(GranularPermissionService.canAccessPage(inventoryUser, 'item_requests', 'release'), false);
  assert.equal(GranularPermissionService.canPerformAction(inventoryUser, 'item_requests', 'release', 'release_items'), false);
});

test('an explicit release officer can enter the Inventory workspace without broad Inventory access', () => {
  const releaseOfficer: SystemUser = {
    ...requester,
    id: 'release-officer-1',
    granularPermissions: [{
      moduleId: 'item_requests',
      pages: [{
        pageId: 'release',
        canAccess: true,
        actions: [
          { actionId: 'access_page', allowed: true },
          { actionId: 'view_release_queue', allowed: true },
          { actionId: 'release_items', allowed: true },
        ],
      }],
    }],
  };

  assert.equal(GranularPermissionService.canAccessPage(releaseOfficer, 'inventory', 'dashboard'), false);
  assert.equal(GranularPermissionService.canAccessInventoryWorkspace(releaseOfficer), true);
  assert.equal(GranularPermissionService.canPerformAction(releaseOfficer, 'item_requests', 'release', 'release_items'), true);
});

test('administrators retain access to the request and release pages', () => {
  const admin: SystemUser = { ...requester, id: 'admin-1', role: 'Admin' };
  assert.equal(GranularPermissionService.canAccessPage(admin, 'item_requests', 'request'), true);
  assert.equal(GranularPermissionService.canPerformAction(admin, 'item_requests', 'release', 'release_items'), true);
});

test('a Procurement purchaser needs the explicit purchase grant to handle restock work', () => {
  const purchaser: SystemUser = {
    ...requester,
    id: 'purchaser-1',
    granularPermissions: [{
      moduleId: 'procurement',
      pages: [{
        pageId: 'purchases',
        canAccess: true,
        actions: [
          { actionId: 'view_purchases', allowed: true },
          { actionId: 'create_purchase', allowed: true },
        ],
      }],
    }],
  };
  assert.equal(GranularPermissionService.canAccessPage(purchaser, 'procurement', 'purchases'), true);
  assert.equal(GranularPermissionService.canPerformAction(purchaser, 'procurement', 'purchases', 'view_purchases'), true);
  assert.equal(GranularPermissionService.canPerformAction(purchaser, 'procurement', 'purchases', 'create_purchase'), true);
  assert.equal(GranularPermissionService.canPerformAction(requester, 'procurement', 'purchases', 'create_purchase'), false);
});
