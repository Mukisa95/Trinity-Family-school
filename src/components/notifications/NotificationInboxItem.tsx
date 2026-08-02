'use client';

import React from 'react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Notification, NotificationPriority } from '@/types';

interface NotificationInboxItemProps {
  notification: Notification & { _isSender?: boolean };
  isSelected?: boolean;
  currentUserId: string;
  onClick: (notification: Notification) => void;
  senderName?: string;
  senderAvatar?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

const PRIORITY_PILL: Record<NotificationPriority, { label: string; className: string }> = {
  low:    { label: 'Low',    className: 'bg-gray-100 text-gray-500 border-gray-200' },
  medium: { label: 'Med',   className: 'bg-blue-50 text-blue-600 border-blue-200' },
  high:   { label: 'High',  className: 'bg-orange-50 text-orange-600 border-orange-200' },
  urgent: { label: 'Urgent',className: 'bg-red-50 text-red-600 border-red-200' },
};

const TYPE_EMOJI: Record<string, string> = {
  reminder: '⏰',
  alert: '🚨',
  announcement: '📢',
  task: '✅',
  system: '⚙️',
  fee_reminder: '💰',
  exam_reminder: '📝',
  attendance_alert: '📋',
  flow: '💬',
};

// Avatar gradient palettes — deterministically picked by first char of name
const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-green-600',
];

function avatarGradient(name: string): string {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

export function NotificationInboxItem({
  notification,
  isSelected = false,
  currentUserId,
  onClick,
  senderName = 'System',
  senderAvatar,
}: NotificationInboxItemProps) {
  const isUnread = !notification.readBy?.includes(currentUserId);
  const isSender = notification._isSender || notification.createdBy === currentUserId;
  const initials = getInitials(senderName);
  const gradient = avatarGradient(senderName);
  const priorityPill = PRIORITY_PILL[notification.priority] || PRIORITY_PILL.medium;
  const typeEmoji = TYPE_EMOJI[notification.type] || '🔔';

  const previewText = notification.description
    || notification.richContent?.longMessage
    || 'No message body.';

  const hasAttachments =
    notification.richContent?.attachments && notification.richContent.attachments.length > 0;

  return (
    <button
      type="button"
      onClick={() => onClick(notification)}
      className={cn(
        'group w-full text-left px-4 py-3.5 flex items-start gap-3 transition-all duration-150 relative border-b border-gray-100',
        isSelected
          ? 'bg-blue-50 border-l-4 border-l-blue-500'
          : 'hover:bg-gray-50 border-l-4 border-l-transparent',
        isUnread && !isSelected && 'bg-white',
        !isUnread && !isSelected && 'bg-gray-50/60',
      )}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5 relative">
        {senderAvatar ? (
          <img
            src={senderAvatar}
            alt={senderName}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
        ) : (
          <div
            className={cn(
              'h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold shadow-sm ring-2 ring-white',
              gradient,
            )}
          >
            {initials}
          </div>
        )}
        {/* Sender indicator dot for sent items */}
        {isSender && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
            <svg className="w-1.5 h-1.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: Name + timestamp */}
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700',
            )}
          >
            {isSender ? 'You' : senderName}
          </span>
          <span className="shrink-0 text-[11px] text-gray-400 font-medium">
            {formatTimestamp(notification.createdAt)}
          </span>
        </div>

        {/* Row 2: Subject */}
        <div
          className={cn(
            'truncate text-sm mt-0.5',
            isUnread ? 'font-semibold text-gray-800' : 'text-gray-600',
          )}
        >
          <span className="mr-1">{typeEmoji}</span>
          {notification.title}
        </div>

        {/* Row 3: Preview + badges */}
        <div className="flex items-center gap-1.5 mt-1">
          <p className="truncate text-xs text-gray-400 flex-1">
            {previewText}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {hasAttachments && (
              <span className="text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </span>
            )}
            {notification.priority !== 'medium' && (
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border',
                  priorityPill.className,
                )}
              >
                {priorityPill.label}
              </span>
            )}
            {/* Unread dot */}
            {isUnread && (
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default NotificationInboxItem;
