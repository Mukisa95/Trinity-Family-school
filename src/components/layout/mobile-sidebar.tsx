"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { X, ChevronRight } from 'lucide-react';
import type { NavigationItem } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/auth-context';
import { useNavigation } from '@/lib/contexts/navigation-context';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { isNavGroup, isNavItem } from '@/types';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { useTouchSwipe } from '@/lib/hooks/use-touch-swipe';
import { sampleSchoolSettings } from '@/lib/sample-data';
import { SidebarUserFooter } from './sidebar-user-footer';
import { SchoolSettingsLoader } from './school-settings-loader';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getRoutePagePermission } from '@/types/permissions';
import { isDevControlPath } from '@/config/dev-control';

// Premium deeper color palettes matching desktop sidebar
const sectionColors: Record<string, { icon: string; text: string; activeBg: string; activeIcon: string }> = {
  Overview: {
    icon: 'text-brand-ink-600 dark:text-brand-ink-400 group-hover:text-brand-ink-700',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-none',
    activeIcon: 'text-brand-ink-700 dark:text-brand-ink-300'
  },
  Academics: {
    icon: 'text-brand-alt-ink-600 dark:text-brand-alt-ink-400 group-hover:text-brand-alt-ink-700',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-none',
    activeIcon: 'text-brand-alt-ink-700 dark:text-brand-alt-ink-300'
  },
  Finance: {
    icon: 'text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-none',
    activeIcon: 'text-emerald-700 dark:text-emerald-300'
  },
  Communications: {
    icon: 'text-rose-600 dark:text-rose-400 group-hover:text-rose-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-none',
    activeIcon: 'text-rose-700 dark:text-rose-300'
  },
  Administration: {
    icon: 'text-amber-600 dark:text-amber-400 group-hover:text-amber-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
    activeBg: 'bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-none',
    activeIcon: 'text-amber-700 dark:text-amber-300'
  }
};

const defaultColors = {
  icon: 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200',
  text: 'text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-slate-100',
  activeBg: 'bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-none',
  activeIcon: 'text-brand-ink-700 dark:text-brand-ink-300'
};

interface MobileSidebarProps {
  items: NavigationItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ items, isOpen, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isNavigating, startNavigation } = useNavigation();
  const { data: schoolSettings, error: settingsError, isLoading: isLoadingSettings } = useSchoolSettings();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  const closeSwipe = useTouchSwipe({ direction: 'left', onSwipe: onClose, enabled: isOpen });

  const currentSettings = React.useMemo(() => {
    // If still loading, don't use fallback yet - wait for the query to finish
    if (isLoadingSettings) {
      return sampleSchoolSettings; // Temporary fallback while loading
    }
    
    // If we have real data, use it
    if (schoolSettings) {
      return schoolSettings;
    }
    
    // Only use sample data if query finished and we have no data
    if (settingsError) {
      console.warn('Using sample school settings due to Firebase error:', settingsError);
    } else {
      console.warn('Using sample school settings - no data found in Firebase');
    }
    return sampleSchoolSettings;
  }, [schoolSettings, settingsError, isLoadingSettings]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Filter items based on user permissions
  const filteredItems = items.filter(item => {
    if (!user) return false;
    
    if (user.role === 'Admin') return true;
    if (user.role === 'Parent') return false;
    
    if (isNavItem(item)) {
      return checkItemPermission(item.href);
    } else if (isNavGroup(item)) {
      return item.items.some(subItem => checkItemPermission(subItem.href));
    }
    
    return false;
  });

  function checkItemPermission(href: string): boolean {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return true;
    }

    if (isDevControlPath(href)) return user?.role === 'Admin';
    if (href === '/inventory') return GranularPermissionService.canAccessInventoryWorkspace(user);

    const routePermission = getRoutePagePermission(href);
    if (routePermission) {
      return GranularPermissionService.canAccessPage(user, routePermission.moduleId, routePermission.pageId);
    }

    return false;
  }

  function toggleGroup(groupTitle: string) {
    setOpenGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupTitle)) {
        newSet.delete(groupTitle);
      } else {
        newSet.add(groupTitle);
      }
      return newSet;
    });
  }

  function isGroupActive(group: NavigationItem): boolean {
    if (isNavGroup(group)) {
      return group.items.some(item => {
        if (!pathname) return false;
        if (item.href === '/fees/collection') {
          return pathname === '/fees/collection' || pathname.startsWith('/fees/collect');
        } else if (item.href === '/fees') {
          return pathname === '/fees' || (pathname.startsWith('/fees/') && !pathname.startsWith('/fees/collection') && !pathname.startsWith('/fees/collect'));
        } else {
          return item.href === '/' ? pathname === item.href : pathname.startsWith(item.href);
        }
      });
    }
    return false;
  }

  function handleMenuItemClick(destination?: string) {
    return () => {
      startNavigation(destination); // Start navigation loading with destination
      onClose();
    };
  }

  if (!mounted || !isOpen) return null;

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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div 
        className="app-mobile-sidebar fixed top-0 left-0 z-50 h-full w-80 max-w-[85vw] bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
        {...closeSwipe}
      >
        {/* Content shares the solid, outlined theme surface. */}
        <div className="relative h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/10 dark:border-slate-700/10">
            {isLoadingSettings ? (
              <div className="flex items-center space-x-2 flex-1">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden">
                  <div className="absolute inset-0 bg-muted animate-pulse" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-2 w-20 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ) : (
            <div className="flex items-center space-x-2">
              {currentSettings.generalInfo.logo && (
                <div className="relative w-8 h-8">
                  <Image
                    src={currentSettings.generalInfo.logo}
                    alt={`${currentSettings.generalInfo.name || 'School'} Logo`}
                    fill
                    sizes="32px"
                    className="rounded-lg object-contain"
                  />
                </div>
              )}
              <div>
                <h2 className="text-sm font-bold text-foreground ">
                  {currentSettings.generalInfo.name || "School Name"}
                </h2>
                {currentSettings.generalInfo.motto && (
                  <p className="text-xs text-gray-600 italic dark:text-slate-300">
                    "{currentSettings.generalInfo.motto}"
                  </p>
                )}
              </div>
            </div>
            )}
            
            <button
              onClick={onClose}
              aria-label="Close sidebar"
              className="p-1 rounded-full bg-accent text-accent-foreground border border-border shadow-none"
            >
              <X size={14} />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-2.5 mobile-sidebar-scroll">
            {groupedItems.map((group) => (
              <div key={group.id} className="space-y-1">
                <h3 className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 tracking-wider px-2 py-0.5 uppercase select-none">
                  {group.label}
                </h3>
                <div className="space-y-0.5">
                  {group.items.map((item, index) => (
                    <div key={index}>
                      {renderNavItem(item, index)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-white/10 space-y-2 dark:border-slate-700/10">
            <div className="bg-white/10 p-1.5 rounded-lg border border-white/10 dark:bg-slate-900/10 dark:border-slate-700/10">
              <SidebarUserFooter onCloseSidebar={onClose} />
            </div>
            <div className="text-center text-xs text-gray-500 dark:text-slate-400">
              <p>© {new Date().getFullYear()} Trinity Family School</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  function renderNavItem(item: NavigationItem, index: number) {
    const section = item.section || 'Overview';
    const colors = sectionColors[section] || defaultColors;

    if (isNavItem(item)) {
      const Icon = item.icon;
      
      let isActive: boolean;
      if (!pathname) {
        isActive = false;
      } else if (item.href === '/fees/collection') {
        isActive = pathname === '/fees/collection' || pathname.startsWith('/fees/collect');
      } else if (item.href === '/fees') {
        isActive = pathname === '/fees' || (pathname.startsWith('/fees/') && !pathname.startsWith('/fees/collection') && !pathname.startsWith('/fees/collect'));
      } else {
        isActive = item.href === '/' ? pathname === item.href : pathname.startsWith(item.href);
      }

      return (
        <Link href={item.disabled ? '#' : item.href} onClick={handleMenuItemClick(item.title)}>
          <div
            className={cn(
              'flex items-center space-x-1.5 px-2 py-1 rounded-lg border transition-all ease-out duration-200 active:scale-[0.98]',
              isActive
                ? colors.activeBg
                : 'bg-sidebar text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              item.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className={cn(
              'p-1 rounded-lg flex items-center justify-center',
              isActive
                ? 'bg-accent text-accent-foreground border border-border shadow-none'
                : cn('bg-white/60 dark:bg-slate-900/60', colors.icon)
            )}>
              <Icon size={12} />
            </div>
            <span className={cn(
              'text-sm font-medium',
              isActive ? 'text-brand-ink-700 dark:text-brand-ink-300' : 'text-slate-700 dark:text-slate-200'
            )}>
              {item.title}
            </span>
            {isActive && (
              <div className="ml-auto w-1.5 h-1.5 bg-brand-surface-600 rounded-full" />
            )}
            {isNavigating && (
              <LoadingIndicator 
                isLoading={true} 
                size="sm" 
                className="ml-auto"
                text=""
              />
            )}
          </div>
        </Link>
      );
    } else if (isNavGroup(item)) {
      const Icon = item.icon;
      const isOpen = openGroups.has(item.title);
      const isActive = isGroupActive(item);
      
      const filteredSubItems = item.items.filter(subItem => checkItemPermission(subItem.href));
      
      if (filteredSubItems.length === 0) return null;

      return (
        <div>
          <button
            onClick={() => toggleGroup(item.title)}
            className={cn(
              'w-full flex items-center space-x-1.5 px-2 py-1 rounded-lg border transition-all ease-out duration-200 active:scale-[0.98]',
              isActive
                ? colors.activeBg
                : 'bg-sidebar text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <div className={cn(
              'p-1 rounded-lg flex items-center justify-center',
              isActive
                ? 'bg-accent text-accent-foreground border border-border shadow-none'
                : cn('bg-white/60 dark:bg-slate-900/60', colors.icon)
            )}>
              <Icon size={12} />
            </div>
            <span className={cn(
              'text-sm font-medium flex-1 text-left',
              isActive ? 'text-brand-ink-700 dark:text-brand-ink-300' : 'text-slate-700 dark:text-slate-200'
            )}>
              {item.title}
            </span>
            <div
              className={cn(
                isOpen ? 'rotate-90' : 'rotate-0'
              )}
            >
              <ChevronRight size={12} className="text-slate-400 animate-pulse dark:text-slate-400" />
            </div>
          </button>

          {isOpen && (
            <div className="ml-2 mt-1 space-y-1">
              {filteredSubItems.map((subItem, subIndex) => {
                const SubIcon = subItem.icon;
                
                let isSubActive: boolean;
                if (!pathname) {
                  isSubActive = false;
                } else if (subItem.href === '/fees/collection') {
                  isSubActive = pathname === '/fees/collection' || pathname.startsWith('/fees/collect');
                } else if (subItem.href === '/fees') {
                  isSubActive = pathname === '/fees' || (pathname.startsWith('/fees/') && !pathname.startsWith('/fees/collection') && !pathname.startsWith('/fees/collect'));
                } else {
                  isSubActive = subItem.href === '/' ? pathname === subItem.href : pathname.startsWith(subItem.href);
                }
                
                return (
                  <div key={subIndex}>
                    {subItem.external ? (
                      <a 
                        href={subItem.title === 'WhatsApp Group' && currentSettings?.socialMedia?.whatsapp ? currentSettings.socialMedia.whatsapp : subItem.href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={handleMenuItemClick(subItem.title)}
                      >
                        <div className="flex items-center space-x-2 px-3 py-1 rounded-md bg-white/20 hover:bg-white/40 border border-white/10 dark:bg-slate-900/20 dark:hover:bg-slate-900/40 dark:border-slate-700/10">
                          <SubIcon size={12} className={cn("shrink-0", colors.icon)} />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {subItem.title}
                          </span>
                        </div>
                      </a>
                    ) : (
                      <Link href={subItem.disabled ? '#' : subItem.href} onClick={handleMenuItemClick(subItem.title)}>
                        <div className={cn(
                          'flex items-center space-x-2 px-3 py-1 rounded-md border',
                          isSubActive
                            ? colors.activeBg + ' font-semibold'
                            : 'bg-white/20 hover:bg-white/40 border-transparent text-slate-700 dark:bg-slate-900/20 dark:hover:bg-slate-900/40 dark:text-slate-200'
                        )}>
                          <SubIcon size={14} className={cn(
                            'shrink-0 transition-colors duration-200',
                            isSubActive ? colors.activeIcon : colors.icon
                          )} />
                          <span className={cn(
                            'text-sm font-medium',
                            isSubActive ? 'text-brand-ink-700 dark:text-brand-ink-300' : 'text-slate-700 dark:text-slate-200'
                          )}>
                            {subItem.title}
                          </span>
                          {isSubActive && (
                            <div className="ml-auto w-1 h-1 bg-brand-surface-600 rounded-full" />
                          )}
                          {isNavigating && (
                            <LoadingIndicator 
                              isLoading={true} 
                              size="sm" 
                              className="ml-auto"
                              text=""
                            />
                          )}
                        </div>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  }
}
