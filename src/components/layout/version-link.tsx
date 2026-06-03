"use client";

import React from 'react';
import Link from 'next/link';
import { useSidebar } from '@/components/ui/sidebar';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { APP_VERSION } from '@/lib/constants/version';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VersionLink() {
  const { state, isMobile, toggleSidebar } = useSidebar();

  return (
    <SidebarMenuButton
      onClick={toggleSidebar}
      className={cn(
        "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "group-data-[state=collapsed]:justify-center"
      )}
      tooltip={{
        children: state === 'expanded' ? "Collapse sidebar" : `Version ${APP_VERSION} - Click to expand`,
        side: "right",
        align: "center",
        hidden: state === 'expanded' && !isMobile
      }}
      aria-label={state === 'expanded' ? "Collapse sidebar" : "Expand sidebar"}
    >
      <Menu className="h-4 w-4 flex-shrink-0" />
      {state === 'expanded' && (
        <Link 
          href="/changelog" 
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="flex items-center gap-2 flex-1"
        >
          <span className="text-xs font-medium">
            v{APP_VERSION}
          </span>
        </Link>
      )}
    </SidebarMenuButton>
  );
}






















