'use client';

import React, { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, CheckCheck, ChevronDown, ChevronUp, Users, Calendar, Send, Trash2, Bell, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';
import { useAuth } from '@/lib/contexts/auth-context';
import { useUsers } from '@/lib/hooks/use-users';
import { useStaff } from '@/lib/hooks/use-staff';
import Image from 'next/image';

interface NotificationBubbleProps {
    notification: Notification;
    isSender: boolean;
    onExpand?: (id: string) => void;
    isExpanded?: boolean;
    onResend?: (notification: Notification) => void;
    onDelete?: (notification: Notification, deleteType?: 'me' | 'everyone') => void;
    onRemind?: (notification: Notification, duration?: number) => void;
}

/**
 * 💬 iMessage-style Notification Bubble
 * 
 * Features:
 * - Sender bubbles: Right-aligned, blue gradient
 * - Received bubbles: Left-aligned, gray
 * - Expandable long messages
 * - Status ticks with live counts:
 *   ✓ Sent (total recipients)
 *   ✓✓ Delivered (gray)
 *   ✓✓ Read (blue)
 */
export function NotificationBubble({
    notification,
    isSender,
    onExpand,
    isExpanded = false,
    onResend,
    onDelete,
    onRemind
}: NotificationBubbleProps) {
    const [localExpanded, setLocalExpanded] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [showDeleteOptions, setShowDeleteOptions] = useState(false);
    const [showRemindOptions, setShowRemindOptions] = useState(false);
    const expanded = isExpanded || localExpanded;
    
    // Get users and staff data for sender info
    const { data: users = [] } = useUsers();
    const { data: staff = [] } = useStaff();
    const { user: currentUser } = useAuth();
    
    // Get sender information
    // For sent messages (isSender = true), use current user
    // For received messages, look up the sender from users or staff array
    const sender = React.useMemo(() => {
        if (isSender) {
            // For messages we sent, use current user
            return currentUser;
        } else {
            // For received messages, find the sender in users array first
            let foundSender = users.find(u => u.id === notification.createdBy);
            
            // If not found in users, check staff
            if (!foundSender) {
                const foundStaff = staff.find(s => s.userId === notification.createdBy);
                if (foundStaff) {
                    // Convert staff to user-like object
                    foundSender = {
                        id: foundStaff.userId || foundStaff.id,
                        name: `${foundStaff.firstName} ${foundStaff.lastName}`.trim(),
                        email: foundStaff.email,
                        avatar: foundStaff.photo,
                        role: 'Staff' as const,
                        createdAt: foundStaff.createdAt || new Date().toISOString()
                    };
                }
            }
            
            // Debug logging
            if (!foundSender && process.env.NODE_ENV === 'development') {
                console.log('[NotificationBubble] Sender not found:', {
                    notificationId: notification.id,
                    title: notification.title,
                    createdBy: notification.createdBy,
                    usersCount: users.length,
                    staffCount: staff.length,
                    currentUserId: currentUser?.id
                });
            }
            
            return foundSender || null;
        }
    }, [isSender, currentUser, users, staff, notification.createdBy]);
    
    const senderName = sender?.name || sender?.email?.split('@')[0] || 'System';
    const senderAvatar = sender?.avatar;
    const senderInitials = senderName
        .split(' ')
        .map(n => n[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 2) || '??';

    const stats = notification.deliveryStats || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
    const messageContent = notification.richContent?.longMessage || notification.description || '';
    const isLongMessage = messageContent.length > 200;
    const displayMessage = expanded || !isLongMessage
        ? messageContent
        : messageContent.slice(0, 200) + '...';

    const handleToggleExpand = () => {
        if (onExpand) {
            onExpand(notification.id);
        } else {
            setLocalExpanded(!localExpanded);
        }
    };

    // Format time - iMessage style (just time if today, date if older)
    const messageDate = notification.createdAt ? new Date(notification.createdAt) : new Date();
    const now = new Date();
    const isToday = messageDate.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === messageDate.toDateString();
    
    const timeDisplay = isToday 
        ? format(messageDate, 'h:mm a') // "9:41 AM"
        : isYesterday
        ? `Yesterday ${format(messageDate, 'h:mm a')}`
        : format(messageDate, 'MMM d, h:mm a'); // "Dec 21, 9:41 AM"
    
    const fullDate = notification.createdAt
        ? format(new Date(notification.createdAt), 'EEEE, MMMM d, yyyy \'at\' h:mm a')
        : '';

    const handleBubbleClick = () => {
        // Toggle actions on click
        setShowActions(!showActions);
    };

    const handleResend = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onResend) {
            onResend(notification);
        }
        setShowActions(false);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSender) {
            setShowDeleteOptions(!showDeleteOptions);
        } else {
            if (onDelete) {
                onDelete(notification, 'me');
            }
            setShowActions(false);
        }
    };

    const handleDeleteOption = (type: 'me' | 'everyone') => (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(notification, type);
        }
        setShowDeleteOptions(false);
        setShowActions(false);
    };

    const handleRemindClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowRemindOptions(!showRemindOptions);
    };

    const handleRemindDuration = (duration: number) => (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onRemind) {
            onRemind(notification, duration);
        }
        setShowRemindOptions(false);
        setShowActions(false);
    };

    return (
        <div className={cn(
            "flex w-full mb-4 group/message",
            isSender ? "justify-end" : "justify-start"
        )}>
            {/* Avatar (Left side for received messages) */}
            {!isSender && (
                <div className="flex-shrink-0 mr-2 mt-auto mb-1">
                    {senderAvatar ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm ring-2 ring-white dark:ring-gray-800">
                            <Image
                                src={senderAvatar}
                                alt={senderName}
                                width={32}
                                height={32}
                                className="object-cover w-full h-full"
                            />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {senderInitials}
                        </div>
                    )}
                </div>
            )}

            <div className={cn(
                "max-w-[75%] md:max-w-[65%] flex flex-col",
                isSender ? "items-end" : "items-start"
            )}>
                {/* Sender Name (for received messages) */}
                {!isSender && (
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 px-2">
                        {senderName}
                    </span>
                )}

                {/* Main Bubble */}
                <div 
                    className={cn(
                        "relative group/bubble cursor-pointer",
                        "transform transition-all duration-200 hover:scale-[1.02]",
                        isSender ? "items-end" : "items-start"
                    )}
                    onClick={handleBubbleClick}
                >
                    <div className={cn(
                        "rounded-[20px] px-4 py-3 shadow-sm transition-all duration-200",
                        "hover:shadow-md relative",
                        isSender
                            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-sm"
                    )}>
                        {/* Title */}
                        <h4 className={cn(
                            "font-semibold text-[15px] mb-1.5",
                            isSender ? "text-white" : "text-gray-900 dark:text-white"
                        )}>
                            {notification.title}
                        </h4>

                        {/* Message Content */}
                        <p className={cn(
                            "text-[15px] leading-[1.4] whitespace-pre-wrap",
                            isSender ? "text-white/95" : "text-gray-800 dark:text-gray-200"
                        )}>
                            {displayMessage}
                        </p>

                        {/* Expand/Collapse Button for Long Messages */}
                        {isLongMessage && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleToggleExpand(); }}
                                className={cn(
                                    "flex items-center gap-1 text-xs mt-2 font-medium transition-colors",
                                    isSender
                                        ? "text-white/80 hover:text-white"
                                        : "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                )}
                            >
                                {expanded ? (
                                    <>Show less <ChevronUp className="w-3 h-3" /></>
                                ) : (
                                    <>Read more <ChevronDown className="w-3 h-3" /></>
                                )}
                            </button>
                        )}

                        {/* Priority Badge (if urgent) */}
                        {notification.priority === 'urgent' && (
                            <span className={cn(
                                "inline-block mt-2 px-2 py-1 rounded-full text-[11px] font-semibold",
                                isSender
                                    ? "bg-white/20 text-white"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                            )}>
                                🔴 Urgent
                            </span>
                        )}

                        {/* iMessage-style tail */}
                        <div className={cn(
                            "absolute bottom-1 w-5 h-5",
                            isSender
                                ? "-right-1.5 bg-blue-600"
                                : "-left-1.5 bg-gray-200 dark:bg-gray-700"
                        )} 
                        style={{
                            clipPath: isSender 
                                ? 'polygon(0 0, 100% 0, 100% 100%)' 
                                : 'polygon(0 0, 100% 0, 0 100%)'
                        }}
                        />
                    </div>

                    {/* Timestamp & Status Row */}
                    <div className={cn(
                        "flex items-center gap-1.5 mt-1 px-1",
                        isSender ? "justify-end" : "justify-start"
                    )}>
                        {/* Timestamp */}
                        <span
                            className="text-[11px] font-medium text-gray-500 dark:text-gray-400"
                            title={fullDate}
                        >
                            {timeDisplay}
                        </span>

                        {/* Status Ticks (Sender Only) */}
                        {isSender && (
                            <StatusTicks
                                total={stats.total}
                                delivered={stats.delivered}
                                read={stats.read}
                                status={notification.status}
                            />
                        )}
                    </div>
                </div>

                {/* Action Buttons (Show on click) */}
                {showActions && (
                    <div className={cn(
                        "mt-2 flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 animate-in fade-in slide-in-from-top-2 duration-200",
                        isSender ? "justify-end" : "justify-start"
                    )}>
                        {isSender ? (
                            // Sender Actions: Resend & Delete
                            <>
                                <button
                                    onClick={handleResend}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                                    title="Resend notification"
                                >
                                    <Send className="w-4 h-4" />
                                    <span>Resend</span>
                                </button>
                                
                                <div className="relative">
                                    <button
                                        onClick={handleDeleteClick}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                        title="Delete notification"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete</span>
                                    </button>
                                    
                                    {/* Delete Options Dropdown - Positioned ABOVE button */}
                                    {showDeleteOptions && (
                                        <div className="absolute right-0 bottom-full mb-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                            <button
                                                onClick={handleDeleteOption('me')}
                                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                For me
                                            </button>
                                            <button
                                                onClick={handleDeleteOption('everyone')}
                                                className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                For everyone
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            // Receiver Actions: Delete & Remind
                            <>
                                <button
                                    onClick={handleDeleteClick}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                    title="Delete notification"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete</span>
                                </button>
                                
                                <div className="relative">
                                    <button
                                        onClick={handleRemindClick}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors"
                                        title="Set reminder"
                                    >
                                        <Clock className="w-4 h-4" />
                                        <span>Remind</span>
                                    </button>
                                    
                                    {/* Remind Duration Options Dropdown - Positioned ABOVE button */}
                                    {showRemindOptions && (
                                        <div className="absolute left-0 bottom-full mb-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                            <button
                                                onClick={handleRemindDuration(5)}
                                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                In 5 minutes
                                            </button>
                                            <button
                                                onClick={handleRemindDuration(15)}
                                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                In 15 minutes
                                            </button>
                                            <button
                                                onClick={handleRemindDuration(30)}
                                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                In 30 minutes
                                            </button>
                                            <button
                                                onClick={handleRemindDuration(60)}
                                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                In 1 hour
                                            </button>
                                            <button
                                                onClick={handleRemindDuration(120)}
                                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                In 2 hours
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Avatar (Right side for sent messages) */}
            {isSender && (
                <div className="flex-shrink-0 ml-2 mt-auto mb-1">
                    {senderAvatar ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm ring-2 ring-white dark:ring-gray-800">
                            <Image
                                src={senderAvatar}
                                alt={senderName}
                                width={32}
                                height={32}
                                className="object-cover w-full h-full"
                            />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {senderInitials}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * ✓✓ Status Ticks Component
 * Shows sent/delivered/read status with counts
 */
interface StatusTicksProps {
    total: number;
    delivered: number;
    read: number;
    status: string;
}

function StatusTicks({ total, delivered, read, status }: StatusTicksProps) {
    // Determine which status to show
    const isProcessing = status === 'processing' || status === 'pending';
    const hasDelivered = delivered > 0;
    const hasRead = read > 0;

    return (
        <div className="flex items-center gap-0.5">
            {/* Sent Tick */}
            {isProcessing ? (
                <span className="flex items-center gap-0.5 text-gray-400 dark:text-gray-500">
                    <Check className="w-3 h-3" />
                    <span className="text-[10px] font-medium">{total}</span>
                </span>
            ) : hasRead ? (
                // Read: Double blue ticks (like iMessage)
                <span className="flex items-center gap-0.5 text-blue-500 dark:text-blue-400">
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-semibold">{read}</span>
                </span>
            ) : hasDelivered ? (
                // Delivered: Double gray ticks
                <span className="flex items-center gap-0.5 text-gray-500 dark:text-gray-400">
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">{delivered}</span>
                </span>
            ) : (
                // Sent: Single tick
                <span className="flex items-center gap-0.5 text-gray-400 dark:text-gray-500">
                    <Check className="w-3 h-3" />
                    <span className="text-[10px] font-medium">{total}</span>
                </span>
            )}
        </div>
    );
}

export default NotificationBubble;
