'use client';

import React, { useMemo } from 'react';
import { NotificationBubble } from './NotificationBubble';
import { Bell, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

interface NotificationChatFeedProps {
    sentNotifications: Notification[];
    receivedNotifications: Notification[];
    currentUserId: string;
    isLoading?: boolean;
    expandedId?: string | null;
    onToggleExpand?: (id: string) => void;
    onResend?: (notification: Notification) => void;
    onDelete?: (notification: Notification, deleteType?: 'me' | 'everyone') => void;
    onRemind?: (notification: Notification, duration?: number) => void;
}

/**
 * 💬 Unified Chat-like Notification Feed
 * 
 * Merges sent and received notifications into a single timeline
 * - Sent: Right-aligned blue bubbles
 * - Received: Left-aligned gray bubbles
 * - Sorted by date (newest first for feed, or newest last for chat)
 */
export function NotificationChatFeed({
    sentNotifications,
    receivedNotifications,
    currentUserId,
    isLoading = false,
    expandedId,
    onToggleExpand,
    onResend,
    onDelete,
    onRemind
}: NotificationChatFeedProps) {

    // Merge and sort notifications (newest at top for notification feed style)
    const allNotifications = useMemo(() => {
        const merged = [
            ...sentNotifications.map(n => ({ ...n, _isSender: true })),
            ...receivedNotifications.map(n => ({ ...n, _isSender: false }))
        ];

        // Remove duplicates (in case sender is also a recipient)
        const unique = merged.reduce((acc, notif) => {
            const existing = acc.find(n => n.id === notif.id);
            if (!existing) {
                acc.push(notif);
            } else if (notif._isSender) {
                // Prefer sender view if user is both sender and recipient
                const idx = acc.indexOf(existing);
                acc[idx] = notif;
            }
            return acc;
        }, [] as (Notification & { _isSender: boolean })[]);

        // Sort by createdAt descending (newest first)
        return unique.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [sentNotifications, receivedNotifications]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <p className="text-sm text-gray-500">Loading notifications...</p>
            </div>
        );
    }

    if (allNotifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                    No notifications yet
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
                    When you send or receive notifications, they'll appear here in a chat-like feed.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col py-6 px-2">
            {/* Chat bubbles */}
            {allNotifications.map((notification) => (
                <NotificationBubble
                    key={notification.id}
                    notification={notification}
                    isSender={notification._isSender}
                    isExpanded={expandedId === notification.id}
                    onExpand={onToggleExpand}
                    onResend={onResend}
                    onDelete={onDelete}
                    onRemind={onRemind}
                />
            ))}

            {/* End of feed marker */}
            <div className="flex items-center justify-center py-6 mt-4">
                <div className="flex items-center gap-2">
                    <div className="h-px w-12 bg-gradient-to-r from-transparent to-gray-300 dark:to-gray-600"></div>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                        End of notifications
                    </span>
                    <div className="h-px w-12 bg-gradient-to-l from-transparent to-gray-300 dark:to-gray-600"></div>
                </div>
            </div>
        </div>
    );
}

export default NotificationChatFeed;
