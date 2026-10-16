import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAppUser } from '@/lib/server/app-auth';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { circumferenceOf, permitsPupil } from '@/lib/access/circumference';
import { CircumferenceError } from '@/lib/server/circumference';
import { GranularPermissionService as Permissions } from '@/lib/services/granular-permissions.service';

export const dynamic = 'force-dynamic';
const schema = z.object({ id: z.string().min(1).max(160).regex(/^[^/]+$/), action: z.enum(['assign', 'unassign']), pupilIds: z.array(z.string().min(1).max(160).regex(/^[^/]+$/)).min(1).max(100) }).strict();
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({error: 'Invalid dormitory assignment.'}, {status: 400});
    const { id, action, pupilIds } = parsed.data;
    const legacy = actor.user.modulePermissions?.some(item => ['boarding', 'pupils'].includes(item.module) && ['full_access', 'edit'].includes(item.permission));
    const granular = Permissions.canPerformAction(actor.user, 'boarding', 'dormitories', 'assign_beds') || Permissions.canPerformAction(actor.user, 'boarding', 'overview', 'assign_boarding');
    if (actor.user.role !== 'Admin' && !legacy && !granular) throw new CircumferenceError('Permission to assign boarding pupils is required.');
    const db = getFirestore(getFirebaseAdminApp());
    await db.runTransaction(async transaction => {
      const [profile, dorm, ...pupils] = await Promise.all([
        transaction.get(db.collection('system_users').doc(actor.user.id)),
        transaction.get(db.collection('dormitories').doc(id)),
        ...pupilIds.map(pupilId => transaction.get(db.collection('pupils').doc(pupilId))),
      ]);
      const scope = circumferenceOf(profile.exists ? profile.data() as any : actor.user);
      if (profile.exists && profile.data()?.isActive === false || !dorm.exists) throw new CircumferenceError();
      const gender = dorm.data()!.gender;
      if (scope.sections !== null && !scope.sections.includes('Boarding') || scope.genders !== null && !scope.genders.includes(gender)) throw new CircumferenceError();
      if (pupils.some(pupil => !pupil.exists || !permitsPupil(scope, pupil.data() as any) || pupil.data()!.section !== 'Boarding' || pupil.data()!.gender !== gender)) throw new CircumferenceError('Choose boarding pupils within your Circumference and dormitory gender.');
      const assigned = new Set<string>(dorm.data()!.assignedPupilIds || []);
      pupilIds.forEach(pupilId => action === 'assign' ? assigned.add(pupilId) : assigned.delete(pupilId));
      // Preserve assignments belonging to pupils the caller cannot view.
      transaction.update(dorm.ref, {assignedPupilIds: [...assigned], updatedAt: new Date().toISOString()});
    });
    return NextResponse.json({success: true});
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : 'Could not update dormitory assignment.'}, {status: error instanceof CircumferenceError ? error.status : /AUTH|INACTIVE/.test(String(error)) ? 401 : 500});
  }
}
