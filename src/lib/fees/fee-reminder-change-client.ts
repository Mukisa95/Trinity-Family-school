import {auth, db} from '@/lib/firebase';
import {onAuthStateChanged} from 'firebase/auth';
import {doc, getDocFromCache} from 'firebase/firestore';

export type FeeReminderClientChange = {
  pupilIds?: string[]; feeIds?: string[]; reversal?: boolean;
  scopes?: Array<{feeStructureId: string; academicYearId: string; termId: string}>;
  source?: {collection: 'feesHolidays' | 'uniformTracking'; id: string};
};
const memoryPending = new Map<string, FeeReminderClientChange[]>();
let flushing: Promise<void> | undefined;
function pending(key: string): FeeReminderClientChange[] {
  try {const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(memoryPending.get(key) || [])); return Array.isArray(value) ? value : [];} catch {return memoryPending.get(key) || [];}
}
function save(key: string, items: FeeReminderClientChange[]) {
  memoryPending.set(key, items);
  try {localStorage.setItem(key, JSON.stringify(items));} catch {/* Sending still proceeds when storage is unavailable. */}
}
export async function flushFeeReminderChanges(): Promise<void> {
  if (typeof window === 'undefined' || flushing) return flushing;
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const key = `fee-reminder-changes:${user.uid}`;
  flushing = (async () => {
    for (const item of pending(key)) {
      try {
        let change = item;
        if (item.source) {
          // Source ownership comes from the cache populated by the ordinary
          // fee screen, never from an extra server read to check disabled Notes.
          const cached = await getDocFromCache(doc(db, item.source.collection, item.source.id)).catch(() => null);
          const pupilId = cached?.data()?.pupilId;
          if (typeof pupilId === 'string') change = {...item, pupilIds: [...new Set([...(item.pupilIds || []), pupilId])]};
          if (!change.pupilIds?.length) continue;
        }
        const token = await user.getIdToken();
        const response = await fetch('/api/fees/reminders/reconcile', {method: 'POST',
          headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
          body: JSON.stringify(change), signal: AbortSignal.timeout(20_000)});
        if (!response.ok && ![400, 403].includes(response.status)) break;
        save(key, pending(key).filter(other => JSON.stringify(other) !== JSON.stringify(item)));
      } catch {break;}
    }
  })().finally(() => {flushing = undefined;});
  return flushing;
}
export async function notifyFeeReminderChange(change: FeeReminderClientChange): Promise<void> {
  if (typeof window === 'undefined') return;
  // Run only after the source commit. No reminder or network failure may turn
  // a successfully recorded payment into a failed payment response.
  try {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    const key = `fee-reminder-changes:${user.uid}`, items = pending(key);
    if (!items.some(item => JSON.stringify(item) === JSON.stringify(change))) items.push(change);
    save(key, items);
    await flushFeeReminderChanges();
    if (pending(key).length) await flushFeeReminderChanges();
  } catch (error) {console.warn('Saved change; reminder update awaits recovery:', error);}
}
export function recoverFeeReminderChanges() {
  const recover = () => {void flushFeeReminderChanges();};
  const unsubscribe = onAuthStateChanged(auth, recover);
  window.addEventListener('online', recover);
  recover();
  return () => {unsubscribe(); window.removeEventListener('online', recover);};
}
