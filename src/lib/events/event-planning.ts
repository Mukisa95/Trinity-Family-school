import type { Class, Guardian, Pupil, Staff, SystemUser } from '@/types';
import { buildFeesSMSPreview, normalizeFeesSMSPhone, type FeesSMSOptions } from '@/lib/utils/fees-sms';
export type EventKind = 'staff' | 'parent' | 'academic';
export type EventReminderTime = {
    date: string;
    time: string;
};
export type EventAudience = {
    scope: 'school' | 'filtered';
    classIds: string[];
    levels: string[];
    sections: string[];
    genders: string[];
    streamIds: string[];
    staffIds: string[];
    guardians: 'first' | 'second' | 'both';
    excludedKeys: string[];
};
export type EventPlanning = {
    version: 1;
    requestId: string;
    kind: EventKind;
    academicType: 'exam' | 'other';
    subjectsByClass: Record<string, string[]>;
    audience: EventAudience;
    push: boolean;
    sms: 'none' | 'without_account' | 'all';
    message: string;
    smsOptions: FeesSMSOptions;
    times: EventReminderTime[];
};
export type EventRecipient = {
    key: string;
    name: string;
    context: string;
    phone: string | null;
    accountIds: string[];
    pupil?: Pupil;
    guardian?: Guardian;
    staffId?: string;
};
export const emptyEventAudience = (): EventAudience => ({ scope: 'school', classIds: [], levels: [], sections: [], genders: [], streamIds: [], staffIds: [], guardians: 'both', excludedKeys: [] });
const active = (user: SystemUser) => user.isActive !== false;
export function resolveEventAudience(plan: EventPlanning, pupils: Pupil[], staff: Staff[], users: SystemUser[], classes: Class[]): EventRecipient[] {
    const accounts = users.filter(active), excluded = new Set(plan.audience.excludedKeys), a = plan.audience;
    if (plan.kind === 'staff')
        return staff.filter(person => a.staffIds.includes(person.id) && person.status !== 'inactive' && person.status !== 'suspended').map(person => ({ key: `staff:${person.id}`, name: [person.lastName, person.firstName, person.otherNames].filter(Boolean).join(' '), context: person.employeeId || '', phone: normalizeFeesSMSPhone(person.contactNumber || '') || normalizeFeesSMSPhone(person.alternativePhone || ''), accountIds: accounts.filter(user => user.role !== 'Parent' && user.staffId === person.id).map(user => user.id), staffId: person.id })).filter(person => !excluded.has(person.key));
    const result: EventRecipient[] = [];
    for (const pupil of pupils) {
        if (pupil.status !== 'Active')
            continue;
        const cls = classes.find(item => item.id === pupil.classId);
        if (a.scope === 'filtered' && (a.classIds.length && !a.classIds.includes(pupil.classId) || a.levels.length && !a.levels.includes(cls?.level || '') || a.sections.length && !a.sections.includes(pupil.section) || a.genders.length && !a.genders.includes(pupil.gender) || a.streamIds.length && !a.streamIds.includes(pupil.streamId || '')))
            continue;
        const savedGuardians = Array.isArray(pupil.guardians) ? pupil.guardians : [];
        const guardians = a.guardians === 'first' ? savedGuardians.slice(0, 1) : a.guardians === 'second' ? savedGuardians.slice(1, 2) : savedGuardians;
        for (const [index, guardian] of guardians.entries()) {
            const key = `parent:${pupil.id}:${guardian.id || `${a.guardians === 'second' ? index + 1 : index}`}`;
            if (excluded.has(key))
                continue;
            const linked = accounts.filter(user => user.role === 'Parent' && (!user.guardianId || user.guardianId === guardian.id) && (user.pupilId === pupil.id || !!pupil.familyId && user.familyId === pupil.familyId || user.id === pupil.parentAccountId));
            result.push({ key, name: [guardian.firstName, guardian.lastName].filter(Boolean).join(' ') || 'Guardian', context: `${cls?.code || pupil.classCode || pupil.classId} / ${pupil.lastName} ${pupil.firstName}`, phone: normalizeFeesSMSPhone(guardian.phone || ''), accountIds: linked.map(user => user.id), pupil, guardian });
        }
    }
    return result;
}
export function eventChannelRecipients(plan: EventPlanning, recipients: EventRecipient[]) {
    return { pushUserIds: plan.push ? [...new Set(recipients.flatMap(person => person.accountIds))] : [], smsRecipients: plan.sms === 'none' ? [] : recipients.filter(person => person.phone && (plan.sms === 'all' || !person.accountIds.length)) };
}
export function eventSmsPreview(plan: EventPlanning, recipients: EventRecipient[], classes: Class[], yearName = '', termName = '') {
    const selected = eventChannelRecipients(plan, recipients).smsRecipients;
    const pupils: Pupil[] = [], recipientGuardians: Record<string, Guardian[]> = {};
    for (const person of selected) {
        const id = person.key;
        const names = person.name.split(' ');
        const pupil = person.pupil ? { ...person.pupil, id } : { id, firstName: names.slice(1).join(' '), lastName: names[0], admissionNumber: person.context, classId: '', guardians: [], gender: '', section: '', status: 'Active', createdAt: '' } as Pupil;
        pupils.push(pupil);
        recipientGuardians[id] = [{ ...(person.guardian || { firstName: names.slice(1).join(' '), lastName: names[0] }), phone: person.phone! } as Guardian];
    }
    // Both class display fields deliberately resolve to the short code here.
    return buildFeesSMSPreview(plan.message, 'both', { pupils, classes: classes.map(cls => ({ ...cls, name: cls.code || cls.id })), pupilFeesInfo: {}, recipientGuardians, allowFees: false, yearName, termName }, plan.smsOptions);
}
export function validateEventTimes(times: EventReminderTime[], now = Date.now(), allowPast = false): string | undefined {
    if (!times.length)
        return 'Choose at least one reminder date and time.';
    if (times.length > 50)
        return 'Choose no more than 50 reminder times for one event.';
    const keys = new Set<string>();
    for (const entry of times) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time))
            return 'Choose a valid date and time for every reminder.';
        const date = new Date(`${entry.date}T${entry.time}:00+03:00`), key = `${entry.date}T${entry.time}`;
        if (!Number.isFinite(date.getTime()) || new Date(`${entry.date}T12:00:00Z`).toISOString().slice(0, 10) !== entry.date)
            return 'Choose a valid reminder date.';
        if (!allowPast && date.getTime() < now + 60000)
            return 'Reminder times must be at least one minute in the future.';
        if (date.getTime() > now + 366 * 86400000)
            return 'Reminders can be scheduled up to one year ahead.';
        if (keys.has(key))
            return 'Remove duplicate reminder times.';
        keys.add(key);
    }
}
