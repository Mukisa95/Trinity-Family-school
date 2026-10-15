"use client";

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClassStream } from '@/types';

export function StreamOrderEditor({ streams, disabled, onSave }: {
    streams: ClassStream[];
    disabled: boolean;
    onSave: (streamIds: string[]) => Promise<void>;
}) {
    const [draft, setDraft] = React.useState<string[] | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const streamMap = new Map(streams.map(stream => [stream.id, stream]));
    const changed = draft?.join('\0') !== streams.map(stream => stream.id).join('\0');
    const stale = draft !== null && (draft.length !== streams.length || draft.some(id => !streamMap.has(id)));
    const blocked = disabled || saving;

    const move = (index: number, direction: number) => setDraft(current => {
        if (!current) return current;
        const next = [...current];
        [next[index], next[index + direction]] = [next[index + direction], next[index]];
        return next;
    });
    const save = async () => {
        if (!draft || blocked || stale) return;
        setSaving(true);
        setError('');
        try {
            await onSave(draft);
            setDraft(null);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Could not save stream order. Try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-3 border-t pt-3">
            {!draft ? (
                <Button type="button" variant="outline" size="sm" className="w-full" disabled={blocked}
                    onClick={() => { setDraft(streams.map(stream => stream.id)); setError(''); }}>
                    <ArrowUpDown className="mr-2 h-4 w-4" />Arrange streams
                </Button>
            ) : (
                <section aria-label="Arrange streams" className="space-y-2">
                    <p className="text-xs font-semibold">Arrange streams</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">Choose the top-to-bottom order for this timetable. Each stream keeps its lessons.</p>
                    <ol aria-label="Stream order" className="space-y-1">
                        {draft.map((id, index) => (
                            <li key={id} className="flex items-center gap-1 rounded-md border px-2 py-1">
                                <span className="mr-1 text-xs text-muted-foreground">{index + 1}.</span>
                                <span className="min-w-0 flex-1 text-xs font-medium break-words">{streamMap.get(id)?.name || 'Stream no longer active'}</span>
                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 flex-none"
                                    aria-label={`Move ${streamMap.get(id)?.name || 'stream'} up`} disabled={blocked || stale || index === 0} onClick={() => move(index, -1)}>
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 flex-none"
                                    aria-label={`Move ${streamMap.get(id)?.name || 'stream'} down`} disabled={blocked || stale || index === draft.length - 1} onClick={() => move(index, 1)}>
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ol>
                    {stale && <p role="alert" className="text-xs text-destructive">The active streams changed. Cancel and reopen Arrange streams.</p>}
                    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setDraft(null)}>Cancel</Button>
                        <Button type="button" size="sm" disabled={blocked || stale || !changed} onClick={save}>
                            {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Save order
                        </Button>
                    </div>
                </section>
            )}
        </div>
    );
}
