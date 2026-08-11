import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { sanitizeSystemUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getNotificationAutomationSettings } from '@/lib/server/notification-automation';
import {
  isNotificationAutomationEnabled,
  resolveAutomatedNotificationRecipientIds,
} from '@/lib/notifications/automation-settings';
import {
  formatKampalaDate,
  nextAttendanceRunAt,
  nextSmsRunAt,
  type SmsScheduleType,
} from '@/lib/scheduler/schedule-times';
import { SCHEDULED_DISPATCH_QUEUE } from '@/lib/server/scheduled-dispatch-queue';


export const dynamic = 'force-dynamic';
export const revalidate = false;
export const maxDuration = 60;


const LEASE_MS = 10 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;


type QueueChannel = 'sms' | 'push' | 'attendance';
type DispatchOutcome = {
  terminal: boolean;
  nextRunAt?: Date | null;
  skipped?: boolean;
  reason?: string;
  result?: unknown;
  provider?: Record<string, unknown>;
};


function dateValue(value: unknown): string {
