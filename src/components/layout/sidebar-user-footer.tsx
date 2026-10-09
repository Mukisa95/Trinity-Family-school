"use client";

import { ThemeToggle, ThemePreferenceMenu } from '@/components/ui/theme-toggle';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSidebar } from '@/components/ui/sidebar';
import { APP_VERSION } from '@/lib/constants/version';
import { cn } from '@/lib/utils';
import { User, LogOut, ChevronLeft, ChevronRight, Download, Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LogoutMessage from '@/components/common/LogoutMessage';
import { AnimatePresence } from 'framer-motion';

interface SidebarUserFooterProps {
  onCloseSidebar?: () => void;
}

export function SidebarUserFooter({ onCloseSidebar }: SidebarUserFooterProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);

  // Safely check sidebar context
  let isCollapsed = false;
  let isMobile = false;
  let toggleSidebar = () => {};

  try {
    const sidebarContext = useSidebar();
    isCollapsed = sidebarContext.state === 'collapsed' && !sidebarContext.isMobile;
    isMobile = sidebarContext.isMobile;
    toggleSidebar = sidebarContext.toggleSidebar;
  } catch (e) {
    // If used outside of SidebarProvider (e.g. custom mobile sidebar)
    isCollapsed = false;
    isMobile = true;
  }

  const handleLogout = async () => {
    setShowLogoutMessage(true);
    if (onCloseSidebar) onCloseSidebar();
    setTimeout(async () => {
      await logout();
      router.replace('/login');
    }, 2000);
  };

  const handleItemClick = () => {
    if (onCloseSidebar) {
      onCloseSidebar();
    }
  };

  return (
    <>
      <DropdownMenu>
        <div className={cn("flex items-center gap-1 w-full", isCollapsed && "justify-center gap-0")}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2 flex-1 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left outline-none",
                isCollapsed && "justify-center p-0.5 rounded-full"
              )}
            >
              {/* Avatar / Initial */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-surface-500 via-brand-secondary-surface-500 to-pink-500 blur-[2px] opacity-75 animate-pulse" />
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-brand-surface-500 via-brand-alt-surface-600 to-brand-secondary-surface-600 flex items-center justify-center border border-white shadow-sm dark:border-slate-700">
                  <span className="text-xs font-bold text-white uppercase">
                    {user?.firstName?.[0] || user?.username?.[0] || '?'}
                  </span>
                </div>
              </div>

              {/* Name / Role (Hidden when collapsed) */}
              {!isCollapsed && (
                <div className="flex-1 min-w-0 leading-tight">
                  <p className="text-xs font-bold text-gray-900 truncate dark:text-slate-100">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.username || 'User'}
                  </p>
                  <p className="text-[10px] text-gray-500 font-semibold capitalize truncate dark:text-slate-400">
                    {user?.role || 'Role'}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>

          {!isCollapsed && <ThemeToggle />}

          {/* Sidebar Collapse button (only when expanded and not mobile) */}
          {!isCollapsed && !isMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSidebar();
              }}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all flex-shrink-0 dark:text-slate-400"
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <DropdownMenuContent
          side={isCollapsed ? "right" : "top"}
          align={isCollapsed ? "end" : "center"}
          sideOffset={isCollapsed ? 12 : 8}
          className="w-48 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/70 p-1 z-50 dark:bg-slate-900/95 dark:border-slate-700/70"
        >
          <div className="px-3 py-2 border-b border-brand-50 bg-gradient-to-r from-brand-surface-50/50 to-brand-alt-surface-50/50 rounded-t-lg dark:border-brand-800/60 dark:from-brand-surface-950/50 dark:to-brand-alt-surface-950/50">
            <p className="text-[10px] font-medium text-gray-600 dark:text-slate-300">Signed in as</p>
            <p className="text-xs font-bold text-brand-ink-700 truncate dark:text-brand-ink-300">{user?.username || 'User'}</p>
          </div>

          <div className="mt-1">
            {isCollapsed && (
              <DropdownMenuItem
                onClick={() => toggleSidebar()}
                className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-brand-surface-50/80 hover:text-brand-ink-700 rounded-md transition-all duration-200 cursor-pointer dark:text-slate-200 dark:hover:bg-brand-surface-950/80 dark:hover:text-brand-ink-300"
              >
                <ChevronRight className="mr-2 h-4 w-4 text-gray-400 dark:text-slate-400" />
                Expand Sidebar
              </DropdownMenuItem>
            )}

            <DropdownMenuItem asChild>
              <Link
                href="/profile"
                onClick={handleItemClick}
                className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-brand-surface-50/80 hover:text-brand-ink-700 rounded-md transition-all duration-200 cursor-pointer dark:text-slate-200 dark:hover:bg-brand-surface-950/80 dark:hover:text-brand-ink-300"
              >
                <User className="mr-2 h-4 w-4 text-gray-400 dark:text-slate-400" />
                My Profile
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/changelog"
                onClick={handleItemClick}
                className="flex items-center w-full px-3 py-2 text-xs text-brand-ink-600 hover:bg-brand-surface-50 hover:text-brand-ink-700 font-semibold rounded-md transition-all duration-200 cursor-pointer dark:text-brand-ink-400 dark:hover:bg-brand-surface-950/40 dark:hover:text-brand-ink-300"
              >
                <span className="mr-2 px-1 py-0.2 text-[9px] bg-brand-surface-100 text-brand-ink-700 rounded border border-brand-200 dark:bg-brand-surface-950/40 dark:text-brand-ink-300 dark:border-brand-800/60">v{APP_VERSION}</span>
                What's New
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/download" onClick={handleItemClick} className="flex min-h-11 items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-brand-surface-50 hover:text-brand-ink-700 rounded-md cursor-pointer dark:text-slate-200 dark:hover:bg-brand-surface-950/40 dark:hover:text-brand-ink-300">
                <Download className="mr-2 h-4 w-4 text-gray-400 dark:text-slate-400" aria-hidden="true" />
                Download Android app
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-brand-surface-50 dark:bg-brand-surface-950/40" />
            <ThemePreferenceMenu />
            <DropdownMenuItem asChild>
              <Link href="/settings/look-and-feel" onClick={handleItemClick} className="flex min-h-11 items-center gap-2 px-3 text-xs cursor-pointer">
                <Palette className="h-4 w-4" aria-hidden="true" />Look and Feel
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50/70 hover:text-red-700 rounded-md transition-all duration-200 cursor-pointer focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:hover:bg-red-950/70 dark:hover:text-red-300 dark:focus:bg-red-950/40 dark:focus:text-red-300"
            >
              <LogOut className="mr-2 h-4 w-4 text-red-500 dark:text-red-400" />
              Logout
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <AnimatePresence>
        {showLogoutMessage && (
          <LogoutMessage username={user?.firstName || user?.username || 'User'} />
        )}
      </AnimatePresence>
    </>
  );
}
