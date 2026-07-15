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
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { SidebarNav } from './sidebar-nav';
import { MobileSidebar } from './mobile-sidebar';
import { navItems } from '@/config/nav';
import { School, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, LogOut, Settings, Menu } from 'lucide-react';
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
import { SidebarUserFooter } from './sidebar-user-footer';
import { SchoolSettingsLoader } from './school-settings-loader';
import { AnimatePresence, motion } from 'framer-motion';
import { BrandedAuthScreen } from '@/components/common/premium-splash-loader';
import React, { useState, useEffect, useRef, memo } from 'react';
import { usePrint } from '@/lib/contexts/print-context';
import { useQueryClient } from '@tanstack/react-query';
import { AutoNotificationPermission } from '@/components/notifications/auto-notification-permission';
import { logger } from '@/lib/utils/logger';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getRoutePagePermission, MODULE_ACTIONS } from '@/types/permissions';

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

function SessionStaleBanner({
  message,
  onRefresh,
}: {
  message?: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="mx-3 my-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm sm:mx-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Session permissions need refresh</p>
          <p className="text-sm">
            {message || 'Your current role and permissions could not be confirmed from the database.'}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
        >
          {isRefreshing && <Loader2 className="h-4 w-4 animate-spin" />}
          Refresh Session
        </Button>
      </div>
    </div>
  );
}

const SidebarHeaderWrapper = ({ isLoadingSettings, currentSettings }: { isLoadingSettings: boolean; currentSettings: any }) => {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [showName, setShowName] = useState(false);

  useEffect(() => {
    if (isCollapsed) {
      setShowName(false);
      return;
    }
    // Logo zooms in at the center first, then slides to the side to reveal the name after 500ms
    const timer = setTimeout(() => {
      setShowName(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [isCollapsed]);

  return (
    <SidebarHeader
      className={cn(
        "p-3 flex flex-row items-center border-b border-gray-100 transition-all duration-300 ease-in-out min-h-[56px] relative",
        (isCollapsed || !showName) ? "justify-center" : "justify-start gap-2.5"
      )}
    >
      {/* Logo — centered when collapsed or during initial load zoom */}
      {!isLoadingSettings && currentSettings.generalInfo.logo && (
        <motion.div
          layout
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            scale: { type: "spring", stiffness: 200, damping: 18, delay: 0.1 },
            opacity: { duration: 0.2, delay: 0.1 },
            layout: { type: "spring", stiffness: 120, damping: 18 }
          }}
          className="flex-shrink-0"
        >
          <Link href="/">
            <div className="relative w-10 h-10 bg-transparent">
              <Image
                src={currentSettings.generalInfo.logo}
                alt={`${currentSettings.generalInfo.name || 'School'} Logo`}
                fill
                sizes="40px"
                className="rounded-lg object-contain bg-transparent"
                data-ai-hint="school logo"
              />
            </div>
          </Link>
        </motion.div>
      )}

      {/* School name + motto — hidden when collapsed or before reveal */}
      <AnimatePresence initial={false}>
        {!isCollapsed && showName && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ 
              opacity: { duration: 0.2 },
              width: { type: "spring", stiffness: 100, damping: 15 } 
            }}
            className="flex flex-col items-start min-w-0 flex-1 overflow-hidden"
          >
            <div className="w-[180px]">
              <AnimatePresence mode="wait">
                {isLoadingSettings ? (
                  <div className="h-8 w-24 bg-gray-100 animate-pulse rounded" />
                ) : (
                  <motion.div
                    key="text-content"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-start min-w-0 w-full"
                  >
                    <h2 className="text-sm font-bold text-gray-900 leading-tight w-full break-words">
                      {currentSettings.generalInfo.name || "School Name"}
                    </h2>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarHeader>
  );
};

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
  refreshUser,
  isSessionStale,
  sessionMessage,
  router
}: any) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

  // Swipe detection state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Swipe hint state
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  // Check if this is a public route
  const publicRoutes = ['/login', '/admin/setup', '/test-firebase'];
  const isPublicRoute = pathname ? (publicRoutes.includes(pathname) || publicRoutes.some((route: string) => pathname.startsWith(route + '/'))) : false;

  // Check if this is a parent route (should use its own layout)
  const isParentRoute = pathname?.startsWith('/parent') || false;
  const routePermission = pathname ? getRoutePagePermission(pathname) : undefined;
  const isAdminOnlyRoute = pathname === '/settings/firebase-usage';
  const shouldCheckRoutePermission = Boolean(routePermission) || isAdminOnlyRoute;
  const canAccessCurrentRoute = (!isAdminOnlyRoute || user?.role === 'Admin') && (!routePermission || user?.role === 'Admin' ||
    GranularPermissionService.canAccessPage(user, routePermission.moduleId, routePermission.pageId));

  const accessibleFallbackPath = React.useMemo(() => {
    if (!user || user.role === 'Parent') return '/login';

    for (const [moduleId, module] of Object.entries(MODULE_ACTIONS)) {
      const accessiblePage = module.pages.find((page) =>
        GranularPermissionService.canAccessPage(user, moduleId, page.page)
      );
      if (accessiblePage) return accessiblePage.path;
    }

    return '/login';
  }, [user]);

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
    const isLeftToRightSwipe = distanceX < -80;
    const isFromLeftEdge = touchStart.x < 80;
    const hasMinimumDistance = Math.abs(distanceX) > 50;

    if (isHorizontalSwipe && isLeftToRightSwipe && isFromLeftEdge && hasMinimumDistance && windowWidth < 768) {
      setIsMobileSidebarOpen(true);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const syncStoredUser = () => {
        const storedUser = localStorage.getItem('trinity_user');
        setHasStoredUser(!!storedUser);
      };

      syncStoredUser();
      setWindowWidth(window.innerWidth);

      const handleResize = () => {
        setWindowWidth(window.innerWidth);
        if (window.innerWidth >= 768) {
          setIsMobileSidebarOpen(false);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('trinity_user');
      setHasStoredUser(!!storedUser);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        triggerPrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerPrint]);

  React.useEffect(() => {
    if (windowWidth < 768 && !isPublicRoute && !isParentRoute) {
      const timer = setTimeout(() => {
        setShowSwipeHint(true);
        setTimeout(() => setShowSwipeHint(false), 3000);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [windowWidth, isPublicRoute, isParentRoute]);

  React.useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    logger.debug('Auth state debug', {
      pathname,
      isPublicRoute,
      authLoading,
      isAuthenticated,
      hasStoredUser,
      userRole: user?.role,
    });
  }, [pathname, isPublicRoute, authLoading, isAuthenticated, user, hasStoredUser]);

  const currentSettings = React.useMemo(() => {
    if (isLoadingSettings) {
      return sampleSchoolSettings;
    }
    if (schoolSettings) {
      return schoolSettings;
    }
    if (settingsError) {
      logger.warn('Using sample school settings due to Firebase error', settingsError);
    } else {
      logger.warn('Using sample school settings - no data found in Firebase');
    }
    return sampleSchoolSettings;
  }, [schoolSettings, settingsError, isLoadingSettings]);

  React.useEffect(() => {
    const delay = hasStoredUser ? 2500 : 1000;

    const timer = setTimeout(() => {
      if (!isPublicRoute && !authLoading && !isAuthenticated && !user) {
        if (hasStoredUser) {
          logger.debug('Stored user found, not redirecting to login');
          return;
        }

        const currentStoredUser = localStorage.getItem('trinity_user');
        if (currentStoredUser) {
          logger.debug('Found stored user in localStorage, not redirecting to login');
          return;
        }

        logger.debug('Redirecting to login due to no authentication');
        router.replace('/login');
      } else if (!authLoading && isAuthenticated && user && pathname === '/login') {
        logger.debug('Authenticated user on login page, redirecting home', { role: user.role });
        router.replace('/');
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isPublicRoute, isAuthenticated, authLoading, router, user, pathname, hasStoredUser]);

  React.useEffect(() => {
    if (!isPublicRoute && !isParentRoute && !authLoading && user && shouldCheckRoutePermission && !canAccessCurrentRoute) {
      router.replace(accessibleFallbackPath);
    }
  }, [accessibleFallbackPath, authLoading, canAccessCurrentRoute, isParentRoute, isPublicRoute, router, shouldCheckRoutePermission, user]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const handleMobileMenuClick = () => {
    setIsMobileSidebarOpen(true);
  };

  const handleMobileSidebarClose = () => {
    setIsMobileSidebarOpen(false);
  };

  // ── Background blur effect ──
  // On dashboard (/): clear at top, blurs up to 8px as user scrolls 200px
  // On all other pages: fixed 6px blur so background stays blurred
  const mainRef = useRef<HTMLElement>(null);
  const isDashboard = pathname === '/';

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;
    const bgWrapper = mainEl.closest<HTMLElement>('.dashboard-bg-wrapper');
    if (!bgWrapper) return;

    if (!isDashboard) {
      // Non-dashboard pages: immediately blurred
      bgWrapper.style.setProperty('--scroll-blur', '6px');
      return () => {
        bgWrapper.style.setProperty('--scroll-blur', '0px');
      };
    }

    // Dashboard: 0px blur at top, grows as user scrolls
    bgWrapper.style.setProperty('--scroll-blur', '0px');
    const onScroll = () => {
      const blur = Math.min(8, (mainEl.scrollTop / 200) * 8);
      bgWrapper.style.setProperty('--scroll-blur', `${blur}px`);
    };
    mainEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      mainEl.removeEventListener('scroll', onScroll);
      bgWrapper.style.setProperty('--scroll-blur', '0px');
    };
  }, [isDashboard]);

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
    return <BrandedAuthScreen message="Strive to Excel…" />;
  }

  if (!isAuthenticated) {
    const showLoadingInstead = hasStoredUser || (typeof window !== 'undefined' && !!localStorage.getItem('trinity_user'));
    return (
      <BrandedAuthScreen
        message={showLoadingInstead ? "Strive to Excel…" : "Redirecting to login…"}
      />
    );
  }

  if (!isParentRoute && shouldCheckRoutePermission && !canAccessCurrentRoute) {
    return <BrandedAuthScreen message="Opening an authorised workspaceâ€¦" />;
  }

  // PARENT INTERFACE
  if (user?.role === 'Parent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <EnhancedHeader
          onMenuClick={() => { }}
          showMenuButton={false}
          loadSchoolSettings={false}
        />
        <main className="flex-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {isSessionStale && (
            <SessionStaleBanner message={sessionMessage} onRefresh={refreshUser} />
          )}
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
          <EnhancedHeader
            onMenuClick={handleMobileMenuClick}
            showMenuButton={true}
          />

          {/* Swipe hint removed as per user request */}

          <main
            className="px-3 pb-4 pt-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {isSessionStale && (
              <SessionStaleBanner message={sessionMessage} onRefresh={refreshUser} />
            )}
            <AuthGuard>
              {children}
            </AuthGuard>
          </main>

          <MobileSidebar
            items={navItems}
            isOpen={isMobileSidebarOpen}
            onClose={handleMobileSidebarClose}
          />

          <AutoNotificationPermission />
        </div>
      </NavigationWrapper>
    );
  }

  // Desktop layout with existing sidebar
  return (
    <NavigationWrapper>
      <AutoNotificationPermission />
      {/* Dashboard background wrapper — background image covers the full viewport */}
      <div className="dashboard-bg-wrapper">
        <SidebarProvider defaultOpen>
          <Sidebar variant="sidebar" collapsible="icon">
            <SidebarHeaderWrapper isLoadingSettings={isLoadingSettings} currentSettings={currentSettings} />
            <SidebarContent>
              <SidebarNav items={navItems} />
            </SidebarContent>
            <SidebarFooter className="p-3 group-data-[state=collapsed]:p-1.5 border-t border-gray-100">
              <SidebarUserFooter />
            </SidebarFooter>
          </Sidebar>

          {/* SidebarInset is transparent so the background image shows through */}
          <SidebarInset className="relative flex flex-col overflow-hidden min-w-0 h-[100dvh] !bg-transparent">
            <EnhancedHeader
              onMenuClick={() => { }}
              showMenuButton={false}
            />
            <main
              ref={mainRef}
              className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-0 md:pt-[52px]"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {isSessionStale && (
                <SessionStaleBanner message={sessionMessage} onRefresh={refreshUser} />
              )}
              <AuthGuard>
                {children}
              </AuthGuard>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </NavigationWrapper>
  );
});

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading, logout, isAuthenticated, refreshUser, isSessionStale, sessionMessage } = useAuth();
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
        refreshUser={refreshUser}
        isSessionStale={isSessionStale}
        sessionMessage={sessionMessage}
        router={router}
      >
        {children}
      </MemoizedAppLayout>
    </NavigationProvider>
  );
}
