import 'server-only';
import { FieldValue, Timestamp, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { GranularPermissionService as Permissions } from '@/lib/services/granular-permissions.service';
import type { SystemUser } from '@/types';
import { nextSmsRunAt } from '@/lib/scheduler/schedule-times';
export async function eventDispatchBlocked(job: Record<string, any>): Promise<string | null> {
    if (!job.eventId)
        return null;
    const db = getFirestore(getFirebaseAdminApp());
    const [event, sender] = await Promise.all([db.collection('events').doc(job.eventId).get(), db.collection('system_users').doc(job.createdBy).get()]);
    const data = event.data(), user = sender.exists ? { ...sender.data(), id: sender.id } as SystemUser : null;
    if (!event.exists || data?.communicationRevision !== job.eventRevision)
        return 'The event was removed or its reminder settings changed.';
    if (['Cancelled', 'Draft'].includes(data?.status) || data?.requiresApproval && data?.approvalStatus !== 'Approved')
        return 'The event is not approved and published for delivery.';
    if (!user?.isActive || !Permissions.canAccessPage(user, 'events', 'calendar') || !Permissions.canPerformAction(user, 'events', 'calendar', 'send_reminders'))
        return 'The scheduling account no longer has event reminder permission.';
    if (job.channel === 'sms' || job.eventPersonalised) {
        if (!Permissions.canPerformAction(user, 'bulk_sms', 'send', 'send_sms'))
            return 'The scheduling account no longer has SMS permission.';
    }
    else if (!Permissions.canPerformAction(user, 'notifications', 'list', 'send_notification'))
        return 'The scheduling account no longer has notification permission.';
    return null;
}
/** Resume acknowledged message groups only. An interrupted provider request is
 * held for review rather than automatically charging for a possible duplicate. */
export async function dispatchEventSms(ref: DocumentReference, job: Record<string, any>, dueAt: Date): Promise<{
    terminal: boolean;
    skipped?:boolean;
    nextRunAt?: Date | null;
    reason?: string;
}> {
    const blocked = await eventDispatchBlocked(job);
    if (blocked) {
        await ref.update({ status: 'cancelled', lockedAmount: 0, lastError: blocked });
        return { terminal: true, skipped:true, reason: blocked };
    }
    const occurrence = job.nextRunAt?.toDate?.().toISOString() || dueAt.toISOString();
    const saved = job.eventDispatchCursor?.occurrence === occurrence ? job.eventDispatchCursor : { occurrence, index: 0, state: 'ready' };
    if (saved.state === 'attempting') {
        await ref.update({ status: 'needs_review', lastError: 'A provider request was interrupted. Review delivery before resending.' });
        return { terminal: true, skipped:true, reason: 'SMS delivery needs review.' };
    }
    const username = process.env.WIZA_SMS_USERNAME, password = process.env.WIZA_SMS_PASSWORD;
    if (!username || !password)
        throw new Error('Wiza credentials are not configured.');
    const stopAt = Date.now() + 20000;
    let index = Number(saved.index) || 0;
    while (index < Number(job.messageBatchCount)) {
        if (Date.now() > stopAt)
            return { terminal: false, nextRunAt: new Date(Date.now() + 15000) };
        const changed = await eventDispatchBlocked(job);
        if (changed) {
            await ref.update({ status: 'cancelled', lockedAmount: 0, lastError: changed });
            return { terminal: true, skipped:true, reason: changed };
        }
        const chunk = await ref.collection('messageChunks').doc(String(Math.floor(index / 20))).get();
        const batch = chunk.data()?.messages?.[index % 20];
        if (!batch?.message || !Array.isArray(batch.phones) || !batch.phones.length)
            throw new Error('An event SMS message group is missing.');
        await ref.update({ eventDispatchCursor: { occurrence, index, state: 'attempting' }, updatedAt: FieldValue.serverTimestamp() });
        try {
            const response = await fetch('https://api.wizasms.ug/v1/sms/send', { method: 'POST', signal: AbortSignal.timeout(8000), headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ contacts: batch.phones, message: batch.message, sender_id: process.env.WIZA_SMS_SENDER_ID || 'TRINITY' }) });
            const raw = await response.text();
            let result: Record<string, unknown> = {};
            try {
                result = JSON.parse(raw);
            }
            catch { }
            if (!response.ok || result.success === false && result.status !== 'success')
                throw new Error(raw.slice(0, 200) || 'The SMS provider did not confirm delivery.');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'The provider result is unknown.';
            await ref.update({ status: 'needs_review', lastError: message, updatedAt: FieldValue.serverTimestamp() });
            return { terminal: true, skipped:true, reason: message };
        }
        index++;
        await ref.update({ eventDispatchCursor: { occurrence, index, state: 'ready' }, updatedAt: FieldValue.serverTimestamp() });
    }
    const next = nextSmsRunAt('dates', job.schedule || {}, new Date(occurrence));
    await ref.update({ status: next ? 'scheduled' : 'completed', nextRunAt: next ? Timestamp.fromDate(next) : null, lastSentAt: FieldValue.serverTimestamp(), lockedAmount: next ? job.lockedAmount || 0 : 0, eventDispatchCursor: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    return { terminal: !next, nextRunAt: next };
}
