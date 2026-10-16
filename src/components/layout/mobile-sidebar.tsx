"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import type { NavigationItem } from '@/types';
import { isNavItem } from '@/types';
import { useAuth } from '@/lib/contexts/auth-context';
import { useNavigation } from '@/lib/contexts/navigation-context';
import { useNavigationPrefetch } from '@/lib/hooks/use-navigation-prefetch';
import { workspaceCacheAccessScope } from '@/lib/startup/workspace-cache-access';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { useTouchSwipe } from '@/lib/hooks/use-touch-swipe';
import { sampleSchoolSettings } from '@/lib/sample-data';
import { SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { SidebarUserFooter } from './sidebar-user-footer';
import { SidebarNav } from './sidebar-nav';
import { visibleSidebarItems } from './sidebar-navigation';

interface MobileSidebarProps {
  items: NavigationItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ items, isOpen, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const { user, isSignedIdentityReady } = useAuth();
  const { startNavigation } = useNavigation();
  const { data: settings, isLoading: isLoadingSettings } = useSchoolSettings();
  const currentSettings = settings || sampleSchoolSettings;
  const [mounted, setMounted] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const closeSwipe = useTouchSwipe({ direction: 'left', onSwipe: onClose, enabled: isOpen });
  const filteredItems = visibleSidebarItems(items, user);
  const permittedRoutes = filteredItems.flatMap(item => isNavItem(item)
    ? item.disabled ? [] : [item.href]
    : item.items.filter(child => !child.disabled).map(child => child.href));
  const warmRoute = useNavigationPrefetch(permittedRoutes, pathname || '', user ? workspaceCacheAccessScope(user) : '', !!isSignedIdentityReady, isOpen);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted || !isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      // Portalled account menus handle their own Escape/focus lifecycle first.
      if (event.defaultPrevented) return;
      const activeOverlay = document.activeElement?.closest('[role="dialog"], [role="menu"], [role="listbox"]');
      if (event.key === 'Escape' && (!activeOverlay || activeOverlay === drawer.current)) { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const targets = Array.from(drawer.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') || [])
        .filter(element => element.offsetParent !== null && element.getAttribute('aria-disabled') !== 'true');
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [isOpen, mounted]);

  if (!mounted || !isOpen) return null;

  return <>
    <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
    <div ref={drawer} role="dialog" aria-modal="true" aria-label="School navigation"
      className="app-mobile-sidebar fixed top-0 left-0 z-50 flex h-[100dvh] w-64 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground"
      {...closeSwipe}>
      <SidebarHeader className="sidebar-school-header flex min-h-[56px] shrink-0 flex-row items-center gap-2.5 border-b border-gray-100 p-3 dark:border-slate-700">
        {!isLoadingSettings && currentSettings.generalInfo.logo && <Link href="/" aria-label="School home" onClick={event => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          startNavigation('Dashboard', '/'); onClose();
        }} className="sidebar-school-logo shrink-0">
          <div className="relative h-10 w-10"><Image src={currentSettings.generalInfo.logo}
            alt={`${currentSettings.generalInfo.name || 'School'} Logo`} fill sizes="40px" className="rounded-lg object-contain" /></div>
        </Link>}
        <div className="sidebar-school-name min-w-0 flex-1">
          {isLoadingSettings ? <div className="h-8 w-24 rounded bg-sidebar-accent" aria-label="Loading school settings" />
            : <h2 className="text-sm font-bold leading-tight break-words text-gray-900 dark:text-slate-100">{currentSettings.generalInfo.name || 'School Name'}</h2>}
        </div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Close sidebar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-400">
          <X size={16} aria-hidden="true" />
        </button>
      </SidebarHeader>
      <SidebarContent className="mobile-sidebar-scroll">
        <SidebarNav items={items} mobile onClose={onClose} onNavigate={startNavigation} onRouteIntent={warmRoute} />
      </SidebarContent>
      <SidebarFooter className="shrink-0 border-t border-gray-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-700">
        <SidebarUserFooter onCloseSidebar={onClose} />
      </SidebarFooter>
    </div>
  </>;
}
