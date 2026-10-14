'use client';

import { Users } from '@phosphor-icons/react';

export function PupilsSelectClassNotice() {
  return <div className="bg-white rounded-xl shadow-sm border border-brand-alt-100 p-12 text-center dark:bg-slate-900 dark:border-brand-alt-800/60">
    <div className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-brand-alt-surface-100 flex items-center justify-center dark:bg-brand-alt-surface-950/40">
        <Users className="w-8 h-8 text-brand-alt-ink-500 dark:text-brand-alt-ink-400" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-brand-alt-ink-700 mb-2 dark:text-brand-alt-ink-300">Select a Class</h3>
        <p className="text-brand-alt-ink-500 dark:text-brand-alt-ink-400">Please select a class from the dropdown above to view pupils</p>
      </div>
    </div>
  </div>;
}
