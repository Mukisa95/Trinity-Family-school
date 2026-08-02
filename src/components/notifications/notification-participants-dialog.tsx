'use client';

import React from 'react';
import { Loader2, Search, Users } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { auth } from '@/lib/firebase';

type Participant = {
  userId: string;
  displayName: string;
  role: string;
  contextLabel?: string;
};

type ParticipantResponse = {
  canViewNames: boolean;
  total: number;
  recipients: Participant[];
  nextPage?: number | null;
};

interface NotificationParticipantsDialogProps {
  notificationId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationParticipantsDialog({
  notificationId,
  open,
  onOpenChange,
}: NotificationParticipantsDialogProps) {
  const [data, setData] = React.useState<ParticipantResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');

  const fetchParticipants = React.useCallback(async (page: number, append = false) => {
    if (!notificationId) return;
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setError('Sign in again to view recipients.');
      return;
    }

    append ? setIsLoadingMore(true) : setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/participants?page=${page}&pageSize=50`, {
        headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load recipients.');
      setData(previous => append && previous
        ? { ...result, recipients: [...previous.recipients, ...result.recipients] }
        : result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load recipients.');
    } finally {
      append ? setIsLoadingMore(false) : setIsLoading(false);
    }
  }, [notificationId]);

  React.useEffect(() => {
    if (!open || !notificationId) return;
    setSearch('');
    setData(null);
    void fetchParticipants(1);
  }, [fetchParticipants, notificationId, open]);

  const filteredRecipients = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data?.recipients || [];
    return (data?.recipients || []).filter(recipient =>
      `${recipient.displayName} ${recipient.role} ${recipient.contextLabel || ''}`.toLowerCase().includes(term),
    );
  }, [data?.recipients, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        <div className="border-b border-slate-100 px-5 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Users className="h-5 w-5 text-blue-600" />
            Recipients
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-500">
            {data?.total ? `${data.total} original recipient${data.total === 1 ? '' : 's'}` : 'People who received this notification'}
          </DialogDescription>
        </div>

        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
          ) : error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
          ) : data && !data.canViewNames ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Recipient names are private. You can still reply directly to the sender.
            </p>
          ) : data ? (
            <>
              <label className="relative mb-3 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search recipients"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
                {filteredRecipients.map(recipient => (
                  <div key={recipient.userId} className="px-3.5 py-3">
                    <p className="text-sm font-semibold text-slate-800">{recipient.displayName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{recipient.contextLabel || recipient.role}</p>
                  </div>
                ))}
                {!filteredRecipients.length && <p className="px-3.5 py-8 text-center text-sm text-slate-500">No matching recipients.</p>}
              </div>
              {data.nextPage && (
                <button
                  type="button"
                  onClick={() => void fetchParticipants(data.nextPage!, true)}
                  disabled={isLoadingMore}
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading...' : 'Show more recipients'}
                </button>
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
