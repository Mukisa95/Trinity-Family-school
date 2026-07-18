"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useMemo } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';

// Premium deeper color palettes for each section's icons and active states
const sectionColors: Record<string, { icon: string; text: string; activeBg: string; activeIcon: string }> = {
  Overview: {
    icon: 'text-blue-600 dark:text-blue-400 group-hover:text-blue-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border border-blue-200/60 dark:border-blue-900/50 shadow-sm',
    activeIcon: 'text-blue-700 dark:text-blue-300'
  },
  Academics: {
    icon: 'text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-200 border border-indigo-200/60 dark:border-indigo-900/50 shadow-sm',
    activeIcon: 'text-indigo-700 dark:text-indigo-300'
  },
  Finance: {
    icon: 'text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-805 dark:text-emerald-205 border border-emerald-200/60 dark:border-emerald-900/50 shadow-sm',
    activeIcon: 'text-emerald-700 dark:text-emerald-300'
  },
  Communications: {
    icon: 'text-rose-600 dark:text-rose-400 group-hover:text-rose-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200/60 dark:border-rose-900/50 shadow-sm',
    activeIcon: 'text-rose-700 dark:text-rose-300'
  },
  Administration: {
    icon: 'text-amber-600 dark:text-amber-400 group-hover:text-amber-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-808 dark:text-amber-205 border border-amber-200/60 dark:border-amber-900/50 shadow-sm',
    activeIcon: 'text-amber-700 dark:text-amber-300'
  }
};

const defaultColors = {
  icon: 'text-slate-500 group-hover:text-slate-700',
  text: 'text-slate-700 group-hover:text-slate-900',
  activeBg: 'bg-blue-50 text-blue-800 border border-blue-200 shadow-sm',
  activeIcon: 'text-blue-700'
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

  if (!items?.length) return null;

  const isCollapsed = sidebarState === 'collapsed' && !isMobile;

  // ── Permission helpers ──────────────────────────────────────────────────────
  function checkItemPermission(href: string): boolean {
    if (href.startsWith('http://') || href.startsWith('https://')) return true;

    if (href === '/settings/firebase-usage' || href === '/settings/deployment') return user?.role === 'Admin';
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

  // ── Renderers ───────────────────────────────────────────────────────────────
  function renderItem(item: NavigationItem, index: number) {
    const section = item.section || 'Overview';
    const colors = sectionColors[section] || defaultColors;

    // ── Flat nav item ─────────────────────────────────────────────────────────
    if (isNavItem(item)) {
      const Icon = item.icon;
      const active = isItemActive(item.href);

      const content = (
        <Link
          href={item.disabled ? '#' : item.href}
          onClick={handleLinkClick}
          className={cn(
            'flex items-center rounded-lg text-sm font-medium w-full py-1.5 group',
            'transition-all ease-out duration-200 active:scale-[0.98]',
            !isCollapsed && 'hover:translate-x-[3px]',
            active
              ? colors.activeBg
              : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900',
            item.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
            isCollapsed ? 'justify-center px-2' : 'px-3'
          )}
        >
          <Icon
            size={18}
            className={cn(
              'shrink-0 transition-colors duration-200',
              active ? colors.activeIcon : colors.icon
            )}
          />
          <AnimatePresence initial={false} mode="popLayout">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                animate={{ opacity: 1, width: 'auto', marginLeft: 12 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="truncate text-left whitespace-nowrap overflow-hidden flex-1"
              >
                {item.title}
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {!isCollapsed && active && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"
              />
            )}
          </AnimatePresence>
        </Link>
      );

      if (isCollapsed) {
        return (
          <SidebarMenuItem 
            key={index} 
            className="sidebar-nav-item-enter" 
            style={{ animationDelay: `${index * 35}ms` }}
          >
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="font-semibold">
                {item.title}
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        );
      }

      return (
        <SidebarMenuItem 
          key={index} 
          className="sidebar-nav-item-enter" 
          style={{ animationDelay: `${index * 35}ms` }}
        >
          {content}
        </SidebarMenuItem>
      );
    }

    // ── Group nav item ────────────────────────────────────────────────────────
    if (isNavGroup(item)) {
      const Icon = item.icon;
      const isOpen = openGroups.has(item.title);
      const active = isGroupActive(item);

      const filteredSubs = item.items.filter(sub => checkItemPermission(sub.href));
      if (filteredSubs.length === 0) return null;

      // Collapsed: hover-triggered Popover so sub-items are fully clickable
      if (isCollapsed) {
        const isPopoverOpen = openPopovers.has(item.title);
        const openPopover  = () => setOpenPopovers(p => new Set(p).add(item.title));
        const closePopover = () => setOpenPopovers(p => { const n = new Set(p); n.delete(item.title); return n; });

        return (
          <SidebarMenuItem 
            key={index} 
            className="sidebar-nav-item-enter" 
            style={{ animationDelay: `${index * 35}ms` }}
          >
            <Popover open={isPopoverOpen} onOpenChange={open => open ? openPopover() : closePopover()}>
              <PopoverTrigger asChild>
                <button
                  onMouseEnter={openPopover}
                  onMouseLeave={closePopover}
                  className={cn(
                    'flex items-center justify-center w-full px-2 py-1.5 rounded-lg group',
                    'transition-all ease-out duration-200 active:scale-[0.98]',
                    active ? colors.activeBg : 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-800'
                  )}
                >
                  <Icon 
                    size={18} 
                    className={cn(
                      'shrink-0 transition-colors duration-200', 
                      active ? colors.activeIcon : colors.icon
                    )} 
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={8}
                className="p-0 w-48 shadow-lg border border-gray-100 rounded-lg overflow-hidden"
                onMouseEnter={openPopover}
                onMouseLeave={closePopover}
                onOpenAutoFocus={e => e.preventDefault()}
              >
                {/* Group title */}
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {item.title}
                  </p>
                </div>

                {/* Sub-items */}
                <div className="py-1">
                  {filteredSubs.map((sub, si) => {
                    const SubIcon = sub.icon;
                    const subActive = isItemActive(sub.href);

                    if (sub.external) {
                      return (
                        <a
                          key={si}
                          href={sub.title === 'WhatsApp Group' && schoolSettings?.socialMedia?.whatsapp
                            ? schoolSettings.socialMedia.whatsapp
                            : sub.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={closePopover}
                          className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-all ease-out duration-200 hover:translate-x-[3px] active:scale-[0.98]"
                        >
                          <SubIcon size={14} className={cn("shrink-0", colors.icon)} />
                          <span className="truncate">{sub.title}</span>
                        </a>
                      );
                    }

                    return (
                      <Link
                        key={si}
                        href={sub.disabled ? '#' : sub.href}
                        onClick={() => { closePopover(); handleLinkClick(); }}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-1.5 text-sm',
                          'transition-all ease-out duration-200 hover:translate-x-[3px] active:scale-[0.98]',
                          subActive
                            ? colors.activeBg + ' font-medium'
                            : 'text-slate-700 hover:bg-slate-50',
                          sub.disabled && 'opacity-50 pointer-events-none'
                        )}
                      >
                        <SubIcon
                          size={14}
                          className={cn('shrink-0', subActive ? colors.activeIcon : colors.icon)}
                        />
                        <span className="truncate">{sub.title}</span>
                        {subActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>
        );
      }


      // Expanded: group header + collapsible sub-items
      return (
        <SidebarMenuItem 
          key={index} 
          className="sidebar-nav-item-enter" 
          style={{ animationDelay: `${index * 35}ms` }}
        >
          {/* Group trigger */}
          <button
            onClick={() => toggleGroup(item.title)}
            className={cn(
              'flex items-center w-full py-1.5 rounded-lg text-sm font-medium group',
              'transition-all ease-out duration-200 active:scale-[0.98]',
              !isCollapsed && 'hover:translate-x-[3px]',
              active
                ? colors.activeBg
                : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900',
              isCollapsed ? 'justify-center px-2' : 'px-3'
            )}
          >
            <Icon
              size={18}
              className={cn('shrink-0 transition-colors duration-200', active ? colors.activeIcon : colors.icon)}
            />
            <AnimatePresence initial={false} mode="popLayout">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                  animate={{ opacity: 1, width: 'auto', marginLeft: 12 }}
                  exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="truncate text-left whitespace-nowrap overflow-hidden flex-1"
                >
                  {item.title}
                </motion.span>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="shrink-0 text-slate-500 ml-auto group-hover:text-slate-700"
                >
                  {isOpen ? (
                    <ChevronDown size={14} className="transition-transform duration-205" />
                  ) : (
                    <ChevronRight size={14} className="transition-transform duration-205" />
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Sub-items */}
          <AnimatePresence initial={false}>
            {isOpen && !isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="mt-0.5 ml-4 pl-3 border-l border-slate-200 space-y-0.5 overflow-hidden"
              >
                {filteredSubs.map((sub, si) => {
                  const SubIcon = sub.icon;
                  const subActive = isItemActive(sub.href);

                  if (sub.external) {
                    return (
                      <a
                        key={si}
                        href={sub.title === 'WhatsApp Group' && schoolSettings?.socialMedia?.whatsapp
                          ? schoolSettings.socialMedia.whatsapp
                          : sub.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3 py-1 rounded-md text-sm text-slate-750 hover:bg-slate-100 hover:text-slate-900 transition-all ease-out duration-200 hover:translate-x-[3px] active:scale-[0.98]"
                      >
                        <SubIcon size={14} className={cn("shrink-0", colors.icon)} />
                        <span className="truncate">{sub.title}</span>
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={si}
                      href={sub.disabled ? '#' : sub.href}
                      onClick={handleLinkClick}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-1 rounded-md text-sm',
                        'transition-all ease-out duration-200 hover:translate-x-[3px] active:scale-[0.98]',
                        subActive
                          ? colors.activeBg + ' font-semibold'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                        sub.disabled && 'opacity-50 pointer-events-none'
                      )}
                    >
                      <SubIcon
                        size={14}
                        className={cn('shrink-0', subActive ? colors.activeIcon : colors.icon)}
                      />
                      <span className="truncate">{sub.title}</span>
                      {subActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </SidebarMenuItem>
      );
    }

    return null;
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

  // If collapsed: render all items together in a flat list with no section dividers or headers
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <SidebarGroup className="p-0">
          <SidebarGroupContent className="px-2 py-1">
            <SidebarMenu className="gap-0.5">
              {filteredItems.map((item, index) => renderItem(item, index))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3 py-1">
        {groupedItems.map((group) => (
          <SidebarGroup key={group.id} className="p-0">
            {/* Header label when expanded - styled with deeper Slate colors */}
            <SidebarGroupLabel className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 tracking-wider px-4 py-1 uppercase select-none">
              {group.label}
            </SidebarGroupLabel>

            <SidebarGroupContent className="px-2">
              <SidebarMenu className="gap-0.5">
                {group.items.map((item, index) => renderItem(item, index))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </div>
    </TooltipProvider>
  );
}
