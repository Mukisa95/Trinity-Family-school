"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext, useId, useState, type MouseEvent } from 'react';
import type { NavigationItem, NavItem } from '@/types';
import { isNavItem } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { SidebarContext, SidebarMenu, SidebarMenuItem, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronRight } from 'lucide-react';
import { isSidebarRouteActive, visibleSidebarItems } from './sidebar-navigation';

const sectionIcons: Record<string, string> = {
  Overview: 'text-brand-ink-600 dark:text-brand-ink-400 group-hover:text-brand-ink-700',
  Academics: 'text-brand-alt-ink-600 dark:text-brand-alt-ink-400 group-hover:text-brand-alt-ink-700',
  Finance: 'text-emerald-600 dark:text-emerald-400',
  Communications: 'text-rose-600 dark:text-rose-400',
  Administration: 'text-amber-600 dark:text-amber-400',
};
const activeIcons: Record<string, string> = {
  Overview: 'text-brand-ink-700 dark:text-brand-ink-300',
  Academics: 'text-brand-alt-ink-700 dark:text-brand-alt-ink-300',
  Finance: 'text-emerald-700 dark:text-emerald-300',
  Communications: 'text-rose-700 dark:text-rose-300',
  Administration: 'text-amber-700 dark:text-amber-300',
};
const sections = [
  { id: 'Overview', label: 'Main Overview' },
  { id: 'Academics', label: 'Academic Management' },
  { id: 'Finance', label: 'Finance & Operations' },
  { id: 'Communications', label: 'Communications' },
  { id: 'Administration', label: 'Administration' },
];
const activeStyle = 'bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-none';
const inactiveStyle = 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-900/70 dark:hover:text-slate-100';

interface SidebarNavProps {
  items: NavigationItem[];
  mobile?: boolean;
  onClose?: () => void;
  onNavigate?: (destination: string, href: string) => void;
  onRouteIntent?: (href: string) => void;
}

export function SidebarNav({ items, mobile = false, onClose, onNavigate, onRouteIntent }: SidebarNavProps) {
  const pathname = usePathname();
  // The custom mobile drawer lives outside SidebarProvider.
  const sidebar = useContext(SidebarContext);
  const { user } = useAuth();
  const { data: schoolSettings } = useSchoolSettings();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openPopovers, setOpenPopovers] = useState<Set<string>>(new Set());
  const id = useId();
  const isCollapsed = !mobile && sidebar?.state === 'collapsed' && !sidebar.isMobile;
  const filteredItems = visibleSidebarItems(items, user);

  function closeMenu() {
    if (onClose) onClose();
    else if (sidebar?.isMobile) sidebar.setOpenMobile(false);
  }

  function handleLink(event: MouseEvent<HTMLAnchorElement>, item: NavItem, closePopover?: () => void) {
    if (item.disabled) { event.preventDefault(); return; }
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    closePopover?.();
    if (!item.external && !event.currentTarget.target && item.href.startsWith('/') && !item.href.startsWith('//')) onNavigate?.(item.title, item.href);
    closeMenu();
  }

  function renderLink(item: NavItem, section: string, sub = false, closePopover?: () => void) {
    const Icon = item.icon;
    const active = isSidebarRouteActive(pathname, item.href);
    const className = cn(
      'sidebar-nav-link flex w-full items-center rounded-lg text-sm group',
      sub ? 'gap-2.5 px-3 py-1 font-normal' : 'px-3 py-1.5 font-medium',
      isCollapsed && !sub && 'justify-center px-2',
      active ? cn(activeStyle, sub && 'font-semibold') : inactiveStyle,
      item.disabled && 'opacity-50 cursor-not-allowed',
    );
    const href = item.title === 'WhatsApp Group' && schoolSettings?.socialMedia?.whatsapp ? schoolSettings.socialMedia.whatsapp : item.href;
    const content = <>
      <Icon size={sub ? 14 : 18} className={cn('shrink-0', active ? activeIcons[section] : sectionIcons[section])} aria-hidden="true" />
      {(!isCollapsed || sub) && <span className={cn('truncate text-left whitespace-nowrap flex-1', !sub && 'ml-3')}>{item.title}</span>}
      {(!isCollapsed || sub) && active && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand-surface-600" />}
    </>;
    const props = {
      className,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => handleLink(event, item, closePopover),
      onTouchStart: () => !item.disabled && onRouteIntent?.(item.href),
      onFocus: () => !item.disabled && onRouteIntent?.(item.href),
      'aria-current': active ? 'page' as const : undefined,
      'aria-disabled': item.disabled || undefined,
    };
    return item.external ? <a {...props} href={href} target="_blank" rel="noopener noreferrer">{content}</a>
      : <Link {...props} href={item.disabled ? '#' : href}>{content}</Link>;
  }

  function setPopover(title: string, open: boolean) {
    setOpenPopovers(previous => { const next = new Set(previous); open ? next.add(title) : next.delete(title); return next; });
  }

  function renderItem(item: NavigationItem, index: number) {
    const section = item.section || 'Overview';
    // Short, capped stagger: a long menu never waits for preceding rows.
    const entrance = { className: 'sidebar-nav-item-enter', style: { animationDelay: `${Math.min(index, 3) * 30}ms` } };
    if (isNavItem(item)) {
      const content = renderLink(item, section);
      return <SidebarMenuItem key={item.href} {...entrance}>
        {isCollapsed ? <Tooltip delayDuration={100}><TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12} className="font-semibold">{item.title}</TooltipContent></Tooltip> : content}
      </SidebarMenuItem>;
    }

    const Icon = item.icon;
    const active = item.items.some(child => isSidebarRouteActive(pathname, child.href));
    const open = openGroups.has(item.title);
    const contentId = `${id}-${section}-${index}`;
    if (isCollapsed) {
      const close = () => setPopover(item.title, false);
      return <SidebarMenuItem key={item.title} {...entrance}>
        <Popover open={openPopovers.has(item.title)} onOpenChange={value => setPopover(item.title, value)}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={item.title}
              onMouseEnter={event => { if (matchMedia('(hover: hover) and (pointer: fine)').matches && event.buttons === 0) setPopover(item.title, true); }}
              className={cn('sidebar-nav-link flex w-full items-center justify-center rounded-lg px-2 py-1.5 group', active ? activeStyle : inactiveStyle)}>
              <Icon size={18} className={cn('shrink-0', active ? activeIcons[section] : sectionIcons[section])} aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" sideOffset={8}
            className="w-48 overflow-hidden rounded-lg border border-gray-100 p-0 shadow-lg dark:border-slate-700"
            onMouseLeave={() => { if (matchMedia('(hover: hover) and (pointer: fine)').matches) close(); }}>
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{item.title}</p>
            </div>
            <div className="py-1">{item.items.map(child => <div key={child.href}>{renderLink(child, section, true, close)}</div>)}</div>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>;
    }

    return <SidebarMenuItem key={item.title} {...entrance}>
      <button type="button" aria-expanded={open} aria-controls={contentId}
        onClick={() => setOpenGroups(previous => { const next = new Set(previous); open ? next.delete(item.title) : next.add(item.title); return next; })}
        className={cn('sidebar-nav-link flex w-full items-center rounded-lg px-3 py-1.5 text-sm font-medium group', active ? activeStyle : inactiveStyle)}>
        <Icon size={18} className={cn('shrink-0', active ? activeIcons[section] : sectionIcons[section])} aria-hidden="true" />
        <span className="ml-3 flex-1 truncate text-left whitespace-nowrap">{item.title}</span>
        <ChevronRight size={14} aria-hidden="true" className="sidebar-nav-chevron ml-auto shrink-0 text-slate-500 dark:text-slate-400" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }} />
      </button>
      {open && <div id={contentId} className="sidebar-nav-submenu mt-0.5 ml-4 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
        {item.items.map(child => <div key={child.href}>{renderLink(child, section, true)}</div>)}
      </div>}
    </SidebarMenuItem>;
  }

  return <TooltipProvider>
    <nav aria-label="Main navigation" className="sidebar-navigation">
      {isCollapsed ? <SidebarGroup className="p-0"><SidebarGroupContent className="px-2 py-1">
        <SidebarMenu className="gap-0.5">{filteredItems.map(renderItem)}</SidebarMenu>
      </SidebarGroupContent></SidebarGroup> : <div className="space-y-3 py-1">
        {sections.map(section => {
          const children = filteredItems.filter(item => (item.section || 'Overview') === section.id);
          return children.length > 0 && <SidebarGroup key={section.id} className="p-0">
            <SidebarGroupLabel className="px-4 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-700 select-none dark:text-slate-300">{section.label}</SidebarGroupLabel>
            <SidebarGroupContent className="px-2"><SidebarMenu className="gap-0.5">{children.map(renderItem)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>;
        })}
      </div>}
    </nav>
  </TooltipProvider>;
}
