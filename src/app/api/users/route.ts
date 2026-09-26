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

const createSchema = z.object({
  username: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(512).optional(),
  email: z.string().email().max(320).optional().or(z.literal('')),
  role: z.enum(['Admin', 'Staff', 'Parent']),
  isActive: z.boolean(),
}).passthrough();

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

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canManageUsers(actor, 'create')) return json({ error: 'Permission denied.' }, 403);

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Invalid user details.' }, 400);
    const { password, ...profileInput } = parsed.data;

    const db = getFirestore(getFirebaseAdminApp());
    const userRef = db.collection('system_users').doc();
    const credentialRef = db.collection('authCredentials').doc(userRef.id);
    const historyRef = db.collection('historyLogs').doc();
    const now = Timestamp.now();
    let cleanProfile: Record<string, unknown> = {};

    await db.runTransaction(async transaction => {
      const duplicateUsername = await transaction.get(
        db.collection('system_users').where('username', '==', profileInput.username).limit(1),
      );
      if (!duplicateUsername.empty) throw new Error('USERNAME_EXISTS');

      cleanProfile = Object.fromEntries(
        Object.entries(profileInput).filter(([, value]) => value !== undefined && value !== ''),
      );

      if (profileInput.role === 'Parent') {
        const pupilId = typeof profileInput.pupilId === 'string' ? profileInput.pupilId.trim() : '';
        if (!pupilId) throw new Error('PUPIL_REQUIRED');

        const pupilRef = db.collection('pupils').doc(pupilId);
        const pupilSnapshot = await transaction.get(pupilRef);
        if (!pupilSnapshot.exists) throw new Error('PUPIL_NOT_FOUND');

        const pupilData = pupilSnapshot.data() || {};
        const familyId = typeof pupilData.familyId === 'string' ? pupilData.familyId.trim() : '';
        const familyPupils = familyId
          ? await transaction.get(db.collection('pupils').where('familyId', '==', familyId))
          : null;
        const familyPupilDocuments = familyPupils?.docs.length
          ? familyPupils.docs
          : [pupilSnapshot];
        const familyPupilIds = familyPupilDocuments.map(document => document.id);
        const pupilIdChunks = Array.from(
          { length: Math.ceil(familyPupilIds.length / 30) },
          (_, index) => familyPupilIds.slice(index * 30, index * 30 + 30),
        );
        const accountGroups = await Promise.all([
          ...(familyId
            ? [transaction.get(db.collection('system_users').where('familyId', '==', familyId))]
            : []),
          ...pupilIdChunks.map(ids => transaction.get(
            db.collection('system_users').where('pupilId', 'in', ids),
          )),
        ]);
        const familyAccountExists = accountGroups
          .some(snapshot => snapshot.docs.some(document => document.data().role === 'Parent'));
        if (familyAccountExists) throw new Error('PARENT_FAMILY_EXISTS');

        // The pupil record is authoritative for family membership. Standalone
        // pupils remain standalone and are linked directly through pupilId.
        delete cleanProfile.familyId;
        cleanProfile = {
          ...cleanProfile,
          pupilId,
          ...(familyId ? { familyId } : {}),
        };
        familyPupilDocuments.forEach(document => transaction.update(document.ref, {
          parentAccountId: userRef.id,
          parentAccountActive: true,
          updatedAt: now,
        }));
      }

      transaction.create(userRef, {
        ...cleanProfile,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.user.id,
      });
      if (password) {
        transaction.set(credentialRef, {
          passwordHash: hashPasswordForServer(password),
          algorithm: 'scrypt-v1',
          updatedAt: now,
        });
      }
      transaction.set(historyRef, {
        action: 'create',
        entity: 'user',
        recordId: userRef.id,
        label: profileInput.username,
        module: 'security',
        sensitive: true,
        actor: {
          id: actor.user.id,
          name: actor.user.username,
          role: actor.user.role,
        },
        createdAt: now,
      });
    });

    return json({
      id: userRef.id,
      user: sanitizeSystemUser(userRef.id, { ...cleanProfile, createdAt: now, updatedAt: now }),
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'USERNAME_EXISTS') return json({ error: 'That username already exists.' }, 409);
    if (message === 'PUPIL_REQUIRED') return json({ error: 'A pupil is required for a parent account.' }, 400);
    if (message === 'PUPIL_NOT_FOUND') return json({ error: 'The selected pupil was not found.' }, 404);
    if (message === 'PARENT_FAMILY_EXISTS') {
      return json({ error: 'A parent account already exists for this pupil or family.' }, 409);
    }
    const status = message.includes('AUTH') || message.includes('INACTIVE') ? 401 : 500;
    return json({ error: status === 401 ? 'Authentication is required.' : 'Could not create user.' }, status);
  }
}

