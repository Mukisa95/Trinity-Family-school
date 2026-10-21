import { doc, runTransaction, Timestamp, type Transaction } from '@/lib/access/scoped-firestore';
import { auth, db } from '@/lib/firebase';
import type { ExamLease } from '@/types';
import { EXAM_LEASE_DURATION_MS, examLeaseDeadline, isExamLeaseExpired } from '@/lib/utils/exam-lease-policy';

export type ExamLeaseToken = Pick<ExamLease, 'leaseId' | 'lockedByUid'>;
export type ExamLeaseOverride = ExamLeaseToken & Pick<ExamLease, 'lockedByName'>;
export type ExamLeaseAttempt =
  | { acquired: true; lease: ExamLease }
  | { acquired: false; holder: ExamLease | null };

function asIso(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return typeof value === 'string' ? value : '';
}

function normalizeLease(examId: string, data: Record<string, unknown>): ExamLease {
  return {
    examId,
    ...(typeof data.clientId === 'string' ? { clientId: data.clientId } : {}),
    lockedByUid: String(data.lockedByUid ?? ''),
    lockedByName: String(data.lockedByName ?? 'Another editor'),
    leaseId: String(data.leaseId ?? ''),
    acquiredAt: asIso(data.acquiredAt),
    renewedAt: asIso(data.renewedAt),
    expiresAt: asIso(data.expiresAt),
  };
}

function isExpired(lease: ExamLease, now = Date.now()): boolean {
  return isExamLeaseExpired(lease, now);
}

function nextExpiry() {
  return Timestamp.fromMillis(Date.now() + EXAM_LEASE_DURATION_MS);
}

export class ExamLeaseService {
  static ref(examId: string) {
    return doc(db, 'examLocks', examId);
  }

  static async acquire(
    examId: string,
    user: { id: string; name: string },
    leaseId: string,
    clientId?: string,
  ): Promise<ExamLeaseAttempt> {
    const ref = this.ref(examId);
    return runTransaction(db, async transaction => {
      const current = await transaction.get(ref);
      const now = Timestamp.now();
      if (current.exists()) {
        const existing = normalizeLease(examId, current.data());
        const samePage = clientId && existing.clientId === clientId && existing.lockedByUid === user.id;
        if (!isExpired(existing) && (existing.leaseId !== leaseId || existing.lockedByUid !== user.id) && !samePage) {
          return { acquired: false, holder: existing };
        }
      }

      const expiresAt = nextExpiry();
      transaction.set(ref, {
        examId,
        lockedByUid: user.id,
        lockedByName: user.name,
        leaseId,
        ...(clientId ? { clientId } : {}),
        acquiredAt: current.exists() ? current.data().acquiredAt ?? now : now,
        renewedAt: now,
        expiresAt,
      });
      return {
        acquired: true,
        lease: {
          examId,
          lockedByUid: user.id,
          lockedByName: user.name,
          leaseId,
          ...(clientId ? { clientId } : {}),
          acquiredAt: now.toDate().toISOString(),
          renewedAt: now.toDate().toISOString(),
          expiresAt: expiresAt.toDate().toISOString(),
        },
      };
    });
  }

  static async release(examId: string, token: ExamLeaseToken): Promise<void> {
    const ref = this.ref(examId);
    const released = await runTransaction(db, async transaction => {
      const current = await transaction.get(ref);
      if (!current.exists()) return false;
      const lease = normalizeLease(examId, current.data());
      if (lease.lockedByUid !== token.lockedByUid || lease.leaseId !== token.leaseId) return false;
      transaction.delete(ref);
      return true;
    });
    if (released) void this.notifyUnlockWaiters(examId);
  }

  /** Best-effort push dispatch after this client has actually released its lease. */
  static async notifyUnlockWaiters(examId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;

    try {
      const token = await user.getIdToken();
      await fetch('/api/exams/unlock-notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ examId }),
        cache: 'no-store',
        keepalive: true,
      });
    } catch {
      // Releasing a lease must never be blocked by an unavailable push service.
    }
  }

  static async verifyForSave(examId: string, token: ExamLeaseToken, transaction: Transaction): Promise<void> {
    const current = await transaction.get(this.ref(examId));
    if (!current.exists()) throw new Error('Your editing lease has expired. Reload before saving.');
    const lease = normalizeLease(examId, current.data());
    if (lease.lockedByUid !== token.lockedByUid || lease.leaseId !== token.leaseId || isExpired(lease)) {
      throw new Error('Another editor now owns this result. Your changes were not saved.');
    }
  }

  /**
   * Explicitly transfers the lease during an override save. Keeping the new
   * lease after the write prevents the displaced browser from immediately
   * reacquiring the exam and saving stale marks over the override.
   */
  static claimForOverrideSave(examId: string, override: ExamLeaseOverride, transaction: Transaction): ExamLease {
    const now = Timestamp.now();
    const expiresAt = nextExpiry();
    transaction.set(this.ref(examId), {
      examId,
      lockedByUid: override.lockedByUid,
      lockedByName: override.lockedByName,
      leaseId: override.leaseId,
      acquiredAt: now,
      renewedAt: now,
      expiresAt,
    });
    return {
      examId,
      ...override,
      acquiredAt: now.toDate().toISOString(),
      renewedAt: now.toDate().toISOString(),
      expiresAt: expiresAt.toDate().toISOString(),
    };
  }

  static isExpired(lease: ExamLease): boolean {
    return isExpired(lease);
  }

  static deadline(lease: ExamLease): number {
    return examLeaseDeadline(lease);
  }

  static normalize(examId: string, data: Record<string, unknown>): ExamLease {
    return normalizeLease(examId, data);
  }
}
