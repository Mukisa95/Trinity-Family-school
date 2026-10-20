import 'server-only';
import { createHash } from 'crypto';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import type { AuthenticatedAppUser } from './app-auth';
import { eventPlanningSchema, loadEventAudience, requireEventAccess } from './event-audience';
import { GranularPermissionService as Permissions } from '@/lib/services/granular-permissions.service';
import { requireScopedClass } from './circumference';
import { eventChannelRecipients, eventSmsPreview, validateEventTimes } from '@/lib/events/event-planning';
import { nextSmsRunAt, smsQueueId, pushQueueId } from '@/lib/scheduler/schedule-times';
import { SCHEDULED_DISPATCH_QUEUE } from './scheduled-dispatch-queue';
import { EXAM_TYPES } from '@/lib/constants';
import type { Event } from '@/types';
import { readSmsWalletBalance } from './sms-wallet';
const id = z.string().min(1).max(160).refine(value => !value.includes('/'));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const eventInput = z.object({ title: z.string().trim().min(1).max(160), description: z.string().max(8000).optional(), type: z.enum(['Academic', 'Co-curricular', 'Administrative', 'Holiday']), priority: z.enum(['Low', 'Medium', 'High', 'Urgent']), status: z.enum(['Draft', 'Scheduled', 'Ongoing', 'Completed', 'Cancelled']), startDate: date, endDate: date, startTime: z.string().optional(), endTime: z.string().optional(), isAllDay: z.boolean(), location: z.string().max(500).optional(), academicYearId: id.optional(), termId: id.optional(), classIds: z.array(id).max(200).optional(), subjectIds: z.array(id).max(200).optional(), isExamEvent: z.boolean(), requiresApproval: z.boolean(), requiresAttendance: z.boolean(), isPublic: z.boolean(), colorCode: z.string().max(20), tags: z.array(z.string().max(100)).max(50).optional(), recurrence: z.object({ frequency: z.enum(['None', 'Daily', 'Weekly', 'Monthly', 'Custom']) }).passthrough(), planning: eventPlanningSchema });
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 40);
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export async function savePlannedEvent(actor: AuthenticatedAppUser, input: {
    eventId?: string;
    eventData: Record<string, unknown>;
    exam?: Record<string, unknown>;
}) {
    const db = getFirestore(getFirebaseAdminApp());
    const existingId = input.eventId ? id.parse(input.eventId) : null;
    const approvalOnly = !!existingId && Object.keys(input.eventData).every(key => ['planning', 'approvalStatus', 'rejectionReason'].includes(key)) && ['Approved', 'Rejected'].includes(String(input.eventData.approvalStatus));
    requireEventAccess(actor, approvalOnly ? 'approve_event' : existingId ? 'edit_event' : 'create_event');
    const requestPlan = eventPlanningSchema.parse(input.eventData.planning || {});
    const eventId = existingId || `event-${hash(`${actor.user.id}:${requestPlan.requestId}`)}`;
    const ref = db.collection('events').doc(eventId), snapshot = await ref.get(), previous = snapshot.data();
    if (existingId && !snapshot.exists)
        throw new Error('The event no longer exists.');
    if (previous && !approvalOnly && actor.user.role !== 'Admin' && previous.createdBy !== actor.user.id)
        throw new Error('FORBIDDEN: You may edit only events you created.');
    const fingerprint = hash(canonical([actor.user.id, input]));
    if (previous?.lastSaveFingerprint === fingerprint)
        return { event: { ...previous, id: eventId }, examIds: previous.examIntegration?.examIds || [] };
    // Cancelling must remain possible even if an invited account or phone was removed.
    if(existingId&&input.eventData.status==='Cancelled'&&Object.keys(input.eventData).every(key=>['status','planning'].includes(key))){
        const [smsJobs,pushJobs]=await Promise.all([db.collection('scheduledSMS').where('eventId','==',eventId).get(),db.collection('scheduledNotifications').where('eventId','==',eventId).get()]);
        const jobs=[...smsJobs.docs.map(doc=>({doc,channel:'sms'})),...pushJobs.docs.map(doc=>({doc,channel:'push'}))].filter(({doc})=>['scheduled','processing','held','draft'].includes(doc.data().status));
        if(jobs.length*2+3>450)throw new Error('Too many active reminders. Cancel them from the schedule list first.');
        const patch={status:'Cancelled',communicationRevision:hash(fingerprint),updatedAt:new Date().toISOString(),updatedBy:actor.user.id,lastSaveFingerprint:fingerprint};
        await db.runTransaction(async tx=>{
            const latest=await tx.get(ref);
            if(latest.data()?.lastSaveFingerprint===fingerprint)return;
            if(JSON.stringify(latest.data()?.updatedAt)!==JSON.stringify(previous?.updatedAt))throw new Error('This event changed. Reopen it before cancelling.');
            tx.update(ref,patch);
            for(const {doc,channel} of jobs){tx.update(doc.ref,{status:'cancelled',lockedAmount:0,updatedAt:FieldValue.serverTimestamp()});tx.set(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(channel==='sms'?smsQueueId(doc.id):pushQueueId(doc.id)),{status:'cancelled',leaseUntil:null,updatedAt:FieldValue.serverTimestamp()},{merge:true});}
            tx.set(db.collection('settings').doc('data-revisions-operational'),{events:FieldValue.increment(1)},{merge:true});
            tx.set(db.collection('settings').doc('school-settings'),{dataRevisions:{events:FieldValue.increment(1)}},{merge:true});
        });
        return {event:{...previous,...patch,id:eventId} as unknown as Event,examIds:previous?.examIntegration?.examIds||[]};
    }
    if (approvalOnly && !Permissions.canPerformAction(actor.user, 'events', 'calendar', 'approve_event'))
        throw new Error('FORBIDDEN: You do not have permission to approve events.');
    const eventDate = (value: unknown) => typeof value === 'string' ? value.slice(0, 10) : value && typeof (value as {
        toDate?: unknown;
    }).toDate === 'function' ? (value as {
        toDate: () => Date;
    }).toDate().toISOString().slice(0, 10) : value;
    const merged = { ...previous, ...input.eventData };
    const data = eventInput.parse({ ...merged, startDate: eventDate(merged.startDate), endDate: eventDate(merged.endDate) });
    if (data.startDate > data.endDate)
        throw new Error('The event end date must be on or after its start date.');
    if (!data.isAllDay && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.endTime || '') || data.startDate === data.endDate && data.startTime! >= data.endTime!))
        throw new Error('Choose a valid event start and end time.');
    if (new Date(`${data.startDate}T12:00:00Z`).toISOString().slice(0, 10) !== data.startDate || new Date(`${data.endDate}T12:00:00Z`).toISOString().slice(0, 10) !== data.endDate)
        throw new Error('Choose valid event dates.');
    const plan = data.planning, wantsMessages = plan.push || plan.sms !== 'none';
    if (data.isExamEvent !== (plan.kind === 'academic' && plan.academicType === 'exam'))
        throw new Error('The academic event type and exam settings do not match.');
    if (existingId && previous?.isExamEvent && canonical(data.classIds) !== canonical(previous.classIds))
        throw new Error('Change linked exam classes from Exams.');
    if (existingId && previous?.isExamEvent && previous.planning && canonical(plan.subjectsByClass) !== canonical(previous.planning.subjectsByClass))
        throw new Error('Change linked exam subjects from Exams.');
    if (approvalOnly && canonical(plan) !== canonical(previous?.planning))
        throw new Error('Approval cannot change the saved audience or message.');
    if (wantsMessages) {
        requireEventAccess(actor, 'send_reminders');
        const timeError = validateEventTimes(plan.times, Date.now(), !!previous);
        if (timeError)
            throw new Error(timeError);
        if (previous && !approvalOnly) {
            const oldTimes = new Set((previous.planning?.times || []).map((entry: {
                date: string;
                time: string;
            }) => `${entry.date}T${entry.time}`));
            for (const entry of plan.times)
                if (!oldTimes.has(`${entry.date}T${entry.time}`) && new Date(`${entry.date}T${entry.time}:00+03:00`).getTime() < Date.now() + 60000)
                    throw new Error('New reminder times must be in the future.');
        }
        if (plan.push && !Permissions.canPerformAction(actor.user, 'notifications', 'list', 'send_notification'))
            throw new Error('FORBIDDEN: Push notification permission is required.');
        if (plan.sms !== 'none' && !Permissions.canPerformAction(actor.user, 'bulk_sms', 'send', 'send_sms'))
            throw new Error('FORBIDDEN: Bulk SMS permission is required.');
        if (plan.sms !== 'none' && !plan.message.trim())
            throw new Error('Enter a reminder message.');
    }
    if (plan.kind === 'staff' && plan.sms === 'all')
        throw new Error('Staff SMS reminders are for staff without accounts.');
    if (plan.kind === 'academic' && (plan.audience.scope !== 'filtered' || canonical([...plan.audience.classIds].sort()) !== canonical([...(data.classIds || [])].sort())))
        throw new Error('The academic audience must match the selected classes.');
    if (plan.kind === 'staff' && !plan.audience.staffIds.length)
        throw new Error('Select the staff attending this event.');
    if (plan.kind === 'academic' && !(data.classIds || []).length)
        throw new Error('Select the classes involved.');
    if (plan.audience.scope === 'filtered' && ![plan.audience.classIds, plan.audience.levels, plan.audience.sections, plan.audience.genders, plan.audience.streamIds].some(list => list.length))
        throw new Error('Choose at least one audience filter.');
    for (const classId of data.classIds || [])
        requireScopedClass(actor, classId);
    const audience = await loadEventAudience(actor, plan);
    const actualClasses = new Map(audience.classes.map(cls => [cls.id, cls]));
    for (const classId of data.classIds || [])
        if (!actualClasses.has(classId))
            throw new Error('A selected class no longer exists.');
    for (const [classId, subjectIds] of Object.entries(plan.subjectsByClass)) {
        if (!(data.classIds || []).includes(classId) || subjectIds.some(subject => !actualClasses.get(classId)?.subjectAssignments?.some(assignment => assignment.subjectId === subject)))
            throw new Error('Choose only subjects assigned to each selected class.');
    }
    const yearSnapshot = data.academicYearId ? await db.collection('academicYears').doc(data.academicYearId).get() : null;
    const year = yearSnapshot?.data(), term = year?.terms?.find((item: {
        id: string;
    }) => item.id === data.termId);
    const channels = eventChannelRecipients(plan, audience.recipients);
    const sms = plan.sms !== 'none' ? eventSmsPreview(plan, audience.recipients, audience.classes, year?.name || '', term?.name || '') : null;
    if (plan.push && !channels.pushUserIds.length)
        throw new Error('None of the selected people has an active account for push notifications.');
    if (sms?.issues.length)
        throw new Error(sms.issues.join(' '));
    if (sms?.messages.some(message => message.message.length > 4000))
        throw new Error('A personalised SMS exceeds 4,000 characters.');
    const revision = hash(`${fingerprint}:${plan.requestId}`), now = new Date();
    const approvalStatus = data.requiresApproval ? (approvalOnly ? String(input.eventData.approvalStatus) : previous?.approvalStatus === 'Approved' && fingerprint === previous.lastSaveFingerprint ? 'Approved' : 'Pending') : undefined;
    const ready = !['Draft', 'Cancelled'].includes(data.status) && (!data.requiresApproval || approvalStatus === 'Approved');
    const times = ['Cancelled'].includes(data.status) || approvalStatus === 'Rejected' ? [] : plan.times.filter(entry => new Date(`${entry.date}T${entry.time}:00+03:00`).getTime() > Date.now() + 1000);
    if (sms && ready) {
        const balance = await readSmsWalletBalance(), cost = sms.segments * times.length * 35;
        if (balance !== null && balance < cost)
            throw new Error(`SMS balance is too low. These reminders need UGX ${cost.toLocaleString()}; available balance is UGX ${balance.toLocaleString()}. Top up in Bulk SMS, then save again.`);
    }
    const grouped = new Map<string, string[]>();
    for (const message of sms?.messages || []) {
        const phones = grouped.get(message.message) || [];
        phones.push(message.phone);
        grouped.set(message.message, phones);
    }
    const messageBatches = [...grouped].flatMap(([message, phones]) => Array.from({ length: Math.ceil(phones.length / 200) }, (_, index) => ({ message, phones: phones.slice(index * 200, index * 200 + 200) })));
    const chunks = Array.from({ length: Math.ceil(messageBatches.length / 20) }, (_, index) => messageBatches.slice(index * 20, index * 20 + 20));
    const [oldSms, oldPush] = await Promise.all([db.collection('scheduledSMS').where('eventId', '==', eventId).get(), db.collection('scheduledNotifications').where('eventId', '==', eventId).get()]);
    const exam = input.exam;
    let exams: Record<string, unknown>[] = [];
    if (exam) {
        if (existingId)
            throw new Error('Edit linked exam settings from Exams.');
        if (!Permissions.canPerformAction(actor.user, 'exams', 'list', 'create_exam'))
            throw new Error('FORBIDDEN: Exam creation permission is required.');
        if (!year || !term)
            throw new Error('Choose an academic year and term for this exam.');
        const examType = EXAM_TYPES.find(item => item.id === exam.examTypeId);
        const max = Number(exam.maxMarks), pass = Number(exam.passingMarks);
        if (!examType || !['Set based', 'Subject based'].includes(String(exam.examNature)) || !Number.isFinite(max) || max <= 0 || !Number.isFinite(pass) || pass < 0 || pass > max)
            throw new Error('Check the exam type, nature and marks.');
        exams = (data.classIds || []).map(classId => {
            const subjectIds = plan.subjectsByClass[classId] || [];
            if (exam.examNature === 'Subject based' && !subjectIds.length)
                throw new Error(`Choose subjects for ${actualClasses.get(classId)?.code || classId}.`);
            return { id: `exam-${hash(`${eventId}:${classId}`)}`, name: data.title, baseName: data.title, batchId: eventId, examTypeId: examType.id, examTypeName: examType.name, examNature: exam.examNature, classId, subjectIds, academicYearId: data.academicYearId, termId: data.termId, startDate: data.startDate, endDate: data.endDate, startTime: data.isAllDay ? '' : data.startTime || '', endTime: data.isAllDay ? '' : data.endTime || '', maxMarks: max, passingMarks: pass, status: 'Scheduled', instructions: String(exam.instructions || '') };
        });
    }
    const examIds = exams.length ? exams.map(exam => String(exam.id)) : previous?.examIntegration?.examIds || [];
    const plannedEvent = { ...previous, ...data, id: eventId, createdBy: previous?.createdBy || actor.user.id, createdByName: previous?.createdByName || [actor.user.firstName, actor.user.lastName].filter(Boolean).join(' ') || actor.user.username, createdAt: previous?.createdAt || now.toISOString(), updatedAt: now.toISOString(), updatedBy: actor.user.id, communicationRevision: revision, lastSaveFingerprint: fingerprint,
        ...(approvalStatus ? { approvalStatus } : {}), ...(approvalOnly ? { approvedBy: actor.user.id, approvedAt: now.toISOString() } : {}),
        classNames: (data.classIds || []).map(classId => actualClasses.get(classId)?.code || classId), subjectIds: [...new Set(Object.values(plan.subjectsByClass).flat())], targetAudience: [plan.kind === 'staff' ? 'All Staff' : plan.kind === 'parent' ? 'All Parents' : 'All Pupils'], expectedAttendees: plan.kind === 'staff' ? audience.recipients.map(person => person.staffId!).filter(Boolean) : plan.kind === 'academic' ? audience.pupils.filter(pupil=>pupil.status==='Active'&&(data.classIds||[]).includes(pupil.classId)).map(pupil=>pupil.id) : audience.recipients.map(person => person.key), notificationsSent: previous?.notificationsSent || [], reminders: [], sendReminders: wantsMessages, isRecurringInstance: previous?.isRecurringInstance || false,
        ...(exams.length ? { isExamEvent: true, examIntegration: { examIds, examName: data.title, maxMarks: exam!.maxMarks, passingMarks: exam!.passingMarks, classIds: data.classIds }, customFields: { ...previous?.customFields, examTypeId: exam!.examTypeId, examType:EXAM_TYPES.find(type=>type.id===exam!.examTypeId)?.name||String(exam!.examTypeId), examNature: exam!.examNature, maxMarks:exam!.maxMarks, passingMarks:exam!.passingMarks, selectedClassIds:data.classIds, instructions: exam!.instructions||'', perClassSelectedSubjects: plan.subjectsByClass } } : {}) };
    const cancelled = [...oldSms.docs.map(doc => ({ doc, channel: 'sms' })), ...oldPush.docs.map(doc => ({ doc, channel: 'push' }))].filter(({ doc }) => ['scheduled', 'processing', 'held', 'draft'].includes(doc.data().status));
    const userChunks = Array.from({ length: Math.ceil(channels.pushUserIds.length / 400) }, (_, index) => channels.pushUserIds.slice(index * 400, index * 400 + 400));
    const writes = cancelled.length * 2 + chunks.length + times.length * userChunks.length * 2 + exams.length + (existingId ? examIds.length : 0) + 5;
    if (writes > 450)
        throw new Error('This event has too many reminders or recipients for one save. Reduce the number of reminder times.');
    await db.runTransaction(async (tx) => {
        const latest = await tx.get(ref);
        if (latest.data()?.lastSaveFingerprint === fingerprint)
            return;
        if (latest.exists !== snapshot.exists || JSON.stringify(latest.data()?.updatedAt) !== JSON.stringify(previous?.updatedAt))
            throw new Error('This event changed while you were editing. Reopen it before saving.');
        tx.set(ref, JSON.parse(JSON.stringify(plannedEvent)));
        cancelled.forEach(({ doc, channel }) => { tx.update(doc.ref, { status: 'cancelled', lockedAmount: 0, updatedAt: FieldValue.serverTimestamp() }); tx.set(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(channel === 'sms' ? smsQueueId(doc.id) : pushQueueId(doc.id)), { status: 'cancelled', updatedAt: FieldValue.serverTimestamp() }, { merge: true }); });
        for (const exam of exams) {
            const { id: examId, ...fields } = exam;
            tx.set(db.collection('exams').doc(String(examId)), { ...fields, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        }
        if (existingId && examIds.length)
            for (const examId of examIds)
                tx.update(db.collection('exams').doc(examId), { name: data.title, startDate: data.startDate, endDate: data.endDate, startTime: data.startTime || '', endTime: data.endTime || '', updatedAt: FieldValue.serverTimestamp() });
        const queue = (channel: 'sms' | 'push', sourceId: string, runAt: Date) => tx.set(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(channel === 'sms' ? smsQueueId(sourceId) : pushQueueId(sourceId)), { channel, sourceId, status: ready ? 'scheduled' : 'paused', dueAt: Timestamp.fromDate(runAt), leaseUntil: null, attempts: 0, createdBy: actor.user.id, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        if (chunks.length && times.length) {
            const sourceId = `event-${eventId}-${revision}`, job = db.collection('scheduledSMS').doc(sourceId), schedule = { entries: times }, next = nextSmsRunAt('dates', schedule, now)!;
            tx.set(job, { type: 'dates', channel: 'sms', eventId, eventRevision: revision, eventPersonalised: true, message: sms!.messages[0]?.message || data.title, messageTemplate: plan.message, recipients: { resolvedPhones: [...new Set(sms!.messages.map(message => message.phone))], classes: data.classIds || [], guardians: [], sections: plan.audience.sections, genders: plan.audience.genders, manualNumbers: [] }, schedule, status: ready ? 'scheduled' : 'held', estimatedSMSCount: sms!.segments * times.length, estimatedCost: sms!.segments * times.length * 35, lockedAmount: ready ? sms!.segments * times.length * 35 : 0, nextRunAt: Timestamp.fromDate(next), messageBatchCount: messageBatches.length, createdBy: actor.user.id, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
            chunks.forEach((messages, index) => tx.set(job.collection('messageChunks').doc(String(index)), { messages }));
            queue('sms', sourceId, next);
        }
        times.forEach((entry, index) => userChunks.forEach((userIds, part) => {
            const sourceId = `event-${eventId}-${revision}-${index}-${part}`, runAt = new Date(`${entry.date}T${entry.time}:00+03:00`);
            tx.set(db.collection('scheduledNotifications').doc(sourceId), { status: ready ? 'scheduled' : 'held', kind: 'event', eventId, eventRevision: revision, userIds, payload: { title: data.title, body: `${data.title}: ${data.startDate}${data.isAllDay ? '' : ` ${data.startTime}`} / ${data.location || 'School'}. ${data.description || ''}`.slice(0, 4000), url: '/events' }, runAt: Timestamp.fromDate(runAt), timezone: 'Africa/Kampala', createdBy: actor.user.id, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
            queue('push', sourceId, runAt);
        }));
        tx.set(db.collection('settings').doc('data-revisions-operational'), { events: FieldValue.increment(1) }, { merge: true });
        if (examIds.length)
            tx.set(db.collection('settings').doc('data-revisions-reference'), { exams: FieldValue.increment(1) }, { merge: true });
        tx.set(db.collection('settings').doc('school-settings'), { dataRevisions: { events: FieldValue.increment(1), ...(examIds.length ? { exams: FieldValue.increment(1) } : {}) } }, { merge: true });
    });
    return { event: plannedEvent as unknown as Event, examIds };
}
