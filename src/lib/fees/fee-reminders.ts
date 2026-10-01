import type { PaymentRecord, SystemUser } from '@/types';
import type { CustomNoteSpec, CustomFeeRow } from './custom-fee-notes';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { paymentMatchesReminderScope as matchesScope, getFeeReminderProgress as calculateProgress,
  canAccessFeeReminderPage, canReceiveFeeReminders as receivesFeeReminders } from './reminder-engine/fee-reminder-progress';

export const FEE_REMINDER_TIMEZONE = 'Africa/Nairobi';
export const FEE_REMINDER_COLLECTION = 'feeReminders';

export interface FeeReminderScope {
  feeStructureId: string;
  academicYearId: string;
  termId: string;
  feeName: string;
  academicYearName: string;
  termName: string;
}

export interface FeeReminder {
  id: string;
  kind: 'pay_later' | 'promise' | 'custom';
  custom?: CustomNoteSpec;
  className?: string;
  renderedMessage?: string;
  evaluatedAt?: string;
  evaluatedFees?: CustomFeeRow[];
  customDeliveryPending?: boolean;
  customAttemptedRecipientIds?: string[];
  lastOutcome?: string;
  liveMessage?: string;
  liveFees?: CustomFeeRow[];
  pupilId: string;
  pupilName: string;
  feeId: string;
  feeName: string;
  academicYearId: string;
  termId: string;
  academicYearName: string;
  termName: string;
  scopes: FeeReminderScope[];
  promisedAmount: number;
  promisedBy: string;
  phone: string;
  additionalNote: string;
  balanceAtCreation: number;
  baselinePaymentIds: string[];
  dueAt: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  reminderStatus: 'scheduled' | 'sent' | 'failed' | 'cancelled' | 'fulfilled' | 'not_triggered';
  recipientIds?: string[] | null;
  recipientNames?: string[];
  notificationVersion?: number;
  settledAt?: string | null;
  cancelReason?: string;
  cancelledByName?: string;
  cancelledAt?: string | null;
  resolutionNotificationId?: string;
  dismissalPending?: boolean;
  sentAt?: string | null;
  lastError?: string | null;
}

export interface CreateFeeReminderInput {
  kind?: 'pay_later' | 'promise';
  requestId: string;
  pupilId: string;
  feeId: string;
  academicYearId: string;
  termId: string;
  scopes?: Pick<FeeReminderScope, 'feeStructureId' | 'academicYearId' | 'termId'>[];
  promisedAmount: number;
  promisedBy: string;
  phone: string;
  additionalNote?: string;
  scheduleDate: string;
  scheduleTime: string;
  recipientIds?: string[] | null;
}

export interface FeeReminderRecipient { id: string; name: string; role: string }

export interface FeeReminderProgress {
  status: 'unpaid' | 'partial' | 'paid';
  paid: number;
  remaining: number;
  overdue: boolean;
  completedAt: string | null;
  lastPaymentAt: string | null;
  paidAfterDeadline: number;
  payments: PaymentRecord[];
}

export function canReadFeeReminders(user: SystemUser | null): boolean {
  return canAccessFeeReminderPage(user, 'collect');
}

export function canManageFeeReminders(user: SystemUser | null): boolean {
  return canReadFeeReminders(user)
    && GranularPermissionService.canPerformAction(user, 'fees', 'collect', 'record_payment');
}

// Every active user with a Fees page grant receives these staff reminders.
// Parent accounts use their own portal and never receive staff follow-up notes.
export function canReceiveFeeReminders(user: SystemUser | null): boolean {
  return receivesFeeReminders(user);
}

export function reminderLocalDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FEE_REMINDER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value);
}

export function reminderDateLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: FEE_REMINDER_TIMEZONE, day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(value));
}

export function reminderTimeLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: FEE_REMINDER_TIMEZONE, hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export function reminderAmountLabel(amount: number): string {
  return `${new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(amount)} shillings`;
}

export function parseFeeReminderSchedule(date: string, time: string, now = new Date()): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Choose a valid reminder date and time.');
  }
  const dueAt = new Date(`${date}T${time}:00+03:00`);
  if (!Number.isFinite(dueAt.getTime()) || reminderLocalDate(dueAt) !== date) {
    throw new Error('Choose a valid reminder date.');
  }
  if (dueAt.getTime() < now.getTime() + 60_000) {
    throw new Error('Choose a reminder time at least one minute in the future.');
  }
  if (dueAt.getTime() > now.getTime() + 366 * 86_400_000) {
    throw new Error('Choose a reminder within the next year.');
  }
  return dueAt;
}

export function normalizeReminderPhone(phone: string): string {
  const normalized = phone.replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(normalized)) throw new Error('Enter a valid phone number.');
  return normalized;
}

export function feeReminderScopeKey(scope: Pick<FeeReminderScope, 'feeStructureId' | 'academicYearId' | 'termId'>): string {
  return JSON.stringify([scope.feeStructureId, scope.academicYearId, scope.termId]);
}

export function paymentMatchesReminderScope(payment: PaymentRecord, scope: FeeReminderScope): boolean {
  return matchesScope(payment, scope);
}

export function getFeeReminderProgress(note: FeeReminder, ledger: PaymentRecord[], now = new Date()): FeeReminderProgress {
  return calculateProgress(note, ledger, now);
}

// Settlement includes late payments; deadline reporting remains available separately.
export function getFeeReminderSettlement(note: FeeReminder, ledger: PaymentRecord[], now = new Date()): FeeReminderProgress {
  return calculateProgress({ ...note, dueAt: new Date(Math.max(Date.parse(note.dueAt), now.getTime())).toISOString() }, ledger, now);
}

export function feeReminderPromiseText(note: Pick<FeeReminder,
  'pupilName' | 'promisedBy' | 'promisedAmount' | 'feeName' | 'createdAt' | 'dueAt'>, now = new Date()): string {
  const date = reminderDateLabel(note.dueAt);
  const due = reminderLocalDate(new Date(note.dueAt)) === reminderLocalDate(now) ? `today, ${date}` : date;
  return `${note.promisedBy}, parent/guardian of ${note.pupilName}, promised on ${reminderDateLabel(note.createdAt)} to pay ${reminderAmountLabel(note.promisedAmount)} towards ${note.feeName} by ${due} at ${reminderTimeLabel(note.dueAt)}.`;
}

export function feeReminderOutcomeText(note: FeeReminder, progress: FeeReminderProgress): string {
  if (progress.status === 'paid') {
    return `The full promised amount was paid on ${reminderDateLabel(progress.completedAt!)}. ${reminderAmountLabel(progress.paid)} was recorded within the promise period.`;
  }
  if (progress.status === 'partial') {
    return `Payments totalling ${reminderAmountLabel(progress.paid)} were recorded, most recently on ${reminderDateLabel(progress.lastPaymentAt!)}. This is ${reminderAmountLabel(progress.remaining)} less than the promise.${progress.overdue ? ` Call ${note.promisedBy} on ${note.phone}?` : ''}`;
  }
  return progress.overdue
    ? `No payment was made within the promise period. Call ${note.promisedBy} on ${note.phone}?`
    : 'No payment has been recorded within the promise period so far.';
}
