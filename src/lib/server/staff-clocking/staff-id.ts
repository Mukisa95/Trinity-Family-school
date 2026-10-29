import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AuthenticatedAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { requireStaffClockingAccess } from './index';

const staffIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
export const staffQrHash = (payload: string) => createHash('sha256').update(payload).digest('base64url');
const headRef = (db: Firestore, staffId: string) => db.collection('staffClockingStaffIds').doc(staffId);
const credentialRef = (db: Firestore, hash: string) => db.collection('staffClockingStaffCredentials').doc(hash);
const manageAllowed = (actor: AuthenticatedAppUser) => GranularPermissionService.canPerformAction(actor.user, 'staff_clocking', 'record', 'manage_staff_ids');

/** Read or issue a stable personal ID. Revoked IDs cannot be reactivated by their owner. */
export async function getOrIssueStaffId(db: Firestore, actor: AuthenticatedAppUser, targetId: string, operation: 'read' | 'issue' | 'replace' | 'revoke', expectedRevision?: number) {
  const staffId = staffIdSchema.parse(targetId), own = actor.user.staffId === staffId;
  const manager = manageAllowed(actor);
  if (own && (operation === 'read' || operation === 'issue') && !manager) requireStaffClockingAccess(actor, 'clock', 'clock_self');
  else requireStaffClockingAccess(actor, 'record', 'manage_staff_ids');
  const head = headRef(db, staffId), staff = db.collection('staff').doc(staffId);
  const token = `TSC1:${randomBytes(32).toString('base64url')}`;
  const hash = staffQrHash(token), now = Timestamp.now();
  return db.runTransaction(async transaction => {
    const [member, existing, account, settings] = await Promise.all([transaction.get(staff), transaction.get(head), transaction.get(db.collection('system_users').doc(actor.user.id)), transaction.get(db.collection('staffClockingSettings').doc('default'))]);
    if (!account.exists || account.data()?.isActive === false) throw new Error('ACCOUNT_INACTIVE');
    const current = { ...actor, user: { ...account.data(), id: account.id } as AuthenticatedAppUser['user'] };
    if (own && (operation === 'read' || operation === 'issue') && !manager && account.data()?.staffId === staffId) requireStaffClockingAccess(current, 'clock', 'clock_self');
    else requireStaffClockingAccess(current, 'record', 'manage_staff_ids');
    if (!member.exists || String(member.data()?.status || 'active').toLowerCase() !== 'active') throw new Error('CLOCKING_STAFF_INACTIVE');
    if (own && !manager && (operation === 'read' || operation === 'issue')) {
      const feature = settings.data();
      if (!feature?.enabled) throw new Error('CLOCKING_FEATURE_DISABLED');
      if (feature.accessMode === 'selected_staff' && !feature.enrolledStaffIds?.includes(staffId)) throw new Error('CLOCKING_STAFF_NOT_ENROLLED');
    }
    const previous = existing.data();
    if (expectedRevision !== undefined && Number(previous?.revision || 0) !== expectedRevision) throw new Error('CLOCKING_STAFF_ID_CHANGED');
    if (operation === 'read') return previous?.active ? { token: previous.token, revision: previous.revision } : { status: previous ? 'revoked' : 'unissued' };
    if (operation === 'issue' && previous?.active) return { token: previous.token, revision: previous.revision };
    if (operation === 'issue' && previous && own && !manageAllowed(actor)) throw new Error('CLOCKING_STAFF_ID_REVOKED');
    if (operation === 'replace' && !previous) throw new Error('CLOCKING_STAFF_ID_NOT_ISSUED');
    if (operation === 'revoke' && !previous?.active) return { status: 'revoked', revision: previous?.revision || 0 };
    const revision = Number(previous?.revision || 0) + 1;
    if (previous?.credentialHash) transaction.set(credentialRef(db, previous.credentialHash), { active: false, revokedAt: now }, { merge: true });
    if (operation === 'revoke') transaction.set(head, { active: false, revision, updatedAt: now }, { merge: true });
    else {
      transaction.set(credentialRef(db, hash), { staffId, active: true, createdAt: now, revision });
      transaction.set(head, { token, credentialHash: hash, active: true, revision, updatedAt: now });
    }
    transaction.set(db.collection('staffClockingPersonalRevisions').doc(staffId), { staffId: staffId, credential: FieldValue.increment(1) }, { merge: true });
    transaction.set(db.collection('settings').doc('data-revisions-operational'), { staffClockingTimekeepers: FieldValue.increment(1) }, { merge: true });
    transaction.create(db.collection('historyLogs').doc(), { a: 'update', e: 'staff_clocking_staff_id', rid: staffId, rl: operation, uid: actor.user.id, un: String(account.data()?.name || account.data()?.username || actor.user.id), ts: now });
    return operation === 'revoke' ? { status: 'revoked', revision } : { token, revision };
  });
}
