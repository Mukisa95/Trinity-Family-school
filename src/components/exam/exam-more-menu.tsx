'use client';

import Link from 'next/link';
import { Camera, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function ExamMoreMenu({ examName, snapshotHref, onDelete, deleteLabel = 'Delete exam', className }: {
  examName: string;
  snapshotHref?: string;
  onDelete: () => void;
  deleteLabel?: string;
  className?: string;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" size="sm" title="More" aria-label={`More options for ${examName}`}
        className={cn('h-8 shrink-0 gap-1 rounded-full border-brand-200 bg-transparent px-2 text-brand-ink-700 shadow-none hover:bg-brand-surface-50 dark:border-brand-800/60 dark:text-brand-ink-300 dark:hover:bg-brand-surface-950/40', className)}>
        <MoreHorizontal className="h-4 w-4" /><span className="text-[10px] font-semibold">More</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" collisionPadding={12} className="w-56 rounded-2xl border-brand-100 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
      <DropdownMenuLabel className="truncate text-xs text-muted-foreground" title={examName}>{examName}</DropdownMenuLabel>
      {snapshotHref && <DropdownMenuItem asChild className="min-h-10 rounded-xl">
        <Link href={snapshotHref}><Camera className="mr-2 h-4 w-4" />Edit snapshot data</Link>
      </DropdownMenuItem>}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onDelete} className="min-h-10 rounded-xl text-red-700 focus:bg-red-50 focus:text-red-800 dark:text-red-300 dark:focus:bg-red-950/40 dark:focus:text-red-200">
        <Trash2 className="mr-2 h-4 w-4" />{deleteLabel}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
