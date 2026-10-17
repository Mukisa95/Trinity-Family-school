"use client";
import { ChevronDown, Copy, Folder, Trash2, Ungroup } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function StudioGroupRow({ name, count, collapsed, selected, onToggle, onSelect, onAction }: { name: string; count: number; collapsed: boolean; selected: boolean; onToggle: () => void; onSelect: () => void; onAction: (action: 'duplicate' | 'delete' | 'ungroup') => void }) {
  return <div className={cn('flex items-center gap-1 rounded-lg px-1 py-1', selected ? 'bg-violet-100' : 'bg-slate-100')}>
    <button type="button" className="grid h-11 w-11 shrink-0 lg:h-8 lg:w-6 shrink-0 place-items-center" aria-label={(collapsed ? 'Expand ' : 'Collapse ') + name} aria-expanded={!collapsed} onClick={onToggle}><ChevronDown className={cn('h-3 w-3', collapsed && '-rotate-90')} /></button>
    <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center lg:min-h-8 gap-1 text-left text-xs font-bold" aria-label={'Select group ' + name} onClick={onSelect}><Folder className="h-4 w-4 shrink-0" /><span className="truncate">{name}</span><span className="text-[10px] text-slate-500">{count}</span></button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-6" aria-label={'Duplicate group ' + name} onClick={() => onAction('duplicate')}><Copy className="h-3 w-3" /></Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-6" aria-label={'Ungroup ' + name} onClick={() => onAction('ungroup')}><Ungroup className="h-3 w-3" /></Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-6 text-rose-600" aria-label={'Delete group ' + name} onClick={() => onAction('delete')}><Trash2 className="h-3 w-3" /></Button>
  </div>;
}
