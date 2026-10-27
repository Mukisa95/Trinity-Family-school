import 'server-only';
import { FieldPath, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AuthenticatedAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService as Permissions } from '@/lib/services/granular-permissions.service';
import { STAFF_CLOCKING_COLLECTIONS as collections, requireStaffClockingAccess, dailyRecordId, kampalaClock, toIso, staffGroupLabels, localDateFromCalendarValue, actorLabel, bumpPersonalClockingRevision, bumpClockingRevisions, createManagedStaffClockingExemption, createStaffClockingSelfServiceRequest, reviewStaffClockingSelfServiceRequest } from './index';
import { isIsoLocalDate } from '@/lib/staff-clocking/dates';
import { detailDates, clockingSchoolDate } from '@/lib/staff-clocking/details-report';
import type { StaffClockingDetailProfile, StaffClockingDetailPlan, StaffClockingDetailRequest, StaffClockingDetailAuditPage, DetailRange } from '@/lib/staff-clocking/details-contracts';
import type { StaffClockingDailyRecord, StaffClockingSchedule } from '@/lib/staff-clocking/contracts';
import { loadStaffClockingDuties } from './duty-schedule';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
const date = z.string().refine(isIsoLocalDate);
const rangeSchema = z.object({ from: date, to: date }).refine(value => detailDates(value).length > 0, 'Choose a period of at most 366 days.');
const allowed = (actor: AuthenticatedAppUser, page: string, action: string) => Permissions.canPerformAction(actor.user, 'staff_clocking', page, action);

export function requireIndividualClockingAccess(actor: AuthenticatedAppUser, staffId: string) {
  id.parse(staffId);
  if (actor.user.staffId === staffId) requireStaffClockingAccess(actor, 'clock', 'view_own_clock');
  else requireStaffClockingAccess(actor, 'records', 'view_records');
}

export async function getIndividualClockingProfile(db: Firestore, actor: AuthenticatedAppUser, staffId: string): Promise<StaffClockingDetailProfile> {
  requireIndividualClockingAccess(actor, staffId);
  const snapshot = await db.collection('staff').doc(staffId).get();
  if (!snapshot.exists) throw new Error('CLOCKING_STAFF_NOT_FOUND');
  const data = snapshot.data()!;
  const own = actor.user.staffId === staffId;
  const profile = Permissions.canPerformAction(actor.user, 'staff', 'list', 'view_list');
  const labels = (value: unknown) => (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === 'string');
  return { staff: { id: staffId, name: [data.firstName, data.otherNames, data.lastName].filter(Boolean).join(' ').trim() || staffId, employeeId: String(data.employeeId || staffId), groups: labels(data.department), roles: labels(data.role), status: String(data.status || 'active'),
    photo: typeof data.photo === 'string' && (/^https:\/\//.test(data.photo) || /^\/(?!\/)/.test(data.photo)) ? data.photo : undefined,
    ...(own || profile ? { email: String(data.email || ''), phone: String(data.contactNumber || '') } : {}) },
    permissions: { own, profile, export: own || allowed(actor, 'records', 'export_records'), manage: allowed(actor, 'record', 'access_manage') && allowed(actor, 'record', 'manage_schedules'),
      exempt: allowed(actor, 'record', 'manage_calendar'), request: own ? allowed(actor, 'clock', 'request_correction') : allowed(actor, 'record', 'manual_clock'), explain: own && allowed(actor, 'clock', 'explain_lateness'),
      audit: own || allowed(actor, 'records', 'view_audit'), reviewExemptions: allowed(actor, 'records', 'review_exemptions'), reviewCorrections: allowed(actor, 'records', 'review_corrections'), reviewExplanations: allowed(actor, 'records', 'review_explanations') } };
}

/** Reconciliation reads three small metadata documents, never attendance lists. */
export async function getIndividualClockingRevisions(db: Firestore, actor: AuthenticatedAppUser, staffId: string) {
  requireIndividualClockingAccess(actor, staffId);
  const [reference, operational, personal] = await Promise.all([
    db.collection('settings').doc('data-revisions-reference').get(),
    db.collection('settings').doc('data-revisions-operational').get(),
    db.collection(collections.personalRevisions).doc(staffId).get(),
  ]);
  return { shared: Object.fromEntries(['staff', 'events', 'staffClockingConfig', 'staffClockingDuty', 'staffClockingRecords', 'staffClockingRequests'].map(key => [key, Math.max(Number(reference.data()?.[key] || 0), Number(operational.data()?.[key] || 0))])), personal: personal.data() || {} };
}

export async function getIndividualClockingPlan(db: Firestore, actor: AuthenticatedAppUser, staffId: string): Promise<StaffClockingDetailPlan> {
  requireIndividualClockingAccess(actor, staffId);
  const [staff, rules, holidays, duties] = await Promise.all([db.collection('staff').doc(staffId).get(), db.collection(collections.schedules).get(), db.collection('events').where('type', '==', 'Holiday').get(), loadStaffClockingDuties(db, staffId)]);
  if (!staff.exists) throw new Error('CLOCKING_STAFF_NOT_FOUND');
  const data = staff.data()!, groups = staffGroupLabels(data);
  const since = (value: unknown) => { const iso = toIso(value); return typeof iso === 'string' && Number.isFinite(Date.parse(iso)) ? clockingSchoolDate(new Date(iso)) : kampalaClock().localDate; };
  return { staffId, groups, duties, joinedOn: localDateFromCalendarValue(data.joinDate), stableSince: since(data.updatedAt || data.createdAt),
    schedules: rules.docs.filter(item => { const rule = item.data(); return rule.scope === 'school' || rule.scope === 'staff' && rule.subjectId === staffId || rule.scope === 'group' && groups.includes(rule.subjectId); })
      .map(item => ({ id: item.id, ...toIso(item.data()), availableFrom: since(item.data().updatedAt || item.data().createdAt) } as StaffClockingSchedule & { availableFrom: string })),
    closures: holidays.docs.flatMap(item => { const event = item.data(), from = localDateFromCalendarValue(event.startDate), to = localDateFromCalendarValue(event.endDate) || from;
      return from && to && !['Draft', 'Cancelled'].includes(event.status) && (event.requiresApproval !== true || event.approvalStatus === 'Approved') && event.customFields?.staffClockingEffect === 'school_closure' ? [{ from, to, title: String(event.title || 'School closure') }] : []; }) };
}

export async function getIndividualClockingRecords(db: Firestore, actor: AuthenticatedAppUser, staffId: string, input: unknown): Promise<StaffClockingDailyRecord[]> {
  requireIndividualClockingAccess(actor, staffId);
  const { from, to } = rangeSchema.parse(input);
  const records = await db.collection(collections.dailyRecords).where('staffId', '==', staffId).where('localDate', '>=', from).where('localDate', '<=', to).orderBy('localDate', 'desc').limit(367).get();
  if (records.size > 366) throw new Error('CLOCKING_REPORT_RANGE_TOO_LARGE');
  return records.docs.map(item => ({ id: item.id, ...toIso(item.data()) } as StaffClockingDailyRecord));
}

export async function getIndividualClockingToday(db: Firestore, actor: AuthenticatedAppUser, staffId: string) {
  requireIndividualClockingAccess(actor, staffId);
  const localDate = kampalaClock().localDate;
  const record = await db.collection(collections.dailyRecords).doc(dailyRecordId(staffId, localDate)).get();
  return { localDate, record: record.exists ? { id: record.id, ...toIso(record.data() || {}) } as StaffClockingDailyRecord : undefined };
}

export async function getIndividualClockingRequests(db: Firestore, actor: AuthenticatedAppUser, staffId: string, input: unknown, exemptionsOnly = false): Promise<StaffClockingDetailRequest[]> {
  requireIndividualClockingAccess(actor, staffId);
  const { from, to } = rangeSchema.parse(input);
  const own = actor.user.staffId === staffId;
  const kinds = exemptionsOnly ? ['exemption'] as const : ['exemption', 'correction', 'explanation'] as const;
  const requests = await Promise.all(kinds.map(async kind => {
    const collection = kind === 'exemption' ? collections.exemptions : kind === 'correction' ? collections.corrections : collections.explanations;
    const data = await db.collection(collection).where('staffId', '==', staffId).where('localDate', '>=', from).where('localDate', '<=', to).orderBy('localDate', 'desc').limit(500).get();
    const privateReason = own || allowed(actor, 'records', kind === 'exemption' ? 'review_exemptions' : kind === 'correction' ? 'review_corrections' : 'review_explanations') || kind === 'exemption' && allowed(actor, 'record', 'manage_calendar');
    return data.docs.map(item => { const request = toIso(item.data()); return { id: item.id, kind, status: request.status, localDate: request.localDate,
      ...(privateReason ? { reason: request.reason, createdAt: request.createdAt, createdBy: request.createdBy, reviewedBy: request.reviewedBy, reviewedAt: request.reviewedAt, reviewNote: request.reviewNote, proposedClockInTime: request.proposedClockInTime, proposedClockOutTime: request.proposedClockOutTime } : {}) } as StaffClockingDetailRequest; });
  }));
  return requests.flat().sort((a, b) => b.localDate.localeCompare(a.localDate));
}

type AuditCursor = { events?: { date: string; time: string; id: string }; logs?: { date: string; time: string; id: string } };
export async function getIndividualClockingAudit(db: Firestore, actor: AuthenticatedAppUser, staffId: string, input: unknown, cursor?: string): Promise<StaffClockingDetailAuditPage> {
  requireIndividualClockingAccess(actor, staffId);
  const own = actor.user.staffId === staffId, full = allowed(actor, 'records', 'view_audit');
  if (!own && !full) throw new Error('PERMISSION_DENIED');
  const range = rangeSchema.parse(input);
  let position: AuditCursor = {};
  if (cursor) { try { position = z.object({ events: z.object({ date, time: z.string().datetime(), id }).optional(), logs: z.object({ date, time: z.string().datetime(), id }).optional() }).parse(JSON.parse(Buffer.from(z.string().max(1500).parse(cursor), 'base64url').toString())); } catch { throw new Error('CLOCKING_INVALID_CURSOR'); } }
  const load = async (source: 'events' | 'logs') => {
    if (source === 'logs' && !full) return [];
    const field = source === 'events' ? 'occurredAt' : 'ts';
    const workDate = source === 'events' ? 'localDate' : 'm.localDate';
    // Audit belongs to the affected work session, including adjustments made
    // weeks later. Occurrence time remains visible and orders that day's changes.
    let query = db.collection(source === 'events' ? collections.events : collections.history).where(source === 'events' ? 'staffId' : 'm.staffId', '==', staffId)
      .where(workDate, '>=', range.from).where(workDate, '<=', range.to).orderBy(workDate, 'desc').orderBy(field, 'desc').orderBy(FieldPath.documentId(), 'desc');
    const at = position[source];
    if (at) query = query.startAfter(at.date, Timestamp.fromDate(new Date(at.time)), at.id);
    const result = await query.limit(50).get();
    return result.docs.map(document => ({ document, source, date: String(source === 'events' ? document.data().localDate : document.data().m.localDate), time: document.data()[field].toDate().toISOString() as string }));
  };
  const [events, logs] = await Promise.all([load('events'), load('logs')]);
  const combined = [...events, ...logs].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.document.id.localeCompare(a.document.id)).slice(0, 50);
  const next = { ...position };
  const rows = combined.map(({ document, source, date, time }) => {
    next[source] = { date, time, id: document.id };
    const data = document.data();
    return { id: `${source}:${document.id}`, type: String(data.type || data.rl || data.e || 'Clocking update'), occurredAt: time,
      localDate: data.localDate || data.m?.localDate, localTime: data.localTime, actor: data.reviewedBy?.name || data.createdBy?.name || data.un,
      original: data.before ? JSON.stringify(data.before) : undefined,
      effective: data.proposedClockInTime || data.proposedClockOutTime ? [data.proposedClockInTime, data.proposedClockOutTime].filter(Boolean).join(' – ') : undefined,
      ...(full || own ? { reason: data.reason || data.reviewNote } : {}) };
  });
  return { events: rows, nextCursor: combined.length === 50 ? Buffer.from(JSON.stringify(next)).toString('base64url') : undefined };
}

export async function mutateIndividualClocking(db: Firestore, actor: AuthenticatedAppUser, staffId: string, input: unknown) {
  requireIndividualClockingAccess(actor, staffId);
  const payload = z.object({ action: z.enum(['request', 'exempt', 'review', 'explain', 'review_explanation', 'cancel_exemption']), kind: z.enum(['exemption', 'correction']).optional(), requestId: id.optional(), approved: z.boolean().optional(), localDate: date.optional(), reason: z.string().trim().min(8).max(1000).optional(), proposedClockInTime: z.string().optional(), proposedClockOutTime: z.string().optional() }).strict().parse(input);
  const own = actor.user.staffId === staffId;
  if (payload.action === 'exempt') return createManagedStaffClockingExemption(db, actor, { staffId, localDate: payload.localDate, reason: payload.reason });
  if (payload.action === 'request') {
    if (!payload.kind || !payload.localDate || !payload.reason) throw new Error('CLOCKING_REQUEST_DETAILS_REQUIRED');
    const details = { localDate: payload.localDate, reason: payload.reason, proposedClockInTime: payload.proposedClockInTime, proposedClockOutTime: payload.proposedClockOutTime };
    if (own) return createStaffClockingSelfServiceRequest(db, actor, payload.kind, details);
    requireStaffClockingAccess(actor, 'record', 'manual_clock');
    const target = await db.collection('system_users').where('staffId', '==', staffId).where('role', '==', 'Staff').limit(1).get();
    if (target.empty || target.docs[0].data().isActive === false) throw new Error('CLOCKING_ACTIVE_STAFF_ACCOUNT_REQUIRED');
    // Only this server-authorized branch delegates the existing validated request
    // workflow. The request stays pending and requires another person's review.
    return createStaffClockingSelfServiceRequest(db, { ...actor, user: { ...target.docs[0].data(), id: target.docs[0].id } as AuthenticatedAppUser['user'] }, payload.kind, details, actorLabel(actor));
  }
  if (payload.action === 'review') {
    if (!payload.kind || !payload.requestId || payload.approved === undefined) throw new Error('CLOCKING_REVIEW_DETAILS_REQUIRED');
    const request = await db.collection(payload.kind === 'correction' ? collections.corrections : collections.exemptions).doc(payload.requestId).get();
    if (request.data()?.staffId !== staffId) throw new Error('PERMISSION_DENIED');
    return reviewStaffClockingSelfServiceRequest(db, actor, payload.kind, payload.requestId, payload.approved, payload.reason);
  }
  const who = actorLabel(actor);
  if (payload.action === 'explain') {
    if (!own) throw new Error('PERMISSION_DENIED');
    requireStaffClockingAccess(actor, 'clock', 'explain_lateness');
    if (!payload.localDate || !payload.reason) throw new Error('CLOCKING_REQUEST_DETAILS_REQUIRED');
    return db.runTransaction(async transaction => {
      const record = await transaction.get(db.collection(collections.dailyRecords).doc(dailyRecordId(staffId, payload.localDate!)));
      if (record.data()?.arrivalStatus !== 'late') throw new Error('CLOCKING_LATE_RECORD_REQUIRED');
      const existing = await transaction.get(db.collection(collections.explanations).where('staffId', '==', staffId).where('localDate', '==', payload.localDate));
      if (existing.docs.some(item => ['pending', 'approved'].includes(item.data().status))) throw new Error('CLOCKING_EXPLANATION_ALREADY_SUBMITTED');
      const ref = db.collection(collections.explanations).doc();
      transaction.create(ref, { kind: 'explanation', staffId, accountId: actor.user.id, localDate: payload.localDate, reason: payload.reason, status: 'pending', createdBy: who, createdAt: Timestamp.now() });
      transaction.create(db.collection(collections.events).doc(), { type: 'lateness_explanation_requested', staffId, localDate: payload.localDate, occurredAt: Timestamp.now(), createdBy: who, reason: payload.reason });
      bumpClockingRevisions(db, transaction, 'staffClockingRequests');
      bumpPersonalClockingRevision(db, transaction, staffId, undefined, false, true);
      return { id: ref.id, status: 'pending' };
    });
  }
  if (!payload.requestId) throw new Error('CLOCKING_REQUEST_DETAILS_REQUIRED');
  if (payload.action === 'cancel_exemption') {
    requireStaffClockingAccess(actor, 'record', 'manage_calendar');
    if (!payload.reason) throw new Error('CLOCKING_REASON_REQUIRED');
    return db.runTransaction(async transaction => {
      const ref = db.collection(collections.exemptions).doc(payload.requestId!);
      const request = await transaction.get(ref), data = request.data();
      if (!data || data.staffId !== staffId) throw new Error('PERMISSION_DENIED');
      if (data.status === 'cancelled') return { status: 'cancelled' };
      const dailyRef = db.collection(collections.dailyRecords).doc(dailyRecordId(staffId, data.localDate));
      const daily = await transaction.get(dailyRef);
      transaction.update(ref, { status: 'cancelled', cancelledBy: who, cancelledAt: Timestamp.now(), cancellationReason: payload.reason });
      if (daily.exists && daily.data()?.exemptionId === ref.id) transaction.update(dailyRef, { exemptionId: FieldValue.delete(), exemptionStatus: FieldValue.delete(), reviewStatus: daily.data()?.correctionId ? 'corrected' : FieldValue.delete(), updatedAt: Timestamp.now() });
      transaction.create(db.collection(collections.events).doc(), { type: 'exemption_cancelled', staffId, localDate: data.localDate, occurredAt: Timestamp.now(), reviewedBy: who, reason: payload.reason });
      bumpClockingRevisions(db, transaction, 'staffClockingRecords', 'staffClockingRequests');
      bumpPersonalClockingRevision(db, transaction, staffId, data.localDate, false, true);
      return { status: 'cancelled' };
    });
  }
  requireStaffClockingAccess(actor, 'records', 'review_explanations');
  if (payload.approved === undefined) throw new Error('CLOCKING_REVIEW_DETAILS_REQUIRED');
  return db.runTransaction(async transaction => {
    const ref = db.collection(collections.explanations).doc(payload.requestId!);
    const request = await transaction.get(ref), data = request.data();
    if (!data || data.staffId !== staffId) throw new Error('PERMISSION_DENIED');
    if (data.accountId === actor.user.id || data.createdBy?.id === actor.user.id || own) throw new Error('CLOCKING_SELF_REVIEW_NOT_ALLOWED');
    if (data.status !== 'pending') throw new Error('CLOCKING_REQUEST_ALREADY_REVIEWED');
    const dailyRef = db.collection(collections.dailyRecords).doc(dailyRecordId(staffId, data.localDate));
    const daily = await transaction.get(dailyRef);
    if (!daily.exists) throw new Error('CLOCKING_DAILY_RECORD_NOT_FOUND');
    transaction.update(ref, { status: payload.approved ? 'approved' : 'rejected', reviewedBy: who, reviewedAt: Timestamp.now(), reviewNote: payload.reason || null });
    if (payload.approved) transaction.update(dailyRef, { latenessExcused: true, explanationId: ref.id, updatedAt: Timestamp.now() });
    transaction.create(db.collection(collections.events).doc(), { type: payload.approved ? 'lateness_explained' : 'lateness_explanation_rejected', staffId, localDate: data.localDate, occurredAt: Timestamp.now(), reviewedBy: who, reason: payload.reason || null });
    bumpClockingRevisions(db, transaction, 'staffClockingRequests', ...(payload.approved ? ['staffClockingRecords' as const] : []));
    bumpPersonalClockingRevision(db, transaction, staffId, payload.approved ? data.localDate : undefined, false, true);
    return { status: payload.approved ? 'approved' : 'rejected' };
  });
}
