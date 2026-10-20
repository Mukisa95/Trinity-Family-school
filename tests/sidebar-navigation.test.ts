import test from 'node:test';
import assert from 'node:assert/strict';
import { Home } from 'lucide-react';
import type { NavigationItem, SystemUser } from '@/types';
import { isNavGroup } from '@/types';
import { navItems } from '@/config/nav';
import { DEV_CONTROL_PATHS } from '@/config/dev-control';
import { isSidebarRouteActive, visibleSidebarItems } from '@/components/layout/sidebar-navigation';

const staff: SystemUser = { id: 'synthetic', username: 'test', role: 'Staff', isActive: true,
  createdAt: '2026-01-01', granularPermissions: [{ moduleId: 'pupils', pages: [{ pageId: 'list', canAccess: true, actions: [] }] }] };
const items: NavigationItem[] = [
  { title: 'Pupils', icon: Home, section: 'Academics', items: [
    { title: 'Pupils Management', href: '/pupils', icon: Home },
    { title: 'Seed', href: DEV_CONTROL_PATHS.seeding, icon: Home },
  ] },
  { title: 'Payroll', href: '/payroll', icon: Home, section: 'Finance' },
  { title: 'Appearance', href: '/settings/look-and-feel', icon: Home, section: 'Administration' },
];

test('shared desktop/mobile menu retains permitted children without exposing admin or finance pages', () => {
  const visible = visibleSidebarItems(items, staff);
  assert.deepEqual(visible.map(item => item.title), ['Pupils', 'Appearance']);
  assert.ok(isNavGroup(visible[0]));
  assert.deepEqual(visible[0].items.map(item => item.href), ['/pupils']);
  assert.equal(isNavGroup(items[0]) && items[0].items.length, 2, 'Filtering never mutates the source menu');
});
test('signed-out and parent sessions have no staff sidebar destinations', () => {
  assert.deepEqual(visibleSidebarItems(items, null), []);
  assert.deepEqual(visibleSidebarItems(items, { ...staff, role: 'Parent' }), []);
});
test('administrators retain every configured destination', () => {
  assert.deepEqual(visibleSidebarItems(items, { ...staff, role: 'Admin' }), items);
});
test('selected state keeps fees management separate from collection and matches route boundaries', () => {
  assert.equal(isSidebarRouteActive('/fees/collect/synthetic', '/fees/collection'), true);
  assert.equal(isSidebarRouteActive('/fees/collect/synthetic', '/fees'), false);
  assert.equal(isSidebarRouteActive('/fees/analytics', '/fees'), true);
  assert.equal(isSidebarRouteActive('/staff/synthetic', '/staff'), true);
  assert.equal(isSidebarRouteActive('/staffing', '/staff'), false);
});

test('Reports is a shared Main Overview destination governed by its existing page permission', () => {
  const reportUser: SystemUser = { ...staff, granularPermissions: [{ moduleId: 'reports', pages: [{ pageId: 'reports', canAccess: true, actions: [] }] }] };
  const reports = visibleSidebarItems(navItems, reportUser).filter(item => 'href' in item && item.href === '/reports');
  assert.equal(reports.length, 1);
  assert.equal(reports[0].section, 'Overview');
  assert.equal(visibleSidebarItems(navItems, staff).some(item => 'href' in item && item.href === '/reports'), false);
  assert.equal(isSidebarRouteActive('/reports', '/reports'), true);
});
