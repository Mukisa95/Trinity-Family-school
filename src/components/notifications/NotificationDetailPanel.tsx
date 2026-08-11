'use client';

import React from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Trash2,
  Bell,
  Clock,
  Download,
  FileText,
  Paperclip,
  Calendar,
  Users,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  SendHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';
import { Button } from '@/components/ui/button';

interface NotificationDetailPanelProps {
  notification: (Notification & { _isSender?: boolean }) | null;
  threadNotifications?: Array<Notification & { _isSender?: boolean }>;
  currentUserId: string;
  senderName?: string;
  // Retained for the legacy notifications screen; the compact header now uses
  // text only so the subject, sender, and date always fit in two lines.
  senderAvatar?: string;
  onClose?: () => void;  // back button on mobile
  onDelete?: (notification: Notification, type?: 'me' | 'everyone') => void;
  onResend?: (notification: Notification) => void;
  onRemind?: (notification: Notification, duration?: number) => void;
  onReply?: (notification: Notification, reply: { mode: 'sender' | 'all'; message: string }) => Promise<void>;
  onViewRecipients?: (notification: Notification) => void;
  canReplyAll?: boolean;
  canDeletePermanently?: boolean;
  isMobile?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Empty state when no notification is selected */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 px-8 text-center">
      <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center mb-6 shadow-inner">
        <Bell className="h-9 w-9 text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a notification</h3>
      <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
        Click any message in the list to read the full notification here.
      </p>
    </div>
  );
}

export function NotificationDetailPanel({
  notification,
  threadNotifications = [],
  currentUserId,
  senderName = 'System',
  onClose,
  onDelete,
  onResend,
  onRemind,
  onReply,
  onViewRecipients,
  canReplyAll = false,
  canDeletePermanently = false,
  isMobile = false,
}: NotificationDetailPanelProps) {
  const [showDeleteMenu, setShowDeleteMenu] = React.useState(false);
  const [showRemindMenu, setShowRemindMenu] = React.useState(false);
  const [replyMode, setReplyMode] = React.useState<'sender' | 'all'>('sender');
  const [replyMessage, setReplyMessage] = React.useState('');
  const [isReplyComposerOpen, setIsReplyComposerOpen] = React.useState(false);
  const [isReplying, setIsReplying] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);
  const deleteMenuRef = React.useRef<HTMLDivElement>(null);
  const remindMenuRef = React.useRef<HTMLDivElement>(null);
  const replySectionRef = React.useRef<HTMLFormElement>(null);

  // Close menus when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deleteMenuRef.current && !deleteMenuRef.current.contains(e.target as Node)) {
        setShowDeleteMenu(false);
      }
      if (remindMenuRef.current && !remindMenuRef.current.contains(e.target as Node)) {
        setShowRemindMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    setReplyMessage('');
    setReplyError(null);
    setIsReplyComposerOpen(false);
    setReplyMode(
      notification?.createdBy === currentUserId && canReplyAll && Boolean(notification.recipientIds?.length)
        ? 'all'
        : 'sender',
    );
  }, [canReplyAll, currentUserId, notification?.createdBy, notification?.id, notification?.recipientIds?.length]);

  React.useEffect(() => {
    if (!isReplyComposerOpen) return;
    const frame = window.requestAnimationFrame(() => {
      replySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isReplyComposerOpen, notification?.id]);

  if (!notification) {
    return (
      <div className="flex-1 bg-white h-full flex flex-col">
        <EmptyState />
      </div>
    );
  }

  const isSender = notification._isSender || notification.createdBy === currentUserId;
  const conversation = threadNotifications.length ? threadNotifications : [notification];
  const isThread = conversation.length > 1;
  const compactDate = format(new Date(notification.createdAt), "MMM d, yyyy - h:mm a");
  const attachments = notification.richContent?.attachments || [];
  const longMessage = notification.richContent?.longMessage;
  const destination = notification.metadata?.destination as { label?: unknown; url?: unknown } | undefined;
  const destinationUrl = typeof destination?.url === 'string'
    ? destination.url
    : typeof notification.pushUrl === 'string'
      ? notification.pushUrl
      : '';
  const safeDestinationUrl = destinationUrl.startsWith('/') && !destinationUrl.startsWith('//') ? destinationUrl : '';
  const destinationLabel = typeof destination?.label === 'string' && destination.label.trim()
    ? destination.label
    : 'Open linked page';
  const canReplyToSender = Boolean(onReply && notification.createdBy && notification.createdBy !== currentUserId);
  const canUseReplyAll = Boolean(onReply && canReplyAll && notification.recipientIds?.length);
  const canReply = canReplyToSender || canUseReplyAll;

  const submitReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onReply || !replyMessage.trim() || isReplying) return;
    setIsReplying(true);
    setReplyError(null);
    try {
      await onReply(notification, { mode: replyMode, message: replyMessage.trim() });
      setReplyMessage('');
      setIsReplyComposerOpen(false);
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : 'Unable to send your reply.');
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* ── Top toolbar ─────────────────────────────────── */}
      <div className="flex min-h-[4.25rem] items-center gap-2 border-b border-gray-100 bg-white/90 px-3 py-2 backdrop-blur-sm shrink-0 sm:px-4">
        {/* Back button (mobile) */}
        {(isMobile || onClose) && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
            aria-label="Back to notifications"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <div className="grid min-w-0 flex-1 grid-rows-2 content-center gap-0.5">
          <h2 className="truncate text-sm font-bold leading-5 text-slate-900 sm:text-[15px]" title={notification.title}>
            {notification.threadSubject || notification.title.replace(/^Re:\s*/i, '')}
          </h2>
          <p className="truncate text-xs leading-4 text-slate-500" title={`${isSender ? 'You' : senderName} - ${compactDate}`}>
            <span className="font-semibold text-slate-700">{isSender ? 'You' : senderName}</span>
            <span className="px-1 text-slate-300" aria-hidden="true">-</span>
            {compactDate}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {canReply && (
            <button
              type="button"
              onClick={() => setIsReplyComposerOpen(open => !open)}
              aria-expanded={isReplyComposerOpen}
              aria-controls="notification-reply-composer"
              title={isReplyComposerOpen ? 'Close reply' : 'Reply'}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-4 focus:ring-blue-100',
                isReplyComposerOpen ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50',
              )}
            >
              <MessageCircle className="h-4 w-4" />
              <span>Reply</span>
            </button>
          )}
          {onViewRecipients && notification.recipients && notification.recipients.length > 0 && (
            <button
              type="button"
              onClick={() => onViewRecipients(notification)}
              title="View recipients"
              aria-label="View recipients"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <Users className="h-4 w-4" />
            </button>
          )}
          {/* Resend / Reply */}
          {isSender && onResend && (
            <button
              onClick={() => onResend(notification)}
              title="Resend"
              className="flex items-center justify-center h-8 w-8 rounded-full text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          {/* Remind */}
          {onRemind && (
            <div className="relative" ref={remindMenuRef}>
              <button
                onClick={() => setShowRemindMenu((v) => !v)}
                title="Set Reminder"
                className="flex items-center justify-center h-8 w-8 rounded-full text-gray-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
              >
                <Clock className="h-4 w-4" />
              </button>
              {showRemindMenu && (
                <div className="absolute right-0 top-10 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-44 text-sm">
                  {[15, 30, 60, 240].map((min) => (
                    <button
                      key={min}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors"
                      onClick={() => {
                        onRemind(notification, min);
                        setShowRemindMenu(false);
                      }}
                    >
                      In {min < 60 ? `${min} min` : `${min / 60}h`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Delete */}
          {onDelete && (
            <div className="relative" ref={deleteMenuRef}>
              <button
                onClick={() => setShowDeleteMenu((v) => !v)}
                title="Delete"
                className="flex items-center justify-center h-8 w-8 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {showDeleteMenu && (
                <div className="absolute right-0 top-10 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-44 text-sm">
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors"
                    onClick={() => { onDelete(notification, 'me'); setShowDeleteMenu(false); }}
                  >
                    Remove from my inbox
                  </button>
                  {canDeletePermanently && (
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 transition-colors"
                      onClick={() => { onDelete(notification, 'everyone'); setShowDeleteMenu(false); }}
                    >
                      Delete from database
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pt-6 pb-10 max-w-3xl mx-auto">
          {isThread && (
            <section className="mb-6 space-y-3" aria-label="Conversation">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Conversation</p>
              {conversation.map(message => {
                const authoredByCurrentUser = message.createdBy === currentUserId || message._isSender;
                const body = message.description || message.richContent?.longMessage || 'No message body.';
                return (
                  <article
                    key={message.id}
                    className={cn(
                      'max-w-[92%] rounded-2xl border px-4 py-3 text-sm shadow-sm',
                      authoredByCurrentUser
                        ? 'ml-auto border-blue-200 bg-blue-50 text-slate-800'
                        : 'border-slate-200 bg-white text-slate-700',
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
                      <span>{authoredByCurrentUser ? 'You' : message.senderSnapshot?.displayName || 'Trinity Family School'}</span>
                      <time>{format(new Date(message.createdAt), 'MMM d, h:mm a')}</time>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{body}</p>
                  </article>
                );
              })}
            </section>
          )}

          {/* Message body */}
          {!isThread && notification.description && (
            <div className="mb-4">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {notification.description}
              </p>
            </div>
          )}

          {/* Long message (flow type) */}
          {!isThread && longMessage && (
            <div className="mb-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {longMessage}
              </p>
            </div>
          )}

          {safeDestinationUrl && (
            <a
              href={safeDestinationUrl}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
            >
              <ExternalLink className="h-4 w-4" />
              {destinationLabel}
            </a>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {attachments.length} Attachment{attachments.length > 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className={cn(
                        'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                        att.type === 'pdf'
                          ? 'bg-red-50 text-red-500'
                          : att.type === 'image'
                            ? 'bg-blue-50 text-blue-500'
                            : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      {att.type === 'pdf' ? (
                        <FileText className="h-4 w-4" />
                      ) : att.type === 'image' ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      ) : (
                        <Paperclip className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{att.name}</p>
                      <p className="text-[10px] text-gray-400">{formatFileSize(att.size)}</p>
                    </div>
                    <a
                      href={att.downloadUrl || att.url}
                      download={att.name}
                      className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canReply && isReplyComposerOpen && (
            <form
              ref={replySectionRef}
              id="notification-reply-composer"
              onSubmit={submitReply}
              className="mt-8 scroll-mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Reply</h3>
                <button
                  type="button"
                  onClick={() => setIsReplyComposerOpen(false)}
                  className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Reply recipients">
                <button
                  type="button"
                  onClick={() => setReplyMode('sender')}
                  disabled={!canReplyToSender}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-45',
                    replyMode === 'sender' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
                  )}
                >
                  Reply to sender
                </button>
                <button
                  type="button"
                  onClick={() => canUseReplyAll && setReplyMode('all')}
                  disabled={!canUseReplyAll}
                  title={canUseReplyAll ? 'Reply to the sender and every original recipient' : 'Reply all is only available to staff and administrators'}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-45',
                    replyMode === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
                  )}
                >
                  Reply all
                </button>
              </div>
              {!canUseReplyAll && (
                <p className="mt-2 text-xs text-slate-500">Reply all is reserved for staff and administrators to protect recipient privacy.</p>
              )}
              <textarea
                value={replyMessage}
                onChange={event => setReplyMessage(event.target.value)}
                placeholder="Write a reply..."
                rows={4}
                maxLength={12000}
                className="mt-3 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
              {replyError && <p className="mt-2 text-xs font-medium text-red-600">{replyError}</p>}
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">{replyMessage.length.toLocaleString()} / 12,000</span>
                <Button type="submit" size="sm" disabled={!replyMessage.trim() || isReplying} className="gap-2">
                  <SendHorizontal className="h-3.5 w-3.5" />
                  {isReplying ? 'Sending...' : replyMode === 'all' ? 'Send to all' : 'Send reply'}
                </Button>
              </div>
            </form>
          )}

          {/* Scheduled info */}
          {notification.scheduledFor && (
            <div className="mt-5 flex items-center gap-2 text-xs text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Scheduled for{' '}
                {format(new Date(notification.scheduledFor), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationDetailPanel;
