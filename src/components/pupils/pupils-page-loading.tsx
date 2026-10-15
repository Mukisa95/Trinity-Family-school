'use client';

import { useState } from 'react';
import { PupilsPageHeader } from './pupils-page-header';
import { PupilsSelectClassNotice } from './pupils-select-class-notice';
import { GlassActionButton, GlassActionDock } from '@/components/common/glass-page-top-bar';
import { ActionGuard } from '@/components/auth/action-guard';
import { Filter, Download, Plus } from 'lucide-react';

const parameter = (name: string) => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get(name) || '';

/** A cold route shows the actual page chrome; it never substitutes a pupil list. */
export function PupilsPageLoading() {
  const [selectedClassId, setSelectedClassId] = useState(() => parameter('classId'));
  const [searchQuery, setSearchQuery] = useState(() => parameter('q'));
  const setParameter = (name: string, value: string) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(name, value); else url.searchParams.delete(name);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };
  return <div className="min-h-screen" data-route-content-pending>
    <PupilsPageHeader selectedClassId={selectedClassId} searchQuery={searchQuery}
      onClassChange={value => { setSelectedClassId(value); setParameter('classId', value); }}
      onSearch={value => { setSearchQuery(value); setParameter('q', value); }} actions={
        <GlassActionDock className="flex-nowrap gap-0.5 px-1 sm:gap-1 sm:px-2">
          <GlassActionButton label="Filters" tone="blue" icon={<Filter className="h-4 w-4" />} disabled />
          <GlassActionButton label="Export" tone="emerald" icon={<Download className="h-4 w-4" />} disabled />
          <ActionGuard module="pupils" page="create" action="access_page">
            <GlassActionButton label="Add" tone="blue" icon={<Plus className="h-4 w-4" />} disabled />
          </ActionGuard>
        </GlassActionDock>
      } />
    <div className="mx-auto px-2 sm:px-6 pt-0 sm:pt-0 -mt-3 sm:-mt-5 pb-4 sm:pb-6">
      {selectedClassId ? <p role="status" className="p-6 text-sm text-muted-foreground">Opening pupils…</p> : <PupilsSelectClassNotice />}
    </div>
  </div>;
}
