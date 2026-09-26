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

    const { collection, linkField } = targetDetails(parsed.data.target);
    const db = getFirestore(getFirebaseAdminApp());
    const targetSnapshot = await db.collection(collection).doc(parsed.data.targetId).get();
    if (!targetSnapshot.exists) return json({ error: 'The linked pupil or staff member was not found.' }, 404);

    const directlyLinkedAccounts = await db
      .collection('system_users')
      .where(linkField, '==', parsed.data.targetId)
      .get();
    let accountDocuments = directlyLinkedAccounts.docs;

    if (parsed.data.target === 'pupil') {
      const familyId = String(targetSnapshot.data()?.familyId || '');
      if (familyId) {
        const familyPupils = await db.collection('pupils').where('familyId', '==', familyId).get();
        const familyPupilIds = familyPupils.docs.length > 0
          ? familyPupils.docs.map(document => document.id)
          : [parsed.data.targetId];
        const pupilIdChunks = Array.from(
          { length: Math.ceil(familyPupilIds.length / 30) },
          (_, index) => familyPupilIds.slice(index * 30, index * 30 + 30),
        );
        const [familyAccounts, ...legacyAccountGroups] = await Promise.all([
          db.collection('system_users').where('familyId', '==', familyId).get(),
          ...pupilIdChunks.map(ids => db.collection('system_users').where('pupilId', 'in', ids).get()),
        ]);
        const familyAccountDocuments = new Map(
          [familyAccounts, ...legacyAccountGroups]
            .flatMap(snapshot => snapshot.docs)
            .filter(document => document.data().role === 'Parent')
            .map(document => [document.id, document]),
        );
        accountDocuments = Array.from(familyAccountDocuments.values());
      }
    }

    if (accountDocuments.length > 1) return json({ error: 'More than one account is linked to this family.' }, 409);

    const account = accountDocuments[0];
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
      const [targetSnapshot, duplicateUsername] = await Promise.all([
        transaction.get(targetRef),
        transaction.get(db.collection('system_users').where('username', '==', username).limit(1)),
      ]);
      if (!targetSnapshot.exists) throw new Error('TARGET_NOT_FOUND');
      if (!duplicateUsername.empty) throw new Error('USERNAME_EXISTS');

      const targetData = targetSnapshot.data() || {};
      const parentFamilyId = target === 'pupil' && typeof targetData.familyId === 'string'
        ? targetData.familyId.trim()
        : '';
      let familyPupilDocuments = target === 'pupil' ? [targetSnapshot] : [];

      if (target === 'pupil') {
        const familyPupils = parentFamilyId
          ? await transaction.get(db.collection('pupils').where('familyId', '==', parentFamilyId))
          : null;
        familyPupilDocuments = familyPupils?.docs.length ? familyPupils.docs : [targetSnapshot];
        const familyPupilIds = familyPupilDocuments.map(document => document.id);
        const pupilIdChunks = Array.from(
          { length: Math.ceil(familyPupilIds.length / 30) },
          (_, index) => familyPupilIds.slice(index * 30, index * 30 + 30),
        );
        const accountGroups = await Promise.all([
          ...(parentFamilyId
            ? [transaction.get(db.collection('system_users').where('familyId', '==', parentFamilyId))]
            : []),
          ...pupilIdChunks.map(ids => transaction.get(
            db.collection('system_users').where('pupilId', 'in', ids),
          )),
        ]);
        if (accountGroups
          .some(snapshot => snapshot.docs.some(document => document.data().role === 'Parent'))) {
          throw new Error('FAMILY_LINK_EXISTS');
        }
      } else {
        const duplicateLink = await transaction.get(
          db.collection('system_users').where(linkField, '==', targetId).limit(1),
        );
        if (!duplicateLink.empty) throw new Error('LINK_EXISTS');
      }
      const user = target === 'pupil'
        ? {
            username,
            role: 'Parent' as const,
            isActive: true,
            pupilId: targetId,
            ...(parentFamilyId ? { familyId: parentFamilyId } : {}),
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
      // Publish the pupil marker change through the normal revision path so
      // the canonical pupil cache sees it without an account listener.
      let pupilRevision: number | null = null;
      if (target === 'pupil') {
        const [operational, settings] = await Promise.all([
          transaction.get(db.collection('settings').doc('data-revisions-operational')),
          transaction.get(db.collection('settings').doc('school-settings')),
        ]);
        pupilRevision = Math.max(
          Number(operational.data()?.pupils || 0),
          Number(settings.data()?.dataRevisions?.pupils || 0),
        ) + 1;
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
      if (target === 'pupil') {
        familyPupilDocuments.forEach(document => transaction.update(document.ref, {
          parentAccountId: userRef.id,
          parentAccountActive: true,
          updatedAt: now,
        }));
      }
      if (pupilRevision !== null && target === 'pupil') {
        transaction.set(db.collection('settings').doc('data-revisions-operational'), {
          pupils: pupilRevision,
        }, { merge: true });
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
    if (message === 'FAMILY_LINK_EXISTS') {
      return json({ error: 'A parent account already exists for this pupil or family.' }, 409);
    }
    if (message === 'LINK_EXISTS') return json({ error: 'An account is already linked to this record.' }, 409);
    const status = message.includes('AUTH') || message.includes('INACTIVE') ? 401 : 500;
    return json({ error: status === 401 ? 'Authentication is required.' : 'Could not activate the account.' }, status);
  }
}
