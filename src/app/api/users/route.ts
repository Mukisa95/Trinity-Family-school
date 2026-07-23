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
    const duplicate = await db
      .collection('system_users')
      .where('username', '==', profileInput.username)
      .limit(1)
      .get();
    if (!duplicate.empty) return json({ error: 'That username already exists.' }, 409);

    const userRef = db.collection('system_users').doc();
    const credentialRef = db.collection('authCredentials').doc(userRef.id);
    const historyRef = db.collection('historyLogs').doc();
    const now = Timestamp.now();
    const cleanProfile = Object.fromEntries(
      Object.entries(profileInput).filter(([, value]) => value !== undefined && value !== ''),
    );

    const batch = db.batch();
    batch.create(userRef, {
      ...cleanProfile,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.user.id,
    });
    if (password) {
      batch.set(credentialRef, {
        passwordHash: hashPasswordForServer(password),
        algorithm: 'scrypt-v1',
        updatedAt: now,
      });
    }
    batch.set(historyRef, {
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
    await batch.commit();

    return json({
      id: userRef.id,
      user: sanitizeSystemUser(userRef.id, { ...cleanProfile, createdAt: now, updatedAt: now }),
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('AUTH') || message.includes('INACTIVE') ? 401 : 500;
    return json({ error: status === 401 ? 'Authentication is required.' : 'Could not create user.' }, status);
  }
}

