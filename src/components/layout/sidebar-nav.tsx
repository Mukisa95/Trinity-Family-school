"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useId } from 'react';
import { usePerformanceMode } from '@/components/providers/performance-provider';
import type { NavigationItem } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/auth-context';
import { isNavGroup, isNavItem } from '@/types';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getRoutePagePermission } from '@/types/permissions';
import { isDevControlPath } from '@/config/dev-control';

// Premium deeper color palettes for each section's icons and active states
const sectionColors: Record<string, { icon: string; text: string; activeBg: string; activeIcon: string }> = {
  Overview: {
    icon: 'text-brand-ink-600 dark:text-brand-ink-400 group-hover:text-brand-ink-700',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-brand-surface-50 dark:bg-brand-surface-950/30 text-brand-ink-800 dark:text-brand-ink-200 border border-brand-200/60 dark:border-brand-900/50 shadow-sm',
    activeIcon: 'text-brand-ink-700 dark:text-brand-ink-300'
  },
  Academics: {
    icon: 'text-brand-alt-ink-600 dark:text-brand-alt-ink-400 group-hover:text-brand-alt-ink-700',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-brand-alt-surface-50 dark:bg-brand-alt-surface-950/30 text-brand-alt-ink-800 dark:text-brand-alt-ink-200 border border-brand-alt-200/60 dark:border-brand-alt-900/50 shadow-sm',
    activeIcon: 'text-brand-alt-ink-700 dark:text-brand-alt-ink-300'
  },
  Finance: {
    icon: 'text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-805 dark:text-emerald-205 border border-emerald-200/60 dark:border-emerald-900/50 shadow-sm',
    activeIcon: 'text-emerald-700 dark:text-emerald-300'
  },
  Communications: {
    icon: 'text-rose-600 dark:text-rose-400 group-hover:text-rose-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200/60 dark:border-rose-900/50 shadow-sm',
    activeIcon: 'text-rose-700 dark:text-rose-300'
  },
  Administration: {
    icon: 'text-amber-600 dark:text-amber-400 group-hover:text-amber-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-808 dark:text-amber-205 border border-amber-200/60 dark:border-amber-900/50 shadow-sm',
    activeIcon: 'text-amber-700 dark:text-amber-300'
  }
};

const defaultColors = {
  icon: 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200',
  text: 'text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-slate-100',
  activeBg: 'bg-brand-surface-50 text-brand-ink-800 border border-brand-200 shadow-sm dark:bg-brand-surface-950/40 dark:text-brand-ink-200 dark:border-brand-800/60',
  activeIcon: 'text-brand-ink-700 dark:text-brand-ink-300'
};

interface SidebarNavProps {
  items: NavigationItem[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const { data: schoolSettings } = useSchoolSettings();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openPopovers, setOpenPopovers] = useState<Set<string>>(new Set());
  const groupId = useId();
  const { reducedEffects, saveData } = usePerformanceMode();
  const prefetch = reducedEffects || saveData ? false : undefined;

  if (!items?.length) return null;

  const isCollapsed = sidebarState === 'collapsed' && !isMobile;

  // ── Permission helpers ──────────────────────────────────────────────────────
  function checkItemPermission(href: string): boolean {
    // Personal appearance settings do not grant access to school administration.
    if (href === '/settings/look-and-feel') return Boolean(user);
    if (href.startsWith('http://') || href.startsWith('https://')) return true;

    if (isDevControlPath(href)) return user?.role === 'Admin';
    if (href === '/inventory') return GranularPermissionService.canAccessInventoryWorkspace(user);
    const routePermission = getRoutePagePermission(href);
    if (routePermission) {
      return GranularPermissionService.canAccessPage(user, routePermission.moduleId, routePermission.pageId);
    }

    return false;
  }

  // ── Active state ────────────────────────────────────────────────────────────
  function isItemActive(href: string): boolean {
    if (!pathname) return false;
    if (href === '/fees/collection') return pathname === '/fees/collection' || pathname.startsWith('/fees/collect');
    if (href === '/fees') return pathname === '/fees' || (pathname.startsWith('/fees/') && !pathname.startsWith('/fees/collection') && !pathname.startsWith('/fees/collect'));
    return href === '/' ? pathname === href : pathname.startsWith(href);
  }

  // Helper to determine if a group (sub-menu) is active
  const isGroupActive = (group: NavigationItem): boolean => {
    if (!isNavGroup(group)) return false;
    return group.items.some(item => isItemActive(item.href));
  };

  // ── Filter by permissions ───────────────────────────────────────────────────
  const filteredItems = items.filter(item => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (user.role === 'Parent') return false;
    if (isNavItem(item)) return checkItemPermission(item.href);
    if (isNavGroup(item)) return item.items.some(sub => checkItemPermission(sub.href));
    return false;
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  function toggleGroup(title: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  }

  function handleLinkClick() {
    if (isMobile) setOpenMobile(false);
  }

  // Keep section, item, link and trigger identities stable across sidebar toggles.
  function renderItem(item: NavigationItem) {
    const colors = sectionColors[item.section || 'Overview'] || defaultColors;
    const Icon = item.icon;
    const row = cn('flex items-center w-full py-1.5 rounded-lg text-sm font-medium group transition-colors duration-150',
      isCollapsed ? 'justify-center px-2' : 'px-3');
    if (isNavItem(item)) {
      const active = isItemActive(item.href);
      return <SidebarMenuItem key={item.href}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={item.disabled ? '#' : item.href} prefetch={prefetch} onClick={handleLinkClick} aria-label={item.title}
              aria-current={active ? 'page' : undefined} aria-disabled={item.disabled || undefined}
              className={cn(row, active ? colors.activeBg : 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-900/70', item.disabled && 'opacity-50 pointer-events-none')}>
              <Icon size={18} className={cn('shrink-0', active ? colors.activeIcon : colors.icon)} />
              <span className={cn('ml-3 truncate text-left flex-1', isCollapsed && 'hidden')}>{item.title}</span>
              <span className={cn('ml-auto w-1.5 h-1.5 rounded-full bg-brand-surface-600 shrink-0', (!active || isCollapsed) && 'hidden')} />
            </Link>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right" sideOffset={12}>{item.title}</TooltipContent>}
        </Tooltip>
      </SidebarMenuItem>;
    }
    if (!isNavGroup(item)) return null;
    const subs = item.items.filter(sub => checkItemPermission(sub.href));
    if (!subs.length) return null;
    const active = isGroupActive(item);
    const isOpen = openGroups.has(item.title);
    const popoverOpen = isCollapsed && openPopovers.has(item.title);
    const openPopover = () => { if (isCollapsed) setOpenPopovers(previous => new Set(previous).add(item.title)); };
    const closePopover = () => setOpenPopovers(previous => { const next = new Set(previous); next.delete(item.title); return next; });
    const contentId = `${groupId}-${item.title.replace(/\s+/g, '-')}`;
    const links = (inPopover: boolean) => subs.map(sub => {
      const SubIcon = sub.icon;
      const subActive = isItemActive(sub.href);
      const className = cn('flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors duration-150',
        subActive ? colors.activeBg + ' font-semibold' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900',
        sub.disabled && 'opacity-50 pointer-events-none');
      const content = <><SubIcon size={14} className={cn('shrink-0', subActive ? colors.activeIcon : colors.icon)} /><span className="truncate">{sub.title}</span></>;
      const onClick = () => { if (inPopover) closePopover(); handleLinkClick(); };
      return sub.external
        ? <a key={sub.href} href={sub.title === 'WhatsApp Group' && schoolSettings?.socialMedia?.whatsapp ? schoolSettings.socialMedia.whatsapp : sub.href}
            target="_blank" rel="noopener noreferrer" className={className} onClick={onClick} aria-disabled={sub.disabled || undefined}>{content}</a>
        : <Link key={sub.href} href={sub.disabled ? '#' : sub.href} prefetch={prefetch} className={className} onClick={onClick}
            aria-current={subActive ? 'page' : undefined} aria-disabled={sub.disabled || undefined}>{content}</Link>;
    });
    return <SidebarMenuItem key={item.title}>
      <Popover open={popoverOpen} onOpenChange={open => open ? openPopover() : closePopover()}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={item.title} aria-expanded={isCollapsed ? popoverOpen : isOpen}
            aria-controls={isCollapsed ? undefined : contentId}
            onClick={event => { if (!isCollapsed) { event.preventDefault(); closePopover(); toggleGroup(item.title); } }}
            onMouseEnter={openPopover} onMouseLeave={() => { if (isCollapsed) closePopover(); }}
            className={cn(row, active ? colors.activeBg : 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-900/70')}>
            <Icon size={18} className={cn('shrink-0', active ? colors.activeIcon : colors.icon)} />
            <span className={cn('ml-3 truncate text-left flex-1', isCollapsed && 'hidden')}>{item.title}</span>
            <ChevronDown size={14} className={cn('ml-auto shrink-0', !isOpen && '-rotate-90', isCollapsed && 'hidden')} />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8} className="p-0 w-48 overflow-hidden rounded-lg"
          onMouseEnter={openPopover} onMouseLeave={closePopover} onOpenAutoFocus={event => event.preventDefault()}>
          <div className="px-3 py-2 border-b text-xs font-bold uppercase">{item.title}</div>
          <div className="py-1">{links(true)}</div>
        </PopoverContent>
      </Popover>
      <div id={contentId} hidden={!isOpen || isCollapsed} className="mt-0.5 ml-4 pl-3 border-l border-slate-200 space-y-0.5 dark:border-slate-700">{links(false)}</div>
    </SidebarMenuItem>;
  }

  // Group items by section
  const sections = [
    { id: 'Overview', label: 'Main Overview' },
    { id: 'Academics', label: 'Academic Management' },
    { id: 'Finance', label: 'Finance & Operations' },
    { id: 'Communications', label: 'Communications' },
    { id: 'Administration', label: 'Administration' },
  ];

  const groupedItems = sections.map(sec => {
    const secItems = filteredItems.filter(item => item.section === sec.id);
    return {
      ...sec,
      items: secItems
    };
  }).filter(group => group.items.length > 0);

  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={300}>
      <div className={isCollapsed ? 'space-y-0 py-1' : 'space-y-3 py-1'}>
        {groupedItems.map(group => (
          <SidebarGroup key={group.id} className="p-0">
            <SidebarGroupLabel className={cn('text-[11px] font-extrabold text-slate-700 dark:text-slate-300 tracking-wider px-4 py-1 uppercase select-none', isCollapsed && 'hidden')}>
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-2">
              <SidebarMenu className="gap-0.5">{group.items.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </div>
    </TooltipProvider>
  );
}
