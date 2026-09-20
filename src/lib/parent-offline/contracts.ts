import type { Account, AttendanceRecord, Loan, PaymentRecord, Pupil, Transaction } from '@/types';

/**
 * This schema is deliberately limited to the family profile needed by the
 * existing parent shell. Fees, results, requirements and notifications
 * will get their own versioned projections before they are persisted here.
 * Keeping those datasets separate prevents a partial download from being
 * presented as a complete financial or academic record.
 */
export const PARENT_OFFLINE_FAMILY_SCHEMA = 1;

export type ParentOfflineFamilySnapshot = {
  schema: typeof PARENT_OFFLINE_FAMILY_SCHEMA;
  accountId: string;
  familyId?: string;
  preparedAt: string;
  pupils: Pupil[];
};

export type ParentOfflineFamilyStatus = {
  preparedAt: string;
  pupilCount: number;
  byteLength: number;
};

export const PARENT_OFFLINE_BANKING_SCHEMA = 2;
export const PARENT_OFFLINE_ATTENDANCE_SCHEMA = 1;
export const PARENT_OFFLINE_RESULTS_SCHEMA = 1;
export const PARENT_OFFLINE_FEES_SCHEMA = 1;

/**
 * A complete, server-authorized banking projection for one child. `account:
 * null` is meaningful only in this complete record; an absent IndexedDB record
 * never means that the child has no banking account.
 */
export type ParentOfflineBankingSnapshot = {
  schema: typeof PARENT_OFFLINE_BANKING_SCHEMA;
  key: string;
  accountId: string;
  pupilId: string;
  revision: number;
  preparedAt: string;
  account: Account | null;
  transactions: Transaction[];
  loans: Loan[];
};

export type ParentOfflineAttendanceSnapshot = {
  schema: typeof PARENT_OFFLINE_ATTENDANCE_SCHEMA;
  key: string;
  accountId: string;
  pupilId: string;
  revision: number;
  preparedAt: string;
  records: AttendanceRecord[];
};

export type ParentReleasedResult = {
  id: string;
  examId: string;
  examName: string;
  examDate: string;
  academicYear: string;
  term: string;
  className: string;
  classCode?: string;
  totalScore: number;
  totalMarks: number;
  totalAggregates: number;
  maxPossibleMarks: number;
  subjectResults: Array<{
    subject: string;
    subjectCode: string;
    score: number;
    totalMarks: number;
    grade: string;
    aggregates: number;
    comment?: string;
  }>;
  grade: string;
  division: string;
  remarks: string;
  recordedAt: string;
  releasedAt?: string;
  pupilInfo: {
    name: string;
    admissionNumber: string;
    classNameAtExam: string;
  };
};

export type ParentOfflineResultsSnapshot = {
  schema: typeof PARENT_OFFLINE_RESULTS_SCHEMA;
  key: string;
  accountId: string;
  pupilId: string;
  revision: number;
  preparedAt: string;
  results: ParentReleasedResult[];
};

/** Exact values already rendered in the parent fee view for one school term. */
export type ParentOfflineFeeDisplay = {
  id: string;
  name: string;
  amount: number;
  paid: number;
  balance: number;
  payments: PaymentRecord[];
  description?: string;
};

export type ParentOfflineFeesSnapshot = {
  schema: typeof PARENT_OFFLINE_FEES_SCHEMA;
  key: string;
  accountId: string;
  pupilId: string;
  academicYearId: string;
  termId: string;
  preparedAt: string;
  fees: ParentOfflineFeeDisplay[];
  totals: { totalFees: number; totalPaid: number; totalBalance: number };
};

export function isParentOfflineFamilySnapshot(
  value: unknown,
  accountId: string,
): value is ParentOfflineFamilySnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<ParentOfflineFamilySnapshot>;
  return (
    snapshot.schema === PARENT_OFFLINE_FAMILY_SCHEMA &&
    snapshot.accountId === accountId &&
    typeof snapshot.preparedAt === 'string' &&
    Array.isArray(snapshot.pupils) &&
    snapshot.pupils.every(pupil => pupil && typeof pupil.id === 'string')
  );
}

export function parentOfflineBankingKey(accountId: string, pupilId: string) {
  return `${accountId}:${pupilId}`;
}

export function parentOfflineAttendanceKey(accountId: string, pupilId: string) {
  return `${accountId}:${pupilId}:attendance`;
}

export function parentOfflineResultsKey(accountId: string, pupilId: string) {
  return `${accountId}:${pupilId}:results`;
}

export function parentOfflineFeesKey(accountId: string, pupilId: string, academicYearId: string, termId: string) {
  return `${accountId}:${pupilId}:${academicYearId}:${termId}:fees`;
}

export function isParentOfflineBankingSnapshot(
  value: unknown,
  accountId: string,
  pupilId: string,
): value is ParentOfflineBankingSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<ParentOfflineBankingSnapshot>;
  const hasValidAccount = snapshot.account === null || (
    Boolean(snapshot.account) &&
    snapshot.account?.pupilId === pupilId &&
    typeof snapshot.account.id === 'string' &&
    typeof snapshot.account.accountNumber === 'string' &&
    typeof snapshot.account.balance === 'number'
  );
  return (
    snapshot.schema === PARENT_OFFLINE_BANKING_SCHEMA &&
    snapshot.key === parentOfflineBankingKey(accountId, pupilId) &&
    snapshot.accountId === accountId &&
    snapshot.pupilId === pupilId &&
    typeof snapshot.revision === 'number' &&
    Number.isInteger(snapshot.revision) &&
    snapshot.revision >= 0 &&
    typeof snapshot.preparedAt === 'string' &&
    hasValidAccount &&
    Array.isArray(snapshot.transactions) &&
    snapshot.transactions.every(transaction => transaction && transaction.pupilId === pupilId && typeof transaction.id === 'string') &&
    Array.isArray(snapshot.loans) &&
    snapshot.loans.every(loan => loan && loan.pupilId === pupilId && typeof loan.id === 'string')
  );
}

export function isParentOfflineAttendanceSnapshot(
  value: unknown,
  accountId: string,
  pupilId: string,
): value is ParentOfflineAttendanceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<ParentOfflineAttendanceSnapshot>;
  return (
    snapshot.schema === PARENT_OFFLINE_ATTENDANCE_SCHEMA &&
    snapshot.key === parentOfflineAttendanceKey(accountId, pupilId) &&
    snapshot.accountId === accountId &&
    snapshot.pupilId === pupilId &&
    typeof snapshot.revision === 'number' &&
    Number.isInteger(snapshot.revision) &&
    snapshot.revision >= 0 &&
    typeof snapshot.preparedAt === 'string' &&
    Array.isArray(snapshot.records) &&
    snapshot.records.every(record => record && record.pupilId === pupilId && typeof record.id === 'string')
  );
}

export function isParentOfflineResultsSnapshot(
  value: unknown,
  accountId: string,
  pupilId: string,
): value is ParentOfflineResultsSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<ParentOfflineResultsSnapshot>;
  return (
    snapshot.schema === PARENT_OFFLINE_RESULTS_SCHEMA &&
    snapshot.key === parentOfflineResultsKey(accountId, pupilId) &&
    snapshot.accountId === accountId &&
    snapshot.pupilId === pupilId &&
    typeof snapshot.revision === 'number' &&
    Number.isInteger(snapshot.revision) &&
    snapshot.revision >= 0 &&
    typeof snapshot.preparedAt === 'string' &&
    Array.isArray(snapshot.results) &&
    snapshot.results.every(result =>
      result &&
      typeof result.id === 'string' &&
      typeof result.examId === 'string' &&
      typeof result.examName === 'string' &&
      Array.isArray(result.subjectResults),
    )
  );
}

export function isParentOfflineFeesSnapshot(
  value: unknown,
  accountId: string,
  pupilId: string,
  academicYearId: string,
  termId: string,
): value is ParentOfflineFeesSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<ParentOfflineFeesSnapshot>;
  const totals = snapshot.totals;
  return (
    snapshot.schema === PARENT_OFFLINE_FEES_SCHEMA &&
    snapshot.key === parentOfflineFeesKey(accountId, pupilId, academicYearId, termId) &&
    snapshot.accountId === accountId &&
    snapshot.pupilId === pupilId &&
    snapshot.academicYearId === academicYearId &&
    snapshot.termId === termId &&
    typeof snapshot.preparedAt === 'string' &&
    Array.isArray(snapshot.fees) &&
    snapshot.fees.every(fee => fee && typeof fee.id === 'string' && typeof fee.name === 'string' && typeof fee.amount === 'number' && typeof fee.paid === 'number' && typeof fee.balance === 'number' && Array.isArray(fee.payments) && fee.payments.every(payment => payment && typeof payment.id === 'string' && typeof payment.paymentDate === 'string' && typeof payment.amount === 'number')) &&
    Boolean(totals) &&
    typeof totals?.totalFees === 'number' &&
    typeof totals?.totalPaid === 'number' &&
    typeof totals?.totalBalance === 'number'
  );
}
