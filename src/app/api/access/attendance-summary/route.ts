import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { CircumferenceError, readWithinCircumference, requireScopedClass, scopedPupils } from '@/lib/server/circumference';
import { circumferenceOf, permitsPupil } from '@/lib/access/circumference';
import { mergeScopedAttendance } from '@/lib/access/attendance-projection';
import { GranularPermissionService as Permissions } from '@/lib/services/granular-permissions.service';

export const dynamic = 'force-dynamic';
const id = z.string().min(1).max(160).regex(/^[^/]+$/);
const schema = z.object({date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), classId: id, replaceClass: z.boolean(),
  records: z.array(z.object({pupilId: id, classId: id, recordId: id,
    status: z.enum(['Present','Absent','Late','Excused','Delayed']), remarks: z.string().max(5000).optional(),
    className: z.string().max(200).optional(), classCode: z.string().max(100).optional(), recordedAt: z.string().max(100).optional(),
  }).strict()).max(2000),
}).strict();
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new CircumferenceError('Invalid attendance summary.', 400);
    const {date, classId, records, replaceClass} = parsed.data;
    requireScopedClass(actor, classId);
    const canPublish = (user: typeof actor.user) => user.role === 'Admin'
      || user.modulePermissions?.some(item => item.module === 'attendance' && ['full_access', 'edit'].includes(item.permission))
      || user.granularPermissions?.some(module => module.moduleId === 'attendance' && module.pages.some(page => page.canAccess && ['record_attendance','edit_attendance'].some(action => Permissions.canPerformAction(user, 'attendance', page.pageId, action))));
    if (!canPublish(actor.user)) throw new CircumferenceError('Permission to record attendance is required.');
    const pupilIds = (await scopedPupils(actor)).filter(pupil => pupil.classId === classId).map(pupil => pupil.id);
    if (records.some(record => record.classId !== classId || !pupilIds.includes(record.pupilId))) throw new CircumferenceError();
    const db = getFirestore(getFirebaseAdminApp());
    const result = await db.runTransaction(async transaction => {
      const [profile, summary, settings, ...pupils] = await Promise.all([
        transaction.get(db.doc(`system_users/${actor.user.id}`)), transaction.get(db.doc(`attendanceDailySummaries/${date}`)),
        transaction.get(db.doc('settings/data-revisions-operational')), ...pupilIds.map(pupilId => transaction.get(db.doc(`pupils/${pupilId}`))),
      ]);
      const user = profile.exists ? {...profile.data(), id: profile.id} as typeof actor.user : actor.user;
      if (!user.isActive || !canPublish(user)) throw new CircumferenceError();
      requireScopedClass({...actor, user}, classId);
      const allowed = new Set(pupils.filter(pupil => pupil.exists && pupil.data()!.classId === classId && permitsPupil(circumferenceOf(user), pupil.data() as any)).map(pupil => pupil.id));
      if (records.some(record => !allowed.has(record.pupilId))) throw new CircumferenceError();
      const next = mergeScopedAttendance(summary.data()?.records || [], records, allowed, classId, replaceClass);
      if (JSON.stringify(next).length * 2 > 700 * 1024) throw new CircumferenceError('Daily attendance summary is too large.', 400);
      const revision = Number(settings.data()?.attendance || 0) + 1;
      transaction.set(summary.ref, {schema: 1, date, records: next, revision, updatedAt: FieldValue.serverTimestamp()});
      transaction.set(settings.ref, {attendance: revision}, {merge: true});
      transaction.set(db.doc('settings/school-settings'), {dataRevisions: {attendance: revision}}, {merge: true});
      return {revision, records: next.filter(record => allowed.has(record.pupilId))};
    });
    const [visible] = await readWithinCircumference(await requireAppUser(request), {collection: 'attendanceDailySummaries', id: date});
    return NextResponse.json({...result, records: visible?.records || []}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : 'Could not publish attendance.'}, {status: error instanceof CircumferenceError ? error.status : /AUTH|INACTIVE/.test(String(error)) ? 401 : 500});
  }
}
