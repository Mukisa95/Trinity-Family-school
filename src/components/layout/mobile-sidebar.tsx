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
import { sampleSchoolSettings } from '@/lib/sample-data';
import { SidebarUserFooter } from './sidebar-user-footer';
import { SchoolSettingsLoader } from './school-settings-loader';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getRoutePagePermission } from '@/types/permissions';

// Premium deeper color palettes matching desktop sidebar
const sectionColors: Record<string, { icon: string; text: string; activeBg: string; activeIcon: string }> = {
  Overview: {
    icon: 'text-blue-600 dark:text-blue-400 group-hover:text-blue-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-blue-50/80 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200 border border-blue-200/50 dark:border-blue-900/30 shadow-sm',
    activeIcon: 'text-blue-700 dark:text-blue-300'
  },
  Academics: {
    icon: 'text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-indigo-50/80 dark:bg-indigo-950/20 text-indigo-850 dark:text-indigo-200 border border-indigo-200/50 dark:border-indigo-900/30 shadow-sm',
    activeIcon: 'text-indigo-700 dark:text-indigo-300'
  },
  Finance: {
    icon: 'text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-850 dark:text-emerald-200 border border-emerald-200/50 dark:border-emerald-900/30 shadow-sm',
    activeIcon: 'text-emerald-700 dark:text-emerald-300'
  },
  Communications: {
    icon: 'text-rose-600 dark:text-rose-400 group-hover:text-rose-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-rose-50/80 dark:bg-rose-950/20 text-rose-850 dark:text-rose-200 border border-rose-200/50 dark:border-rose-900/30 shadow-sm',
    activeIcon: 'text-rose-700 dark:text-rose-300'
  },
  Administration: {
    icon: 'text-amber-600 dark:text-amber-400 group-hover:text-amber-750',
    text: 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900',
    activeBg: 'bg-amber-50/80 dark:bg-amber-950/20 text-amber-850 dark:text-amber-200 border border-amber-200/50 dark:border-amber-900/30 shadow-sm',
    activeIcon: 'text-amber-700 dark:text-amber-300'
  }
};

const defaultColors = {
  icon: 'text-slate-500 group-hover:text-slate-700',
  text: 'text-slate-700 group-hover:text-slate-900',
  activeBg: 'bg-blue-50 text-blue-800 border border-blue-200 shadow-sm',
  activeIcon: 'text-blue-700'
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

  // Swipe detection state for closing sidebar
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

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

  // Swipe detection functions for closing sidebar
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    const isRightToLeftSwipe = distanceX > 80; // Swipe from right to left (positive distance) - increased threshold
    const hasMinimumDistance = Math.abs(distanceX) > 50; // Swipe distance minimum
    
    // Only trigger if horizontal from right to left
    if (isHorizontalSwipe && isRightToLeftSwipe && hasMinimumDistance) {
      onClose();
    }
    
    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

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

    if (href === '/settings/firebase-usage') return user?.role === 'Admin';

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
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div 
        className="fixed top-0 left-0 z-50 h-full w-80 max-w-[85vw]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Glass morphism background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/95 via-white/90 to-blue-50/85 backdrop-blur-xl border-r border-white/20 shadow-2xl" />
        
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/3 to-pink-500/5 opacity-70" />
        
        {/* Content */}
        <div className="relative h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            {isLoadingSettings ? (
              <div className="flex items-center space-x-2 flex-1">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-pulse" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
                  <div className="h-2 w-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
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
                <h2 className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {currentSettings.generalInfo.name || "School Name"}
                </h2>
                {currentSettings.generalInfo.motto && (
                  <p className="text-xs text-gray-600 italic">
                    "{currentSettings.generalInfo.motto}"
                  </p>
                )}
              </div>
            </div>
            )}
            
            <button
              onClick={onClose}
              className="p-1 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg"
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
          <div className="p-3 border-t border-white/10 space-y-2">
            <div className="bg-white/10 p-1.5 rounded-lg border border-white/10">
              <SidebarUserFooter onCloseSidebar={onClose} />
            </div>
            <div className="text-center text-xs text-gray-500">
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
                : 'bg-white/40 hover:bg-white/60 border-white/20 text-slate-700 hover:text-slate-900',
              item.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className={cn(
              'p-1 rounded-lg flex items-center justify-center',
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : cn('bg-white/60', colors.icon)
            )}>
              <Icon size={12} />
            </div>
            <span className={cn(
              'text-sm font-medium',
              isActive ? 'text-blue-700' : 'text-slate-700'
            )}>
              {item.title}
            </span>
            {isActive && (
              <div className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
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
                : 'bg-white/40 hover:bg-white/60 border-white/20 text-slate-700 hover:text-slate-900'
            )}
          >
            <div className={cn(
              'p-1 rounded-lg flex items-center justify-center',
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : cn('bg-white/60', colors.icon)
            )}>
              <Icon size={12} />
            </div>
            <span className={cn(
              'text-sm font-medium flex-1 text-left',
              isActive ? 'text-blue-700' : 'text-slate-700'
            )}>
              {item.title}
            </span>
            <div
              className={cn(
                isOpen ? 'rotate-90' : 'rotate-0'
              )}
            >
              <ChevronRight size={12} className="text-slate-400 animate-pulse" />
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
                        <div className="flex items-center space-x-2 px-3 py-1 rounded-md bg-white/20 hover:bg-white/40 border border-white/10">
                          <SubIcon size={12} className={cn("shrink-0", colors.icon)} />
                          <span className="text-sm font-medium text-slate-700">
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
                            : 'bg-white/20 hover:bg-white/40 border-transparent text-slate-700'
                        )}>
                          <SubIcon size={14} className={cn(
                            'shrink-0 transition-colors duration-200',
                            isSubActive ? colors.activeIcon : colors.icon
                          )} />
                          <span className={cn(
                            'text-sm font-medium',
                            isSubActive ? 'text-blue-700' : 'text-slate-700'
                          )}>
                            {subItem.title}
                          </span>
                          {isSubActive && (
                            <div className="ml-auto w-1 h-1 bg-blue-600 rounded-full" />
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
