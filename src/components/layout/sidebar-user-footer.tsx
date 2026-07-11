"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSidebar } from '@/components/ui/sidebar';
import { APP_VERSION } from '@/lib/constants/version';
import { cn } from '@/lib/utils';
import { User, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
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
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-[2px] opacity-75 animate-pulse" />
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center border border-white shadow-sm">
                  <span className="text-xs font-bold text-white uppercase">
                    {user?.firstName?.[0] || user?.username?.[0] || '?'}
                  </span>
                </div>
              </div>

              {/* Name / Role (Hidden when collapsed) */}
              {!isCollapsed && (
                <div className="flex-1 min-w-0 leading-tight">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.username || 'User'}
                  </p>
                  <p className="text-[10px] text-gray-500 font-semibold capitalize truncate">
                    {user?.role || 'Role'}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>

          {/* Sidebar Collapse button (only when expanded and not mobile) */}
          {!isCollapsed && !isMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSidebar();
              }}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all flex-shrink-0"
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
          className="w-48 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/70 p-1 z-50"
        >
          <div className="px-3 py-2 border-b border-blue-50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg">
            <p className="text-[10px] font-medium text-gray-600">Signed in as</p>
            <p className="text-xs font-bold text-blue-700 truncate">{user?.username || 'User'}</p>
          </div>

          <div className="mt-1">
            {isCollapsed && (
              <DropdownMenuItem
                onClick={() => toggleSidebar()}
                className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-blue-50/80 hover:text-blue-700 rounded-md transition-all duration-200 cursor-pointer"
              >
                <ChevronRight className="mr-2 h-4 w-4 text-gray-400" />
                Expand Sidebar
              </DropdownMenuItem>
            )}

            <DropdownMenuItem asChild>
              <Link
                href="/profile"
                onClick={handleItemClick}
                className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-blue-50/80 hover:text-blue-700 rounded-md transition-all duration-200 cursor-pointer"
              >
                <User className="mr-2 h-4 w-4 text-gray-400" />
                My Profile
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/changelog"
                onClick={handleItemClick}
                className="flex items-center w-full px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-semibold rounded-md transition-all duration-200 cursor-pointer"
              >
                <span className="mr-2 px-1 py-0.2 text-[9px] bg-blue-100 text-blue-700 rounded border border-blue-200">v{APP_VERSION}</span>
                What's New
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-blue-50" />

            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50/70 hover:text-red-700 rounded-md transition-all duration-200 cursor-pointer focus:bg-red-50 focus:text-red-700"
            >
              <LogOut className="mr-2 h-4 w-4 text-red-500" />
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
