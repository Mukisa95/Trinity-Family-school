import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';
import type { SystemUser } from '@/types';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

const SYSTEM_USERS_COLLECTION = 'system_users';
const AUTH_CREDENTIALS_COLLECTION = 'authCredentials';
const LEGACY_PASSWORD_SALT = 'trinity_school_2024';
const SCRYPT_PREFIX = 'scrypt$v1';

type UserRecord = Record<string, any> & {
  username?: string;
  role?: string;
  isActive?: boolean;
  passwordHash?: string;
};

function legacyHash(password: string, salted = true) {
  return Buffer.from(`${salted ? LEGACY_PASSWORD_SALT : ''}${password}`, 'utf8').toString('base64');
}

export function hashPasswordForServer(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${SCRYPT_PREFIX}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

function verifyServerPassword(password: string, storedHash: string) {
  if (storedHash.startsWith(`${SCRYPT_PREFIX}$`)) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    try {
      const salt = Buffer.from(parts[2], 'base64url');
      const expected = Buffer.from(parts[3], 'base64url');
      const actual = scryptSync(password, salt, expected.length);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  const suppliedSalted = Buffer.from(legacyHash(password), 'utf8');
  const expected = Buffer.from(storedHash, 'utf8');
  if (suppliedSalted.length === expected.length && timingSafeEqual(suppliedSalted, expected)) {
    return true;
  }

  // Preserve the one historical unsalted administrator password format.
  const suppliedUnsalted = Buffer.from(legacyHash(password, false), 'utf8');
  return suppliedUnsalted.length === expected.length && timingSafeEqual(suppliedUnsalted, expected);
}

function timestampToIso(value: any): any {
  if (value?.toDate instanceof Function) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(timestampToIso);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, timestampToIso(item)]));
  }
  return value;
}

export function sanitizeSystemUser(id: string, data: UserRecord): SystemUser {
  const { passwordHash: _passwordHash, ...safeData } = data;
  return timestampToIso({ id, ...safeData }) as SystemUser;
}

async function findUserByCredentials(
  username: string,
  password: string,
): Promise<{ id: string; data: UserRecord } | null> {
  const db = getFirestore(getFirebaseAdminApp());
  const exact = await db
    .collection(SYSTEM_USERS_COLLECTION)
    .where('username', '==', username)
    .limit(1)
    .get();

  let userDoc: QueryDocumentSnapshot<DocumentData> | undefined = exact.docs[0];

  // Preserve the existing parent-login compatibility flow. Some parents use
  // admission number as their password and an older generated username.
  if (!userDoc) {
    const pupilSnapshot = await db
      .collection('pupils')
      .where('admissionNumber', '==', password)
      .limit(1)
      .get();
    const pupilDoc = pupilSnapshot.docs[0];

    if (pupilDoc) {
      const pupil = pupilDoc.data();
      const surnamePrefix = String(pupil.lastName || '').slice(0, 3).toUpperCase();
      const birthYear = pupil.dateOfBirth?.toDate instanceof Function
        ? pupil.dateOfBirth.toDate().getFullYear()
        : new Date(pupil.dateOfBirth || Date.now()).getFullYear();
      const simpleUsername = `${surnamePrefix}${String(birthYear).slice(-2)}`;
      const simpleVariations = [
        simpleUsername,
        `${simpleUsername}1`,
        `${simpleUsername}2`,
        `${simpleUsername}3`,
      ];
      const admissionBasedUsername = `parent_${password.toLowerCase()}`;
      const nameVariations = [
        `${pupil.firstName || ''}${pupil.lastName || ''}${pupil.otherNames || ''}`.replace(/\s+/g, '').toLowerCase(),
        `${pupil.firstName || ''}.${pupil.lastName || ''}`.replace(/\s+/g, '').toLowerCase(),
        `${pupil.firstName || ''}${pupil.lastName || ''}`.replace(/\s+/g, '').toLowerCase(),
      ];
      const candidates = Array.from(new Set([
        ...simpleVariations,
        admissionBasedUsername,
        ...nameVariations,
      ].filter(Boolean))).slice(0, 10);

      if (candidates.length) {
        const compatible = await db
          .collection(SYSTEM_USERS_COLLECTION)
          .where('username', 'in', candidates)
          .get();
        const byUsername = new Map(compatible.docs.map(doc => [doc.data().username, doc]));
        userDoc = simpleVariations
          .map(candidate => byUsername.get(candidate))
          .find(candidate => candidate?.data().pupilId === pupilDoc.id);
        userDoc ??= byUsername.get(admissionBasedUsername);
        userDoc ??= nameVariations.map(candidate => byUsername.get(candidate)).find(Boolean);
      }
    }
  }

  if (!userDoc) return null;
  const userData = userDoc.data() as UserRecord;
  if (userData.isActive === false) return null;

  const credentialRef = db.collection(AUTH_CREDENTIALS_COLLECTION).doc(userDoc.id);
  const credentialDoc = await credentialRef.get();
  const storedHash = credentialDoc.data()?.passwordHash || userData.passwordHash;
  if (typeof storedHash !== 'string' || !verifyServerPassword(password, storedHash)) return null;

  const batch = db.batch();
  batch.update(userDoc.ref, {
    lastLogin: Timestamp.now(),
    updatedAt: userData.updatedAt || Timestamp.now(),
  });

  // A successful legacy login upgrades the password and removes it from the
  // profile document. Only server credentials can read authCredentials.
  if (!storedHash.startsWith(`${SCRYPT_PREFIX}$`) || userData.passwordHash) {
    batch.set(credentialRef, {
      passwordHash: hashPasswordForServer(password),
      algorithm: 'scrypt-v1',
      updatedAt: Timestamp.now(),
    }, { merge: true });
    if (userData.passwordHash) {
      batch.update(userDoc.ref, { passwordHash: FieldValue.delete() });
    }
  }
  await batch.commit();

  const safeData: UserRecord = { ...userData };
  delete safeData.passwordHash;
  return { id: userDoc.id, data: safeData };
}

export async function authenticateLegacyUser(username: string, password: string) {
  const match = await findUserByCredentials(username.trim(), password);
  if (!match) return null;

  const claims = {
    appUser: true,
    role: match.data.role || 'Staff',
    isActive: match.data.isActive !== false,
    ...(match.data.familyId ? { familyId: match.data.familyId } : {}),
    ...(match.data.staffId ? { staffId: match.data.staffId } : {}),
    ...(match.data.pupilId ? { pupilId: match.data.pupilId } : {}),
  };
  const adminAuth = getAuth(getFirebaseAdminApp());
  try {
    const firebaseUser = await adminAuth.getUser(match.id);
    if (firebaseUser.disabled) {
      await adminAuth.updateUser(match.id, { disabled: false });
    }
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') throw error;
    await adminAuth.createUser({ uid: match.id, disabled: false });
  }
  await adminAuth.setCustomUserClaims(match.id, claims);

  return {
    user: sanitizeSystemUser(match.id, match.data),
    customToken: await adminAuth.createCustomToken(match.id, claims),
  };
}

export async function verifyLegacyCredentials(username: string, password: string) {
  const match = await findUserByCredentials(username.trim(), password);
  return match ? sanitizeSystemUser(match.id, match.data) : null;
}

export type AuthenticatedAppUser = {
  decoded: DecodedIdToken;
  user: SystemUser;
  rawUser: UserRecord;
};

export async function requireAppUser(request: NextRequest): Promise<AuthenticatedAppUser> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) throw new Error('AUTH_REQUIRED');

  const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(token, true);
  if (decoded.appUser !== true || decoded.firebase?.sign_in_provider === 'anonymous') {
    throw new Error('APP_AUTH_REQUIRED');
  }

  const userDoc = await getFirestore(getFirebaseAdminApp())
    .collection(SYSTEM_USERS_COLLECTION)
    .doc(decoded.uid)
    .get();
  if (!userDoc.exists || userDoc.data()?.isActive === false) throw new Error('ACCOUNT_INACTIVE');

  return {
    decoded,
    user: sanitizeSystemUser(userDoc.id, userDoc.data() as UserRecord),
    rawUser: userDoc.data() as UserRecord,
  };
}

export function canManageUsers(actor: AuthenticatedAppUser, action: 'create' | 'update' | 'delete') {
  if (actor.user.role === 'Admin') return true;
  if (actor.user.role !== 'Staff') return false;

  const legacy = actor.user.modulePermissions?.find(permission =>
    String(permission.module).toLowerCase() === 'users'
  )?.permission;
  if (legacy === 'full_access') return true;
  if (action !== 'delete' && legacy === 'edit') return true;

  const modulePermissions = actor.user.granularPermissions?.find(module => module.moduleId === 'users');
  if (!modulePermissions) return false;
  const acceptedActions = action === 'create'
    ? ['create_user', 'manage_permissions']
    : action === 'update'
      ? ['edit_user', 'manage_permissions']
      : ['delete_user'];

  return modulePermissions.pages.some(page =>
    page.canAccess && page.actions.some(item => item.allowed && acceptedActions.includes(item.actionId))
  );
}
