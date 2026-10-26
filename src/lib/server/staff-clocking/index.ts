import 'server-only';

import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { FieldValue, Timestamp, type Firestore, type Query, type QueryDocumentSnapshot, type Transaction, type WriteBatch } from 'firebase-admin/firestore';
import { z } from 'zod';
import type {
  StaffClockingBootstrap,
  StaffClockingDailyRecord,
  StaffClockingReviewRequest,
  StaffClockingFeatureSettings,
  StaffClockingSchedule,
  StaffClockingTimekeeper,
  StaffClockingPersonalSchedule,
} from '@/lib/staff-clocking/contracts';
import { STAFF_CLOCKING_TIME_ZONE, type StaffClockingRevisionKey } from '@/lib/staff-clocking/contracts';
import { classifyStaffClockIn, resolveStaffClockingSchedule } from '@/lib/staff-clocking/schedule-resolver';
import { isIsoLocalDate, localTimeToSeconds } from '@/lib/staff-clocking/dates';
import { isUgandaPublicHoliday } from '@/lib/utils/uganda-holidays';
import type { AuthenticatedAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';

export const STAFF_CLOCKING_COLLECTIONS = {
  settings: 'staffClockingSettings',
  schedules: 'staffClockingSchedules',
  sessions: 'staffClockingQrSessions',
  events: 'staffClockingEvents',
  dailyRecords: 'staffClockingDailyRecords',
  exemptions: 'staffClockingExemptions',
  corrections: 'staffClockingCorrections',
  notifications: 'staffClockingNotifications',
  history: 'historyLogs',
  personalRevisions: 'staffClockingPersonalRevisions',
  explanations: 'staffClockingExplanations',
} as const;

const SETTINGS_ID = 'default';
const QR_TOKEN_LIFETIME_MS = 60_000;
const QR_SESSION_LIFETIME_MS = 10 * 60_000;

export function bumpClockingRevisions(db: Firestore, writer: Transaction | WriteBatch, ...keys: Array<StaffClockingRevisionKey | 'events'>) {
  // The existing shared listener watches this tiny document. Publish atomically
  // with the source write so other tabs/devices never miss a successful change.
  (writer as Transaction).set(db.collection('settings').doc('data-revisions-operational'),
    Object.fromEntries(keys.map(key => [key, FieldValue.increment(1)])), { merge: true });
}

export function bumpPersonalClockingRevision(db: Firestore, writer: Transaction | WriteBatch, staffId: string, workDate?: string, notifications = false, requests = false) {
  (writer as Transaction).set(db.collection(STAFF_CLOCKING_COLLECTIONS.personalRevisions).doc(staffId), {
    ...(workDate ? { dates: { [workDate]: FieldValue.increment(1) } } : {}),
    ...(notifications ? { notifications: FieldValue.increment(1) } : {}),
    ...(requests ? { requests: FieldValue.increment(1) } : {}),
  }, { merge: true });
}
const localDate = z.string().refine(isIsoLocalDate, 'Use a valid YYYY-MM-DD date.');
const localTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Use a 24-hour time such as 08:00 or 08:00:00.');
const documentId = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/, 'Use only letters, numbers, underscores, or hyphens.');

export const staffClockingSettingsSchema = z.object({
  enabled: z.boolean(),
  accessMode: z.enum(['all_active_linked_staff', 'selected_staff']),
  enrolledStaffIds: z.array(documentId).max(500),
}).superRefine((value, context) => {
  if (value.accessMode === 'selected_staff' && value.enrolledStaffIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['enrolledStaffIds'],
      message: 'Select at least one linked staff member for selected-staff access.',
    });
  }
});

export const staffClockingScheduleSchema = z.object({
  scope: z.enum(['school', 'group', 'staff']),
  // Staff schedules use a staff document ID. Group schedules deliberately use
  // the stored department or role label, which may contain spaces.
  subjectId: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(['recurring', 'date_override']),
  workDate: localDate.optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  startsOn: localDate.optional(),
  endsOn: localDate.optional(),
  clockInBy: localTime,
  clockOutBy: localTime.optional(),
  graceMinutes: z.number().int().min(0).max(180),
  priority: z.number().int().min(-100).max(100).optional().default(0),
  isActive: z.boolean().default(true),
}).superRefine((value, context) => {
  if (value.scope === 'school' && value.subjectId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['subjectId'], message: 'School schedules cannot target one subject.' });
  }
  if (value.scope !== 'school' && !value.subjectId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['subjectId'], message: 'Group and staff schedules need a subject ID.' });
  }
  if (value.scope === 'staff' && value.subjectId && !documentId.safeParse(value.subjectId).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['subjectId'], message: 'Staff schedules need a valid staff ID.' });
  }
  if (value.kind === 'date_override' && !value.workDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['workDate'], message: 'A date override needs a work date.' });
  }
  if (value.kind === 'recurring' && (!value.weekdays || value.weekdays.length === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['weekdays'], message: 'A recurring schedule needs at least one weekday.' });
  }
  if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endsOn'], message: 'The end date must be on or after the start date.' });
  }
  if (value.clockOutBy && localTimeToSeconds(value.clockOutBy) <= localTimeToSeconds(value.clockInBy)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['clockOutBy'], message: 'Expected departure must be later than expected arrival on the same day.' });
  }
});

const clockScanSchema = z.object({
  token: z.string().trim().min(20).max(2_000),
  operationId: z.string().trim().regex(/^[A-Za-z0-9_-]{12,120}$/),
});
const qrSessionRefreshSchema = z.object({
  sessionId: z.string().uuid().optional(),
}).default({});
const selfServiceRequestSchema = z.object({
  localDate,
  reason: z.string().trim().min(8, 'Give a short reason of at least eight characters.').max(1_000),
  proposedClockInTime: localTime.optional(),
  proposedClockOutTime: localTime.optional(),
}).superRefine((value, context) => {
  if ((value.proposedClockInTime || value.proposedClockOutTime) && !value.proposedClockInTime) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['proposedClockInTime'], message: 'A correction needs a proposed clock-in time.' });
  }
  if (value.proposedClockInTime && value.proposedClockOutTime && localTimeToSeconds(value.proposedClockOutTime) <= localTimeToSeconds(value.proposedClockInTime)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['proposedClockOutTime'], message: 'Clock-out must be later than clock-in on the same day.' });
  }
});
const managerExemptionSchema = z.object({
  staffId: documentId,
  localDate,
  reason: z.string().trim().min(8, 'Give a short reason of at least eight characters.').max(1_000),
});
export const staffClockingReviewSchema = z.object({ approved: z.boolean(), reviewNote: z.string().trim().max(1_000).optional() });
const recordFilterSchema = z.object({
  from: localDate.optional(), to: localDate.optional(), staffId: documentId.optional(), query: z.string().trim().max(120).optional(),
}).superRefine((value, context) => {
  if (value.from && value.to && value.to < value.from) context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'The end date must be on or after the start date.' });
});
const closureSchema = z.object({ title: z.string().trim().min(3).max(120), startDate: localDate, endDate: localDate.optional(), description: z.string().trim().max(500).optional() })
  .refine(value => !value.endDate || value.endDate >= value.startDate, { path: ['endDate'], message: 'The end date must be on or after the start date.' });

export function actorLabel(actor: AuthenticatedAppUser) {
  const name = [actor.user.firstName, actor.user.lastName].filter(Boolean).join(' ').trim();
  return { id: actor.user.id, name: name || actor.user.username || 'Unknown user' };
}

export function kampalaClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: STAFF_CLOCKING_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { localDate: `${parts.year}-${parts.month}-${parts.day}`, localTime: `${parts.hour}:${parts.minute}:${parts.second}` };
}

export function localDateFromCalendarValue(value: unknown): string | undefined {
  const instant = value instanceof Timestamp ? value.toDate()
    : value instanceof Date ? value
      : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined
        : value && typeof value === 'object' && 'seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number'
          ? new Date((value as { seconds: number }).seconds * 1_000)
          : undefined;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!instant || Number.isNaN(instant.getTime())) return undefined;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: STAFF_CLOCKING_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(instant).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function resolveCalendarClosure(db: Firestore, localDate: string, transaction?: Transaction) {
  const generatedHoliday = isUgandaPublicHoliday(localDate);
  const query = db.collection('events').where('type', '==', 'Holiday');
  const holidayEvents = await (transaction ? transaction.get(query) : query.get());
  const eventClosure = holidayEvents.docs
    .map((item) => item.data())
    .find((event) => {
      if (event.status === 'Draft' || event.status === 'Cancelled') return false;
      if (event.requiresApproval === true && event.approvalStatus !== 'Approved') return false;
      if (event.customFields?.staffClockingEffect !== 'school_closure') return false;
      const start = localDateFromCalendarValue(event.startDate);
      const end = localDateFromCalendarValue(event.endDate) || start;
      return Boolean(start && end && start <= localDate && localDate <= end);
    });
  if (eventClosure) return { localDate, isClosed: true, label: String(eventClosure.title || 'School closure') };
  return generatedHoliday ? { localDate, isClosed: true, label: generatedHoliday.title } : undefined;
}

function clockingSecret() {
  const secret = process.env.STAFF_CLOCKING_QR_SECRET;
  if (!secret || secret.length < 32) throw new Error('CLOCKING_QR_SECRET_NOT_CONFIGURED');
  return secret;
}

function signQrPayload(payload: string) {
  return createHmac('sha256', clockingSecret()).update(payload).digest('base64url');
}

function issueQrToken(sessionId: string, expiresAtMs: number) {
  const payload = Buffer.from(JSON.stringify({ sessionId, expiresAtMs, version: 1 })).toString('base64url');
  return `${payload}.${signQrPayload(payload)}`;
}

function verifyQrToken(token: string, nowMs = Date.now()) {
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length) throw new Error('CLOCKING_QR_TOKEN_INVALID');
  const expected = signQrPayload(payload);
  const supplied = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) throw new Error('CLOCKING_QR_TOKEN_INVALID');
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sessionId?: string; expiresAtMs?: number; version?: number };
    if (typeof value.sessionId !== 'string' || !z.string().uuid().safeParse(value.sessionId).success || typeof value.expiresAtMs !== 'number' || !Number.isSafeInteger(value.expiresAtMs) || value.version !== 1 || value.expiresAtMs < nowMs) throw new Error('invalid');
    return { sessionId: value.sessionId, expiresAtMs: value.expiresAtMs, version: 1 };
  } catch {
    throw new Error('CLOCKING_QR_TOKEN_INVALID');
  }
}

export function dailyRecordId(staffId: string, localDate: string) {
  return createHash('sha256').update(`${staffId}:${localDate}`).digest('base64url');
}

function operationEventId(actorId: string, operationId: string) {
  return createHash('sha256').update(`${actorId}:${operationId}`).digest('base64url');
}

export function toIso(value: Record<string, unknown>): Record<string, unknown>;
export function toIso(value: unknown): unknown;
export function toIso(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toIso);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, toIso(nested)]));
  return value;
}

function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => omitUndefined(item)) as T;
  if (value && typeof value === 'object' && !(value instanceof Timestamp) && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, omitUndefined(item)]),
    ) as T;
  }
  return value;
}

function defaultSettings(): StaffClockingFeatureSettings {
  return {
    enabled: false,
    accessMode: 'all_active_linked_staff',
    enrolledStaffIds: [],
    revision: 0,
    timeZone: STAFF_CLOCKING_TIME_ZONE,
  };
}

function normalizeSettings(data?: Record<string, unknown>): StaffClockingFeatureSettings {
  const defaults = defaultSettings();
  return {
    enabled: data?.enabled === true,
    accessMode: data?.accessMode === 'selected_staff' ? 'selected_staff' : defaults.accessMode,
    enrolledStaffIds: Array.isArray(data?.enrolledStaffIds) ? data!.enrolledStaffIds.filter((value): value is string => typeof value === 'string').sort() : [],
    revision: Number.isSafeInteger(data?.revision) && Number(data?.revision) >= 0 ? Number(data?.revision) : 0,
    timeZone: STAFF_CLOCKING_TIME_ZONE,
    updatedAt: typeof toIso(data?.updatedAt) === 'string' ? toIso(data?.updatedAt) as string : undefined,
  };
}

export function staffGroupLabels(staff: Record<string, unknown>): string[] {
  const asLabels = (value: unknown) => (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
  return [...new Set([...asLabels(staff.department), ...asLabels(staff.role)])];
}

async function assertScheduleAudienceExists(db: Firestore, schedule: { scope: 'school' | 'group' | 'staff'; subjectId?: string }) {
  if (schedule.scope === 'school') return;
  if (!schedule.subjectId) throw new Error('CLOCKING_SCHEDULE_AUDIENCE_REQUIRED');
  if (schedule.scope === 'staff') {
    const staff = await db.collection('staff').doc(schedule.subjectId).get();
    if (!staff.exists || String(staff.data()?.status || 'active').toLowerCase() !== 'active') throw new Error('CLOCKING_SCHEDULE_STAFF_NOT_FOUND');
    return;
  }
  const staff = await db.collection('staff').get();
  const exists = staff.docs.some((item) => String(item.data().status || 'active').toLowerCase() === 'active' && staffGroupLabels(item.data()).includes(schedule.subjectId!));
  if (!exists) throw new Error('CLOCKING_SCHEDULE_GROUP_NOT_FOUND');
}

function canAccess(actor: AuthenticatedAppUser, page: 'record' | 'clock' | 'records', action?: string) {
  return GranularPermissionService.canAccessPage(actor.user, 'staff_clocking', page)
    && (!action || GranularPermissionService.canPerformAction(actor.user, 'staff_clocking', page, action));
}

export function requireStaffClockingAccess(actor: AuthenticatedAppUser, page: 'record' | 'clock' | 'records', action?: string) {
  if (!canAccess(actor, page, action)) throw new Error('PERMISSION_DENIED');
  if (page === 'record' && ['manage_schedules', 'manage_timekeepers'].includes(action || '') && !canAccess(actor, 'record', 'access_manage')) throw new Error('PERMISSION_DENIED');
}

function canManageClocking(actor: AuthenticatedAppUser) {
  return canAccess(actor, 'record', 'access_manage') && canAccess(actor, 'record', 'manage_schedules');
}

export async function getStaffClockingBootstrap(db: Firestore, actor: AuthenticatedAppUser): Promise<StaffClockingBootstrap> {
  const canClock = canAccess(actor, 'clock', 'view_own_clock');
  const canRecord = canAccess(actor, 'record');
  const canManage = canManageClocking(actor);
  const canReview = canAccess(actor, 'records', 'view_records');
  if (!canClock && !canRecord && !canReview) throw new Error('PERMISSION_DENIED');

  const settingsRef = db.collection(STAFF_CLOCKING_COLLECTIONS.settings).doc(SETTINGS_ID);
  const staffRef = actor.user.staffId ? db.collection('staff').doc(actor.user.staffId) : undefined;
  const [snapshot, staffSnapshot, schedules] = await Promise.all([
    settingsRef.get(),
    staffRef?.get() ?? Promise.resolve(undefined),
    db.collection(STAFF_CLOCKING_COLLECTIONS.schedules).where('isActive', '==', true).limit(1).get(),
  ]);
  const feature = normalizeSettings(snapshot.data());
  const staffId = actor.user.staffId;
  const isActiveStaff = staffSnapshot?.exists && String(staffSnapshot.data()?.status || 'active').toLowerCase() === 'active';
  const isEnrolled = Boolean(staffId && isActiveStaff) && (
    feature.accessMode === 'all_active_linked_staff' || (staffId !== undefined && feature.enrolledStaffIds.includes(staffId))
  );

  return { feature: { ...feature, enrolledStaffIds: canManage ? feature.enrolledStaffIds : [] }, access: { canClock, canManage, isEnrolled }, hasActiveSchedule: !schedules.empty };
}

export async function revokeStaffClockingQrSession(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  requireStaffClockingAccess(actor, 'record', 'display_qr');
  const sessionId = z.string().uuid().parse((input as { sessionId?: unknown })?.sessionId);
  const ref = db.collection(STAFF_CLOCKING_COLLECTIONS.sessions).doc(sessionId);
  await db.runTransaction(async transaction => {
    const session = await transaction.get(ref);
    if (!session.exists) return;
    if (session.data()?.createdBy?.id !== actor.user.id) throw new Error('PERMISSION_DENIED');
    transaction.update(ref, { status: 'revoked', revokedAt: Timestamp.now() });
  });
  return { sessionId, status: 'revoked' };
}

export async function getStaffClockingSettings(db: Firestore, actor: AuthenticatedAppUser) {
  requireStaffClockingAccess(actor, 'record', 'manage_schedules');
  const snapshot = await db.collection(STAFF_CLOCKING_COLLECTIONS.settings).doc(SETTINGS_ID).get();
  return normalizeSettings(snapshot.data());
}

export async function updateStaffClockingSettings(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  requireStaffClockingAccess(actor, 'record', 'manage_schedules');
  const payload = staffClockingSettingsSchema.parse(input);
  const settingsRef = db.collection(STAFF_CLOCKING_COLLECTIONS.settings).doc(SETTINGS_ID);
  const actorData = actorLabel(actor);
  const result = await db.runTransaction(async transaction => {
    const current = await transaction.get(settingsRef);
    const existing = normalizeSettings(current.data());
    const next = {
      ...payload,
      enrolledStaffIds: [...new Set(payload.enrolledStaffIds)].sort(),
      revision: existing.revision + 1,
      timeZone: STAFF_CLOCKING_TIME_ZONE,
      updatedAt: Timestamp.now(),
      updatedBy: actorData,
    };
    transaction.set(settingsRef, next, { merge: false });
    bumpClockingRevisions(db, transaction, 'staffClockingConfig');
    transaction.set(db.collection(STAFF_CLOCKING_COLLECTIONS.history).doc(), {
      a: 'update', e: 'staff_clocking_settings', rid: SETTINGS_ID, rl: 'Staff clocking settings updated',
      uid: actorData.id, un: actorData.name, m: { module: 'staff_clocking', enabled: payload.enabled, accessMode: payload.accessMode }, ts: Timestamp.now(),
    });
    return normalizeSettings(next);
  });
  return result;
}

function serializeSchedule(id: string, data: Record<string, unknown>): StaffClockingSchedule {
  return { id, ...toIso(data) } as StaffClockingSchedule;
}

export async function listStaffClockingSchedules(db: Firestore, actor: AuthenticatedAppUser) {
  requireStaffClockingAccess(actor, 'record', 'manage_schedules');
  const snapshot = await db.collection(STAFF_CLOCKING_COLLECTIONS.schedules).get();
  return snapshot.docs
    .map(item => serializeSchedule(item.id, item.data()))
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id));
}

export async function createStaffClockingSchedule(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  requireStaffClockingAccess(actor, 'record', 'manage_schedules');
  const payload = staffClockingScheduleSchema.parse(input);
  await assertScheduleAudienceExists(db, payload);
  const actorData = actorLabel(actor);
  const ref = db.collection(STAFF_CLOCKING_COLLECTIONS.schedules).doc();
  const record = omitUndefined({ ...payload, weekdays: payload.weekdays ? [...new Set(payload.weekdays)].sort() : undefined, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: actorData, updatedBy: actorData });
  const batch = db.batch();
  batch.set(ref, record);
  bumpClockingRevisions(db, batch, 'staffClockingConfig');
  await batch.commit();
  return serializeSchedule(ref.id, record);
}

export async function updateStaffClockingSchedule(db: Firestore, actor: AuthenticatedAppUser, id: string, input: unknown) {
  requireStaffClockingAccess(actor, 'record', 'manage_schedules');
  const scheduleId = documentId.parse(id);
  const payload = staffClockingScheduleSchema.parse(input);
  await assertScheduleAudienceExists(db, payload);
  const ref = db.collection(STAFF_CLOCKING_COLLECTIONS.schedules).doc(scheduleId);
  const actorData = actorLabel(actor);
  const record = omitUndefined({ ...payload, weekdays: payload.weekdays ? [...new Set(payload.weekdays)].sort() : undefined, updatedAt: Timestamp.now(), updatedBy: actorData });
  const result = await db.runTransaction(async transaction => {
    const existing = await transaction.get(ref);
    if (!existing.exists) throw new Error('CLOCKING_SCHEDULE_NOT_FOUND');
    const next = { ...record, createdAt: existing.data()?.createdAt || Timestamp.now(), createdBy: existing.data()?.createdBy || actorData };
    transaction.set(ref, next, { merge: false });
    bumpClockingRevisions(db, transaction, 'staffClockingConfig');
    return serializeSchedule(scheduleId, next);
  });
  return result;
}

export async function deleteStaffClockingSchedule(db: Firestore, actor: AuthenticatedAppUser, id: string) {
  requireStaffClockingAccess(actor, 'record', 'manage_schedules');
  const scheduleId = documentId.parse(id);
  const ref = db.collection(STAFF_CLOCKING_COLLECTIONS.schedules).doc(scheduleId);
  await db.runTransaction(async transaction => {
    const existing = await transaction.get(ref);
    if (!existing.exists) throw new Error('CLOCKING_SCHEDULE_NOT_FOUND');
    transaction.delete(ref);
    bumpClockingRevisions(db, transaction, 'staffClockingConfig');
  });
}

export async function listStaffClockingDailyRecords(db: Firestore, actor: AuthenticatedAppUser, input?: unknown): Promise<StaffClockingDailyRecord[]> {
  requireStaffClockingAccess(actor, 'records', 'view_records');
  const filters = recordFilterSchema.parse(input ?? {});
  let base: Query = db.collection(STAFF_CLOCKING_COLLECTIONS.dailyRecords);
  if (filters.from) base = base.where('localDate', '>=', filters.from);
  if (filters.to) base = base.where('localDate', '<=', filters.to);
  if (filters.staffId) base = base.where('staffId', '==', filters.staffId);
  base = base.orderBy('localDate', 'desc');
  const documents: QueryDocumentSnapshot[] = [];
  let cursor: QueryDocumentSnapshot | undefined;
  do {
    const page = await (cursor ? base.startAfter(cursor) : base).limit(500).get();
    documents.push(...page.docs);
    if (documents.length > 5_000) throw new Error('CLOCKING_REPORT_RANGE_TOO_LARGE');
    cursor = page.size === 500 ? page.docs[page.docs.length - 1] : undefined;
  } while (cursor);
  const query = filters.query?.toLowerCase();
  return documents.map((item) => ({ id: item.id, ...toIso(item.data()) } as StaffClockingDailyRecord))
    .filter(record => !query || `${record.staffName || ''} ${record.staffId}`.toLowerCase().includes(query));
}

export async function getStaffClockingStaffCandidates(db: Firestore, actor: AuthenticatedAppUser) {
  if (!canAccess(actor, 'record', 'manage_schedules') && !canAccess(actor, 'record', 'manage_calendar')) throw new Error('PERMISSION_DENIED');
  const snapshot = await db.collection('staff').get();
  return snapshot.docs
    .filter(item => String(item.data().status || 'active').toLowerCase() === 'active')
    .map(item => ({ id: item.id, name: [item.data().firstName, item.data().lastName].filter(Boolean).join(' ').trim() || item.id, employeeId: item.data().employeeId, department: (Array.isArray(item.data().department) ? item.data().department : [item.data().department]).filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0).map((value: string) => value.trim()), role: (Array.isArray(item.data().role) ? item.data().role : [item.data().role]).filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0).map((value: string) => value.trim()) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listStaffClockingClosures(db: Firestore, actor: AuthenticatedAppUser) {
  requireStaffClockingAccess(actor, 'record', 'manage_calendar');
  const snapshot = await db.collection('events').where('type', '==', 'Holiday').get();
  return snapshot.docs.map(item => ({ id: item.id, ...toIso(item.data()) }))
    .filter((event: any) => event.customFields?.staffClockingEffect === 'school_closure')
    .sort((left: any, right: any) => String(left.startDate).localeCompare(String(right.startDate)));
}

export async function createStaffClockingClosure(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  requireStaffClockingAccess(actor, 'record', 'manage_calendar');
  const payload = closureSchema.parse(input);
  const who = actorLabel(actor);
  const ref = db.collection('events').doc();
  const event = { title: payload.title, description: payload.description || '', type: 'Holiday', priority: 'High', status: 'Scheduled', startDate: payload.startDate, endDate: payload.endDate || payload.startDate, isAllDay: true, targetAudience: ['All Staff'], isExamEvent: false, isRecurringInstance: false, recurrence: { frequency: 'None' }, reminders: [], notificationsSent: [], sendReminders: false, colorCode: '#dc2626', requiresApproval: false, requiresAttendance: false, isPublic: false, customFields: { staffClockingEffect: 'school_closure' }, createdBy: who.id, createdByName: who.name, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  const batch = db.batch();
  batch.create(ref, event);
  batch.create(db.collection(STAFF_CLOCKING_COLLECTIONS.history).doc(), { a: 'create', e: 'staff_clocking_closure', rid: ref.id, rl: `Staff clocking closure created: ${payload.title}`, uid: who.id, un: who.name, m: { startDate: payload.startDate, endDate: payload.endDate || payload.startDate }, ts: Timestamp.now() });
  bumpClockingRevisions(db, batch, 'events');
  await batch.commit();
  return { id: ref.id, ...toIso(event) };
}

export async function finalizeStaffClockingDate(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  requireStaffClockingAccess(actor, 'record', 'manual_clock');
  const { localDate: workDate } = z.object({ localDate }).parse(input);
  return finalizeOpenStaffClockingDate(db, workDate, actorLabel(actor));
}

export async function finalizeOpenStaffClockingDate(db: Firestore, workDate: string, finalizedBy = { id: 'scheduler', name: 'Staff Clocking scheduler' }) {
  localDate.parse(workDate);
  if (workDate >= kampalaClock().localDate) throw new Error('CLOCKING_FINALIZATION_DATE_NOT_FINISHED');
  const settingsRef = db.collection(STAFF_CLOCKING_COLLECTIONS.settings).doc(SETTINGS_ID);
  const snapshot = await db.collection(STAFF_CLOCKING_COLLECTIONS.dailyRecords).where('localDate', '==', workDate).get();
  let finalized = 0;
  for (let offset = 0; offset < snapshot.docs.length; offset += 150) {
    finalized += await db.runTransaction(async transaction => {
      const settings = await transaction.get(settingsRef);
      if (!normalizeSettings(settings.data()).enabled) return 0;
      const current = await transaction.getAll(...snapshot.docs.slice(offset, offset + 150).map(item => item.ref));
      let count = 0;
      for (const document of current) {
        const record = document.data();
        if (record?.status !== 'open' || !record.clockInAt || record.clockOutAt || record.effectiveClockOutTime || record.exemptionStatus === 'approved') continue;
        transaction.update(document.ref, { status: 'missing_clock_out', finalizationStatus: 'finalized', finalizedAt: Timestamp.now(), finalizedBy, updatedAt: Timestamp.now() });
        bumpPersonalClockingRevision(db, transaction, String(record.staffId), workDate);
        count += 1;
      }
      if (count) bumpClockingRevisions(db, transaction, 'staffClockingRecords');
      return count;
    });
  }
  return { localDate: workDate, finalized };
}

export function summarizeStaffClockingRecords(records: StaffClockingDailyRecord[]) {
  return records.reduce((summary, record) => ({ total: summary.total + 1, complete: summary.complete + (record.status === 'complete' ? 1 : 0), open: summary.open + (record.status === 'open' ? 1 : 0), late: summary.late + (record.arrivalStatus === 'late' ? 1 : 0), exempted: summary.exempted + (record.reviewStatus === 'exempted' ? 1 : 0), corrected: summary.corrected + (record.reviewStatus === 'corrected' ? 1 : 0) }), { total: 0, complete: 0, open: 0, late: 0, exempted: 0, corrected: 0 });
}

export async function listStaffClockingReviewRequests(db: Firestore, actor: AuthenticatedAppUser, kind: 'exemption' | 'correction'): Promise<StaffClockingReviewRequest[]> {
  requireStaffClockingAccess(actor, 'records', kind === 'exemption' ? 'review_exemptions' : 'review_corrections');
  const snapshot = await db.collection(kind === 'exemption' ? STAFF_CLOCKING_COLLECTIONS.exemptions : STAFF_CLOCKING_COLLECTIONS.corrections).get();
  return snapshot.docs
    .map((item) => ({ id: item.id, ...toIso(item.data()) } as StaffClockingReviewRequest))
    .filter((request) => request.status === 'pending')
    .sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')));
}

export async function listOwnStaffClockingNotifications(db: Firestore, actor: AuthenticatedAppUser) {
  requireStaffClockingAccess(actor, 'clock', 'view_own_clock');
  const snapshot = await db.collection(STAFF_CLOCKING_COLLECTIONS.notifications).where('accountId', '==', actor.user.id).get();
  return snapshot.docs.map(item => ({ id: item.id, ...toIso(item.data()) })).sort((left: any, right: any) => String(right.createdAt || '').localeCompare(String(left.createdAt || ''))).slice(0, 10);
}

/** A staff-scoped, server-resolved snapshot for the personal Clock page. */
export async function getOwnStaffClockingDashboard(db: Firestore, actor: AuthenticatedAppUser, part: 'schedule' | 'status' | 'history' | 'all' = 'all'): Promise<Partial<StaffClockingPersonalSchedule> & { record?: StaffClockingDailyRecord; history?: StaffClockingDailyRecord[] }> {
  requireStaffClockingAccess(actor, 'clock', 'view_own_clock');
  const staffId = actor.user.staffId;
  if (!staffId) throw new Error('CLOCKING_STAFF_LINK_REQUIRED');
  const now = kampalaClock();
  if (part === 'status') {
    const record = await db.collection(STAFF_CLOCKING_COLLECTIONS.dailyRecords).doc(dailyRecordId(staffId, now.localDate)).get();
    return { localDate: now.localDate, record: record.exists ? { id: record.id, ...toIso(record.data() || {}) } as StaffClockingDailyRecord : undefined };
  }
  if (part === 'history') {
    const records = await db.collection(STAFF_CLOCKING_COLLECTIONS.dailyRecords).where('staffId', '==', staffId)
      .where('localDate', '<', now.localDate).orderBy('localDate', 'desc').limit(5).get();
    return { history: records.docs.map(record => ({ id: record.id, ...toIso(record.data()) } as StaffClockingDailyRecord)) };
  }
  if (part === 'all') {
    const [schedule, status, history] = await Promise.all(['schedule', 'status', 'history'].map(value => getOwnStaffClockingDashboard(db, actor, value as 'schedule' | 'status' | 'history')));
    return { ...schedule, ...status, ...history };
  }
  const [staffSnapshot, schedulesSnapshot, calendarDay] = await Promise.all([
    db.collection('staff').doc(staffId).get(),
    db.collection(STAFF_CLOCKING_COLLECTIONS.schedules).get(),
    resolveCalendarClosure(db, now.localDate),
  ]);
  if (!staffSnapshot.exists || String(staffSnapshot.data()?.status || 'active').toLowerCase() !== 'active') throw new Error('CLOCKING_STAFF_INACTIVE');
  const staff = staffSnapshot.data() || {};
  const groups = [...new Set([...(Array.isArray(staff.department) ? staff.department : [staff.department]), ...(Array.isArray(staff.role) ? staff.role : [staff.role])].filter((value): value is string => typeof value === 'string' && value.length > 0))];
  const schedules = schedulesSnapshot.docs.map(item => serializeSchedule(item.id, item.data()));
  const resolution = resolveStaffClockingSchedule({ staffId, groupIds: groups, localDate: now.localDate, schedules, calendarDay });
  const appliedSchedule = resolution.sourceScheduleId ? schedules.find(schedule => schedule.id === resolution.sourceScheduleId) : undefined;
  return {
    staff: { id: staffId, name: [staff.firstName, staff.lastName].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' ').trim() || 'Staff member', group: groups[0] || undefined },
    localDate: now.localDate,
    schedule: resolution.kind === 'scheduled' ? { kind: resolution.kind, clockInBy: resolution.clockInBy, clockOutBy: appliedSchedule?.clockOutBy, graceMinutes: resolution.graceMinutes, sourceScope: resolution.sourceScope } : { kind: resolution.kind, reason: resolution.reason },
    calendar: calendarDay ? { isClosed: calendarDay.isClosed, label: calendarDay.label } : undefined,
  };
}

export async function createStaffClockingSelfServiceRequest(db: Firestore, actor: AuthenticatedAppUser, kind: 'exemption' | 'correction', input: unknown, submittedBy?: { id: string; name: string }) {
  requireStaffClockingAccess(actor, 'clock', kind === 'exemption' ? 'request_exemption' : 'request_correction');
  const staffId = actor.user.staffId;
  if (!staffId) throw new Error('CLOCKING_STAFF_LINK_REQUIRED');
  const payload = selfServiceRequestSchema.parse(input);
  if (kind === 'exemption' && (payload.proposedClockInTime || payload.proposedClockOutTime)) throw new Error('CLOCKING_EXEMPTION_TIME_NOT_ALLOWED');
  if (kind === 'correction' && !payload.proposedClockInTime) throw new Error('CLOCKING_CORRECTION_TIME_REQUIRED');
  if (kind === 'correction' && payload.localDate > kampalaClock().localDate) throw new Error('CLOCKING_FUTURE_CORRECTION_NOT_ALLOWED');
  const staff = await db.collection('staff').doc(staffId).get();
  if (!staff.exists || String(staff.data()?.status || 'active').toLowerCase() !== 'active') throw new Error('CLOCKING_STAFF_INACTIVE');
  const ref = db.collection(kind === 'exemption' ? STAFF_CLOCKING_COLLECTIONS.exemptions : STAFF_CLOCKING_COLLECTIONS.corrections).doc();
  const actorData = submittedBy || actorLabel(actor);
  const record = omitUndefined({
    kind, status: 'pending', staffId, accountId: actor.user.id, localDate: payload.localDate, reason: payload.reason,
    proposedClockInTime: payload.proposedClockInTime, proposedClockOutTime: payload.proposedClockOutTime,
    createdAt: Timestamp.now(), createdBy: actorData,
  });
  const batch = db.batch();
  batch.create(ref, record);
  batch.set(db.collection(STAFF_CLOCKING_COLLECTIONS.history).doc(), {
    a: 'create', e: `staff_clocking_${kind}`, rid: ref.id, rl: `Staff clocking ${kind} requested`,
    uid: actorData.id, un: actorData.name, m: { staffId, localDate: payload.localDate }, ts: Timestamp.now(),
  });
  bumpClockingRevisions(db, batch, 'staffClockingRequests');
  bumpPersonalClockingRevision(db, batch, staffId, undefined, false, true);
  await batch.commit();
  return { id: ref.id, ...toIso(record) };
}

/** Records a manager-authorised one-day absence without rewriting scan history. */
export async function createManagedStaffClockingExemption(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  requireStaffClockingAccess(actor, 'record', 'manage_calendar');
  const payload = managerExemptionSchema.parse(input);
  const staff = await db.collection('staff').doc(payload.staffId).get();
  if (!staff.exists || String(staff.data()?.status || 'active').toLowerCase() !== 'active') throw new Error('CLOCKING_STAFF_INACTIVE');
  const manager = actorLabel(actor);
  const exemptionRef = db.collection(STAFF_CLOCKING_COLLECTIONS.exemptions).doc();
  const staffData = staff.data() || {};
  const staffName = [staffData.firstName, staffData.lastName].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' ').trim();
  const exemption = { kind: 'exemption', status: 'approved', staffId: payload.staffId, localDate: payload.localDate, reason: payload.reason, createdAt: Timestamp.now(), createdBy: manager, reviewedAt: Timestamp.now(), reviewedBy: manager, source: 'manager_recorded' };
  await db.runTransaction(async transaction => {
    const dailyRef = db.collection(STAFF_CLOCKING_COLLECTIONS.dailyRecords).doc(dailyRecordId(payload.staffId, payload.localDate));
    const existing = await transaction.get(dailyRef);
    transaction.create(exemptionRef, exemption);
    bumpClockingRevisions(db, transaction, 'staffClockingRequests', 'staffClockingRecords');
    bumpPersonalClockingRevision(db, transaction, payload.staffId, payload.localDate, false, true);
    transaction.set(dailyRef, {
      ...(existing.exists ? existing.data() : {}), staffId: payload.staffId, ...(staffName ? { staffName } : {}), localDate: payload.localDate,
      status: existing.data()?.status || 'open', exemptionId: exemptionRef.id, exemptionStatus: 'approved', reviewStatus: 'exempted', updatedAt: Timestamp.now(),
    }, { merge: false });
    transaction.create(db.collection(STAFF_CLOCKING_COLLECTIONS.events).doc(`manager_exemption_${exemptionRef.id}`), { type: 'exemption_approved', staffId: payload.staffId, localDate: payload.localDate, exemptionId: exemptionRef.id, occurredAt: Timestamp.now(), reviewedBy: manager });
    transaction.create(db.collection(STAFF_CLOCKING_COLLECTIONS.history).doc(), { a: 'create', e: 'staff_clocking_exemption', rid: exemptionRef.id, rl: 'Staff clocking exemption recorded', uid: manager.id, un: manager.name, m: { staffId: payload.staffId, localDate: payload.localDate }, ts: Timestamp.now() });
  });
  return { id: exemptionRef.id, ...toIso(exemption) };
}

export async function reviewStaffClockingSelfServiceRequest(db: Firestore, actor: AuthenticatedAppUser, kind: 'exemption' | 'correction', id: string, approved: boolean, reviewNote?: string) {
  requireStaffClockingAccess(actor, 'records', kind === 'exemption' ? 'review_exemptions' : 'review_corrections');
  staffClockingReviewSchema.parse({ approved, reviewNote });
  const ref = db.collection(kind === 'exemption' ? STAFF_CLOCKING_COLLECTIONS.exemptions : STAFF_CLOCKING_COLLECTIONS.corrections).doc(documentId.parse(id));
  const reviewer = actorLabel(actor);
  return db.runTransaction(async transaction => {
    const request = await transaction.get(ref);
    if (!request.exists) throw new Error('CLOCKING_REQUEST_NOT_FOUND');
    const data = request.data()!;
    if (data.status !== 'pending') throw new Error('CLOCKING_REQUEST_ALREADY_REVIEWED');
    if (data.accountId === actor.user.id || data.staffId === actor.user.staffId || data.createdBy?.id === actor.user.id) throw new Error('CLOCKING_SELF_REVIEW_NOT_ALLOWED');
    const dailyRef = db.collection(STAFF_CLOCKING_COLLECTIONS.dailyRecords).doc(dailyRecordId(String(data.staffId), String(data.localDate)));
    const daily = approved ? await transaction.get(dailyRef) : undefined;
    if (approved && kind === 'correction') {
      if (String(data.localDate) > kampalaClock().localDate) throw new Error('CLOCKING_FUTURE_CORRECTION_NOT_ALLOWED');
      const previous = daily?.data() || {};
      const clockInTime = String(data.proposedClockInTime);
      const clockOutTime = data.proposedClockOutTime || previous.effectiveClockOutTime || previous.clockOutTime || null;
      if (clockOutTime && localTimeToSeconds(clockOutTime) <= localTimeToSeconds(clockInTime)) throw new Error('CLOCKING_CORRECTION_INVALID_TIME_ORDER');
      const schedule = { kind: 'scheduled' as const, clockInBy: String(previous.clockInBy || ''), graceMinutes: Number(previous.graceMinutes) };
      const arrival = schedule.clockInBy && Number.isInteger(schedule.graceMinutes) ? classifyStaffClockIn(clockInTime, schedule) : undefined;
      transaction.set(dailyRef, omitUndefined({
        ...previous, staffId: data.staffId, accountId: data.accountId, localDate: data.localDate,
        effectiveClockInTime: clockInTime,
        effectiveClockOutTime: clockOutTime,
        rawArrivalStatus: previous.rawArrivalStatus || previous.arrivalStatus,
        rawSecondsLate: previous.rawSecondsLate ?? previous.secondsLate,
        arrivalStatus: arrival?.status || previous.arrivalStatus,
        secondsLate: arrival?.secondsLate ?? previous.secondsLate,
        correctionId: ref.id,
        reviewStatus: 'corrected',
        status: clockOutTime ? 'complete' : previous.status || 'open',
        updatedAt: Timestamp.now(),
      }), { merge: false });
    }
    if (approved && kind === 'exemption') {
      transaction.set(dailyRef, {
        staffId: data.staffId, accountId: data.accountId, localDate: data.localDate, status: daily?.data()?.status || 'open',
        exemptionId: ref.id, exemptionStatus: 'approved', reviewStatus: 'exempted', updatedAt: Timestamp.now(),
      }, { merge: true });
    }
    if (approved) transaction.create(db.collection(STAFF_CLOCKING_COLLECTIONS.events).doc(`review_${kind}_${ref.id}`), {
      type: `${kind}_approved`, staffId: data.staffId, localDate: data.localDate, requestId: ref.id,
      reviewedBy: reviewer, occurredAt: Timestamp.now(),
      ...(kind === 'correction' ? { proposedClockInTime: data.proposedClockInTime, proposedClockOutTime: data.proposedClockOutTime || null } : {}),
      before: { clockInTime: daily?.data()?.effectiveClockInTime || daily?.data()?.clockInTime || null, clockOutTime: daily?.data()?.effectiveClockOutTime || daily?.data()?.clockOutTime || null },
    });
    transaction.update(ref, omitUndefined({ status: approved ? 'approved' : 'rejected', reviewedAt: Timestamp.now(), reviewedBy: reviewer, reviewNote: reviewNote?.trim() || undefined }));
    bumpClockingRevisions(db, transaction, 'staffClockingRequests', 'staffClockingNotifications', ...(approved ? ['staffClockingRecords' as const] : []));
    bumpPersonalClockingRevision(db, transaction, String(data.staffId), approved ? String(data.localDate) : undefined, true, true);
    transaction.set(db.collection(STAFF_CLOCKING_COLLECTIONS.notifications).doc(), {
      accountId: data.accountId, staffId: data.staffId, type: `${kind}_${approved ? 'approved' : 'rejected'}`,
      title: `Clocking ${kind} ${approved ? 'approved' : 'rejected'}`,
      body: reviewNote?.trim() || `Your ${kind} for ${data.localDate} was ${approved ? 'approved' : 'rejected'}.`,
      requestId: ref.id, readAt: null, createdAt: Timestamp.now(),
    });
    transaction.set(db.collection(STAFF_CLOCKING_COLLECTIONS.history).doc(), {
      a: 'review', e: `staff_clocking_${kind}`, rid: ref.id, rl: `Staff clocking ${kind} ${approved ? 'approved' : 'rejected'}`,
      uid: reviewer.id, un: reviewer.name, m: { staffId: data.staffId, localDate: data.localDate, approved }, ts: Timestamp.now(),
    });
    return { id: ref.id, status: approved ? 'approved' : 'rejected' };
  });
}

export async function issueStaffClockingQrSession(db: Firestore, actor: AuthenticatedAppUser) {
  requireStaffClockingAccess(actor, 'record', 'display_qr');
  const [settingsSnapshot, schedules] = await Promise.all([
    db.collection(STAFF_CLOCKING_COLLECTIONS.settings).doc(SETTINGS_ID).get(),
    db.collection(STAFF_CLOCKING_COLLECTIONS.schedules).get(),
  ]);
  const settings = normalizeSettings(settingsSnapshot.data());
  if (!settings.enabled) throw new Error('CLOCKING_FEATURE_DISABLED');
  if (!schedules.docs.some(schedule => schedule.data().isActive === true)) throw new Error('CLOCKING_SCHEDULE_REQUIRED');
  const now = Date.now();
  const sessionId = randomUUID();
  const tokenExpiresAtMs = now + QR_TOKEN_LIFETIME_MS;
  const sessionExpiresAtMs = now + QR_SESSION_LIFETIME_MS;
  const token = issueQrToken(sessionId, tokenExpiresAtMs);
  await db.collection(STAFF_CLOCKING_COLLECTIONS.sessions).doc(sessionId).set({
    status: 'active', settingsRevision: settings.revision, createdBy: actorLabel(actor),
    createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(sessionExpiresAtMs),
  });
  return { sessionId, token, expiresAt: new Date(tokenExpiresAtMs).toISOString() };
}

export async function refreshStaffClockingQrSession(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  requireStaffClockingAccess(actor, 'record', 'display_qr');
  const { sessionId } = qrSessionRefreshSchema.parse(input);
  if (!sessionId) return issueStaffClockingQrSession(db, actor);

  const now = Date.now();
  const settingsSnapshot = await db.collection(STAFF_CLOCKING_COLLECTIONS.settings).doc(SETTINGS_ID).get();
  const settings = normalizeSettings(settingsSnapshot.data());
  if (!settings.enabled) throw new Error('CLOCKING_FEATURE_DISABLED');
  const sessionRef = db.collection(STAFF_CLOCKING_COLLECTIONS.sessions).doc(sessionId);
  const session = await sessionRef.get();
  const expiresAt = session.data()?.expiresAt?.toDate?.();
  if (!session.exists || session.data()?.status !== 'active' || !(expiresAt instanceof Date) || expiresAt.getTime() < now) {
    return issueStaffClockingQrSession(db, actor);
  }
  if (session.data()?.createdBy?.id !== actor.user.id || Number(session.data()?.settingsRevision) !== settings.revision) {
    throw new Error('CLOCKING_QR_SESSION_STALE');
  }
  const tokenExpiresAtMs = now + QR_TOKEN_LIFETIME_MS;
  return { sessionId, token: issueQrToken(sessionId, tokenExpiresAtMs), expiresAt: new Date(tokenExpiresAtMs).toISOString() };
}

export async function recordStaffClockingScan(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  requireStaffClockingAccess(actor, 'clock', 'clock_self');
  const payload = clockScanSchema.parse(input);
  const now = new Date();
  const staffId = actor.user.staffId;
  if (!staffId) throw new Error('CLOCKING_STAFF_LINK_REQUIRED');
  const { localDate, localTime } = kampalaClock(now);
  const eventRef = db.collection(STAFF_CLOCKING_COLLECTIONS.events).doc(operationEventId(actor.user.id, payload.operationId));
  const dailyRef = db.collection(STAFF_CLOCKING_COLLECTIONS.dailyRecords).doc(dailyRecordId(staffId, localDate));
  const settingsRef = db.collection(STAFF_CLOCKING_COLLECTIONS.settings).doc(SETTINGS_ID);
  const staffRef = db.collection('staff').doc(staffId);
  const scheduleQuery = db.collection(STAFF_CLOCKING_COLLECTIONS.schedules);
  const requestDigest = createHash('sha256').update(payload.token).digest('hex');

  return db.runTransaction(async transaction => {
    const [existingEvent, account] = await Promise.all([
      transaction.get(eventRef), transaction.get(db.collection('system_users').doc(actor.user.id)),
    ]);
    if (!account.exists || account.data()?.isActive === false || account.data()?.staffId !== staffId) throw new Error('ACCOUNT_INACTIVE');
    requireStaffClockingAccess({ ...actor, user: { ...account.data(), id: account.id } as AuthenticatedAppUser['user'] }, 'clock', 'clock_self');
    if (existingEvent.exists) {
      if (existingEvent.data()?.requestDigest !== requestDigest) throw new Error('CLOCKING_OPERATION_CONFLICT');
      return { duplicate: true, event: toIso(existingEvent.data()) };
    }
    const token = verifyQrToken(payload.token, now.getTime());
    const sessionRef = db.collection(STAFF_CLOCKING_COLLECTIONS.sessions).doc(token.sessionId);
    const [session, settingsSnapshot, staff, scheduleSnapshot, daily, calendarDay] = await Promise.all([
      transaction.get(sessionRef), transaction.get(settingsRef), transaction.get(staffRef), transaction.get(scheduleQuery), transaction.get(dailyRef), resolveCalendarClosure(db, localDate, transaction),
    ]);
    const feature = normalizeSettings(settingsSnapshot.data());
    if (!feature.enabled) throw new Error('CLOCKING_FEATURE_DISABLED');
    if (!staff.exists || String(staff.data()?.status || 'active').toLowerCase() !== 'active') throw new Error('CLOCKING_STAFF_INACTIVE');
    if (feature.accessMode === 'selected_staff' && !feature.enrolledStaffIds.includes(staffId)) throw new Error('CLOCKING_STAFF_NOT_ENROLLED');
    const sessionExpiry = session.data()?.expiresAt?.toDate?.();
    if (!session.exists || session.data()?.status !== 'active' || !(sessionExpiry instanceof Date) || sessionExpiry.getTime() < now.getTime()) throw new Error('CLOCKING_QR_SESSION_EXPIRED');
    if (Number(session.data()?.settingsRevision) !== feature.revision) throw new Error('CLOCKING_QR_SESSION_STALE');

    const staffData = staff.data() || {};
    const departmentGroups = Array.isArray(staffData.department) ? staffData.department : [staffData.department];
    const roleGroups = Array.isArray(staffData.role) ? staffData.role : [staffData.role];
    const groups = [...new Set([...departmentGroups, ...roleGroups].filter((value): value is string => typeof value === 'string' && value.length > 0))];
    const prior = daily.exists ? daily.data()! : undefined;
    const hasArrival = !!(prior?.clockInAt || prior?.effectiveClockInTime);
    const resolution = hasArrival ? {
      kind: 'scheduled' as const, localDate,
      sourceScheduleId: prior.scheduleId || 'saved-day', sourceScope: prior.scheduleScope || 'school',
      clockInBy: prior.clockInBy, graceMinutes: prior.graceMinutes,
    } : resolveStaffClockingSchedule({
      staffId,
      groupIds: groups,
      localDate,
      schedules: scheduleSnapshot.docs.map(item => serializeSchedule(item.id, item.data())),
      calendarDay,
    });
    if (resolution.kind !== 'scheduled') throw new Error(resolution.kind === 'conflict' ? 'CLOCKING_SCHEDULE_CONFLICT' : 'CLOCKING_NO_SCHEDULE');

    if (prior?.finalizationStatus === 'finalized') throw new Error('CLOCKING_DAY_FINALIZED');
    const eventType = hasArrival ? (prior?.clockOutAt || prior?.effectiveClockOutTime) ? null : 'clock_out' : 'clock_in';
    if (!eventType) throw new Error('CLOCKING_DAY_ALREADY_COMPLETE');
    const arrivalAt = prior?.clockInAt?.toMillis?.() ?? (prior?.effectiveClockInTime ? new Date(`${localDate}T${prior.effectiveClockInTime}+03:00`).getTime() : 0);
    if (eventType === 'clock_out' && now.getTime() - arrivalAt < 90_000) throw new Error('CLOCKING_DUPLICATE_SCAN_WAIT');
    const arrival = eventType === 'clock_in' ? classifyStaffClockIn(localTime, resolution) : undefined;
    const event = omitUndefined({
      id: eventRef.id, staffId, accountId: actor.user.id, operationId: payload.operationId, requestDigest, type: eventType,
      occurredAt: Timestamp.fromDate(now), localDate, localTime, sessionId: token.sessionId,
      scheduleId: resolution.sourceScheduleId, scheduleScope: resolution.sourceScope, clockInBy: resolution.clockInBy,
      graceMinutes: resolution.graceMinutes, ...(arrival ? { arrivalStatus: arrival.status, secondsLate: arrival.secondsLate } : {}),
    });
    const staffName = [staffData.firstName, staffData.lastName].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' ').trim();
    const appliedRule = scheduleSnapshot.docs.find(item => item.id === resolution.sourceScheduleId)?.data();
    const savedSchedule = omitUndefined({ clockInBy: resolution.clockInBy, clockOutBy: appliedRule?.clockOutBy, graceMinutes: resolution.graceMinutes, scope: resolution.sourceScope, kind: appliedRule?.kind, groups });
    const record = eventType === 'clock_in'
      ? { ...prior, staffId, ...(staffName ? { staffName } : {}), accountId: actor.user.id, localDate, clockInAt: Timestamp.fromDate(now), clockInTime: localTime, arrivalStatus: arrival!.status, secondsLate: arrival!.secondsLate, scheduleId: resolution.sourceScheduleId, clockInBy: resolution.clockInBy, graceMinutes: resolution.graceMinutes, status: 'open', updatedAt: Timestamp.fromDate(now) }
      : { ...prior, clockOutAt: Timestamp.fromDate(now), clockOutTime: localTime, status: 'complete', updatedAt: Timestamp.fromDate(now) };
    transaction.create(eventRef, event);
    if (eventType === 'clock_in') Object.assign(record, { scheduleSnapshot: savedSchedule, ...(appliedRule?.clockOutBy ? { clockOutBy: appliedRule.clockOutBy } : {}) });
    transaction.set(dailyRef, record, { merge: false });
    bumpClockingRevisions(db, transaction, 'staffClockingRecords');
    bumpPersonalClockingRevision(db, transaction, staffId, localDate);
    return { duplicate: false, event: toIso(event), record: toIso(record) };
  });
}

export async function listStaffClockingTimekeepers(db: Firestore, actor: AuthenticatedAppUser): Promise<StaffClockingTimekeeper[]> {
  requireStaffClockingAccess(actor, 'record', 'manage_timekeepers');
  const [accounts, staff] = await Promise.all([db.collection('system_users').where('role', '==', 'Staff').get(), db.collection('staff').get()]);
  const active = new Map(staff.docs.filter(item => String(item.data().status || 'active').toLowerCase() === 'active').map(item => [item.id, item.data()]));
  return accounts.docs.flatMap(item => {
    const data = item.data();
    const member = active.get(String(data.staffId));
    if (data.isActive === false || !member) return [];
    return [{ accountId: item.id, staffId: String(data.staffId), name: [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || String(data.username || 'Staff member'), username: String(data.username || ''),
      allowed: GranularPermissionService.canPerformAction({ ...data, id: item.id } as AuthenticatedAppUser['user'], 'staff_clocking', 'record', 'display_qr'), revision: Number(data.clockingStationAccessRevision || 0) }];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateStaffClockingTimekeeper(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  requireStaffClockingAccess(actor, 'record', 'manage_timekeepers');
  const payload = z.object({ accountId: documentId, allowed: z.boolean(), revision: z.number().int().min(0) }).strict().parse(input);
  const ref = db.collection('system_users').doc(payload.accountId);
  return db.runTransaction(async transaction => {
    const target = await transaction.get(ref);
    const data = target.data();
    if (!data || data.role !== 'Staff' || data.isActive === false || !data.staffId) throw new Error('CLOCKING_ACTIVE_STAFF_ACCOUNT_REQUIRED');
    const staff = await transaction.get(db.collection('staff').doc(data.staffId));
    if (!staff.exists || String(staff.data()?.status || 'active').toLowerCase() !== 'active') throw new Error('CLOCKING_STAFF_INACTIVE');
    if (Number(data.clockingStationAccessRevision || 0) !== payload.revision) throw new Error('CLOCKING_ACCESS_CHANGED_REVIEW_AND_RETRY');
    const permissions: import('@/types').ModulePermissions[] = structuredClone(data.granularPermissions || []);
    let module = permissions.find(item => item.moduleId === 'staff_clocking');
    if (!module) { module = { moduleId: 'staff_clocking', pages: [] }; permissions.push(module); }
    let page = module.pages.find(item => item.pageId === 'record');
    if (!page) { page = { pageId: 'record', canAccess: false, actions: [] }; module.pages.push(page); }
    const wasAccessible = page.canAccess;
    // Enabling a previously disabled page must not resurrect dormant manager
    // actions saved on it. Preserve effective permissions, not inactive flags.
    if (!wasAccessible && payload.allowed) page.actions = page.actions.map(item => ({ ...item, allowed: false }));
    for (const actionId of ['view_record', 'display_qr']) {
      const action = page.actions.find(item => item.actionId === actionId);
      if (action) action.allowed = payload.allowed; else page.actions.push({ actionId, allowed: payload.allowed });
    }
    page.canAccess = (wasAccessible || payload.allowed) && page.actions.some(item => item.allowed);
    transaction.update(ref, { granularPermissions: permissions, clockingStationAccessRevision: payload.revision + 1, updatedAt: Timestamp.now() });
    bumpClockingRevisions(db, transaction, 'staffClockingTimekeepers');
    const who = actorLabel(actor);
    transaction.create(db.collection(STAFF_CLOCKING_COLLECTIONS.history).doc(), { a: 'update', e: 'staff_clocking_timekeeper', rid: target.id,
      rl: payload.allowed ? 'Record Station access granted' : 'Record Station access removed', uid: who.id, un: who.name,
      m: { staffId: data.staffId, accountId: target.id, allowed: payload.allowed }, ts: Timestamp.now() });
    return { accountId: target.id, allowed: payload.allowed, revision: payload.revision + 1 };
  });
}
