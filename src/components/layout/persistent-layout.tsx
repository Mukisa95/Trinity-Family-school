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
import { navItems } from '@/config/nav';
import { School, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, LogOut, Settings, PanelLeft, PanelRight } from 'lucide-react';
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
import { ParentLayout } from '@/components/parent/parent-layout';
import EnhancedHeader from './enhanced-header';
import { VersionLink } from './version-link';
import { SchoolSettingsLoader } from './school-settings-loader';
import { AnimatePresence, motion } from 'framer-motion';
import { BrandedAuthScreen } from '@/components/common/premium-splash-loader';
import React from 'react';

const Sidebar연구 = Sidebar;

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

export function PersistentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Always call hooks at the top level to maintain consistent order
  const { user, isLoading: authLoading, logout, isAuthenticated } = useAuth();
  const { data: schoolSettings, isLoading: isLoadingSettings, error: settingsError } = useSchoolSettings();

  // Check if this is a public route
  const publicRoutes = ['/login', '/admin/setup', '/test-firebase'];
  const isPublicRoute = publicRoutes.includes(pathname) || publicRoutes.some(route => pathname.startsWith(route + '/'));

  // Check if there's a stored user that might be loading
  const [hasStoredUser, setHasStoredUser] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('trinity_user');
      setHasStoredUser(!!storedUser);
    }
  }, []);

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

        console.log('Redirecting to login due to no authentication');
        router.replace('/login');
      } else if (!authLoading && isAuthenticated && user && pathname === '/login') {
        // Redirect all authenticated users from login page to home page
        console.log(`${user.role} login: Redirecting to /`);
        router.replace('/');
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isPublicRoute, isAuthenticated, authLoading, router, user, pathname, hasStoredUser]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  // If it's a public route, render without any authentication checks
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // ── Branded loading screen (auth resolving) ──
  if (authLoading) {
    return <BrandedAuthScreen message="Strive to Excel…" />;
  }

  // ── Branded redirect screen (not authenticated) ──
  if (!isAuthenticated) {
    return <BrandedAuthScreen message="Redirecting to login…" />;
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
          <ParentLayout />
        </main>
      </div>
    );
  }

  // Default layout for Admin/Staff (includes sidebar) - This is now persistent!
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full">
        <Sidebar연구 variant="sidebar" collapsible="icon">
          <SidebarHeader
            className={cn(
              "p-3 flex flex-row items-center gap-2.5 transition-all duration-300 ease-in-out h-13 min-h-[52px]",
              "group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:p-2"
            )}
          >
            {/* Logo (shown in both states) */}
            {!isLoadingSettings && currentSettings.generalInfo.logo && (
              <Link href="/" className="flex-shrink-0">
                <div className="relative w-9 h-9 bg-transparent transition-all duration-300">
                  <Image
                    src={currentSettings.generalInfo.logo}
                    alt={`${currentSettings.generalInfo.name || 'School'} Logo`}
                    fill
                    sizes="36px"
                    className="rounded-md object-contain bg-transparent"
                    data-ai-hint="school logo"
                  />
                </div>
              </Link>
            )}

            {/* Text info (hidden when collapsed) */}
            <div
              className={cn(
                "flex flex-col items-start min-w-0 transition-all duration-300 ease-in-out overflow-hidden w-full",
                "group-data-[state=collapsed]:w-0 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:invisible"
              )}
            >
              <AnimatePresence mode="wait">
                {isLoadingSettings ? (
                  <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
                ) : (
                  <motion.div
                    key="text-content"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-start min-w-0 w-full"
                  >
                    <h2 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight leading-tight w-full break-words">
                      {currentSettings.generalInfo.name || "School Name"}
                    </h2>
                    {currentSettings.generalInfo.motto && (
                      <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wider leading-none mt-0.5 truncate w-full">
                        {currentSettings.generalInfo.motto}
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

        <SidebarInset className="flex flex-col flex-1">
          <EnhancedHeader
            onMenuClick={() => { }}
            showMenuButton={false}
          />
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <div className="transition-opacity duration-150 ease-in-out">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
