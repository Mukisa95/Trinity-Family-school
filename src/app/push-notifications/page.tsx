"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';

import { GlassActionButton, GlassActionDock, GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { NotificationDetailPanel } from '@/components/notifications/NotificationDetailPanel';
import { NotificationInboxItem } from '@/components/notifications/NotificationInboxItem';
import { NotificationLinkPicker } from '@/components/notifications/notification-link-picker';
import { NotificationParticipantsDialog } from '@/components/notifications/notification-participants-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';
import { markInboxNotificationRead, removeInboxNotification, subscribeToUserNotificationInbox, type InboxNotification } from '@/lib/notification-inbox-store';
import { groupNotificationThreads } from '@/lib/notification-threads';
import { usePushSubscribe } from '@/lib/hooks/use-push-subscribe';
import type { NotificationDestinationSelection } from '@/lib/notifications/notification-destinations';
import type { Notification } from '@/types';

const TARGET_OPTIONS = [
  { value: 'all', label: 'All users', description: 'Every active app user' },
  { value: 'admins', label: 'Admins only', description: 'Administrators only' },
  { value: 'fees_staff', label: 'Fees & accounts', description: 'Fees staff and administrators' },
  { value: 'custom', label: 'Specific users', description: 'Enter user IDs manually' },
] as const;

type Target = (typeof TARGET_OPTIONS)[number]['value'];

function defaultScheduleFields() {
  const future = new Date(Date.now() + 10 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(future);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  };
}

function ComposeNotificationDialog({
  open,
  onOpenChange,
  userId,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onScheduled?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [destination, setDestination] = useState<NotificationDestinationSelection | null>(null);
  const [target, setTarget] = useState<Target>('all');
  const [customIds, setCustomIds] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'now' | 'scheduled'>('now');
  const [scheduleFields, setScheduleFields] = useState(defaultScheduleFields);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const close = (nextOpen: boolean) => {
    if (!isSending) onOpenChange(nextOpen);
  };

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !body.trim() || !userId) return;

    setIsSending(true);
    setResult(null);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || firebaseUser.uid !== userId) {
        throw new Error('Your secure session has expired. Please sign in again.');
      }

      const isScheduled = deliveryMode === 'scheduled';
      const response = await fetch(isScheduled ? '/api/notifications/scheduled' : '/api/notifications/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        },
        body: JSON.stringify({
          target: target === 'custom' ? undefined : target,
          userIds: target === 'custom'
            ? customIds.split(/[\s,]+/).map(value => value.trim()).filter(Boolean)
            : undefined,
          payload: { title: title.trim(), body: body.trim() },
          destination: destination || undefined,
          urgency: 'normal',
          ...(isScheduled ? {
            scheduleDate: scheduleFields.date,
            scheduleTime: scheduleFields.time,
          } : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Unable to send this notification.');

      setResult({
        ok: true,
        message: data.message || (isScheduled
          ? `Notification scheduled for ${scheduleFields.date} at ${scheduleFields.time}.`
          : 'Notification sent.'),
      });
      setTitle('');
      setBody('');
      setDestination(null);
      setCustomIds('');
      if (isScheduled) onScheduled?.();
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to send this notification.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const canSend = Boolean(
    title.trim()
    && body.trim()
    && userId
    && (target !== 'custom' || customIds.trim())
    && (deliveryMode === 'now' || (scheduleFields.date && scheduleFields.time)),
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex h-[calc(100dvh-1.5rem)] min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-none gap-0 overflow-hidden rounded-none border-0 bg-white p-0 sm:h-[min(760px,calc(100dvh-3rem))] sm:max-h-[calc(100dvh-3rem)] sm:max-w-2xl sm:rounded-2xl sm:border sm:p-0">
        <div className="flex h-full min-h-0 w-full flex-col">
          <div className="shrink-0 border-b border-slate-100 px-5 py-5 pr-14 sm:px-7">
            <DialogTitle className="text-xl font-bold text-slate-900">Compose notification</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-slate-500">
              Send an in-app message, with a push alert where the recipient has enabled it.
            </DialogDescription>
          </div>

          <form onSubmit={send} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 touch-pan-y space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Subject</span>
                <input
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="What should people see?"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Message</span>
                <textarea
                  value={body}
                  onChange={event => setBody(event.target.value)}
                  placeholder="Write your message…"
                  rows={8}
                  className="min-h-44 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
                <span className="mt-1.5 block text-xs text-slate-400">No message length limit.</span>
              </label>

              <div>
                <span className="mb-2 block text-sm font-semibold text-slate-700">Recipients</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TARGET_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTarget(option.value)}
                      className={`rounded-xl border px-3.5 py-3 text-left transition ${target === option.value
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-slate-800">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                    </button>
                  ))}
                </div>
                {target === 'custom' && (
                  <textarea
                    value={customIds}
                    onChange={event => setCustomIds(event.target.value)}
                    placeholder="Paste user IDs, separated by commas or new lines"
                    rows={3}
                    className="mt-3 w-full rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 font-mono text-xs outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                )}
              </div>

              <NotificationLinkPicker value={destination} onChange={setDestination} />

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-700">Delivery time</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDeliveryMode('now')} className={`rounded-xl border px-3.5 py-3 text-left transition ${deliveryMode === 'now' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <span className="block text-sm font-semibold text-slate-800">Send now</span>
                    <span className="mt-0.5 block text-xs text-slate-500">Deliver immediately</span>
                  </button>
                  <button type="button" onClick={() => setDeliveryMode('scheduled')} className={`rounded-xl border px-3.5 py-3 text-left transition ${deliveryMode === 'scheduled' ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <span className="block text-sm font-semibold text-slate-800">Schedule</span>
                    <span className="mt-0.5 block text-xs text-slate-500">Within about five minutes</span>
                  </button>
                </div>
                {deliveryMode === 'scheduled' && (
                  <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3.5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1.5 block text-xs font-semibold text-violet-900">Date</span>
                        <input type="date" value={scheduleFields.date} onChange={event => setScheduleFields(current => ({ ...current, date: event.target.value }))} className="h-11 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-semibold text-violet-900">Time · Africa/Kampala</span>
                        <input type="time" value={scheduleFields.time} onChange={event => setScheduleFields(current => ({ ...current, time: event.target.value }))} className="h-11 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
                      </label>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-violet-700">The notification will show you as the sender and will be marked internally as scheduled.</p>
                  </div>
                )}
              </fieldset>

              {result && (
                <div className={`flex gap-3 rounded-xl border p-3.5 text-sm ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                  {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{result.message}</span>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-7">
              <button type="button" onClick={() => close(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending || !canSend}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : deliveryMode === 'scheduled' ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {isSending ? 'Working…' : deliveryMode === 'scheduled' ? 'Schedule notification' : 'Send notification'}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ScheduledNotificationJob = {
  id: string;
  title: string;
  body: string;
  target: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';
  runAt: string | null;
  lastError?: string | null;
};

function ScheduledNotificationsDialog({
  open,
  onOpenChange,
  userId,
  refreshKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  refreshKey: number;
}) {
  const [jobs, setJobs] = useState<ScheduledNotificationJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastLoadedAtRef = useRef(0);
  const loadedRefreshKeyRef = useRef<number | null>(null);

  const loadJobs = useCallback(async (force = false) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.uid !== userId) return;
    if (!force && jobs.length && Date.now() - lastLoadedAtRef.current < 5 * 60 * 1000) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/notifications/scheduled', {
        headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load schedules.');
      setJobs(Array.isArray(result.jobs) ? result.jobs : []);
      lastLoadedAtRef.current = Date.now();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load schedules.');
    } finally {
      setLoading(false);
    }
  }, [jobs.length, userId]);

  useEffect(() => {
    if (!open) return;
    const refreshRequested = loadedRefreshKeyRef.current !== refreshKey;
    loadedRefreshKeyRef.current = refreshKey;
    void loadJobs(refreshRequested);
  }, [loadJobs, open, refreshKey]);

  const cancelJob = async (jobId: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.uid !== userId) return;
    setCancellingId(jobId);
    try {
      const response = await fetch(`/api/notifications/scheduled/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to cancel this schedule.');
      await loadJobs(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to cancel this schedule.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-slate-100 px-5 py-5 pr-14 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900"><CalendarClock className="h-5 w-5 text-violet-600" /> Scheduled notifications</DialogTitle>
          <DialogDescription className="mt-1">Upcoming and recently completed notifications. Times use Africa/Kampala.</DialogDescription>
        </div>
        <div className="max-h-[65dvh] overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(item => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>
          ) : jobs.length ? (
            <div className="space-y-3">
              {jobs.map(job => (
                <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-slate-900">{job.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{job.body}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${job.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : job.status === 'failed' ? 'bg-red-100 text-red-700' : job.status === 'cancelled' ? 'bg-slate-100 text-slate-600' : 'bg-violet-100 text-violet-700'}`}>{job.status}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <CalendarClock className="h-4 w-4 text-violet-500" />
                    <span>{job.runAt ? new Date(job.runAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' }) : 'Time unavailable'}</span>
                    {job.status === 'scheduled' && (
                      <button type="button" onClick={() => void cancelJob(job.id)} disabled={cancellingId === job.id} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                        {cancellingId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Cancel
                      </button>
                    )}
                  </div>
                  {job.lastError && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-700">{job.lastError}</p>}
                </article>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center"><CalendarClock className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No scheduled notifications</p><p className="mt-1 text-xs text-slate-400">Choose Schedule when composing a notification.</p></div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PushNotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading: subscriptionLoading,
    error: subscriptionError,
    subscribe,
    unsubscribe,
    sync,
  } = usePushSubscribe();
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [isInboxLoading, setIsInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [scheduledRefreshKey, setScheduledRefreshKey] = useState(0);
  const [participantsNotification, setParticipantsNotification] = useState<InboxNotification | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<{
    notification: InboxNotification;
    scope: 'me' | 'everyone';
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setIsInboxLoading(false);
      return;
    }
    return subscribeToUserNotificationInbox(user.id, snapshot => {
      setNotifications(snapshot.notifications);
      setIsInboxLoading(snapshot.isLoading);
      setInboxError(snapshot.error);
    });
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && isSupported && permission === 'granted') void sync(user.id);
  }, [isSupported, permission, sync, user?.id]);

  const threads = useMemo(
    () => groupNotificationThreads(notifications, user?.id || ''),
    [notifications, user?.id],
  );
  const selectedThread = threads.find(thread => thread.id === selectedThreadId) || null;
  const selected = selectedThread?.latest || null;

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return threads.filter(thread => {
      const matchesSearch = !term || thread.messages.some(notification => {
        const body = notification.description || notification.richContent?.longMessage || '';
        return `${notification.title} ${body}`.toLowerCase().includes(term);
      });
      return matchesSearch && (!showUnreadOnly || thread.unreadCount > 0);
    });
  }, [search, showUnreadOnly, threads]);

  const unreadCount = notifications.filter(notification => !notification.readBy?.includes(user?.id || '')).length;

  const selectNotification = useCallback((notification: Notification) => {
    const inboxNotification = notification as InboxNotification;
    const threadId = inboxNotification.threadId || inboxNotification.rootNotificationId || inboxNotification.id;
    setSelectedThreadId(threadId);
    if (user?.id) void markInboxNotificationRead(user.id, notification.id);
  }, [user?.id]);

  const toggleSubscription = useCallback(async () => {
    if (!user?.id || !isSupported) return;
    if (isSubscribed) await unsubscribe(user.id);
    else await subscribe(user.id);
  }, [isSubscribed, isSupported, subscribe, unsubscribe, user?.id]);

  const getSenderName = useCallback((notification: InboxNotification | null) => {
    if (!notification) return 'Trinity Family School';
    return notification.senderSnapshot?.displayName || 'Trinity Family School';
  }, []);

  const sendReply = useCallback(async (
    notification: Notification,
    reply: { mode: 'sender' | 'all'; message: string },
  ) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.uid !== user?.id) {
      throw new Error('Your secure session has expired. Please sign in again.');
    }
    const response = await fetch(`/api/notifications/${encodeURIComponent(notification.id)}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
      },
      body: JSON.stringify({
        mode: reply.mode,
        message: reply.message,
        requestId: crypto.randomUUID(),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to send your reply.');
  }, [user?.id]);

  const confirmDeletion = useCallback(async () => {
    if (!deleteRequest || isDeleting) return;
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.uid !== user?.id) {
      toast({
        variant: 'destructive',
        title: 'Sign in again',
        description: 'Your secure session has expired.',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/notifications/${encodeURIComponent(deleteRequest.notification.id)}?scope=${deleteRequest.scope}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete this notification.');

      removeInboxNotification(user.id, deleteRequest.notification.id);
      if (selected?.id === deleteRequest.notification.id) setSelectedThreadId(null);
      if (participantsNotification?.id === deleteRequest.notification.id) setParticipantsNotification(null);
      toast({
        title: deleteRequest.scope === 'everyone' ? 'Notification permanently deleted' : 'Notification removed',
        description: deleteRequest.scope === 'everyone'
          ? `Deleted the database notification and ${result.deletedDeliveries || 0} delivery record${result.deletedDeliveries === 1 ? '' : 's'}.`
          : 'This notification was removed from your inbox.',
      });
      setDeleteRequest(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to delete notification',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteRequest, isDeleting, participantsNotification?.id, selected?.id, toast, user?.id]);

  return (
    <div className="min-h-screen pb-24 md:h-dvh md:min-h-0 md:overflow-hidden md:pb-4">
      <GlassPageTopBar
        title="Notifications"
        backHref="/dashboard"
        backLabel="Dashboard"
        inlineActions
        actions={user?.id ? (
          <GlassActionDock>
            <GlassActionButton
              label="Scheduled"
              icon={<CalendarClock className="h-4 w-4" />}
              onClick={() => setScheduledOpen(true)}
              tone="emerald"
              title="View and cancel scheduled notifications"
            />
            <GlassActionButton
              label="Settings"
              icon={<Settings className="h-4 w-4" />}
              href="/push-notifications/settings"
              tone="violet"
              title="Configure automated notification alerts"
            />
            {isSupported && (
              <GlassActionButton
                label={subscriptionLoading ? 'Working' : isSubscribed ? 'Disable' : 'Enable'}
                icon={subscriptionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                onClick={toggleSubscription}
                disabled={subscriptionLoading}
                tone={isSubscribed ? 'slate' : 'blue'}
                title={isSubscribed ? 'Disable browser push notifications on this device' : 'Enable browser push notifications on this device'}
              />
            )}
          </GlassActionDock>
        ) : undefined}
      />

      <div className="mx-auto flex max-w-7xl flex-col px-1 sm:px-0 md:h-[calc(100dvh-7rem)] md:min-h-0">
        {!isSupported && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Push alerts are unavailable in this browser, but your in-app notifications remain here.
          </div>
        )}
        {isSupported && permission === 'denied' && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Browser push is blocked for this site. You can still read all delivered notifications here.
          </div>
        )}
        {isSupported && permission !== 'denied' && subscriptionError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Push notifications are not active on this device: {subscriptionError}
          </div>
        )}

        <div className="min-h-[calc(100dvh-10rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] md:min-h-0 md:flex-1 md:grid md:grid-cols-[minmax(340px,0.7fr)_minmax(0,1.3fr)]">
          <aside className={`${selected ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r border-slate-100 bg-white`}>
            <div className="border-b border-slate-100 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search notifications"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
                <SlidersHorizontal className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setShowUnreadOnly(false)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${!showUnreadOnly ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>All</button>
                <button onClick={() => setShowUnreadOnly(true)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${showUnreadOnly ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>Unread{unreadCount ? ` (${unreadCount})` : ''}</button>
                <span className="ml-auto text-xs font-medium text-slate-400">Newest first</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {isInboxLoading ? (
                <div className="space-y-3 p-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
              ) : inboxError ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">Unable to load notifications. {inboxError}</div>
              ) : filteredThreads.length ? (
                filteredThreads.map(thread => (
                  <NotificationInboxItem
                    key={thread.id}
                    notification={thread.latest}
                    isSelected={selectedThreadId === thread.id}
                    currentUserId={user?.id || ''}
                    senderName={getSenderName(thread.latest)}
                    onClick={selectNotification}
                    threadMessageCount={thread.messages.length}
                    threadUnreadCount={thread.unreadCount}
                    displayTitle={thread.subject}
                  />
                ))
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50"><Bell className="h-6 w-6 text-blue-500" /></div>
                  <p className="font-semibold text-slate-700">No notifications here</p>
                  <p className="mt-1 text-sm text-slate-400">{search || showUnreadOnly ? 'Try a different search or filter.' : 'Messages delivered to you will appear here.'}</p>
                </div>
              )}
            </div>
          </aside>

          <section className={`${selected ? 'fixed inset-0 z-40 flex md:static' : 'hidden md:flex'} min-h-0 flex-col bg-white`}>
            <NotificationDetailPanel
              notification={selected}
              threadNotifications={selectedThread?.messages}
              currentUserId={user?.id || ''}
              senderName={getSenderName(selected)}
              onClose={() => setSelectedThreadId(null)}
              onReply={sendReply}
              onViewRecipients={notification => setParticipantsNotification(notification as InboxNotification)}
              onDelete={(notification, scope = 'me') => setDeleteRequest({
                notification: notification as InboxNotification,
                scope: scope === 'everyone' ? 'everyone' : 'me',
              })}
              canReplyAll={user?.role !== 'Parent'}
              canDeletePermanently={Boolean(selected && (selected.createdBy === user?.id || user?.role === 'Admin'))}
              isMobile
            />
          </section>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="fixed bottom-6 right-5 z-30 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.4)] transition hover:scale-105 hover:from-blue-600 hover:to-blue-800 active:scale-95 sm:bottom-8 sm:right-8"
        aria-label="Compose notification"
      >
        <Plus className="h-5 w-5" />
        <span className="hidden sm:inline">Compose</span>
      </button>

      <ComposeNotificationDialog open={composerOpen} onOpenChange={setComposerOpen} userId={user?.id} onScheduled={() => setScheduledRefreshKey(value => value + 1)} />
      <ScheduledNotificationsDialog open={scheduledOpen} onOpenChange={setScheduledOpen} userId={user?.id} refreshKey={scheduledRefreshKey} />
      <NotificationParticipantsDialog
        open={Boolean(participantsNotification)}
        notificationId={participantsNotification?.id}
        onOpenChange={open => { if (!open) setParticipantsNotification(null); }}
      />

      <AlertDialog
        open={Boolean(deleteRequest)}
        onOpenChange={open => { if (!open && !isDeleting) setDeleteRequest(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 sm:mx-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle>
              {deleteRequest?.scope === 'everyone'
                ? 'Delete this notification from the database?'
                : 'Remove this notification from your inbox?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              {deleteRequest?.scope === 'everyone'
                ? 'This permanently deletes the notification and every recipient delivery record. It cannot withdraw push alerts that are already visible on devices, and this action cannot be undone.'
                : 'Only your inbox delivery will be deleted. The notification remains available to its sender and other recipients.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={event => {
                event.preventDefault();
                void confirmDeletion();
              }}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting
                ? 'Deleting...'
                : deleteRequest?.scope === 'everyone'
                  ? 'Delete permanently'
                  : 'Remove from inbox'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
