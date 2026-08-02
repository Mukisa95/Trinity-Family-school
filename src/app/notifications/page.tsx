"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNotifications, useSentNotifications, useReceivedNotifications } from '@/lib/hooks/use-notifications';
import { useSyncContext } from '@/context/SyncContext';
import { useNotificationBadge } from '@/lib/hooks/use-notification-badge';
import { pushNotificationService } from '@/lib/services/push-notifications.service';
import { notificationService } from '@/lib/services/notification-service';
import { NotificationProgress } from '@/components/NotificationProgress';
import { format } from 'date-fns';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { GlassPageRouteSkeleton } from "@/components/common/glass-page-loading";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Bell,
  CheckCircle,
  Trash2,
  Clock,
  AlertCircle,
  Wifi,
  WifiOff,
  Calendar,
  Users,
  MessageSquare,
  Smartphone,
  X,
  Upload,
  FileText,
  Download,
  Paperclip,
  Search,
  Edit3,
  Send,
  RefreshCw,
} from 'lucide-react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from '@/components/ui/modern-dialog';
import { AdvancedRecipientPicker } from '@/components/notifications/AdvancedRecipientPicker';
import { NotificationInboxItem } from '@/components/notifications/NotificationInboxItem';
import { NotificationDetailPanel } from '@/components/notifications/NotificationDetailPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type {
  Notification,
  NotificationType,
  NotificationPriority,
  CreateNotificationData,
  NotificationRecipient
} from '@/types';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { deleteDoc, doc, updateDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUsers } from '@/lib/hooks/use-users';
import { useStaff } from '@/lib/hooks/use-staff';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES: { value: NotificationType; label: string; icon: React.ReactNode }[] = [
  { value: 'reminder', label: 'Reminder', icon: <Clock className="h-4 w-4" /> },
  { value: 'alert', label: 'Alert', icon: <AlertCircle className="h-4 w-4" /> },
  { value: 'announcement', label: 'Announcement', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'task', label: 'Task', icon: <CheckCircle className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Bell className="h-4 w-4" /> },
  { value: 'fee_reminder', label: 'Fee Reminder', icon: <Calendar className="h-4 w-4" /> },
  { value: 'exam_reminder', label: 'Exam Reminder', icon: <Calendar className="h-4 w-4" /> },
  { value: 'attendance_alert', label: 'Attendance Alert', icon: <Users className="h-4 w-4" /> },
  { value: 'flow', label: 'Flow (Rich Content)', icon: <MessageSquare className="h-4 w-4" /> },
];

// ─── Hook: detect mobile ───────────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

// ─── Sender resolver ──────────────────────────────────────────────────────────
function useSenderInfo(createdBy: string | undefined, users: any[], staff: any[], currentUser: any) {
  return useMemo(() => {
    if (!createdBy) return { name: 'System', avatar: undefined };
    if (createdBy === currentUser?.id) {
      const displayName = currentUser?.firstName && currentUser?.lastName
        ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
        : currentUser?.username || currentUser?.email?.split('@')[0] || 'You';
      return { name: displayName, avatar: undefined };
    }
    const user = users.find(u => u.id === createdBy);
    if (user) return { name: user.name || user.email?.split('@')[0] || 'User', avatar: user.avatar };
    const staffMember = staff.find(s => s.userId === createdBy);
    if (staffMember) {
      return {
        name: `${staffMember.firstName} ${staffMember.lastName}`.trim() || 'Staff',
        avatar: staffMember.photo,
      };
    }
    return { name: 'System', avatar: undefined };
  }, [createdBy, users, staff, currentUser]);
}

// ─── Compose form (shared) ────────────────────────────────────────────────────
interface ComposeFormProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isCreating: boolean;
  isPushSupported: boolean;
  pushPermission: NotificationPermission;
  isUploadingFile: boolean;
  uploadProgress: number;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveAttachment: (id: string) => void;
  handleRequestPermission: () => void;
  isRequestingPermission: boolean;
}

function ComposeForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isCreating,
  isPushSupported,
  pushPermission,
  isUploadingFile,
  uploadProgress,
  handleFileUpload,
  handleRemoveAttachment,
  handleRequestPermission,
  isRequestingPermission,
}: ComposeFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Academic context banner */}
      <div className="p-2 border rounded-lg text-[0.65rem] bg-amber-50 border-amber-200 flex items-center gap-2">
        <Bell className="h-3 w-3 text-amber-600 shrink-0" />
        <span className="font-medium text-amber-700">Notification Management</span>
        <span className="ml-auto text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
          {format(new Date(), "MMM dd, yyyy")}
        </span>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="compose-title" className="text-sm font-semibold">
          Subject <span className="text-red-500">*</span>
        </Label>
        <Input
          id="compose-title"
          value={formData.title}
          onChange={(e) => setFormData((p: any) => ({ ...p, title: e.target.value }))}
          placeholder="Enter notification title"
          className="rounded-xl"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="compose-description" className="text-sm font-semibold">Message</Label>
        <Textarea
          id="compose-description"
          value={formData.description}
          onChange={(e) => setFormData((p: any) => ({ ...p, description: e.target.value }))}
          placeholder="Write your message here…"
          rows={4}
          className="rounded-xl resize-none"
        />
      </div>

      {/* Type + Priority grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Type</Label>
          <Select
            value={formData.type}
            onValueChange={(v: NotificationType) => setFormData((p: any) => ({ ...p, type: v }))}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  <div className="flex items-center gap-2">{t.icon}<span>{t.label}</span></div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Priority</Label>
          <Select
            value={formData.priority}
            onValueChange={(v: NotificationPriority) => setFormData((p: any) => ({ ...p, priority: v }))}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">🟢 Low</SelectItem>
              <SelectItem value="medium">🔵 Medium</SelectItem>
              <SelectItem value="high">🟠 High</SelectItem>
              <SelectItem value="urgent">🔴 Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Schedule */}
      <div className="space-y-1.5">
        <Label htmlFor="compose-schedule" className="text-sm font-semibold">
          Schedule for (optional)
        </Label>
        <Input
          id="compose-schedule"
          type="datetime-local"
          value={formData.scheduledFor}
          onChange={(e) => setFormData((p: any) => ({ ...p, scheduledFor: e.target.value }))}
          className="rounded-xl"
        />
      </div>

      {/* Flow-specific: long message + attachments */}
      {formData.type === 'flow' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="compose-long-msg" className="text-sm font-semibold">
              Long Message <span className="text-gray-400 text-xs font-normal">(up to 5000 chars)</span>
            </Label>
            <Textarea
              id="compose-long-msg"
              value={formData.longMessage}
              onChange={(e) => setFormData((p: any) => ({ ...p, longMessage: e.target.value }))}
              placeholder="Detailed message content…"
              rows={6}
              className="rounded-xl resize-vertical"
              maxLength={5000}
            />
            <p className="text-xs text-gray-400">{formData.longMessage.length}/5000</p>
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Attachments</Label>
              <div>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                  onChange={handleFileUpload}
                  disabled={isUploadingFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={isUploadingFile}
                >
                  {isUploadingFile
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                    : <><Upload className="h-3.5 w-3.5 mr-1.5" />Add File</>
                  }
                </Button>
              </div>
            </div>

            {isUploadingFile && (
              <div className="space-y-1">
                <Progress value={uploadProgress} className="w-full h-1.5" />
                <p className="text-xs text-gray-400">{uploadProgress}%</p>
              </div>
            )}

            {formData.attachments.length > 0 && (
              <div className="space-y-1.5">
                {formData.attachments.map((att: any) => (
                  <div key={att.id} className="flex items-center gap-2 p-2.5 border rounded-xl bg-gray-50">
                    {att.type === 'pdf' ? (
                      <FileText className="h-4 w-4 text-red-500 shrink-0" />
                    ) : att.type === 'image' ? (
                      <img src={att.url} alt={att.name} className="h-6 w-6 object-cover rounded" />
                    ) : (
                      <Paperclip className="h-4 w-4 text-blue-500 shrink-0" />
                    )}
                    <span className="flex-1 text-xs truncate">{att.name}</span>
                    <span className="text-xs text-gray-400">
                      {(att.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="h-5 w-5 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Markdown toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="useMarkdown"
              checked={formData.useMarkdown}
              onCheckedChange={(v: boolean) => setFormData((p: any) => ({ ...p, useMarkdown: v }))}
            />
            <Label htmlFor="useMarkdown" className="text-sm cursor-pointer">
              Enable Markdown formatting
            </Label>
          </div>
        </>
      )}

      {/* Recipients */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">
          Recipients <span className="text-red-500">*</span>
        </Label>
        <AdvancedRecipientPicker
          selectedRecipients={formData.recipients}
          onRecipientsChange={(recipients) => setFormData((p: any) => ({ ...p, recipients }))}
        />
      </div>

      {/* Push notification settings */}
      {isPushSupported && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">Push Notifications</Label>
              <p className="text-xs text-gray-400">Send to devices in real-time</p>
              {pushPermission !== 'granted' && (
                <p className="text-xs text-amber-600 mt-0.5">⚠️ Browser permission required</p>
              )}
            </div>
            <input
              type="checkbox"
              checked={formData.enablePush}
              onChange={(e) => setFormData((p: any) => ({ ...p, enablePush: e.target.checked }))}
              className="h-4 w-4 rounded"
              disabled={pushPermission === 'denied'}
            />
          </div>

          {pushPermission !== 'granted' && formData.enablePush && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 text-xs">Permission Required</p>
                  <p className="text-amber-700 text-xs mt-0.5">
                    {pushPermission === 'default'
                      ? 'You\'ll be prompted for permission when you send.'
                      : 'Push notifications are blocked in browser settings.'
                    }
                  </p>
                  {pushPermission === 'default' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleRequestPermission}
                      disabled={isRequestingPermission}
                      className="mt-2 h-7 px-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
                    >
                      {isRequestingPermission
                        ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Requesting…</>
                        : 'Request Permission'
                      }
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {formData.enablePush && pushPermission === 'granted' && (
            <div className="space-y-3 pl-3 border-l-2 border-blue-200">
              <div>
                <Label htmlFor="compose-push-title" className="text-xs font-medium">Push Title (optional)</Label>
                <Input
                  id="compose-push-title"
                  value={formData.pushTitle}
                  onChange={(e) => setFormData((p: any) => ({ ...p, pushTitle: e.target.value }))}
                  placeholder="Leave blank to use main title"
                  className="rounded-xl mt-1 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="compose-push-body" className="text-xs font-medium">Push Message (optional)</Label>
                <Textarea
                  id="compose-push-body"
                  value={formData.pushBody}
                  onChange={(e) => setFormData((p: any) => ({ ...p, pushBody: e.target.value }))}
                  placeholder="Leave blank to use description"
                  rows={2}
                  className="rounded-xl mt-1 text-sm resize-none"
                />
              </div>
              <div>
                <Label htmlFor="compose-push-url" className="text-xs font-medium">Click URL</Label>
                <Input
                  id="compose-push-url"
                  value={formData.pushUrl}
                  onChange={(e) => setFormData((p: any) => ({ ...p, pushUrl: e.target.value }))}
                  placeholder="/notifications"
                  className="rounded-xl mt-1 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="rounded-full text-gray-500 hover:text-gray-700"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isCreating}
          className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6"
        >
          {isCreating
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
            : <><Send className="h-4 w-4 mr-2" />Send</>
          }
        </Button>
      </div>
    </form>
  );
}

// ─── Push Settings Dialog ─────────────────────────────────────────────────────

interface PushSettingsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPushSupported: boolean;
  pushPermission: NotificationPermission;
  userPushSubscription: any;
  isRequestingPermission: boolean;
  isSubscribingToPush: boolean;
  isUnsubscribingFromPush: boolean;
  onRequestPermission: () => void;
  onToggleSubscription: () => void;
}

function PushSettingsDialog({
  open, onOpenChange,
  isPushSupported, pushPermission, userPushSubscription,
  isRequestingPermission, isSubscribingToPush, isUnsubscribingFromPush,
  onRequestPermission, onToggleSubscription,
}: PushSettingsDialogProps) {
  return (
    <ModernDialog open={open} onOpenChange={onOpenChange}>
      <ModernDialogContent size="md">
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Push Notification Settings
          </ModernDialogTitle>
          <ModernDialogDescription>
            Manage your push notification preferences and permissions
          </ModernDialogDescription>
        </ModernDialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Permission Status</Label>
                <p className="text-sm text-gray-500">Current browser permission</p>
              </div>
              <Badge className={
                pushPermission === 'granted'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : pushPermission === 'denied'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : 'bg-yellow-100 text-yellow-800 border-yellow-200'
              }>
                {pushPermission === 'granted' ? 'Granted' : pushPermission === 'denied' ? 'Denied' : 'Not Requested'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Subscription:</span>
              <Badge variant="outline" className={userPushSubscription ? 'text-green-600' : 'text-gray-600'}>
                {userPushSubscription ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Push Notifications</Label>
                <p className="text-sm text-gray-500">Receive alerts even when browser is closed</p>
              </div>
              <div className="flex items-center gap-2">
                {pushPermission === 'default' && (
                  <Button
                    onClick={onRequestPermission}
                    disabled={isRequestingPermission}
                    size="icon"
                    className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isRequestingPermission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  </Button>
                )}
                {pushPermission === 'granted' && (
                  <Button
                    onClick={onToggleSubscription}
                    variant={userPushSubscription ? "destructive" : "default"}
                    disabled={isSubscribingToPush || isUnsubscribingFromPush}
                    size="icon"
                    className={cn(
                      'h-10 w-10 rounded-full',
                      userPushSubscription
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    )}
                  >
                    {(isSubscribingToPush || isUnsubscribingFromPush)
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Bell className={cn("h-4 w-4", userPushSubscription && 'animate-pulse')} />
                    }
                  </Button>
                )}
                {pushPermission === 'denied' && (
                  <div className="text-sm text-red-600 text-right">
                    <p>Blocked</p>
                    <p className="text-xs">Enable in browser settings</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {userPushSubscription && pushPermission === 'granted' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-900 mb-1.5">How Background Notifications Work</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {[
                      'Browser Closed: Notifications still appear via service worker',
                      'Signed In: Works as long as you\'re logged into the app',
                      'Device Specific: Enable on each device separately',
                      'Instant Alerts: Receive important updates immediately',
                    ].map(item => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!isPushSupported && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-start gap-2 text-sm text-gray-700">
              <AlertCircle className="h-4 w-4 text-gray-600 mt-0.5" />
              <div>
                <p className="font-medium">Push Notifications Not Supported</p>
                <p>Your browser doesn't support push notifications. Notifications will only appear when the app is open.</p>
              </div>
            </div>
          )}
        </div>

        <ModernDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 w-10 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { toast } = useToast();
  const {
    notifications,
    isLoading,
    error,
    fetchNotifications,
    addNotification,
    markAsCompleted,
    deleteNotification,
    isSyncing,
    subscribeToPush,
    unsubscribeFromPush,
    isCreating,
    isSubscribingToPush,
    isUnsubscribingFromPush
  } = useNotifications();

  const { data: sentNotifications = [], isLoading: isSentLoading } = useSentNotifications();
  const { data: receivedNotifications = [], isLoading: isReceivedLoading } = useReceivedNotifications();
  const { data: users = [] } = useUsers();
  const { data: staff = [] } = useStaff();
  const { user } = useAuth();
  const { fetchUnreadCount: refreshBadge, markAllAsRead } = useNotificationBadge();
  const { isOnline, syncNow } = useSyncContext();

  // UI state
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'sent'>('all');
  const [search, setSearch] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<(Notification & { _isSender?: boolean }) | null>(null);
  const [showDetailMobile, setShowDetailMobile] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'reminder' as NotificationType,
    priority: 'medium' as NotificationPriority,
    scheduledFor: '',
    recipients: [] as NotificationRecipient[],
    enablePush: true,
    pushTitle: '',
    pushBody: '',
    pushUrl: '/notifications',
    longMessage: '',
    useMarkdown: false,
    attachments: [] as Array<{
      id: string; name: string; type: 'pdf' | 'image' | 'document';
      url: string; downloadUrl?: string; size: number; uploadedAt: string;
    }>,
  });

  // Push state
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [userPushSubscription, setUserPushSubscription] = useState<any>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isWebPushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      const pushPermissionValue: NotificationPermission = 'Notification' in window ? Notification.permission : 'default';
      setIsPushSupported(isWebPushSupported);
      setPushPermission(pushPermissionValue);

      if (user?.id) {
        (async () => {
          try {
            await pushNotificationService.validateAndSyncSubscription(user.id);
            const subscription = await notificationService.getUserPushSubscription(user.id);
            setUserPushSubscription(subscription);
          } catch (error) {
            console.error('Error validating push subscription:', error);
          }
        })();
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && receivedNotifications.length > 0) {
      const hasUnread = receivedNotifications.some((n: any) => !n.readBy?.includes(user.id));
      if (hasUnread) {
        markAllAsRead().catch(console.error);
      }
    }
  }, [user?.id, receivedNotifications.length, markAllAsRead]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const allNotifications = useMemo(() => {
    const merged = [
      ...sentNotifications.map(n => ({ ...n, _isSender: true })),
      ...receivedNotifications.map(n => ({ ...n, _isSender: false })),
    ];
    // Deduplicate
    const seen = new Map<string, typeof merged[0]>();
    for (const n of merged) {
      if (!seen.has(n.id) || n._isSender) seen.set(n.id, n);
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [sentNotifications, receivedNotifications]);

  const filteredNotifications = useMemo(() => {
    let list = allNotifications;
    if (activeTab === 'unread') list = list.filter(n => !n.readBy?.includes(user?.id || ''));
    if (activeTab === 'sent') list = list.filter(n => n._isSender);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        (n.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allNotifications, activeTab, search, user?.id]);

  const unreadCount = useMemo(
    () => allNotifications.filter(n => !n.readBy?.includes(user?.id || '')).length,
    [allNotifications, user?.id]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectNotification = (notification: Notification & { _isSender?: boolean }) => {
    setSelectedNotification(notification);
    if (isMobile) setShowDetailMobile(true);
  };

  const handleCloseDetail = () => {
    setShowDetailMobile(false);
    setTimeout(() => setSelectedNotification(null), 300);
  };

  const handleOpenCompose = () => setIsComposeOpen(true);
  const handleCloseCompose = () => setIsComposeOpen(false);

  const handleRequestPermission = async () => {
    if (!isPushSupported) {
      toast({ variant: "destructive", title: "Not Supported", description: "Push notifications not supported in this browser" });
      return;
    }
    setIsRequestingPermission(true);
    try {
      const permission = await pushNotificationService.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted') {
        toast({ title: "Permission Granted!", description: "You can now receive push notifications" });
        if (user?.id) {
          const subscription = await subscribeToPush();
          setUserPushSubscription(subscription);
        }
      } else if (permission === 'denied') {
        toast({ variant: "destructive", title: "Permission Denied", description: "Push notifications have been blocked. Enable them in browser settings." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to request notification permission" });
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handlePushSubscriptionToggle = async () => {
    if (pushPermission !== 'granted') { await handleRequestPermission(); return; }
    try {
      if (userPushSubscription) {
        await unsubscribeFromPush();
        setUserPushSubscription(null);
        toast({ title: "Unsubscribed", description: "You will no longer receive push notifications" });
      } else {
        const subscription = await subscribeToPush();
        setUserPushSubscription(subscription);
        toast({ title: "Subscribed!", description: "You will now receive push notifications" });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to update push notification subscription" });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast({ variant: "destructive", title: "Invalid File Type", description: "Only PDF, images, and Word documents are allowed." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File Too Large", description: "File size must be less than 10MB." });
      return;
    }
    setIsUploadingFile(true);
    setUploadProgress(0);
    try {
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => { if (prev >= 90) { clearInterval(uploadInterval); return 90; } return prev + 10; });
      }, 200);
      const fileUrl = URL.createObjectURL(file);
      const attachment = {
        id: `attachment-${Date.now()}`,
        name: file.name,
        type: file.type.includes('pdf') ? 'pdf' as const : file.type.includes('image') ? 'image' as const : 'document' as const,
        url: fileUrl,
        downloadUrl: fileUrl,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
      clearInterval(uploadInterval);
      setUploadProgress(100);
      setFormData(prev => ({ ...prev, attachments: [...prev.attachments, attachment] }));
      toast({ title: "File Uploaded", description: `${file.name} has been uploaded successfully.` });
    } catch {
      toast({ variant: "destructive", title: "Upload Failed", description: "Failed to upload file. Please try again." });
    } finally {
      setIsUploadingFile(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(att => att.id !== attachmentId) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || formData.recipients.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in the subject and select at least one recipient group" });
      return;
    }
    if (!user?.id) {
      toast({ variant: "destructive", title: "Error", description: "User not authenticated" });
      return;
    }
    try {
      const notificationData: CreateNotificationData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        priority: formData.priority,
        recipients: formData.recipients,
        createdBy: user.id,
        scheduledFor: formData.scheduledFor ? new Date(formData.scheduledFor).toISOString() : undefined,
        enablePush: formData.enablePush,
        pushTitle: formData.pushTitle.trim() || formData.title.trim(),
        pushBody: formData.pushBody.trim() || formData.description.trim(),
        pushUrl: formData.pushUrl.trim() || '/notifications',
        richContent: formData.type === 'flow' ? {
          longMessage: formData.longMessage.trim() || undefined,
          attachments: formData.attachments,
          formatting: { useMarkdown: formData.useMarkdown, allowHtml: false }
        } : undefined,
      };

      try {
        const response = await fetch('/api/notifications/send-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notificationData),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to send notification: ${response.status} ${errorText}`);
        }
        const result = await response.json();
        if (result.stats.totalRecipients > 50) setActiveNotificationId(result.notificationId);
        await refreshBadge();
        await fetchNotifications();
        toast({ title: "🚀 Notification Sent!", description: `Queued for ${result.stats.totalRecipients} recipients.` });
      } catch {
        await addNotification(notificationData);
        await refreshBadge();
        await fetchNotifications();
        toast({ title: "✅ Notification Sent!", description: "Sent via fallback method." });
      }

      setFormData({
        title: '', description: '', type: 'reminder', priority: 'medium', scheduledFor: '',
        recipients: [], enablePush: true, pushTitle: '', pushBody: '', pushUrl: '/notifications',
        longMessage: '', useMarkdown: false, attachments: [],
      });
      setIsComposeOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Notification Error", description: error instanceof Error ? error.message : "Failed to send notification" });
    }
  };

  const handleResendNotification = async (notification: Notification) => {
    try {
      const notificationData: CreateNotificationData = {
        title: notification.title,
        description: notification.description || '',
        type: notification.type,
        priority: notification.priority,
        recipients: notification.recipients || [],
        enablePush: true,
        pushTitle: notification.pushTitle || notification.title,
        pushBody: notification.description || '',
        pushUrl: notification.pushUrl || '/notifications',
        richContent: notification.richContent,
      };
      await notificationService.createNotification(notificationData);
      toast({ title: "Notification Resent", description: "Sent again to all recipients" });
    } catch {
      toast({ variant: "destructive", title: "Failed to Resend", description: "Could not resend. Please try again." });
    }
  };

  const handleDeleteNotification = async (notification: Notification, deleteType?: 'me' | 'everyone') => {
    try {
      const isSentByMe = notification.createdBy === user?.id;
      if (deleteType === 'everyone' && isSentByMe) {
        await deleteDoc(doc(db, 'notifications', notification.id));
        const deliveriesQuery = query(collection(db, 'notificationDeliveries'), where('notificationId', '==', notification.id));
        const deliveriesSnapshot = await getDocs(deliveriesQuery);
        await Promise.all(deliveriesSnapshot.docs.map(d => deleteDoc(d.ref)));
        toast({ title: "Deleted for Everyone", description: "Notification deleted for all recipients" });
      } else {
        if (isSentByMe) {
          await updateDoc(doc(db, 'notifications', notification.id), {
            [`deletedBy.${user?.id}`]: true, updatedAt: serverTimestamp()
          });
        } else {
          const deliveriesQuery = query(
            collection(db, 'notificationDeliveries'),
            where('notificationId', '==', notification.id),
            where('userId', '==', user?.id)
          );
          const deliveriesSnapshot = await getDocs(deliveriesQuery);
          await Promise.all(deliveriesSnapshot.docs.map(d => deleteDoc(d.ref)));
        }
        toast({ title: "Notification Deleted", description: "Removed from your view" });
      }
      if (selectedNotification?.id === notification.id) setSelectedNotification(null);
    } catch {
      toast({ variant: "destructive", title: "Failed to Delete", description: "Could not delete. Please try again." });
    }
  };

  const handleRemindNotification = async (notification: Notification, duration = 15) => {
    try {
      const scheduledTime = new Date(Date.now() + duration * 60 * 1000);
      await notificationService.createNotification({
        title: `Reminder: ${notification.title}`,
        description: notification.description || '',
        type: 'reminder',
        priority: notification.priority,
        recipients: [{ id: user?.id || '', type: 'user', name: user?.username || user?.email?.split('@')[0] || '' }],
        scheduledFor: scheduledTime.toISOString(),
        enablePush: true,
        pushTitle: `Reminder: ${notification.title}`,
        pushBody: notification.description || '',
        pushUrl: notification.pushUrl || '/notifications',
        richContent: notification.richContent,
      });
      toast({ title: "Reminder Set", description: `You'll be reminded in ${duration} minutes` });
    } catch {
      toast({ variant: "destructive", title: "Failed to Set Reminder", description: "Could not set reminder. Please try again." });
    }
  };

  // ── Selected notification sender info ──────────────────────────────────────

  const selectedSenderInfo = useSenderInfo(selectedNotification?.createdBy, users, staff, user);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) return <GlassPageRouteSkeleton variant="list" />;

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-4">
        <div className="text-destructive">Error loading notifications</div>
        <Button onClick={() => fetchNotifications()}>Retry</Button>
      </div>
    );
  }

  // Helper to get sender info for any notification in the list
  function getNotificationSenderInfo(notif: Notification & { _isSender?: boolean }) {
    const isSender = notif._isSender || notif.createdBy === user?.id;
    if (isSender) {
      const displayName = (user as any)?.firstName && (user as any)?.lastName
        ? `${(user as any).firstName} ${(user as any).lastName}`.trim()
        : user?.username || user?.email?.split('@')[0] || 'You';
      return { name: displayName, avatar: undefined as string | undefined };
    }
    const u = users.find((x: any) => x.id === notif.createdBy);
    if (u) return { name: u.name || u.email?.split('@')[0] || 'User', avatar: u.avatar as string | undefined };
    const s = staff.find((x: any) => x.userId === notif.createdBy);
    if (s) return { name: `${s.firstName} ${s.lastName}`.trim() || 'Staff', avatar: s.photo as string | undefined };
    return { name: 'System', avatar: undefined as string | undefined };
  }

  const isListLoading = isSentLoading || isReceivedLoading;

  return (
    <div className="min-h-screen flex flex-col bg-[#F0F4F8]">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <GlassPageTopBar
        title="Notifications"
        subtitle={`${unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}`}
        backHref="/dashboard"
        backLabel="Dashboard"
        meta={
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200/60 text-[10px] font-bold flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Online
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200/60 text-[10px] font-bold flex items-center gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
          </div>
        }
        actions={
          <GlassActionDock>
            {isPushSupported && (
              <GlassActionButton
                label="Push"
                icon={
                  (isSubscribingToPush || isUnsubscribingFromPush)
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Bell className={cn("h-4 w-4", userPushSubscription && pushPermission === 'granted' && 'animate-pulse')} />
                }
                tone={userPushSubscription && pushPermission === 'granted' ? 'emerald' : 'slate'}
                disabled={isSubscribingToPush || isUnsubscribingFromPush || pushPermission === 'denied'}
                onClick={() => setIsSettingsOpen(true)}
                title="Push notification settings"
              />
            )}
          </GlassActionDock>
        }
      />

      {/* ── Progress indicator ───────────────────────────────────────────────── */}
      {activeNotificationId && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-2">
          <NotificationProgress
            notificationId={activeNotificationId}
            totalRecipients={formData.recipients.length}
            onComplete={() => setActiveNotificationId(null)}
          />
        </div>
      )}

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-2 sm:px-4 lg:px-6 py-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          style={{ height: 'calc(100vh - 140px)', minHeight: 500 }}>

          <div className="flex h-full min-h-0">
            {/* ── LEFT: Notification List ─────────────────────────────────── */}
            <div className={cn(
              'flex min-h-0 flex-col border-r border-gray-100 bg-white transition-all duration-300',
              // On mobile: show list OR detail, not both
              isMobile
                ? showDetailMobile ? 'hidden' : 'w-full'
                : 'w-[360px] shrink-0',
            )}>
              {/* Search bar */}
              <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search messages…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-full text-sm placeholder-gray-400 text-gray-700 border-0 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-all"
                  />
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 px-3 pb-2 shrink-0 border-b border-gray-100">
                {([
                  { id: 'all',    label: 'All' },
                  { id: 'unread', label: 'Unread' },
                  { id: 'sent',   label: 'Sent' },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150',
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100',
                    )}
                  >
                    {tab.label}
                    {tab.id === 'unread' && unreadCount > 0 && (
                      <span className="ml-1.5 bg-white text-blue-600 rounded-full text-[10px] px-1.5 py-px font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Notification list */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {isListLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                    <p className="text-sm text-gray-400">Loading messages…</p>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center mb-4">
                      <Bell className="h-6 w-6 text-blue-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">
                      {search ? 'No results found' : activeTab === 'unread' ? 'All caught up!' : 'No notifications yet'}
                    </p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {search
                        ? 'Try a different search term'
                        : activeTab === 'unread'
                          ? 'You\'ve read all your notifications.'
                          : 'Tap the compose button to send your first notification.'
                      }
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map(notif => {
                    const senderInfo = getNotificationSenderInfo(notif);
                    return (
                      <NotificationInboxItem
                        key={notif.id}
                        notification={notif}
                        isSelected={selectedNotification?.id === notif.id}
                        currentUserId={user?.id || ''}
                        onClick={n => handleSelectNotification(n as Notification & { _isSender?: boolean })}
                        senderName={senderInfo.name}
                        senderAvatar={senderInfo.avatar}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* ── RIGHT: Detail panel (desktop always visible; mobile conditionally) ── */}
            <div className={cn(
              'min-h-0 flex-1 bg-white overflow-hidden',
              isMobile && !showDetailMobile ? 'hidden' : 'flex flex-col',
            )}>
              <NotificationDetailPanel
                notification={selectedNotification}
                currentUserId={user?.id || ''}
                senderName={selectedSenderInfo.name}
                senderAvatar={selectedSenderInfo.avatar}
                onClose={isMobile ? handleCloseDetail : undefined}
                onDelete={handleDeleteNotification}
                onResend={handleResendNotification}
                onRemind={handleRemindNotification}
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Compose FAB ──────────────────────────────────────────────────────── */}
      <button
        id="compose-fab"
        onClick={handleOpenCompose}
        aria-label="Compose notification"
        className={cn(
          'fixed bottom-6 right-6 z-40',
          'h-14 w-14 rounded-full',
          'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
          'text-white shadow-[0_4px_20px_rgba(37,99,235,0.45)]',
          'flex items-center justify-center',
          'transition-all duration-200 hover:scale-105 active:scale-95',
          'hover:shadow-[0_6px_28px_rgba(37,99,235,0.55)]',
        )}
      >
        <Edit3 className="h-6 w-6" />
      </button>

      {/* ── Compose: MOBILE full-screen ───────────────────────────────────── */}
      {isMobile && isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
          {/* Mobile compose header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0 bg-white shadow-sm">
            <button
              onClick={handleCloseCompose}
              className="h-8 w-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-base font-bold text-gray-900 flex-1">New Notification</h2>
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Edit3 className="h-4 w-4 text-white" />
            </div>
          </div>
          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ComposeForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onCancel={handleCloseCompose}
              isCreating={isCreating}
              isPushSupported={isPushSupported}
              pushPermission={pushPermission}
              isUploadingFile={isUploadingFile}
              uploadProgress={uploadProgress}
              handleFileUpload={handleFileUpload}
              handleRemoveAttachment={handleRemoveAttachment}
              handleRequestPermission={handleRequestPermission}
              isRequestingPermission={isRequestingPermission}
            />
          </div>
        </div>
      )}

      {/* ── Compose: DESKTOP popup dialog ────────────────────────────────── */}
      {!isMobile && (
        <ModernDialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
          <ModernDialogContent
            size="xl"
            className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto"
            open={isComposeOpen}
            onOpenChange={setIsComposeOpen}
          >
            <ModernDialogHeader className="pb-2">
              <ModernDialogTitle className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center">
                  <Edit3 className="h-3.5 w-3.5 text-white" />
                </div>
                New Notification
              </ModernDialogTitle>
              <ModernDialogDescription className="text-xs">
                Compose and send a notification to your school community.
              </ModernDialogDescription>
            </ModernDialogHeader>

            <div className="py-2">
              <ComposeForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                onCancel={handleCloseCompose}
                isCreating={isCreating}
                isPushSupported={isPushSupported}
                pushPermission={pushPermission}
                isUploadingFile={isUploadingFile}
                uploadProgress={uploadProgress}
                handleFileUpload={handleFileUpload}
                handleRemoveAttachment={handleRemoveAttachment}
                handleRequestPermission={handleRequestPermission}
                isRequestingPermission={isRequestingPermission}
              />
            </div>
          </ModernDialogContent>
        </ModernDialog>
      )}

      {/* ── Push settings dialog ──────────────────────────────────────────── */}
      <PushSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        isPushSupported={isPushSupported}
        pushPermission={pushPermission}
        userPushSubscription={userPushSubscription}
        isRequestingPermission={isRequestingPermission}
        isSubscribingToPush={isSubscribingToPush}
        isUnsubscribingFromPush={isUnsubscribingFromPush}
        onRequestPermission={handleRequestPermission}
        onToggleSubscription={handlePushSubscriptionToggle}
      />
    </div>
  );
}
