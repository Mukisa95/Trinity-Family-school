import type {Firestore, Transaction} from 'firebase-admin/firestore';
import type {CustomFeeContext} from '../src/lib/fees/custom-fee-notes';
import type {FeeReminderResolutionDelivery} from './fee-reminder-lifecycle';
export interface CustomFeeDelivery extends FeeReminderResolutionDelivery {type: 'FEE_REMINDER_ALERT'}
type Options = {db: Firestore; FieldValue: {serverTimestamp(): unknown}; now?: Date; sendAlert?: (delivery: CustomFeeDelivery) => Promise<void>};
export function readCustomFeeContext(db: Firestore, transaction: Transaction, pupilId: string): Promise<CustomFeeContext>;
export function evaluateCustomFeeNote(options: Options & {id: string; mode?: 'live' | 'deadline'; expectedVersion?: number}): Promise<{terminal: boolean; skipped: boolean}>;
export function reconcileCustomFeeNotes(options: Options & {pupilId: string}): Promise<void>;
export function deliverCustomFeeNote(options: Options & {id: string; sendAlert: (delivery: CustomFeeDelivery) => Promise<void>}): Promise<boolean>;
