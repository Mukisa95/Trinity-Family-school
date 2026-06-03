"use client";

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { SidebarNav } from './sidebar-nav';
import { MobileSidebar } from './mobile-sidebar';
import { navItems } from '@/config/nav';
import { School, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, LogOut, Settings, PanelLeft, PanelRight, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { sampleSchoolSettings } from '@/lib/sample-data';
import { cn } from '@/lib/utils';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { useAuth } from '@/lib/contexts/auth-context';
import { NavigationProvider, useNavigation } from '@/lib/contexts/navigation-context';
import { LoadingOverlay } from '@/components/ui/loading-indicator';
import { ParentLayout } from '@/components/parent/parent-layout';
import EnhancedHeader from './enhanced-header';
import AuthGuard from '@/components/common/AuthGuard';
import { VersionLink } from './version-link';
import { SchoolSettingsLoader } from './school-settings-loader';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState, useEffect, memo } from 'react';
import { usePrint } from '@/lib/contexts/print-context';
import { PullToRefresh } from '@/components/android/PullToRefresh';
import { clearCacheAndRefresh } from '@/lib/utils/android-navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AutoNotificationPermission } from '@/components/notifications/auto-notification-permission';

const Sidebar연구 = Sidebar;

// Wrapper component that uses navigation context
function NavigationWrapper({ children }: { children: ReactNode }) {
  const { isNavigating, destination } = useNavigation();

  return (
    <>
      <LoadingOverlay
        isLoading={isNavigating}
        message="Loading page..."
        destination={destination || undefined}
      />
      {children}
    </>
  );
}

function DesktopSidebarToggle() {
  const { toggleSidebar, state, isMobile } = useSidebar();

  if (isMobile) {
    return null;
  }

  const IconToRender = state === 'expanded' ? PanelLeft : PanelRight;
  const label = state === 'expanded' ? "Collapse sidebar" : "Expand sidebar";

  return (
    <SidebarMenuButton
      onClick={toggleSidebar}
      className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      tooltip={{ children: label, side: "right", align: "center", hidden: state === 'expanded' && !isMobile }}
      aria-label={label}
    >
      <IconToRender className="h-5 w-5" />
      <span></span>
    </SidebarMenuButton>
  );
}

function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl"
    >
      <Menu size={20} />
    </button>
  );
}

// 🚀 CRITICAL OPTIMIZATION: Memoize layout to prevent sidebar re-renders on navigation
const MemoizedAppLayout = memo(function MemoizedAppLayout({
  children,
  pathname,
  user,
  authLoading,
  isAuthenticated,
  schoolSettings,
  isLoadingSettings,
  settingsError,
  logout,
  router
}: any) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

  // Swipe detection state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Swipe hint state
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  // 🚀 OPTIMIZED: Use props instead of calling hooks again (props are passed from parent)

  // Check if this is a public route
  const publicRoutes = ['/login', '/admin/setup', '/test-firebase'];
  const isPublicRoute = pathname ? (publicRoutes.includes(pathname) || publicRoutes.some(route => pathname.startsWith(route + '/'))) : false;

  // Check if this is a parent route (should use its own layout)
  const isParentRoute = pathname?.startsWith('/parent') || false;

  // Check if there's a stored user that might be loading
  const [hasStoredUser, setHasStoredUser] = React.useState(false);

  // Get print context
  const { triggerPrint } = usePrint();

  // Swipe detection functions
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
    const isLeftToRightSwipe = distanceX < -80; // Swipe from left to right (negative distance) - increased threshold
    const isFromLeftEdge = touchStart.x < 80; // Start from left edge of screen - increased area
    const hasMinimumDistance = Math.abs(distanceX) > 50; // Minimum swipe distance

    // Only trigger if it's a horizontal swipe from left to right starting from the left edge
    if (isHorizontalSwipe && isLeftToRightSwipe && isFromLeftEdge && hasMinimumDistance && windowWidth < 768) {
      setIsMobileSidebarOpen(true);
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('trinity_user');
      setHasStoredUser(!!storedUser);
      setWindowWidth(window.innerWidth);

      const handleResize = () => {
        setWindowWidth(window.innerWidth);
        // Close mobile sidebar on resize to desktop
        if (window.innerWidth >= 768) {
          setIsMobileSidebarOpen(false);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Keyboard shortcut handler for print (Ctrl+P or Cmd+P)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+P (Windows/Linux) or Cmd+P (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        triggerPrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerPrint]);

  // Show swipe hint on mobile
  React.useEffect(() => {
    if (windowWidth < 768 && !isPublicRoute && !isParentRoute) {
      // Show hint after a short delay
      const timer = setTimeout(() => {
        setShowSwipeHint(true);
        // Hide hint after 3 seconds
        setTimeout(() => setShowSwipeHint(false), 3000);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [windowWidth, isPublicRoute, isParentRoute]);

  // Close mobile sidebar when route changes
  React.useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  // Add debugging to see what's happening
  React.useEffect(() => {
    console.log('Auth state debug:', {
      pathname,
      isPublicRoute,
      authLoading,
      isAuthenticated,
      hasStoredUser,
      userRole: user?.role,
      timestamp: new Date().toISOString()
    });
  }, [pathname, isPublicRoute, authLoading, isAuthenticated, user, hasStoredUser]);

  // Use Firebase data if available, otherwise fallback to sample data
  // Only use fallback if query has finished loading and we have no data
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
  // Handle authentication redirects for protected routes only
  React.useEffect(() => {
    // Don't redirect immediately on auth state change to avoid flashing/premature redirects
    // Use longer delay if there's a stored user that might still be loading
    const delay = hasStoredUser ? 2500 : 1000; // Even longer delay for stored users

    const timer = setTimeout(() => {
      // Only redirect if we're confident the auth state is stable
      if (!isPublicRoute && !authLoading && !isAuthenticated && !user) {
        // Multiple additional checks to prevent premature redirects
        if (hasStoredUser) {
          console.log('Stored user found, NOT redirecting to login');
          return;
        }

        // Double-check localStorage one more time
        const currentStoredUser = localStorage.getItem('trinity_user');
        if (currentStoredUser) {
          console.log('Found stored user in localStorage, NOT redirecting to login');
          return;
        }

        // Check if we're on a deep page (not just home) - user was likely authenticated recently
        const authenticatedPages = ['/pupils', '/staff', '/classes', '/fees', '/exams', '/attendance'];
        const isOnAuthenticatedPage = pathname ? authenticatedPages.some(page => pathname.startsWith(page)) : false;
        if (isOnAuthenticatedPage) {
          console.log('User is on authenticated page, likely recently authenticated - NOT redirecting');
          return;
        }

        console.log('Redirecting to login due to no authentication');
        router.push('/login');
      } else if (!authLoading && isAuthenticated && user && pathname === '/login') {
        // Redirect all authenticated users from login page to home page
        console.log(`${user.role} login: Redirecting to /`);
        router.push('/');
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isPublicRoute, isAuthenticated, authLoading, router, user, pathname, hasStoredUser]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleMobileMenuClick = () => {
    setIsMobileSidebarOpen(true);
  };

  const handleMobileSidebarClose = () => {
    setIsMobileSidebarOpen(false);
  };

  // If it's a public route, render without any authentication checks
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // If it's a parent route, render without admin layout wrapper
  if (isParentRoute) {
    return <>{children}</>;
  }

  // Show loading screen while checking authentication for protected routes
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <School className="h-8 w-8 text-white" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated for protected route, this will be handled by the useEffect above
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <School className="h-8 w-8 text-white" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // PARENT INTERFACE - No routing, just render the dashboard directly
  if (user?.role === 'Parent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <EnhancedHeader
          onMenuClick={() => { }}
          showMenuButton={false}
          loadSchoolSettings={false}
        />
        <main className="flex-1 overflow-y-auto h-[calc(100vh-4rem)]">
          <AuthGuard>
            <ParentLayout />
          </AuthGuard>
        </main>
      </div>
    );
  }

  // Check if we're on mobile
  const isMobile = windowWidth < 768;

  // Mobile layout with custom sidebar
  if (isMobile) {
    return (
      <NavigationWrapper>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
          {/* Enhanced Header for Mobile */}
          <EnhancedHeader
            onMenuClick={handleMobileMenuClick}
            showMenuButton={true}
          />

          {/* Swipe Hint Indicator */}
          {showSwipeHint && (
            <div className="fixed top-20 left-4 z-40 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm animate-pulse">
              <div className="flex items-center space-x-2">
                <span>👆</span>
                <span>Swipe from left edge to open menu</span>
              </div>
            </div>
          )}

          {/* Mobile Main Content */}
          <main
            className="px-3 pb-4 pt-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <AuthGuard>
              {children}
            </AuthGuard>
          </main>

          {/* Custom Mobile Sidebar */}
          <MobileSidebar
            items={navItems}
            isOpen={isMobileSidebarOpen}
            onClose={handleMobileSidebarClose}
          />

          {/* Push notification permission prompt */}
          <AutoNotificationPermission />
        </div>
      </NavigationWrapper>
    );
  }

  // Desktop layout with existing sidebar
  return (
    <NavigationWrapper>
      <AutoNotificationPermission />
      <SidebarProvider defaultOpen>
        <Sidebar연구 variant="sidebar" collapsible="icon">
          <SidebarHeader
            className={cn(
              "p-4 flex flex-col items-center text-center transition-all duration-300 ease-in-out",
              "group-data-[state=expanded]:pb-6"
            )}
          >
            {/* Logo shown when collapsed */}
            {!isLoadingSettings && currentSettings.generalInfo.logo && (
              <Link
                href="/"
                className={cn(
                  "flex items-center justify-center transition-all duration-300 ease-in-out",
                  "group-data-[state=collapsed]:mb-0 group-data-[state=collapsed]:w-full group-data-[state=collapsed]:h-auto",
                  "group-data-[state=expanded]:hidden"
                )}
              >
                <div className="relative w-10 h-10 bg-transparent">
                  <Image
                    src={currentSettings.generalInfo.logo}
                    alt={`${currentSettings.generalInfo.name || 'School'} Logo`}
                    fill
                    sizes="40px"
                    className="rounded-md object-contain bg-transparent"
                    data-ai-hint="school logo collapsed"
                  />
                </div>
              </Link>
            )}

            {/* Full content shown when expanded */}
            <div
              className={cn(
                "flex flex-col items-center space-y-2 w-full transition-all duration-300 ease-in-out overflow-hidden",
                "group-data-[state=collapsed]:h-0 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:invisible group-data-[state=collapsed]:-mt-4",
                "group-data-[state=expanded]:h-auto group-data-[state=expanded]:opacity-100 group-data-[state=expanded]:visible"
              )}
            >
              <AnimatePresence mode="wait">
                {isLoadingSettings ? (
                  <SchoolSettingsLoader key="loading" />
                ) : (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center space-y-2 w-full"
                  >
                    {currentSettings.generalInfo.logo && (
                      <div className="relative w-16 h-16 mb-2 bg-transparent">
                        <Image
                          src={currentSettings.generalInfo.logo}
                          alt={`${currentSettings.generalInfo.name || 'School'} Logo`}
                          fill
                          sizes="(max-width: 640px) 100vw, 64px"
                          className="rounded-md object-contain bg-transparent"
                          data-ai-hint="school logo"
                        />
                      </div>
                    )}
                    <h2 className="text-md font-semibold text-sidebar-foreground leading-tight px-1">
                      {currentSettings.generalInfo.name || "School Name"}
                    </h2>
                    {currentSettings.generalInfo.motto && (
                      <p className="text-xs text-sidebar-foreground/80 italic px-1 leading-snug">
                        "{currentSettings.generalInfo.motto}"
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarNav items={navItems} />
          </SidebarContent>
          <SidebarFooter className="p-2 border-t border-sidebar-border flex flex-col gap-1.5">
            <VersionLink />
          </SidebarFooter>
        </Sidebar연구>
        <SidebarInset className="flex flex-col overflow-hidden min-w-0 h-[100dvh]">
          <EnhancedHeader
            onMenuClick={() => { }}
            showMenuButton={false}
          />
          <main
            className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <AuthGuard>
              {children}
            </AuthGuard>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </NavigationWrapper>
  );
});

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading, logout, isAuthenticated } = useAuth();
  const { data: schoolSettings, isLoading: isLoadingSettings, error: settingsError } = useSchoolSettings();

  return (
    <NavigationProvider>
      <MemoizedAppLayout
        pathname={pathname}
        user={user}
        authLoading={authLoading}
        isAuthenticated={isAuthenticated}
        schoolSettings={schoolSettings}
        isLoadingSettings={isLoadingSettings}
        settingsError={settingsError}
        logout={logout}
        router={router}
      >
        {children}
      </MemoizedAppLayout>
    </NavigationProvider>
  );
}
