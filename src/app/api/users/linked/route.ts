import { NextRequest, NextResponse } from 'next/server';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  canManageUsers,
  hashPasswordForServer,
  requireAppUser,
  sanitizeSystemUser,
} from '@/lib/server/app-auth';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const targetSchema = z.object({
  target: z.enum(['pupil', 'staff']),
  targetId: z.string().trim().min(1).max(160),
});

const createSchema = targetSchema.extend({
  username: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(512),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function targetDetails(target: 'pupil' | 'staff') {
  return target === 'pupil'
    ? { collection: 'pupils', linkField: 'pupilId' }
    : { collection: 'staff', linkField: 'staffId' };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canManageUsers(actor, 'read')) return json({ error: 'Permission denied.' }, 403);

    const parsed = targetSchema.safeParse({
      target: request.nextUrl.searchParams.get('target'),
      targetId: request.nextUrl.searchParams.get('targetId'),
    });
    if (!parsed.success) return json({ error: 'Invalid account target.' }, 400);

    const { linkField } = targetDetails(parsed.data.target);
    const db = getFirestore(getFirebaseAdminApp());
    const existing = await db
      .collection('system_users')
      .where(linkField, '==', parsed.data.targetId)
      .limit(2)
      .get();
    if (existing.size > 1) return json({ error: 'More than one account is linked to this record.' }, 409);

    const account = existing.docs[0];
    return json({ user: account ? sanitizeSystemUser(account.id, account.data()) : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('AUTH') || message.includes('INACTIVE') ? 401 : 500;
    return json({ error: status === 401 ? 'Authentication is required.' : 'Could not load the linked account.' }, status);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canManageUsers(actor, 'create')) return json({ error: 'Permission denied.' }, 403);

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Invalid account details.' }, 400);

    const { target, targetId, username, password } = parsed.data;
    const { collection, linkField } = targetDetails(target);
    const db = getFirestore(getFirebaseAdminApp());
    const targetRef = db.collection(collection).doc(targetId);
    const userRef = db.collection('system_users').doc();
    const now = Timestamp.now();
    const user = await db.runTransaction(async transaction => {
      const [targetSnapshot, duplicateUsername, duplicateLink] = await Promise.all([
        transaction.get(targetRef),
        transaction.get(db.collection('system_users').where('username', '==', username).limit(1)),
        transaction.get(db.collection('system_users').where(linkField, '==', targetId).limit(1)),
      ]);
      if (!targetSnapshot.exists) throw new Error('TARGET_NOT_FOUND');
      if (!duplicateUsername.empty) throw new Error('USERNAME_EXISTS');
      if (!duplicateLink.empty) throw new Error('LINK_EXISTS');

      const targetData = targetSnapshot.data() || {};
      const parentFamilyId = target === 'pupil'
        ? String(targetData.familyId || `family-${targetId}`)
        : null;
      const user = target === 'pupil'
        ? {
            username,
            role: 'Parent' as const,
            isActive: true,
            pupilId: targetId,
            familyId: parentFamilyId,
            guardianId: targetData.guardians?.[0]?.id,
            firstName: 'Parent',
            lastName: `of ${String(targetData.firstName || '').trim()} ${String(targetData.lastName || '').trim()}`.trim(),
          }
        : {
            username,
            role: 'Staff' as const,
            isActive: true,
            staffId: targetId,
            firstName: String(targetData.firstName || '').trim(),
            lastName: String(targetData.lastName || '').trim(),
            ...(targetData.email ? { email: String(targetData.email) } : {}),
            modulePermissions: [],
            granularPermissions: [],
          };

      // Every read must happen before the transaction writes. A pupil that
      // receives its first family ID also publishes the normal cache revision
      // so currently open staff dashboards refresh that relationship.
      let pupilRevision: number | null = null;
      if (target === 'pupil' && !targetData.familyId) {
        const settings = await transaction.get(db.collection('settings').doc('school-settings'));
        pupilRevision = Number(settings.data()?.dataRevisions?.pupils || 0) + 1;
      }

      transaction.create(userRef, {
        ...user,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.user.id,
      });
      transaction.create(db.collection('authCredentials').doc(userRef.id), {
        passwordHash: hashPasswordForServer(password),
        algorithm: 'scrypt-v1',
        updatedAt: now,
      });
      if (pupilRevision !== null && target === 'pupil' && parentFamilyId) {
        transaction.update(targetRef, { familyId: parentFamilyId, updatedAt: now });
        transaction.set(db.collection('settings').doc('school-settings'), {
          dataRevisions: { pupils: pupilRevision },
        }, { merge: true });
        transaction.set(db.collection('pupilCacheChanges').doc(String(pupilRevision).padStart(16, '0')), {
          revision: pupilRevision,
          pupilId: targetId,
          operation: 'upsert',
          changedAt: now,
        });
      }
      transaction.set(db.collection('historyLogs').doc(), {
        action: 'create',
        entity: 'user',
        recordId: userRef.id,
        label: username,
        module: 'security',
        sensitive: true,
        linkedTarget: { type: target, id: targetId },
        actor: { id: actor.user.id, name: actor.user.username, role: actor.user.role },
        createdAt: now,
      });
      return user;
    });

    return json({
      user: sanitizeSystemUser(userRef.id, { ...user, createdAt: now, updatedAt: now }),
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'TARGET_NOT_FOUND') {
      return json({ error: 'The linked pupil or staff member was not found.' }, 404);
    }
    if (message === 'USERNAME_EXISTS') return json({ error: 'That username already exists.' }, 409);
    if (message === 'LINK_EXISTS') return json({ error: 'An account is already linked to this record.' }, 409);
    const status = message.includes('AUTH') || message.includes('INACTIVE') ? 401 : 500;
    return json({ error: status === 401 ? 'Authentication is required.' : 'Could not activate the account.' }, status);
  }
}
