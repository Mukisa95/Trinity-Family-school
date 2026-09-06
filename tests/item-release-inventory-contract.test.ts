import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inventoryPage = readFileSync('src/app/inventory/page.tsx', 'utf8');
const releasePanel = readFileSync('src/components/inventory/ItemReleaseQueuePanel.tsx', 'utf8');
const legacyReleasePage = readFileSync('src/app/item-requests/release/page.tsx', 'utf8');
const navigation = readFileSync('src/config/nav.ts', 'utf8');
const appLayout = readFileSync('src/components/layout/app-layout.tsx', 'utf8');
const desktopSidebar = readFileSync('src/components/layout/sidebar-nav.tsx', 'utf8');
const mobileSidebar = readFileSync('src/components/layout/mobile-sidebar.tsx', 'utf8');
const requestRoute = readFileSync('src/app/api/item-requests/route.ts', 'utf8');
const restockReceivedRoute = readFileSync('src/app/api/item-requests/restock-received/route.ts', 'utf8');

test('release is embedded in Inventory and removed from standalone navigation', () => {
  assert.doesNotMatch(navigation, /href:\s*['"]\/item-requests\/release['"]/);
  assert.match(inventoryPage, /<ItemReleaseQueuePanel/);
  assert.match(inventoryPage, /id:\s*['"]release['"]/);
  assert.match(appLayout, /canAccessInventoryWorkspace/);
  assert.match(desktopSidebar, /href === ['"]\/inventory['"].*canAccessInventoryWorkspace/);
  assert.match(mobileSidebar, /href === ['"]\/inventory['"].*canAccessInventoryWorkspace/);
});

test('Inventory displays a dismissible request popup and keeps a counted Release action', () => {
  assert.match(inventoryPage, /releaseAlertOpen/);
  assert.match(inventoryPage, /sessionStorage\.setItem/);
  assert.match(inventoryPage, /label=['"]Release['"]/);
  assert.match(inventoryPage, /badge=\{releaseRequests\.length/);
  assert.match(inventoryPage, /Open release queue/);
  assert.match(inventoryPage, /Who:<\/span>/);
  assert.match(inventoryPage, /How much:<\/span>/);
});

test('push notifications deep-link to the embedded release tab', () => {
  for (const source of [requestRoute, restockReceivedRoute]) {
    assert.match(source, /\/inventory\?tab=release&requestId=/);
    assert.doesNotMatch(source, /\/item-requests\/release\?requestId=/);
  }
});

test('old release links redirect into Inventory and preserve request parameters', () => {
  assert.match(legacyReleasePage, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(legacyReleasePage, /nextParams\.set\(['"]tab['"],\s*['"]release['"]\)/);
  assert.match(legacyReleasePage, /router\.replace\(`\/inventory\?\$\{nextParams\.toString\(\)\}`\)/);
});

test('release-only view disables broad Inventory collection owners', () => {
  assert.match(inventoryPage, /inventoryQueriesEnabled\s*=\s*canViewInventory\s*&&\s*activeTab\s*!==\s*['"]release['"]/);
  assert.match(inventoryPage, /requestedTab === ['"]release['"].*canViewRelease/s);
  assert.match(inventoryPage, /useInventoryItems\(filters,\s*\{\s*enabled:\s*inventoryQueriesEnabled\s*\}\)/);
  assert.match(inventoryPage, /useInventorySummary\(\{\s*enabled:\s*inventoryQueriesEnabled\s*\}\)/);
  assert.match(releasePanel, /useItemRequestDecision/);
});
