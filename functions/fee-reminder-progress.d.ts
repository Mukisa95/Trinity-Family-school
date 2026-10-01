import type { PaymentRecord, SystemUser } from '../src/types';
import type { FeeReminder, FeeReminderScope, FeeReminderProgress } from '../src/lib/fees/fee-reminders';
export function paymentMatchesReminderScope(payment: PaymentRecord, scope: FeeReminderScope): boolean;
export function getFeeReminderProgress(note: FeeReminder, ledger: PaymentRecord[], now?: Date): FeeReminderProgress;
export function canAccessFeeReminderPage(user: SystemUser | null, pageId: string): boolean;
export function canReceiveFeeReminders(user: SystemUser | null): boolean;
