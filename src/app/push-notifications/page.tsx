"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Send,
  Users,
  ShieldCheck,
  DollarSign,
  User,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  ChevronRight,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePushSubscribe } from '@/lib/hooks/use-push-subscribe';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  url?: string;
  target: string;
  sentBy: string;
  sentAt: Timestamp;
  totalSubscriptions: number;
  sent: number;
  failed: number;
  expiredCleaned?: number;
}

// ─── Target group config ──────────────────────────────────────────────────────

const TARGET_OPTIONS = [
  {
    value: 'all',
    label: 'All Users',
    description: 'Every user with an active subscription',
    icon: Users,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    activeColor: 'bg-blue-600 text-white',
  },
  {
    value: 'admins',
    label: 'Admins Only',
    description: 'Admin role users only',
    icon: ShieldCheck,
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    activeColor: 'bg-violet-600 text-white',
  },
  {
    value: 'fees_staff',
    label: 'Fees / Accounts Staff',
    description: 'Users with fees or accounts access + admins',
    icon: DollarSign,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    activeColor: 'bg-emerald-600 text-white',
  },
  {
    value: 'custom',
    label: 'Custom User IDs',
    description: 'Enter specific user IDs (comma-separated)',
    icon: User,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    activeColor: 'bg-amber-600 text-white',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubscriptionStatusCard({
  isSupported,
  isSubscribed,
  permission,
  isLoading,
  userId,
  subscribe,
  unsubscribe,
}: {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  isLoading: boolean;
  userId: string;
  subscribe: (id: string) => Promise<boolean>;
  unsubscribe: (id: string) => Promise<boolean>;
}) {
  const [feedback, setFeedback] = useState<'ok' | 'fail' | null>(null);

  const handleToggle = async () => {
    setFeedback(null);
    const ok = isSubscribed ? await unsubscribe(userId) : await subscribe(userId);
    setFeedback(ok ? 'ok' : 'fail');
    setTimeout(() => setFeedback(null), 3000);
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-500">
        <BellOff className="w-5 h-5 text-gray-400" />
        Push notifications are not supported in this browser.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSubscribed ? 'bg-emerald-100' : 'bg-gray-100'}`}>
          {isSubscribed ? (
            <Bell className="w-5 h-5 text-emerald-600" />
          ) : (
            <BellOff className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {isSubscribed ? 'Notifications enabled on this device' : 'Notifications disabled on this device'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Browser permission: <span className="font-medium">{permission}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {feedback === 'ok' && <span className="text-xs text-emerald-600 font-medium">✓ Done</span>}
        {feedback === 'fail' && <span className="text-xs text-red-600 font-medium">✗ Failed</span>}
        <button
          onClick={handleToggle}
          disabled={isLoading || permission === 'denied'}
          className={`hidden text-sm font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isSubscribed
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSubscribed ? (
            'Disable'
          ) : (
            'Enable'
          )}
        </button>
      </div>
    </div>
  );
}

function LogEntry({ log }: { log: NotificationLog }) {
  const sentAt = log.sentAt?.toDate?.() || new Date();
  const successRate = log.totalSubscriptions > 0 ? Math.round((log.sent / log.totalSubscriptions) * 100) : 0;
  const targetLabel = TARGET_OPTIONS.find((t) => t.value === log.target)?.label || log.target;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-100 p-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{log.title}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{log.body}</p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] flex-shrink-0 ${
            successRate >= 80 ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700'
          }`}
        >
          {log.sent}/{log.totalSubscriptions} delivered
        </Badge>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-gray-400">
        <span>→ {targetLabel}</span>
        <span>{sentAt.toLocaleString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'short', timeStyle: 'short' })}</span>
        {log.expiredCleaned ? <span className="text-amber-600">{log.expiredCleaned} expired cleaned</span> : null}
      </div>

      {/* Success bar */}
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${successRate >= 80 ? 'bg-emerald-400' : 'bg-amber-400'}`}
          style={{ width: `${successRate}%` }}
        />
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PushNotificationsPage() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, permission, isLoading: subLoading, subscribe, unsubscribe } = usePushSubscribe();

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [target, setTarget] = useState<string>('all');
  const [customIds, setCustomIds] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    ok: boolean;
    message: string;
    sent?: number;
    total?: number;
  } | null>(null);

  // History
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Live log listener
  useEffect(() => {
    const q = query(
      collection(db, 'pushNotificationLog'),
      orderBy('sentAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationLog)));
        setLogsLoading(false);
      },
      () => setLogsLoading(false)
    );
    return unsub;
  }, []);

  const handleSend = useCallback(async () => {
    if (!title.trim() || !body.trim()) return;
    setIsSending(true);
    setSendResult(null);

    try {
      const effectiveTarget = target === 'custom' ? customIds.trim() : target;
      const res = await fetch('/api/notifications/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: target === 'custom' ? undefined : effectiveTarget,
          userIds: target === 'custom'
            ? customIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
            : undefined,
          payload: { title: title.trim(), body: body.trim(), url: url.trim() || '/' },
          urgency: 'normal',
          logSentBy: user?.id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSendResult({ ok: true, message: data.message, sent: data.sent, total: data.total });
        setTitle('');
        setBody('');
        setUrl('/');
        setCustomIds('');
      } else {
        setSendResult({ ok: false, message: data.error || 'Send failed' });
      }
    } catch (err) {
      setSendResult({ ok: false, message: 'Network error — please try again' });
    } finally {
      setIsSending(false);
    }
  }, [title, body, url, target, customIds, user?.id]);

  const selectedOption = TARGET_OPTIONS.find((t) => t.value === target)!;

  const handleSubscriptionToggle = useCallback(async () => {
    if (!user?.id) return;
    if (isSubscribed) {
      await unsubscribe(user.id);
      return;
    }
    await subscribe(user.id);
  }, [isSubscribed, subscribe, unsubscribe, user?.id]);

  return (
    <div className="min-h-screen pb-12">
      <GlassPageTopBar
        title="Push Notifications"
        subtitle="Send direct push notifications to active app users"
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={isSupported && user?.id ? (
          <GlassActionDock>
            <GlassActionButton
              label={subLoading ? 'Working' : isSubscribed ? 'Disable' : 'Enable'}
              icon={subLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              tone={isSubscribed ? 'slate' : 'emerald'}
              onClick={handleSubscriptionToggle}
              disabled={subLoading || permission === 'denied'}
              title={
                permission === 'denied'
                  ? 'Push notifications are blocked in this browser'
                  : isSubscribed
                    ? 'Disable push notifications on this device'
                    : 'Enable push notifications on this device'
              }
            />
          </GlassActionDock>
        ) : undefined}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── This device subscription status ────────────────────────────── */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
              <Bell className="w-4 h-4" /> This Device
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SubscriptionStatusCard
              isSupported={isSupported}
              isSubscribed={isSubscribed}
              permission={permission}
              isLoading={subLoading}
              userId={user?.id || ''}
              subscribe={subscribe}
              unsubscribe={unsubscribe}
            />
            {permission === 'denied' && (
              <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg p-3">
                🚫 Notifications are blocked in this browser. Open the browser's site settings (lock icon → Site settings → Notifications → Allow) to re-enable them.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Compose & Send ─────────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
              <Send className="w-4 h-4" /> Compose Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. School Fee Reminder"
                maxLength={100}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              />
              <p className="text-[11px] text-gray-400 mt-1 text-right">{title.length}/100</p>
            </div>

            {/* Body */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your notification message here…"
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-y"
              />
              <p className="text-[11px] text-gray-400 mt-1 text-right">{body.length.toLocaleString()} characters</p>
            </div>

            {/* URL */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                Link (tap on notification opens this page)
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                          placeholder="/ or /accounts/schoolpay-feed"
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-mono"
              />
            </div>

            {/* Target selector */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">
                Recipients
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TARGET_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = target === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTarget(opt.value)}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-150 ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isActive ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                      </div>
                      <span className={`text-[11px] font-bold leading-tight ${isActive ? 'text-indigo-700' : 'text-gray-700'}`}>
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-gray-400 leading-tight">{opt.description}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom IDs input */}
              <AnimatePresence>
                {target === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <textarea
                      value={customIds}
                      onChange={(e) => setCustomIds(e.target.value)}
                      placeholder="Paste user IDs here, one per line or comma-separated…"
                      rows={3}
                      className="w-full text-xs font-mono border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Preview card */}
            {(title || body) && (
              <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4">
                <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wide mb-2">Preview</p>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{title || 'Notification title'}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{body || 'Notification body text…'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Result banner */}
            <AnimatePresence>
              {sendResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`flex items-center gap-3 p-4 rounded-xl ${
                    sendResult.ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {sendResult.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`text-sm font-semibold ${sendResult.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                      {sendResult.ok ? 'Notification sent!' : 'Send failed'}
                    </p>
                    <p className={`text-xs mt-0.5 ${sendResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sendResult.message}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={isSending || !title.trim() || !body.trim() || (target === 'custom' && !customIds.trim())}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all shadow-md shadow-indigo-200 active:scale-[0.99]"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send to {TARGET_OPTIONS.find((t) => t.value === target)?.label || 'Selected Users'}
                </>
              )}
            </button>
          </CardContent>
        </Card>

        {/* ── SchoolPay auto-alert notice ─────────────────────────────────── */}
        <div className="flex items-start gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">SchoolPay Auto-Alerts Active</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Every time a SchoolPay payment is received, a push notification is automatically sent to all Fees &amp; Accounts staff and Admins. No manual action needed.
            </p>
          </div>
        </div>

        {/* ── Send History ───────────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                <History className="w-4 h-4" /> Send History
              </CardTitle>
              {logsLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notifications sent yet</p>
                <p className="text-xs mt-1">Send your first notification above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <LogEntry key={log.id} log={log} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
