import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { FeeReminder, FeeReminderProgress } from '../src/lib/fees/fee-reminders';
import type { SystemUser } from '../src/types';
export interface FeeReminderResolutionDelivery {
  id: string; version: number; notificationId: string; title: string; body: string;
  pupilId: string; recipientIds: string[]; collectRecipientIds: string[];
}
export interface FeeReminderResolution extends FeeReminderResolutionDelivery {
  reason: 'paid' | 'manual'; settledAt: string | null; paidTotal: number; cancelledByName: string; cancelReason: string;
}
type Sender = (result: FeeReminderResolutionDelivery) => Promise<void>;
type Stamp = { serverTimestamp(): unknown };
export function reconcilePupilFeeReminders(options: {
  db: Firestore; FieldValue: Stamp; pupilId: string; now?: Date; sendDismissals?: Sender;
}): Promise<void>;
export function makeFeeReminderResolution(note: FeeReminder, options: {
  reason: 'paid' | 'manual'; version: number; now?: Date; settlement?: FeeReminderProgress;
  users: SystemUser[]; previousRecipientIds?: string[]; cancelledByName?: string; cancelReason?: string;
}): FeeReminderResolution;
export function writeFeeReminderResolution(transaction: Transaction, options: {
  db: Firestore; FieldValue: Stamp; note: FeeReminder; resolution: FeeReminderResolution;
}): void;
export function deliverFeeReminderResolution(options: {
  db: Firestore; FieldValue: Stamp; id: string; sendDismissals: Sender;
}): Promise<boolean>;
