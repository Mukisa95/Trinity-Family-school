import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { z } from 'zod';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { issueAppUserCustomToken, requireAppUser, verifyLegacyCredentials } from '@/lib/server/app-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const actions = z.enum(['list', 'register-options', 'register-verify', 'login-options', 'login-verify', 'remove']);
const requestSchema = z.object({
  action: actions,
  password: z.string().min(1).max(512).optional(),
  challengeId: z.string().regex(/^[A-Za-z0-9_-]{32}$/).optional(),
  credentialId: z.string().regex(/^[A-Za-z0-9_-]{1,2048}$/).optional(),
  response: z.record(z.unknown()).optional(),
});
const attempts = new Map<string, { count: number; until: number }>();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}

function relyingParty(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!origin || !host) return null;
  const url = new URL(origin);
  if (url.host !== host || (url.protocol !== 'https:' && url.hostname !== 'localhost')) return null;
  return { origin: url.origin, rpID: url.hostname };
}

function rateLimited(request: NextRequest) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  if (attempts.size > 2000) for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
  const attempt = attempts.get(address);
  if (!attempt || attempt.until < now) {
    attempts.set(address, { count: 1, until: now + 60_000 });
    return false;
  }
  attempt.count++;
  return attempt.count > 15;
}

function db() { return getFirestore(getFirebaseAdminApp()); }
// Keep security credentials below the already server-only authCredentials
// namespace. Existing production rules deny this entire recursive path, so the
// browser cannot read or forge a passkey even before any rules update.
function passkeys() { return db().collection('authCredentials').doc('__passkeys__').collection('credentials'); }
function passkeyChallenges() { return db().collection('authCredentials').doc('__passkeys__').collection('challenges'); }

async function cleanExpiredChallenges() {
  // Firestore's TTL policy is optional; bounded cleanup prevents abandoned
  // challenges from accumulating when it has not been enabled yet.
  const expired = await passkeyChallenges()
    .where('expiresAt', '<', Timestamp.now()).limit(25).get();
  if (expired.empty) return;
  const batch = db().batch();
  expired.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

async function consumeChallenge(id: string, purpose: 'login' | 'register', origin: string, userId?: string) {
  const ref = passkeyChallenges().doc(id);
  return db().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    transaction.delete(ref);
    const data = snapshot.data();
    if (data?.purpose !== purpose || data.origin !== origin ||
      typeof data.expiresAt?.toMillis !== 'function' || data.expiresAt.toMillis() < Date.now()) return null;
    if (userId && data.userId !== userId) return null;
    return typeof data.challenge === 'string' ? data.challenge as string : null;
  });
}

export async function POST(request: NextRequest) {
  let rp: ReturnType<typeof relyingParty>;
  try { rp = relyingParty(request); } catch { rp = null; }
  if (!rp) return json({ error: 'Passkeys require a secure same-origin connection.' }, 403);
  if (rateLimited(request)) return json({ error: 'Too many attempts. Please wait one minute.' }, 429);

  let parsed: z.infer<typeof requestSchema>;
  try {
    const result = requestSchema.safeParse(await request.json());
    if (!result.success) return json({ error: 'Invalid passkey request.' }, 400);
    parsed = result.data;
  } catch { return json({ error: 'Invalid passkey request.' }, 400); }

  try {
    const { action } = parsed;
    if (action === 'login-options') {
      if (Math.random() < 0.1) await cleanExpiredChallenges();
      // A discoverable credential lets the device identify the account without a username lookup.
      const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'required' });
      const challengeId = randomBytes(24).toString('base64url');
      await passkeyChallenges().doc(challengeId).create({
        challenge: options.challenge, purpose: 'login', origin: rp.origin,
        expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60_000),
      });
      return json({ options, challengeId });
    }

    if (action === 'login-verify') {
      if (!parsed.challengeId || !parsed.response || typeof parsed.response.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,2048}$/.test(parsed.response.id)) return json({ error: 'Invalid passkey response.' }, 400);
      const challenge = await consumeChallenge(parsed.challengeId, 'login', rp.origin);
      if (!challenge) return json({ error: 'This sign-in request expired. Please try again.' }, 400);
      const ref = passkeys().doc(parsed.response.id);
      const key = await ref.get();
      const record = key.data();
      if (!record || typeof record.userId !== 'string' || typeof record.publicKey !== 'string') return json({ error: 'Passkey not registered.' }, 401);
      const verified = await verifyAuthenticationResponse({
        response: parsed.response as unknown as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
        expectedChallenge: challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID,
        requireUserVerification: true,
        credential: { id: key.id, publicKey: new Uint8Array(Buffer.from(record.publicKey, 'base64url')), counter: record.counter || 0, transports: record.transports || [] },
      });
      if (!verified.verified) return json({ error: 'Device verification failed.' }, 401);
      const userDoc = await db().collection('system_users').doc(record.userId).get();
      if (!userDoc.exists || userDoc.data()?.isActive === false) return json({ error: 'Account unavailable.' }, 401);
      await db().runTransaction(async transaction => {
        const latest = await transaction.get(ref);
        if (!latest.exists || latest.data()?.userId !== record.userId || latest.data()?.counter !== record.counter) throw new Error('PASSKEY_CHANGED');
        transaction.update(ref, { counter: verified.authenticationInfo.newCounter, lastUsedAt: Timestamp.now() });
      });
      return json(await issueAppUserCustomToken(userDoc.id, userDoc.data()!));
    }

    const actor = await requireAppUser(request);
    if (action === 'list') {
      const snapshot = await passkeys().where('userId', '==', actor.user.id).limit(20).get();
      return json({ passkeys: snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || 'This device', createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null })) });
    }

    if (action === 'register-options') {
      if (!parsed.password) return json({ error: 'Enter your current password to add device unlock.' }, 400);
      const verifiedUser = await verifyLegacyCredentials(actor.user.username, parsed.password);
      if (verifiedUser?.id !== actor.user.id) return json({ error: 'Current password is incorrect.' }, 401);
      const existing = await passkeys().where('userId', '==', actor.user.id).limit(20).get();
      if (existing.size >= 20) return json({ error: 'Passkey limit reached.' }, 400);
      const options = await generateRegistrationOptions({
        rpName: 'Trinity Family School', rpID: rp.rpID,
        userID: new Uint8Array(createHash('sha256').update(actor.user.id).digest()),
        userName: actor.user.username,
        attestationType: 'none',
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
        excludeCredentials: existing.docs.map(doc => ({ id: doc.id, transports: doc.data().transports || [] })),
      });
      const challengeId = randomBytes(24).toString('base64url');
      await passkeyChallenges().doc(challengeId).create({
        challenge: options.challenge, purpose: 'register', origin: rp.origin, userId: actor.user.id,
        expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60_000),
      });
      return json({ options, challengeId });
    }

    if (action === 'register-verify') {
      if (!parsed.challengeId || !parsed.response) return json({ error: 'Invalid passkey response.' }, 400);
      const challenge = await consumeChallenge(parsed.challengeId, 'register', rp.origin, actor.user.id);
      if (!challenge) return json({ error: 'This setup request expired. Please try again.' }, 400);
      const verification = await verifyRegistrationResponse({
        response: parsed.response as unknown as Parameters<typeof verifyRegistrationResponse>[0]['response'],
        expectedChallenge: challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) return json({ error: 'Device verification failed.' }, 400);
      const credential = verification.registrationInfo.credential;
      await passkeys().doc(credential.id).create({
        userId: actor.user.id, name: 'This device',
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter, transports: credential.transports || [],
        createdAt: Timestamp.now(),
      });
      return json({ registered: true });
    }

    if (action === 'remove') {
      if (!parsed.password || !parsed.credentialId) return json({ error: 'Password and passkey are required.' }, 400);
      const verifiedUser = await verifyLegacyCredentials(actor.user.username, parsed.password);
      if (verifiedUser?.id !== actor.user.id) return json({ error: 'Current password is incorrect.' }, 401);
      const ref = passkeys().doc(parsed.credentialId);
      const key = await ref.get();
      if (!key.exists || key.data()?.userId !== actor.user.id) return json({ error: 'Passkey not found.' }, 404);
      await ref.delete();
      return json({ removed: true });
    }
    return json({ error: 'Invalid passkey request.' }, 400);
  } catch (error) {
    if (error instanceof Error && ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED', 'ACCOUNT_INACTIVE'].includes(error.message)) {
      return json({ error: 'Sign in again to manage device unlock.' }, 401);
    }
    console.error('Passkey request failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Passkey request could not be completed. Please try again.' }, 503);
  }
}
