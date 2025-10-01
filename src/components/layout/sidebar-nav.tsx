"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import type { NavigationItem } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/auth-context';
import { useNavigation } from '@/lib/contexts/navigation-context';
import { useNotificationBadge } from '@/lib/hooks/use-notification-badge';
import { FloatingNotificationBadge } from '@/components/ui/notification-badge';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { isNavGroup, isNavItem } from '@/types';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SidebarNavProps {
  items: NavigationItem[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const { user, canAccessModule } = useAuth();
  const { isNavigating, startNavigation } = useNavigation();
  const { unreadCount } = useNotificationBadge();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const sidebarContentRef = useRef<HTMLUListElement>(null);

  if (!items?.length) {
    return null;
  }

  // Function to auto-scroll to show dropdown items
  const autoScrollToDropdown = (groupElement: HTMLElement) => {
    if (!sidebarContentRef.current) return;

    const sidebarContent = sidebarContentRef.current.closest('[data-sidebar="content"]') as HTMLElement;
    if (!sidebarContent) return;

    // Wait for the dropdown animation to complete
    setTimeout(() => {
      const submenu = groupElement.querySelector('[data-sidebar="menu-sub"]') as HTMLElement;
      if (!submenu) return;

      const sidebarRect = sidebarContent.getBoundingClientRect();
      const submenuRect = submenu.getBoundingClientRect();
      
      // Check if submenu is fully visible
      const submenuTop = submenuRect.top - sidebarRect.top;
      const submenuBottom = submenuRect.bottom - sidebarRect.top;
      const sidebarHeight = sidebarRect.height;
      
      // If submenu extends beyond visible area, scroll to show it
      if (submenuBottom > sidebarHeight) {
        const scrollTarget = sidebarContent.scrollTop + (submenuBottom - sidebarHeight) + 10; // Reduced padding from 20px to 10px
        sidebarContent.scrollTo({
          top: scrollTarget,
          behavior: 'smooth'
        });
      } else if (submenuTop < 0) {
        const scrollTarget = sidebarContent.scrollTop + submenuTop - 10; // Reduced padding from 20px to 10px
        sidebarContent.scrollTo({
          top: scrollTarget,
          behavior: 'smooth'
        });
      }
    }, 150); // Reduced delay from 200ms to 150ms for faster response
  };

  // Filter items based on user permissions
  const filteredItems = items.filter(item => {
    if (!user) return false;
    
    // Admin can access everything
    if (user.role === 'Admin') return true;
    
    // Parents can't access any sidebar items (they have their own interface)
    if (user.role === 'Parent') return false;
    
    // For staff, check module permissions
    if (isNavItem(item)) {
      return checkItemPermission(item.href);
    } else if (isNavGroup(item)) {
      // Show group if at least one sub-item is accessible
      return item.items.some(subItem => checkItemPermission(subItem.href));
    }
    
    return false;
  });

  function checkItemPermission(href: string): boolean {
    // Allow external links (like WhatsApp)
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return true;
    }
    
    // Map nav item hrefs to module names
    const moduleMap: Record<string, string> = {
      '/pupils': 'pupils',
      '/pupil-history': 'pupils',
      '/pupils/promote': 'pupils',
      '/enrollment-trends': 'pupils',
      '/classes': 'classes',
      '/staff': 'staff',
      '/subjects': 'subjects',
      '/fees': 'fees',
      '/fees/collection': 'fees',
      '/fees/collect': 'fees',
      '/exams': 'exams',
      '/events': 'events',
      '/attendance': 'attendance',
      '/academic-years': 'academic_years',
      '/users': 'users',
      '/access-levels': 'users',
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
      '/admin/commentary-box': 'settings',
    };
    
    const module = moduleMap[href];
    if (module) {
      return canAccessModule(module);
    }
    
    // Allow access to dashboard and other general pages
    // Also allow access to administrative pages that don't have specific module permissions
    const allowedPaths = [
      '/', 
      '/settings', 
      '/admin'
    ];
    
    return allowedPaths.includes(href) || href === '/';
  }

  function toggleGroup(groupTitle: string, element?: HTMLElement) {
    setOpenGroups(prev => {
      const newSet = new Set(prev);
      const wasOpen = newSet.has(groupTitle);
      
      if (wasOpen) {
        newSet.delete(groupTitle);
      } else {
        newSet.add(groupTitle);
        // Auto-scroll when opening a dropdown
        if (element) {
          autoScrollToDropdown(element);
        }
      }
      return newSet;
    });
  }

  // Function to handle collapsible change and auto-scroll
  function handleCollapsibleChange(groupTitle: string, isOpen: boolean) {
    setOpenGroups(prev => {
      const newSet = new Set(prev);
      if (isOpen) {
        newSet.add(groupTitle);
        // Find the menu item element for auto-scroll
        setTimeout(() => {
          if (sidebarContentRef.current) {
            const menuItems = sidebarContentRef.current.querySelectorAll('[data-sidebar="menu-item"]');
            const groupElement = Array.from(menuItems).find(item => {
              const button = item.querySelector('[data-sidebar="menu-button"]');
              return button?.textContent?.includes(groupTitle);
            }) as HTMLElement;
            
            if (groupElement) {
              autoScrollToDropdown(groupElement);
            }
          }
        }, 30); // Reduced delay for faster response
      } else {
        newSet.delete(groupTitle);
      }
      return newSet;
    });
  }

  function isGroupActive(group: NavigationItem): boolean {
    if (isNavGroup(group)) {
      return group.items.some(item => {
        if (!pathname) return false;
        // Custom logic for fees-related routes (same as main items)
        if (item.href === '/fees/collection') {
          // Fees Collection should be active for /fees/collection and /fees/collect
          return pathname === '/fees/collection' || pathname.startsWith('/fees/collect');
        } else if (item.href === '/fees') {
          // Fees Management should only be active for /fees (exact match or /fees/something that's not collection or collect)
          return pathname === '/fees' || (pathname.startsWith('/fees/') && !pathname.startsWith('/fees/collection') && !pathname.startsWith('/fees/collect'));
        } else {
          // Default logic for other routes
          return item.href === '/' ? pathname === item.href : pathname.startsWith(item.href);
        }
      });
    }
    return false;
  }

  // Function to handle menu item clicks and close mobile sidebar
  function handleMenuItemClick(destination?: string) {
    return () => {
      startNavigation(destination); // Start navigation loading with destination
      if (isMobile) {
        setOpenMobile(false);
      }
    };
  }

  function renderNavItem(item: NavigationItem, index: number) {
    if (isNavItem(item)) {
      const Icon = item.icon;
      
      // Custom logic for fees-related routes
      let isActive: boolean;
      if (!pathname) {
        isActive = false;
      } else if (item.href === '/fees/collection') {
        // Fees Collection should be active for /fees/collection and /fees/collect
        isActive = pathname === '/fees/collection' || pathname.startsWith('/fees/collect');
      } else if (item.href === '/fees') {
        // Fees Management should only be active for /fees (exact match or /fees/something that's not collection or collect)
        isActive = pathname === '/fees' || (pathname.startsWith('/fees/') && !pathname.startsWith('/fees/collection') && !pathname.startsWith('/fees/collect'));
      } else {
        // Default logic for other routes
        isActive = item.href === '/' ? pathname === item.href : pathname.startsWith(item.href);
      }

      const buttonContent = (
        <div className={cn(
          'flex items-center space-x-1.5 px-2 py-1.5 rounded-lg w-full',
          isActive
            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/10 border border-blue-200/50 shadow-lg shadow-blue-500/10'
            : 'bg-sidebar-accent/40 hover:bg-sidebar-accent/60 border border-sidebar-border/20',
          item.disabled && 'opacity-50 cursor-not-allowed'
        )}>
          <div className={cn(
            'p-1 rounded-lg',
            isActive
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
              : 'bg-sidebar-accent/60 text-sidebar-foreground'
          )}>
            <Icon size={12} />
          </div>
          <span className={cn(
            'text-sm font-medium',
            isActive ? 'text-blue-700 dark:text-blue-300' : 'text-sidebar-foreground'
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
      );

      return (
        <SidebarMenuItem key={index}>
          {sidebarState === 'collapsed' && !isMobile ? (
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Link href={item.disabled ? '#' : item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    aria-disabled={item.disabled}
                    className={cn(item.disabled && "cursor-not-allowed opacity-80")}
                  >
                    <a onClick={handleMenuItemClick(item.title)}>{buttonContent}</a>
                  </SidebarMenuButton>
                </Link>
              </TooltipTrigger>
              <TooltipContent 
                side="right" 
                align="center"
                className="bg-popover text-popover-foreground border shadow-md"
                sideOffset={8}
              >
                <p className="font-medium">{item.title}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href={item.disabled ? '#' : item.href} passHref legacyBehavior>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                aria-disabled={item.disabled}
                className={cn(item.disabled && "cursor-not-allowed opacity-80")}
              >
                 <a onClick={handleMenuItemClick(item.title)}>{buttonContent}</a>
              </SidebarMenuButton>
            </Link>
          )}
        </SidebarMenuItem>
      );
    } else if (isNavGroup(item)) {
      const Icon = item.icon;
      const isOpen = openGroups.has(item.title);
      const isActive = isGroupActive(item);
      
      // Filter sub-items based on permissions
      const filteredSubItems = item.items.filter(subItem => checkItemPermission(subItem.href));
      
      if (filteredSubItems.length === 0) {
        return null; // Don't render group if no sub-items are accessible
      }

      return (
        <Collapsible key={index} open={isOpen} onOpenChange={(isOpen) => handleCollapsibleChange(item.title, isOpen)}>
          <SidebarMenuItem>
            {sidebarState === 'collapsed' && !isMobile ? (
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      isActive={isActive}
                    >
                      <div className={cn(
                        'flex items-center space-x-1.5 px-2 py-1.5 rounded-lg w-full',
                        isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/10 border border-blue-200/50 shadow-lg shadow-blue-500/10'
                          : 'bg-sidebar-accent/40 hover:bg-sidebar-accent/60 border border-sidebar-border/20'
                      )}>
                        <div className={cn(
                          'p-1 rounded-lg',
                          isActive
                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                            : 'bg-sidebar-accent/60 text-sidebar-foreground'
                        )}>
                          <Icon size={12} />
                        </div>
                        <span className={cn(
                          'text-sm font-medium flex-1 text-left',
                          isActive ? 'text-blue-700 dark:text-blue-300' : 'text-sidebar-foreground'
                        )}>
                          {item.title}
                        </span>
                        <ChevronRight className={cn(
                          "transition-transform duration-200",
                          isOpen && "rotate-90"
                        )} size={12} />
                      </div>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  align="center"
                  className="bg-popover text-popover-foreground border shadow-md"
                  sideOffset={8}
                >
                  <p className="font-medium">{item.title}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <CollapsibleTrigger asChild>
                <SidebarMenuButton 
                  isActive={isActive}
                >
                  <div className={cn(
                    'flex items-center space-x-1.5 px-2 py-1.5 rounded-lg w-full',
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/10 border border-blue-200/50 shadow-lg shadow-blue-500/10'
                      : 'bg-sidebar-accent/40 hover:bg-sidebar-accent/60 border border-sidebar-border/20'
                  )}>
                    <div className={cn(
                      'p-1 rounded-lg',
                      isActive
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                        : 'bg-sidebar-accent/60 text-sidebar-foreground'
                    )}>
                      <Icon size={12} />
                    </div>
                    <span className={cn(
                      'text-sm font-medium flex-1 text-left',
                      isActive ? 'text-blue-700 dark:text-blue-300' : 'text-sidebar-foreground'
                    )}>
                      {item.title}
                    </span>
                    <ChevronRight className={cn(
                      "transition-transform duration-200",
                      isOpen && "rotate-90"
                    )} size={12} />
                  </div>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            )}
            <CollapsibleContent>
              <SidebarMenuSub>
                {filteredSubItems.map((subItem, subIndex) => {
                  const SubIcon = subItem.icon;
                  
                  // Custom logic for fees-related routes (same as main items)
                  let isSubActive: boolean;
                  if (!pathname) {
                    isSubActive = false;
                  } else if (subItem.href === '/fees/collection') {
                    // Fees Collection should be active for /fees/collection and /fees/collect
                    isSubActive = pathname === '/fees/collection' || pathname.startsWith('/fees/collect');
                  } else if (subItem.href === '/fees') {
                    // Fees Management should only be active for /fees (exact match or /fees/something that's not collection or collect)
                    isSubActive = pathname === '/fees' || (pathname.startsWith('/fees/') && !pathname.startsWith('/fees/collection') && !pathname.startsWith('/fees/collect'));
                  } else {
                    // Default logic for other routes
                    isSubActive = subItem.href === '/' ? pathname === subItem.href : pathname.startsWith(subItem.href);
                  }
                  
                  return (
                    <SidebarMenuSubItem key={subIndex}>
                      <SidebarMenuSubButton asChild isActive={isSubActive}>
                        {subItem.external ? (
                          <a 
                            href={subItem.href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={handleMenuItemClick(subItem.title)}
                            className="flex items-center space-x-2 px-3 py-2 rounded-md w-full"
                          >
                            <div className={cn(
                              'flex items-center space-x-2 px-3 py-2 rounded-md w-full',
                              isSubActive
                                ? 'bg-gradient-to-r from-blue-400/20 to-purple-400/10 border-l-2 border-blue-400'
                                : 'bg-sidebar-accent/20 hover:bg-sidebar-accent/40'
                            )}>
                              <SubIcon size={14} className={cn(
                                isSubActive ? 'text-blue-600' : 'text-sidebar-foreground/70'
                              )} />
                              <span className={cn(
                                'text-sm font-medium',
                                isSubActive ? 'text-blue-700 dark:text-blue-300' : 'text-sidebar-foreground'
                              )}>
                                {subItem.title}
                              </span>
                            </div>
                          </a>
                        ) : (
                          <Link href={subItem.disabled ? '#' : subItem.href} onClick={handleMenuItemClick(subItem.title)}>
                            <div className={cn(
                              'flex items-center space-x-2 px-3 py-2 rounded-md w-full',
                              isSubActive
                                ? 'bg-gradient-to-r from-blue-400/20 to-purple-400/10 border-l-2 border-blue-400'
                                : 'bg-sidebar-accent/20 hover:bg-sidebar-accent/40'
                            )}>
                              <SubIcon size={14} className={cn(
                                isSubActive ? 'text-blue-600' : 'text-sidebar-foreground/70'
                              )} />
                              <span className={cn(
                                'text-sm font-medium',
                                isSubActive ? 'text-blue-700 dark:text-blue-300' : 'text-sidebar-foreground'
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
                              {/* Add loading indicator */}
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
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }
    
    return null;
  }

  return (
    <TooltipProvider>
      <SidebarMenu ref={sidebarContentRef}>
        {filteredItems.map((item, index) => renderNavItem(item, index))}
      </SidebarMenu>
    </TooltipProvider>
  );
}
