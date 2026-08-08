import { doc, runTransaction, Timestamp, type Transaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ExamLease } from '@/types';

const LEASE_MINUTES = 10;
const CLOCK_SKEW_MS = 15_000;

export type ExamLeaseToken = Pick<ExamLease, 'leaseId' | 'lockedByUid'>;
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
    lockedByUid: String(data.lockedByUid ?? ''),
    lockedByName: String(data.lockedByName ?? 'Another editor'),
    leaseId: String(data.leaseId ?? ''),
    acquiredAt: asIso(data.acquiredAt),
    renewedAt: asIso(data.renewedAt),
    expiresAt: asIso(data.expiresAt),
  };
}

function isExpired(lease: ExamLease, now = Date.now()): boolean {
  const expiresAt = new Date(lease.expiresAt).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= now - CLOCK_SKEW_MS;
}

function nextExpiry() {
  return Timestamp.fromMillis(Date.now() + LEASE_MINUTES * 60_000);
}

export class ExamLeaseService {
  static ref(examId: string) {
    return doc(db, 'examLocks', examId);
  }

  static async acquire(
    examId: string,
    user: { id: string; name: string },
    leaseId: string,
  ): Promise<ExamLeaseAttempt> {
    const ref = this.ref(examId);
    return runTransaction(db, async transaction => {
      const current = await transaction.get(ref);
      const now = Timestamp.now();
      if (current.exists()) {
        const existing = normalizeLease(examId, current.data());
        if (!isExpired(existing) && existing.leaseId !== leaseId) {
          return { acquired: false, holder: existing };
        }
      }

      const expiresAt = nextExpiry();
      transaction.set(ref, {
        examId,
        lockedByUid: user.id,
        lockedByName: user.name,
        leaseId,
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
          acquiredAt: now.toDate().toISOString(),
          renewedAt: now.toDate().toISOString(),
          expiresAt: expiresAt.toDate().toISOString(),
        },
      };
    });
  }

  static async release(examId: string, token: ExamLeaseToken): Promise<void> {
    const ref = this.ref(examId);
    await runTransaction(db, async transaction => {
      const current = await transaction.get(ref);
      if (!current.exists()) return;
      const lease = normalizeLease(examId, current.data());
      if (lease.lockedByUid !== token.lockedByUid || lease.leaseId !== token.leaseId) return;
      transaction.delete(ref);
    });
  }

  static async verifyForSave(examId: string, token: ExamLeaseToken, transaction: Transaction): Promise<void> {
    const current = await transaction.get(this.ref(examId));
    if (!current.exists()) throw new Error('Your editing lease has expired. Reload before saving.');
    const lease = normalizeLease(examId, current.data());
    if (lease.lockedByUid !== token.lockedByUid || lease.leaseId !== token.leaseId || isExpired(lease)) {
      throw new Error('Another editor now owns this result. Your changes were not saved.');
    }
  }

  static isExpired(lease: ExamLease): boolean {
    return isExpired(lease);
  }

  static normalize(examId: string, data: Record<string, unknown>): ExamLease {
    return normalizeLease(examId, data);
  }
}
