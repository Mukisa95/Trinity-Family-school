import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { optimizedNotificationService } from '@/lib/services/optimized-notification.service';
import type { User } from '@/types';
import 'server-only';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

export type FamilyMembershipReason = 'membership_change' | 'registration';

export interface ParentFamilyMembershipInput {
  pupilIds: string[];
  familyId: string | null;
  preferredPupilId?: string;
  reason?: FamilyMembershipReason;
}

export interface ParentScopeClaimUpdate {
  accountId: string;
  familyId: string | null;
  pupilId: string | null;
  isActive: boolean;
}

export interface ParentFamilyMembershipNotification {
  accountId: string;
  pupilId: string;
  pupilName: string;
  kind: 'joined' | 'removed';
}

export interface ParentFamilyMembershipResult {
  pupilIds: string[];
  familyId: string | null;
  accountId: string | null;
  claimUpdates: ParentScopeClaimUpdate[];
  notifications: ParentFamilyMembershipNotification[];
}

function chunks<T>(items: T[], size = 30): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => (
    items.slice(index * size, index * size + size)
  ));
}

function accountSort(left: any, right: any) {
  const activeDifference = Number(right.data().isActive === true) - Number(left.data().isActive === true);
  return activeDifference || left.id.localeCompare(right.id);
}

/**
 * Moves pupils between account scopes in one Firestore transaction. Family
 * membership remains the grouping boundary; parentAccountId is the immediate
 * authorization and notification-routing boundary.
 */
export async function transitionParentFamilyMembership(
  input: ParentFamilyMembershipInput,
  actor: { id: string; username?: string; role?: string },
): Promise<ParentFamilyMembershipResult> {
  const pupilIds = unique(input.pupilIds.map(text));
  if (pupilIds.length === 0) throw new Error('PUPILS_REQUIRED');
  if (pupilIds.length > 100) throw new Error('TOO_MANY_PUPILS');
  const destinationFamilyId = text(input.familyId) || null;
  if (!destinationFamilyId && pupilIds.length > 1) throw new Error('DETACH_ONE_PUPIL_AT_A_TIME');
  const preferredPupilId = text(input.preferredPupilId) || pupilIds[0];
  const reason = input.reason || 'membership_change';
  const db = getFirestore(getFirebaseAdminApp());

  return db.runTransaction(async transaction => {
    const targetDocuments = await Promise.all(
      pupilIds.map(id => transaction.get(db.collection('pupils').doc(id))),
    );
    if (targetDocuments.some(document => !document.exists)) throw new Error('PUPIL_NOT_FOUND');

    const oldFamilyIds = unique(targetDocuments.map(document => text(document.data()?.familyId)));
    const affectedFamilyIds = unique([
      ...oldFamilyIds,
      ...(destinationFamilyId ? [destinationFamilyId] : []),
    ]);
    const familySnapshots = await Promise.all(
      affectedFamilyIds.map(familyId => transaction.get(
        db.collection('pupils').where('familyId', '==', familyId),
      )),
    );
    const pupilDocuments = new Map<string, any>();
    targetDocuments.forEach(document => pupilDocuments.set(document.id, document));
    familySnapshots.forEach(snapshot => snapshot.docs.forEach(document => (
      pupilDocuments.set(document.id, document)
    )));
    if (pupilDocuments.size > 180) throw new Error('FAMILY_TOO_LARGE');

    const relevantPupilIds = [...pupilDocuments.keys()];
    const familyAccountGroups = affectedFamilyIds.length === 0
      ? []
      : await Promise.all(chunks(affectedFamilyIds).map(ids => transaction.get(
          db.collection('system_users').where('familyId', 'in', ids),
        )));
    const pupilAccountGroups = await Promise.all(chunks(relevantPupilIds).map(ids => transaction.get(
      db.collection('system_users').where('pupilId', 'in', ids),
    )));
    const markerAccountIds = unique(
      [...pupilDocuments.values()].map(document => text(document.data()?.parentAccountId)),
    );
    const markerAccountDocuments = await Promise.all(
      markerAccountIds.map(id => transaction.get(db.collection('system_users').doc(id))),
    );

    const accountDocuments = new Map<string, any>();
    [...familyAccountGroups, ...pupilAccountGroups].forEach(snapshot => (
      snapshot.docs.forEach(document => {
        if (document.data().role === 'Parent') accountDocuments.set(document.id, document);
      })
    ));
    markerAccountDocuments.forEach(document => {
      if (document.exists && document.data()?.role === 'Parent') accountDocuments.set(document.id, document);
    });
    const parentAccounts = [...accountDocuments.values()];
    const targetIdSet = new Set(pupilIds);
    const effectiveFamilyId = (document: any) => (
      targetIdSet.has(document.id) ? destinationFamilyId : text(document.data()?.familyId) || null
    );
    const membersAfter = new Map<string, string[]>();
    affectedFamilyIds.forEach(familyId => membersAfter.set(familyId, []));
    pupilDocuments.forEach(document => {
      const familyId = effectiveFamilyId(document);
      if (familyId) membersAfter.set(familyId, [...(membersAfter.get(familyId) || []), document.id]);
    });

    const canonicalByFamily = new Map<string, any>();
    affectedFamilyIds.forEach(familyId => {
      const candidates = parentAccounts
        .filter(document => text(document.data().familyId) === familyId && document.data().isActive === true)
        .sort(accountSort);
      if (candidates[0]) canonicalByFamily.set(familyId, candidates[0]);
    });

    if (destinationFamilyId && !canonicalByFamily.has(destinationFamilyId)) {
      const transferableCandidates = parentAccounts
        .filter(document => (
          document.data().isActive === true
          && targetIdSet.has(text(document.data().pupilId))
          && (
            !text(document.data().familyId)
            || unique(membersAfter.get(text(document.data().familyId)) || []).length === 0
          )
        ))
        .sort((left, right) => {
          const standaloneDifference = Number(!text(right.data().familyId))
            - Number(!text(left.data().familyId));
          const preferredDifference = Number(text(right.data().pupilId) === preferredPupilId)
            - Number(text(left.data().pupilId) === preferredPupilId);
          return standaloneDifference || preferredDifference || accountSort(left, right);
        });
      // A standalone account is promoted into an unclaimed family. Likewise,
      // when the last child leaves one family for another unclaimed family,
      // the existing login moves with that child instead of being discarded.
      if (transferableCandidates[0]) canonicalByFamily.set(destinationFamilyId, transferableCandidates[0]);
    }

    const desiredAccountScopes = new Map<string, { familyId: string | null; pupilId: string | null }>();
    const directAccountByPupil = new Map<string, any>();
    affectedFamilyIds.forEach(familyId => {
      const memberIds = unique(membersAfter.get(familyId) || []);
      const canonical = memberIds.length > 0 ? canonicalByFamily.get(familyId) : undefined;
      const familyAccounts = parentAccounts.filter(document => text(document.data().familyId) === familyId);
      if (canonical) {
        const existingRepresentative = text(canonical.data().pupilId);
        const representative = memberIds.includes(existingRepresentative)
          ? existingRepresentative
          : memberIds.includes(preferredPupilId) ? preferredPupilId : memberIds[0];
        desiredAccountScopes.set(canonical.id, { familyId, pupilId: representative });
      }
      familyAccounts.forEach(document => {
        if (!canonical || document.id !== canonical.id) {
          desiredAccountScopes.set(document.id, { familyId: null, pupilId: null });
        }
      });
    });

    parentAccounts.forEach(document => {
      const linkedPupilId = text(document.data().pupilId);
      if (
        linkedPupilId
        && targetIdSet.has(linkedPupilId)
        && !text(document.data().familyId)
        && ![...canonicalByFamily.values()].some(account => account.id === document.id)
      ) {
        desiredAccountScopes.set(document.id, { familyId: null, pupilId: null });
      }
    });

    // If the last pupil leaves a family, keep that family's existing account
    // with the pupil as a standalone account. If siblings remain, the shared
    // account stays with them and the detached pupil loses that scope.
    if (!destinationFamilyId) {
      targetDocuments.forEach(document => {
        const oldFamilyId = text(document.data()?.familyId);
        const remainingMembers = oldFamilyId ? unique(membersAfter.get(oldFamilyId) || []) : [];
        const formerFamilyAccount = oldFamilyId ? canonicalByFamily.get(oldFamilyId) : undefined;
        const standaloneAccount = parentAccounts
          .filter(account => (
            account.data().isActive === true
            && !text(account.data().familyId)
            && text(account.data().pupilId) === document.id
          ))
          .sort(accountSort)[0];
        const directAccount = remainingMembers.length === 0 ? formerFamilyAccount || standaloneAccount : standaloneAccount;
        if (!directAccount) return;
        directAccountByPupil.set(document.id, directAccount);
        desiredAccountScopes.set(directAccount.id, { familyId: null, pupilId: document.id });
      });
    }

    const canonicalForPupil = (document: any) => {
      const familyId = effectiveFamilyId(document);
      return familyId ? canonicalByFamily.get(familyId) : directAccountByPupil.get(document.id);
    };
    const notifications = new Map<string, ParentFamilyMembershipNotification>();
    targetDocuments.forEach(document => {
      const data = document.data() || {};
      const oldFamilyId = text(data.familyId) || null;
      const oldAccountId = text(data.parentAccountId)
        || (oldFamilyId ? canonicalByFamily.get(oldFamilyId)?.id : '')
        || parentAccounts.find(account => text(account.data().pupilId) === document.id)?.id
        || null;
      const newAccountId = canonicalForPupil(document)?.id || null;
      const pupilName = `${text(data.firstName)} ${text(data.lastName)}`.trim() || 'A pupil';
      const familyChanged = oldFamilyId !== destinationFamilyId;
      if (oldAccountId && (oldAccountId !== newAccountId || !destinationFamilyId)) {
        notifications.set(`${oldAccountId}:removed:${document.id}`, {
          accountId: oldAccountId,
          pupilId: document.id,
          pupilName,
          kind: 'removed',
        });
      }
      if (newAccountId && destinationFamilyId && (
        reason === 'registration' || oldAccountId !== newAccountId || familyChanged
      )) {
        notifications.set(`${newAccountId}:joined:${document.id}`, {
          accountId: newAccountId,
          pupilId: document.id,
          pupilName,
          kind: 'joined',
        });
      }
    });

    const changedPupilIds = [...pupilDocuments.keys()].sort();
    const [operational, legacySettings] = await Promise.all([
      transaction.get(db.collection('settings').doc('data-revisions-operational')),
      transaction.get(db.collection('settings').doc('school-settings')),
    ]);
    const currentRevision = Math.max(
      Number(operational.data()?.pupils || 0),
      Number(legacySettings.data()?.dataRevisions?.pupils || 0),
    );
    const finalRevision = currentRevision + changedPupilIds.length;
    const now = Timestamp.now();

    pupilDocuments.forEach(document => {
      const canonical = canonicalForPupil(document);
      const update: Record<string, any> = {
        parentAccountId: canonical?.id || null,
        parentAccountActive: canonical?.data().isActive === true,
        updatedAt: now,
      };
      if (targetIdSet.has(document.id)) {
        update.familyId = destinationFamilyId || FieldValue.delete();
      }
      transaction.update(document.ref, update);
    });

    const claimUpdates: ParentScopeClaimUpdate[] = [];
    desiredAccountScopes.forEach((scope, accountId) => {
      const document = accountDocuments.get(accountId);
      if (!document) return;
      const currentFamilyId = text(document.data().familyId) || null;
      const currentPupilId = text(document.data().pupilId) || null;
      if (currentFamilyId === scope.familyId && currentPupilId === scope.pupilId) return;
      transaction.set(document.ref, {
        familyId: scope.familyId || FieldValue.delete(),
        pupilId: scope.pupilId || FieldValue.delete(),
        ...(scope.familyId || scope.pupilId ? {} : {
          isActive: false,
          deactivatedReason: 'parent_scope_merged_or_removed',
          deactivatedAt: now,
        }),
        updatedAt: now,
      }, { merge: true });
      claimUpdates.push({
        accountId,
        familyId: scope.familyId,
        pupilId: scope.pupilId,
        isActive: Boolean(scope.familyId || scope.pupilId) && document.data().isActive === true,
      });
    });

    changedPupilIds.forEach((pupilId, index) => {
      const revision = currentRevision + index + 1;
      transaction.set(db.collection('pupilCacheChanges').doc(String(revision).padStart(16, '0')), {
        revision,
        pupilId,
        operation: 'upsert',
        changedAt: now,
      });
    });
    transaction.set(db.collection('settings').doc('data-revisions-operational'), {
      pupils: finalRevision,
    }, { merge: true });
    transaction.set(db.collection('settings').doc('school-settings'), {
      dataRevisions: { pupils: finalRevision },
    }, { merge: true });
    transaction.set(db.collection('historyLogs').doc(), {
      action: 'update',
      entity: 'pupil-family-membership',
      recordId: pupilIds.join(','),
      label: destinationFamilyId ? `Moved to family ${destinationFamilyId}` : 'Detached from family',
      changedFields: ['familyId', 'parentAccountId', 'parentAccountActive'],
      actor: { id: actor.id, name: actor.username || actor.id, role: actor.role || 'Staff' },
      createdAt: now,
    });

    return {
      pupilIds,
      familyId: destinationFamilyId,
      accountId: destinationFamilyId ? canonicalByFamily.get(destinationFamilyId)?.id || null : null,
      claimUpdates,
      notifications: [...notifications.values()],
    };
  });
}

export async function syncParentScopeClaims(updates: ParentScopeClaimUpdate[]): Promise<void> {
  const adminAuth = getAuth(getFirebaseAdminApp());
  await Promise.all(updates.map(async update => {
    try {
      await adminAuth.setCustomUserClaims(update.accountId, {
        appUser: true,
        role: 'Parent',
        isActive: update.isActive,
        ...(update.familyId ? { familyId: update.familyId } : {}),
        ...(update.pupilId ? { pupilId: update.pupilId } : {}),
      });
    } catch (error: any) {
      // Accounts receive an Auth record at first secure sign-in. There is no
      // live session to refresh for an account that has never signed in.
      if (error?.code !== 'auth/user-not-found') throw error;
    }
  }));
}

export async function sendParentFamilyMembershipNotifications(
  notifications: ParentFamilyMembershipNotification[],
): Promise<void> {
  for (const notification of notifications) {
    const joined = notification.kind === 'joined';
    const url = joined
      ? `/parent?scopeRefresh=${Date.now()}&pupilId=${encodeURIComponent(notification.pupilId)}`
      : `/parent?scopeRefresh=${Date.now()}`;
    await optimizedNotificationService.sendPushOnlyNotification({
      title: joined ? 'Family member added' : 'Family member removed',
      description: joined
        ? `${notification.pupilName} has joined your family. Click here to view their details.`
        : `${notification.pupilName} is no longer a member of your family. Contact the school to find out why.`,
      type: 'system',
      priority: 'high',
      enablePush: true,
      pushTitle: joined ? 'Family member added' : 'Family member removed',
      pushBody: joined
        ? `${notification.pupilName} has joined your family. Click here to view their details.`
        : `${notification.pupilName} is no longer a member of your family. Contact the school to find out why.`,
      pushUrl: url,
      pushIcon: '/trinity-logo-192.png',
      pushData: {
        type: 'PARENT_SCOPE_CHANGED',
        accountId: notification.accountId,
        pupilId: notification.pupilId,
        membership: notification.kind,
      },
    }, [{ id: notification.accountId } as User], `family-${notification.kind}-${notification.pupilId}-${Date.now()}`);
  }
}
