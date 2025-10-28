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
import { useNotificationBadge } from '@/lib/hooks/use-notification-badge';
import { FloatingNotificationBadge } from '@/components/ui/notification-badge';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { isNavGroup, isNavItem } from '@/types';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { sampleSchoolSettings } from '@/lib/sample-data';

interface MobileSidebarProps {
  items: NavigationItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ items, isOpen, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const { user, canAccessModule } = useAuth();
  const { isNavigating, startNavigation } = useNavigation();
  const { data: schoolSettings, error: settingsError } = useSchoolSettings();
  const { unreadCount } = useNotificationBadge();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Swipe detection state for closing sidebar
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const currentSettings = React.useMemo(() => {
    if (settingsError) {
      console.warn('Using sample school settings due to Firebase error:', settingsError);
    }
    return schoolSettings || sampleSchoolSettings;
  }, [schoolSettings, settingsError]);

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
    const hasMinimumDistance = Math.abs(distanceX) > 50; // Minimum swipe distance
    
    // Only trigger if it's a horizontal swipe from right to left
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
    // Allow external links (like WhatsApp)
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return true;
    }
    
    const moduleMap: Record<string, string> = {
      '/pupils': 'pupils',
      '/pupil-history': 'pupil_history',
      '/pupils/promote': 'promotion',
      '/enrollment-trends': 'pupils',
      '/classes': 'classes',
      '/staff': 'staff',
      '/subjects': 'subjects',
      '/fees': 'fees',
      '/fees/collection': 'fees',
      '/fees/collect': 'fees',
      '/fees/analytics': 'fees',
      '/exams': 'exams',
      '/events': 'events',
      '/attendance': 'attendance',
      '/academic-years': 'academic_years',
      '/users': 'users',
      '/access-levels': 'access_levels',
      '/banking/list': 'banking',
      '/banking': 'banking',
      '/bulk-sms': 'bulk_sms',
      '/notifications': 'notifications',
      '/procurement': 'procurement',
      '/procurement/items': 'procurement',
      '/procurement/purchases': 'procurement',
      '/procurement/budget': 'procurement',
      '/duty-service': 'duty_service',
      '/requirements': 'requirements',
      '/requirement-tracking': 'requirements',
      '/uniforms': 'uniforms',
      '/uniform-tracking': 'uniforms',
      '/about-school': 'settings',
      '/admin/photos': 'settings',
      '/admin/commentary-box': 'commentary',
    };
    
    const module = moduleMap[href];
    if (module) {
      return canAccessModule(module);
    }
    
    const allowedPaths = ['/', '/settings', '/admin'];
    return allowedPaths.includes(href) || href === '/';
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
            
            <button
              onClick={onClose}
              className="p-1 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg"
            >
              <X size={14} />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 mobile-sidebar-scroll">
            {filteredItems.map((item, index) => (
              <div key={index}>
                {renderNavItem(item, index)}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-white/10">
            <div className="text-center text-xs text-gray-500">
              <p>© {new Date().getFullYear()} Trinity Family School</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  function renderNavItem(item: NavigationItem, index: number) {
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
              'flex items-center space-x-1.5 px-2 py-1.5 rounded-lg',
              isActive
                ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/10 border border-blue-200/50 shadow-lg shadow-blue-500/10'
                : 'bg-white/40 hover:bg-white/60 border border-white/20',
              item.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className={cn(
              'p-1 rounded-lg',
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-white/60 text-gray-600'
            )}>
              <Icon size={12} />
            </div>
            <span className={cn(
              'text-sm font-medium',
              isActive ? 'text-blue-700' : 'text-gray-700'
            )}>
              {item.title}
            </span>
            {isActive && (
              <div className="ml-auto w-1.5 h-1.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
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
              'w-full flex items-center space-x-1.5 px-2 py-1.5 rounded-lg',
              isActive
                ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/10 border border-blue-200/50 shadow-lg shadow-blue-500/10'
                : 'bg-white/40 hover:bg-white/60 border border-white/20'
            )}
          >
            <div className={cn(
              'p-1 rounded-lg',
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-white/60 text-gray-600'
            )}>
              <Icon size={12} />
            </div>
            <span className={cn(
              'text-sm font-medium flex-1 text-left',
              isActive ? 'text-blue-700' : 'text-gray-700'
            )}>
              {item.title}
            </span>
            <div
              className={cn(
                isOpen ? 'rotate-90' : 'rotate-0'
              )}
            >
              <ChevronRight size={12} className="text-gray-400" />
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
                        href={subItem.href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={handleMenuItemClick(subItem.title)}
                      >
                        <div className="flex items-center space-x-2 px-3 py-2 rounded-md bg-white/20 hover:bg-white/40">
                          <SubIcon size={12} className="text-gray-500" />
                          <span className="text-sm font-medium text-gray-600">
                            {subItem.title}
                          </span>
                        </div>
                      </a>
                    ) : (
                      <Link href={subItem.disabled ? '#' : subItem.href} onClick={handleMenuItemClick(subItem.title)}>
                        <div className={cn(
                          'flex items-center space-x-2 px-3 py-2 rounded-md',
                          isSubActive
                            ? 'bg-gradient-to-r from-blue-400/20 to-purple-400/10 border-l-2 border-blue-400'
                            : 'bg-white/20 hover:bg-white/40'
                        )}>
                          <SubIcon size={14} className={cn(
                            isSubActive ? 'text-blue-600' : 'text-gray-500'
                          )} />
                          <span className={cn(
                            'text-sm font-medium',
                            isSubActive ? 'text-blue-700' : 'text-gray-600'
                          )}>
                            {subItem.title}
                          </span>
                          {/* Add notification badge for Notifications */}
                          {subItem.href === '/notifications' && unreadCount > 0 && (
                            <FloatingNotificationBadge
                              count={unreadCount}
                              size="sm"
                              position="top-right"
                              offset={4}
                            />
                          )}
                          {isSubActive && (
                            <div className="ml-auto w-1 h-1 bg-blue-500 rounded-full" />
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