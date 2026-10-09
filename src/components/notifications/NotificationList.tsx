
import React from 'react';
import { format } from 'date-fns';
import {
    Bell,
    CheckCircle,
    Trash2,
    Clock,
    Calendar,
    Users,
    Smartphone,
    FileText,
    Paperclip,
    Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Notification, NotificationPriority } from '@/types';

interface NotificationListProps {
    notifications: Notification[];
    expandedId: string | null;
    onToggleExpand: (id: string) => void;
    onMarkCompleted?: (id: string) => void;
    onDelete?: (id: string) => void;
    showSenderView?: boolean; // If true, show delivery stats. If false, show "From" (not implemented yet, default false)
    emptyMessage?: string;
}

const PRIORITY_COLORS = {
    low: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700',
    medium: 'bg-brand-surface-100 text-brand-ink-800 border-brand-200 dark:bg-brand-surface-950/40 dark:text-brand-ink-200 dark:border-brand-800/60',
    high: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-800/60',
    urgent: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800/60',
};

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-800/60',
    completed: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800/60',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700',
    failed: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800/60',
    sent: 'bg-brand-surface-100 text-brand-ink-800 border-brand-200 dark:bg-brand-surface-950/40 dark:text-brand-ink-200 dark:border-brand-800/60',
    delivered: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800/60',
    read: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800/60',
};

export function NotificationList({
    notifications,
    expandedId,
    onToggleExpand,
    onMarkCompleted,
    onDelete,
    showSenderView = false,
    emptyMessage = "No notifications found"
}: NotificationListProps) {

    const getPriorityColor = (priority: NotificationPriority) => {
        return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.low;
    };

    const getStatusColor = (status: string) => {
        return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
    };

    if (!notifications || notifications.length === 0) {
        return (
            <Card>
                <CardContent className="text-center p-10">
                    <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4 dark:text-slate-400" />
                    <p className="text-gray-500 dark:text-slate-400">{emptyMessage}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {notifications.map((notification) => (
                <Card key={notification.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader
                        className="pb-3"
                        onClick={() => onToggleExpand(notification.id)}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <CardTitle className="text-lg">{notification.title}</CardTitle>
                                    <Badge className={getPriorityColor(notification.priority)}>
                                        {notification.priority}
                                    </Badge>
                                    <Badge className={getStatusColor(notification.status)}>
                                        {notification.status}
                                    </Badge>
                                    {notification.enablePush && (
                                        <Badge variant="outline" className="text-brand-ink-600 border-brand-200 dark:text-brand-ink-400 dark:border-brand-800/60">
                                            <Smartphone className="w-3 h-3 mr-1" />
                                            Push
                                        </Badge>
                                    )}
                                    {notification.type === 'flow' && (
                                        <Badge variant="outline" className="text-brand-secondary-ink-600 border-brand-secondary-200 dark:text-brand-secondary-ink-400 dark:border-brand-secondary-800/60">
                                            <FileText className="w-3 h-3 mr-1" />
                                            Flow
                                        </Badge>
                                    )}
                                </div>
                                {notification.description && (
                                    <CardDescription className="text-sm">
                                        {notification.description}
                                    </CardDescription>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {onMarkCompleted && notification.status === 'pending' && (
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMarkCompleted(notification.id);
                                        }}
                                        className="h-8 w-8 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                    </Button>
                                )}
                                {onDelete && (
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(notification.id);
                                        }}
                                        className="h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-slate-400">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {format(new Date(notification.createdAt), 'MMM d, yyyy')}
                                </div>
                                {notification.scheduledFor && (
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {format(new Date(notification.scheduledFor), 'MMM d, HH:mm')}
                                    </div>
                                )}

                                {showSenderView && (
                                    <div className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {notification.recipients?.length || notification.deliveryStats?.total || 0} recipients
                                    </div>
                                )}
                            </div>

                            {showSenderView && notification.deliveryStats && (
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-green-600 dark:text-green-400">
                                        {notification.deliveryStats.sent} sent
                                    </span>
                                    {notification.deliveryStats.failed > 0 && (
                                        <span className="text-red-600 dark:text-red-400">
                                            {notification.deliveryStats.failed} failed
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>

                    {/* Expanded Content Section */}
                    {expandedId === notification.id && (
                        <CardContent className="pt-0 border-t bg-gray-50 dark:bg-slate-900">
                            <div className="space-y-4 pt-4">
                                {/* Flow notification rich content */}
                                {notification.type === 'flow' && notification.richContent && (
                                    <div className="space-y-3">
                                        {notification.richContent.longMessage && (
                                            <div>
                                                <h4 className="font-semibold text-sm mb-2">Full Message:</h4>
                                                <div className="bg-white p-3 rounded border text-sm whitespace-pre-wrap dark:bg-slate-900">
                                                    {notification.richContent.longMessage}
                                                </div>
                                            </div>
                                        )}

                                        {notification.richContent.attachments && notification.richContent.attachments.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold text-sm mb-2">Attachments:</h4>
                                                <div className="space-y-2">
                                                    {notification.richContent.attachments.map((attachment, index) => (
                                                        <div key={index} className="flex items-center gap-3 p-2 bg-white rounded border dark:bg-slate-900">
                                                            {attachment.type === 'image' ? (
                                                                <img src="/api/placeholder/40/40" alt="Attachment" className="w-8 h-8 rounded" />
                                                            ) : attachment.type === 'pdf' ? (
                                                                <FileText className="w-8 h-8 text-red-500 dark:text-red-400" />
                                                            ) : (
                                                                <Paperclip className="w-8 h-8 text-gray-500 dark:text-slate-400" />
                                                            )}
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium">{attachment.name}</p>
                                                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                                                    {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                                                </p>
                                                            </div>
                                                            <Button size="icon" variant="outline" className="h-8 w-8">
                                                                <Download className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Basic notification details */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium">Type:</span> {notification.type}
                                    </div>
                                    {showSenderView && (
                                        <div>
                                            <span className="font-medium">Recipients:</span> {notification.recipients?.length || 0}
                                        </div>
                                    )}
                                    <div>
                                        <span className="font-medium">Created:</span> {new Date(notification.createdAt).toLocaleDateString()}
                                    </div>
                                    <div>
                                        <span className="font-medium">Push Enabled:</span> {notification.enablePush ? 'Yes' : 'No'}
                                    </div>
                                </div>

                                {/* Push notification details - Only for Sender */}
                                {showSenderView && notification.enablePush && (
                                    <div className="border-t pt-3">
                                        <h4 className="font-semibold text-sm mb-2">Push Notification Details:</h4>
                                        <div className="space-y-2 text-sm">
                                            <div><span className="font-medium">Push Title:</span> {notification.pushTitle || notification.title}</div>
                                            <div><span className="font-medium">Push Body:</span> {notification.pushBody || notification.description}</div>
                                            <div><span className="font-medium">Click URL:</span> {notification.pushUrl || '/notifications'}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    )}
                </Card>
            ))}
        </div>
    );
}
