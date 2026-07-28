import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  canManageUsers,
  hashPasswordForServer,
  requireAppUser,
} from '@/lib/server/app-auth';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  password: z.string().min(1).max(512).optional(),
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

async function context(request: NextRequest, action: 'update' | 'delete') {
  const actor = await requireAppUser(request);
  if (!canManageUsers(actor, action)) throw new Error('PERMISSION_DENIED');
  return actor;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await context(request, 'update');
    const { id } = await params;
    if (!id || id.length > 160) return json({ error: 'Invalid user ID.' }, 400);

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Invalid user details.' }, 400);
    const { password, passwordHash: _ignoredHash, id: _ignoredId, createdAt: _ignoredCreatedAt, ...profileUpdates } =
      parsed.data as Record<string, any>;
    const cleanUpdates = Object.fromEntries(
      Object.entries(profileUpdates).filter(([, value]) => value !== undefined),
    );

    const db = getFirestore(getFirebaseAdminApp());
    const userRef = db.collection('system_users').doc(id);
    const existing = await userRef.get();
    if (!existing.exists) return json({ error: 'User not found.' }, 404);

    const now = Timestamp.now();
    const batch = db.batch();
    batch.update(userRef, { ...cleanUpdates, updatedAt: now });
    if (password) {
      batch.set(db.collection('authCredentials').doc(id), {
        passwordHash: hashPasswordForServer(password),
        algorithm: 'scrypt-v1',
        updatedAt: now,
      }, { merge: true });
      batch.update(userRef, { passwordHash: FieldValue.delete() });
    }
    batch.set(db.collection('historyLogs').doc(), {
      action: 'update',
      entity: 'user',
      recordId: id,
      label: cleanUpdates.username || existing.data()?.username || id,
      changedFields: Object.keys(cleanUpdates),
      passwordChanged: Boolean(password),
      module: 'security',
      sensitive: Boolean(password) || ['role', 'isActive', 'modulePermissions', 'granularPermissions']
        .some(field => field in cleanUpdates),
      actor: { id: actor.user.id, name: actor.user.username, role: actor.user.role },
      createdAt: now,
    });
    await batch.commit();

    // Every user edit invalidates that user's existing refresh session. This is
    // the control point for password, permission, role, profile, and active
    // status changes. It uses Firebase Authentication only; no client needs to
    // poll system_users to discover the change.
    const merged = { ...existing.data(), ...cleanUpdates };
    const adminAuth = getAuth(getFirebaseAdminApp());
    try {
      const firebaseUser = await adminAuth.getUser(id);
      const shouldDisable = merged.isActive === false;
      if (firebaseUser.disabled !== shouldDisable) {
        await adminAuth.updateUser(id, { disabled: shouldDisable });
      }
      await adminAuth.setCustomUserClaims(id, {
        appUser: true,
        role: merged.role || 'Staff',
        isActive: !shouldDisable,
        ...(merged.familyId ? { familyId: merged.familyId } : {}),
        ...(merged.staffId ? { staffId: merged.staffId } : {}),
        ...(merged.pupilId ? { pupilId: merged.pupilId } : {}),
      });
      await adminAuth.revokeRefreshTokens(id);
    } catch (error: any) {
      // Users receive a Firebase Auth record on their first secure sign-in. An
      // account that has never signed in has no live session to revoke.
      if (error?.code !== 'auth/user-not-found') throw error;
    }

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'PERMISSION_DENIED') return json({ error: 'Permission denied.' }, 403);
    if (message.includes('AUTH') || message.includes('INACTIVE')) {
      return json({ error: 'Authentication is required.' }, 401);
    }
    return json({ error: 'Could not update user.' }, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await context(request, 'delete');
    const { id } = await params;
    if (!id || id.length > 160) return json({ error: 'Invalid user ID.' }, 400);
    if (id === actor.user.id) return json({ error: 'You cannot delete your own active account.' }, 409);

    const db = getFirestore(getFirebaseAdminApp());
    const userRef = db.collection('system_users').doc(id);
    const existing = await userRef.get();
    if (!existing.exists) return json({ error: 'User not found.' }, 404);

    const batch = db.batch();
    batch.delete(userRef);
    batch.delete(db.collection('authCredentials').doc(id));
    batch.set(db.collection('historyLogs').doc(), {
      action: 'delete',
      entity: 'user',
      recordId: id,
      label: existing.data()?.username || id,
      module: 'security',
      sensitive: true,
      actor: { id: actor.user.id, name: actor.user.username, role: actor.user.role },
      createdAt: Timestamp.now(),
    });
    await batch.commit();
    try {
      await getAuth(getFirebaseAdminApp()).deleteUser(id);
    } catch (error: any) {
      if (error?.code !== 'auth/user-not-found') throw error;
    }

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'PERMISSION_DENIED') return json({ error: 'Permission denied.' }, 403);
    if (message.includes('AUTH') || message.includes('INACTIVE')) {
      return json({ error: 'Authentication is required.' }, 401);
    }
    return json({ error: 'Could not delete user.' }, 500);
  }
}
