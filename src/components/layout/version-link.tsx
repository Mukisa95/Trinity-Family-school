"use client";

import React from 'react';
import Link from 'next/link';
import { useSidebar } from '@/components/ui/sidebar';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { APP_VERSION } from '@/lib/constants/version';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function VersionLink() {
  const { state, isMobile, toggleSidebar } = useSidebar();

  return (
    <div className="flex items-center gap-2 w-full justify-between group-data-[state=collapsed]:justify-center">
      {/* Menu Toggle Button */}
      <SidebarMenuButton
        onClick={toggleSidebar}
        className={cn(
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-auto p-1.5 rounded-md",
          "group-data-[state=collapsed]:w-full group-data-[state=collapsed]:justify-center"
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
      </SidebarMenuButton>

      {/* Adjacent Version Link - independent click target to avoid accidental clicks */}
      <AnimatePresence initial={false}>
        {state === 'expanded' && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <Link 
              href="/changelog" 
              className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors px-2.5 py-1 hover:bg-gray-100 rounded-md whitespace-nowrap"
            >
              v{APP_VERSION}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
