import 'server-only';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import type { AuthenticatedAppUser } from './app-auth';
import { scopedPupils, requireScopedClass } from './circumference';
import { GranularPermissionService as Permissions } from '@/lib/services/granular-permissions.service';
import { resolveEventAudience, type EventPlanning } from '@/lib/events/event-planning';
import type { Class, Pupil, Staff, SystemUser } from '@/types';
import { z } from 'zod';
const ids = z.array(z.string().min(1).max(160).refine(value => !value.includes('/'))).max(500);
export const eventPlanningSchema = z.object({ version: z.literal(1), requestId: z.string().min(12).max(100), kind: z.enum(['staff', 'parent', 'academic']), academicType: z.enum(['exam', 'other']), subjectsByClass: z.record(ids), audience: z.object({ scope: z.enum(['school', 'filtered']), classIds: ids, levels: ids, sections: ids, genders: ids, streamIds: ids, staffIds: ids, guardians: z.enum(['first', 'second', 'both']), excludedKeys: z.array(z.string().max(500)).max(5000) }), push: z.boolean(), sms: z.enum(['none', 'without_account', 'all']), message: z.string().max(16000), smsOptions: z.object({ nameFormat: z.enum(['all', 'surname', 'first', 'both']).optional(), nameCase: z.enum(['unchanged', 'upper', 'lower', 'sentence', 'title']).optional(), messageCase: z.enum(['unchanged', 'upper', 'lower', 'sentence', 'title']).optional() }), times: z.array(z.object({ date: z.string(), time: z.string() })).max(50) });
export function requireEventAccess(actor: AuthenticatedAppUser, action = 'create_event') {
    if (!actor.user.isActive || actor.user.role === 'Parent' || !Permissions.canAccessPage(actor.user, 'events', 'calendar') || !Permissions.canPerformAction(actor.user, 'events', 'calendar', action))
        throw new Error('FORBIDDEN: You do not have permission for this event action.');
}
export async function loadEventAudience(actor: AuthenticatedAppUser, plan: EventPlanning) {
    requireEventAccess(actor, 'invite_participants');
    const db = getFirestore(getFirebaseAdminApp());
    const [classSnapshot, accountSnapshot] = await Promise.all([db.collection('classes').get(), db.collection('system_users').select('role', 'staffId', 'familyId', 'pupilId', 'guardianId', 'isActive').get()]);
    const classes = classSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Class[];
    for (const classId of plan.audience.classIds)
        requireScopedClass(actor, classId);
    let pupils: Pupil[] = [], staff: Staff[] = [];
    if (plan.kind === 'staff') {
        if (plan.audience.staffIds.length) {
            const docs = await db.getAll(...plan.audience.staffIds.map(id => db.collection('staff').doc(id)));
            staff = docs.filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id })) as Staff[];
        }
    }
    else
        pupils = await scopedPupils(actor) as Pupil[];
    const users = accountSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as SystemUser[];
    return { classes, pupils, staff, users, recipients: resolveEventAudience(plan, pupils, staff, users, classes) };
}
