"use client";

import React from 'react';
import { School } from 'lucide-react';

export function SchoolSettingsLoader() {
  return (
    <div className="flex flex-col items-center gap-2 w-full" role="status" aria-label="Loading school settings">
      <div className="w-16 h-16 mb-2 rounded-md bg-sidebar-accent border border-sidebar-border flex items-center justify-center">
        <School className="w-8 h-8 text-sidebar-foreground/40" />
      </div>
      <div className="h-4 w-24 rounded bg-sidebar-accent" />
      <div className="h-3 w-20 rounded bg-sidebar-accent" />
      <span className="sr-only">Loading school settings</span>
    </div>
  );
}
