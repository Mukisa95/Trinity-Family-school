import type { NavigationItem, SystemUser } from '@/types';
import { isNavGroup, isNavItem } from '@/types';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getRoutePagePermission } from '@/types/permissions';
import { isDevControlPath } from '@/config/dev-control';

export function canUseSidebarRoute(user: SystemUser | null, href: string): boolean {
  if (!user || user.role === 'Parent') return false;
  if (user.role === 'Admin') return true;
  if (href === '/settings/look-and-feel') return true;
  if (href.startsWith('http://') || href.startsWith('https://')) return true;
  if (isDevControlPath(href)) return false;
  if (href === '/inventory') return GranularPermissionService.canAccessInventoryWorkspace(user);
  const permission = getRoutePagePermission(href);
  return Boolean(permission && GranularPermissionService.canAccessPage(user, permission.moduleId, permission.pageId));
}

/** The same permitted destinations drive both menus and route preparation. */
export function visibleSidebarItems(items: NavigationItem[], user: SystemUser | null): NavigationItem[] {
  const visible: NavigationItem[] = [];
  for (const item of items) {
    if (isNavItem(item) && canUseSidebarRoute(user, item.href)) visible.push(item);
    else if (isNavGroup(item)) {
      const children = item.items.filter(child => canUseSidebarRoute(user, child.href));
      if (children.length) visible.push({ ...item, items: children });
    }
  }
  return visible;
}

export function isSidebarRouteActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/fees/collection') return pathname === href || pathname.startsWith('/fees/collect');
  if (href === '/fees') return pathname === href || (pathname.startsWith('/fees/') && !pathname.startsWith('/fees/collect'));
  return href === '/' ? pathname === href : pathname === href || pathname.startsWith(href + '/');
}
