'use client';

import type { ReactNode } from 'react';
import { ClassSelector } from '@/components/common/class-selector';
import { GlassPageTopBar, GlassPageSearchInput } from '@/components/common/glass-page-top-bar';

/** Identical chrome for the route boundary and the actual cached-data page. */
export function PupilsPageHeader({ heading = 'Pupils', selectedClassId, onClassChange, searchQuery, onSearch, actions }: {
  heading?: string; selectedClassId: string; onClassChange: (value: string) => void;
  searchQuery: string; onSearch: (value: string) => void; actions?: ReactNode;
}) {
  return (
      <GlassPageTopBar
        title={
          <>
            <span className="hidden lg:inline">{heading}</span>
            <span className="sr-only lg:hidden">Pupils</span>
          </>
        }
        className="pupils-page-topbar"
        backHref="/"
        backLabel="Back to dashboard"
        meta={null}
        inlineActions
        mobileTitleControlsBesideBack
        contentClassName="overflow-x-auto px-2 sm:px-4 lg:px-8"
        actionsClassName="min-w-0 shrink gap-1 lg:flex-none lg:gap-2 flex-1"
        titleControls={
          <div className="min-w-0 shrink-0 lg:hidden">
            <ClassSelector
              selectedClassId={selectedClassId}
              onClassChange={onClassChange}
              placeholder="Class"
              size="sm"
              showIcon={false}
              className="shrink-0"
              triggerClassName="h-[34px] w-[58px] min-w-0 max-w-[58px] rounded-full border-brand-200/60 bg-white/90 px-2 text-xs font-semibold text-brand-ink-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-brand-400/50 sm:w-[68px] sm:max-w-[68px] dark:border-brand-800/60 dark:bg-slate-900/90 dark:text-brand-ink-300"
              includeAllOption={true}
              allOptionLabel="All"
            />
          </div>
        }
        center={
          <>
            <ClassSelector
              selectedClassId={selectedClassId}
              onClassChange={onClassChange}
              placeholder="Class"
              size="sm"
              showIcon={false}
              className="shrink-0"
              triggerClassName="h-[34px] min-w-[120px] max-w-[160px] rounded-full border-brand-200/60 bg-white/90 px-3 text-xs font-semibold text-brand-ink-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-brand-400/50 dark:border-brand-800/60 dark:bg-slate-900/90 dark:text-brand-ink-300"
              includeAllOption={true}
              allOptionLabel="All Classes"
            />

            <GlassPageSearchInput
              placeholder="Search pupils..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
            />
          </>
        }
        actionsLeading={
          <GlassPageSearchInput
            placeholder="Search pupils..."
            value={searchQuery}
            onChange={(event) => onSearch(event.target.value)}
            containerClassName="min-w-0 flex-1 lg:hidden"
            className="w-full min-w-0"
          />
        }
        actions={actions}
      />
  );
}
