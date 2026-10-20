"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Users, UserRound, Loader2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { useStaff } from '@/lib/hooks/use-staff';
import { useAuth } from '@/lib/contexts/auth-context';
import { useAcademicYearsForEvents, useCreateExamFromEvent } from '@/lib/hooks/use-events-fixed';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import { authorizedFetch } from '@/lib/access/authorized-fetch';
import { getComputedEventStatus } from '@/lib/utils/event-status-utils';
import { EXAM_TYPES } from '@/lib/constants';
import { emptyEventAudience, eventSmsPreview, validateEventTimes, type EventKind, type EventPlanning, type EventRecipient } from '@/lib/events/event-planning';
import type { Event, CreateEventData, UpdateEventData } from '@/types';
import { EventAudienceFields } from './event-audience-fields';
import { EventReminderFields } from './event-reminder-fields';
interface Props {
    event: Event | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: CreateEventData | UpdateEventData | CreateEventData[]) => void | Promise<void>;
    onReviewSchedule?: (event: Partial<Event>) => Promise<void>;
}
const freshPlan = (): EventPlanning => ({ version: 1, requestId: crypto.randomUUID(), kind: 'academic', academicType: 'other', subjectsByClass: {}, audience: emptyEventAudience(), push: false, sms: 'none', message: 'You are invited to our school event. Please check the event details and attend on time.', smsOptions: {}, times: [] });
const selectStyle = 'h-11 w-full rounded-xl border bg-background px-3 text-sm';
export function EventForm({ event, isOpen, onClose, onSave, onReviewSchedule }: Props) {
    const { user, canPerformAction } = useAuth(), { data: classes = [] } = useClasses(), { data: subjects = [] } = useSubjects(), { data: staff = [] } = useStaff(), { data: years = [] } = useAcademicYearsForEvents();
    const current = getEffectiveTermForDataDisplay(years), examMutation = useCreateExamFromEvent();
    const [kind, setKind] = useState<EventKind | null>(null), [data, setData] = useState<Partial<Event>>({}), [plan, setPlan] = useState<EventPlanning>(freshPlan);
    const [selectSubjects, setSelectSubjects] = useState(false), [exam, setExam] = useState({ examTypeId: 'et_mid', examNature: 'Set based' as 'Set based' | 'Subject based', maxMarks: 100, passingMarks: 40, instructions: '' });
    const [saving, setSaving] = useState(false), [error, setError] = useState(''), savingRef = useRef(false), session = useRef('');
    const sessionKey = JSON.stringify([isOpen, user?.id, user?.role, user?.granularPermissions, user?.circumference]);
    session.current = sessionKey;
    useEffect(() => {
        if (!isOpen)
            return;
        const next = event?.planning ? { ...event.planning, requestId: crypto.randomUUID() } : freshPlan();
        const editKind = event?.planning?.kind || (event?.targetAudience.some(value => /parent|guardian/i.test(value)) ? 'parent' : event?.targetAudience.some(value => /staff|teacher/i.test(value)) ? 'staff' : 'academic');
        setKind(event?.id ? editKind : null);
        setPlan({ ...next, kind: editKind, academicType: event?.isExamEvent ? 'exam' : next.academicType });
        setData({ title: '', description: '', type: 'Academic', priority: 'Medium', status: 'Scheduled', startDate: '', endDate: '', startTime: '08:00', endTime: '17:00', isAllDay: false, location: '', classIds: [], subjectIds: [], academicYearId: current.academicYear?.id, termId: current.term?.id, requiresApproval: false, requiresAttendance: false, isPublic: true, colorCode: '#6366f1', recurrence: { frequency: 'None' }, ...event });
        setSelectSubjects(!!Object.keys(next.subjectsByClass).length);
        setExam({ examTypeId: EXAM_TYPES.find(type=>type.id===(event?.customFields?.examTypeId||event?.customFields?.examType)||type.name===event?.customFields?.examType)?.id || 'et_mid', examNature: event?.customFields?.examNature || 'Set based', maxMarks: event?.examIntegration?.maxMarks || 100, passingMarks: event?.examIntegration?.passingMarks || 40, instructions: event?.customFields?.instructions || '' });
        setError('');
    }, [event, isOpen]);
    useEffect(() => { if (!isOpen || data.academicYearId || !current.academicYear)
        return; setData(value => ({ ...value, academicYearId: current.academicYear!.id, termId: current.term?.id })); }, [current.academicYear?.id, isOpen, data.academicYearId]);
    useEffect(() => {
        if (!data.startDate)
            return;
        const found = years.flatMap(year => year.terms.map(term => ({ year, term }))).find(({ term }) => data.startDate! >= term.startDate.slice(0, 10) && data.startDate! <= term.endDate.slice(0, 10));
        if (found)
            setData(value => ({ ...value, academicYearId: found.year.id, termId: found.term.id }));
    }, [data.startDate, years]);
    const isExam = kind === 'academic' && plan.academicType === 'exam';
    const effectivePlan = useMemo(() => ({ ...plan, kind: kind || 'academic', subjectsByClass: selectSubjects || isExam && exam.examNature === 'Subject based' ? Object.fromEntries((data.classIds || []).map(id => [id, plan.subjectsByClass[id] || []])) : {}, audience: kind === 'academic' ? { ...plan.audience, scope: 'filtered' as const, classIds: data.classIds || [] } : plan.audience }), [plan, kind, selectSubjects, isExam, exam.examNature, data.classIds]);
    const canInvite = canPerformAction('events', 'calendar', 'invite_participants');
    const needsClass = effectivePlan.audience.scope === 'filtered' && !Object.values(effectivePlan.audience).some((value) => Array.isArray(value) && value.length);
    const previewPlan = { ...effectivePlan, audience: { ...effectivePlan.audience, excludedKeys: [] } };
    const audienceKey = JSON.stringify([previewPlan.kind, previewPlan.audience]);
    const audience = useQuery<EventRecipient[]>({ queryKey: ['event-audience', sessionKey, audienceKey], enabled: isOpen && !!kind && canInvite && !needsClass && (kind !== 'staff' || plan.audience.staffIds.length > 0), queryFn: async ({ signal }) => {
            const response = await authorizedFetch('/api/events/audience', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(previewPlan) });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error || 'The selected audience could not load.');
            return result.recipients;
        }, staleTime: 30000, retry: false });
    const recipients = (audience.data || []).filter(person => !plan.audience.excludedKeys.includes(person.key));
    const year = years.find(year => year.id === data.academicYearId), term = year?.terms.find(term => term.id === data.termId);
    const update = (patch: Partial<Event>) => { setData(value => ({ ...value, ...patch })); setError(''); };
    const chooseKind = (value: EventKind) => { setKind(value); setPlan({ ...freshPlan(), kind: value }); setSelectSubjects(false); update({ type: value === 'academic' ? 'Academic' : 'Administrative', classIds: [], subjectIds: [], isExamEvent: false }); };
    const toggleClass = (id: string) => { const ids = data.classIds || []; update({ classIds: ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] }); };
    const toggleSubject = (classId: string, id: string) => { const ids = plan.subjectsByClass[classId] || []; setPlan({ ...plan, subjectsByClass: { ...plan.subjectsByClass, [classId]: ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] } }); };
    const submit = async () => {
        if (savingRef.current)
            return;
        const messages: string[] = [];
        if (!kind)
            messages.push('Choose the event type.');
        if (!data.title?.trim())
            messages.push('Enter the event title.');
        if (!data.startDate || !data.endDate || data.endDate < data.startDate)
            messages.push('Choose the event start and end dates.');
        if (!data.isAllDay && (!data.startTime || !data.endTime || data.startDate === data.endDate && data.endTime <= data.startTime))
            messages.push('Choose an end time after the start time.');
        if (kind === 'academic' && !data.classIds?.length)
            messages.push('Choose the classes involved.');
        if (!canInvite)
            messages.push('Event invitation permission is required to select the audience.');
        if (audience.isFetching)
            messages.push('Wait for the selected recipients to finish loading.');
        if (audience.isError)
            messages.push('Load the event audience before saving.');
        if (kind !== 'academic' && !recipients.length)
            messages.push('Select at least one attendee or parent contact.');
        if ((selectSubjects || isExam && exam.examNature === 'Subject based') && (data.classIds || []).some(id => !effectivePlan.subjectsByClass[id]?.length))
            messages.push('Choose at least one subject for every selected class.');
        if (isExam && (!year || !term || exam.maxMarks <= 0 || exam.passingMarks < 0 || exam.passingMarks > exam.maxMarks))
            messages.push('Check the exam year, term and marks.');
        if (effectivePlan.push || effectivePlan.sms !== 'none') {
            const issue = validateEventTimes(effectivePlan.times, Date.now(), !!event?.id);
            if (issue)
                messages.push(issue);
        }
        if (effectivePlan.push && !recipients.some(person => person.accountIds.length))
            messages.push('No selected recipient has an active account for push notifications.');
        if (effectivePlan.sms !== 'none')
            messages.push(...eventSmsPreview(effectivePlan, recipients, classes, year?.name, term?.name).issues);
        if (messages.length) {
            setError([...new Set(messages)].join(' '));
            return;
        }
        const saved: CreateEventData = { ...data, title: data.title!.trim(), planning: effectivePlan, isExamEvent: isExam, classIds: kind === 'parent' ? plan.audience.classIds : data.classIds || [], subjectIds: [...new Set(Object.values(effectivePlan.subjectsByClass).flat())], targetAudience: [kind === 'staff' ? 'All Staff' : kind === 'parent' ? 'All Parents' : 'All Pupils'], status: data.status === 'Draft' ? 'Draft' : getComputedEventStatus(data), createdBy: user?.id || '', isRecurringInstance: false, reminders: [], sendReminders: effectivePlan.push || effectivePlan.sms !== 'none' } as CreateEventData;
        const expectedSession = sessionKey;
        savingRef.current = true;
        setSaving(true);
        setError('');
        try {
            if (isExam && !event?.id) {
                await onReviewSchedule?.(saved);
                if (session.current !== expectedSession)
                    throw new Error('Your account changed. Reopen the event form.');
                await examMutation.mutateAsync({ title: saved.title, description: saved.description, startDate: saved.startDate, endDate: saved.endDate, startTime: saved.isAllDay ? undefined : saved.startTime, endTime: saved.isAllDay ? undefined : saved.endTime, location: saved.location, academicYearId: saved.academicYearId!, termId: saved.termId!, ...exam, selectedClassIds: saved.classIds!, perClassSelectedSubjects: effectivePlan.subjectsByClass, eventSettings: saved });
                onClose();
            }
            else {
                if (session.current !== expectedSession)
                    throw new Error('Your account changed. Reopen the event form.');
                await onSave(saved);
            }
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'The event could not be saved. Your choices are still here.');
        }
        finally {
            savingRef.current = false;
            setSaving(false);
        }
    };
    const field = (label: string, control: React.ReactNode) => <label className="block space-y-1.5 text-sm"><span className="font-medium">{label}</span>{control}</label>;
    const classChoices = <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{classes.map(cls => <label key={cls.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm"><input type="checkbox" checked={data.classIds?.includes(cls.id) || false} disabled={!!event?.id && event.isExamEvent} onChange={() => toggleClass(cls.id)} className="h-4 w-4"/>{cls.code || cls.id}</label>)}</div>;
    return <Dialog open={isOpen} onOpenChange={open => { if (!open && !saving)
        onClose(); }}><DialogContent className="flex max-h-[90dvh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-3xl sm:p-0">
    <DialogHeader className="m-0 shrink-0 border-b bg-muted/30 px-4 py-4 pr-12 sm:px-6 sm:pr-14"><DialogTitle>{event?.id ? 'Edit event' : 'Create new event'}</DialogTitle><p className="text-sm text-muted-foreground">Choose the event, its audience and how to remind them.</p></DialogHeader>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-6"><fieldset disabled={saving} className="space-y-5 py-4">
      <fieldset><legend className="mb-3 text-sm font-semibold">1. What kind of event is this?</legend><div className="grid grid-cols-3 gap-2">{([{ id: 'staff', label: 'Staff event', icon: UserRound }, { id: 'parent', label: 'Parent event', icon: Users }, { id: 'academic', label: 'Academic event', icon: GraduationCap }] as const).map(option => <Button key={option.id} type="button" variant={kind === option.id ? 'default' : 'outline'} aria-pressed={kind === option.id} className="h-auto min-h-20 flex-col gap-2 rounded-2xl px-2 text-xs sm:text-sm" onClick={() => chooseKind(option.id)} disabled={!!event?.id && event.isExamEvent}><option.icon className="h-5 w-5"/>{option.label}</Button>)}</div></fieldset>
      {kind && <>
        {kind === 'academic' && <fieldset className="flex flex-wrap gap-2"><legend className="mb-2 text-sm font-semibold">Academic event type</legend>{(['exam', 'other'] as const).map(value => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm"><input type="radio" name="academic-event-type" disabled={!!event?.id && event.isExamEvent} checked={plan.academicType === value} onChange={() => { setPlan({ ...plan, academicType: value }); update({ isExamEvent: value === 'exam' }); }}/>{value === 'exam' ? 'Exam event' : 'Other academic event'}</label>)}</fieldset>}
        <section className="space-y-4 rounded-2xl border p-3 sm:p-5"><h3 className="font-semibold">2. Event details</h3>
          {field(isExam ? 'Exam name' : 'Event title', <Input id="event-title" aria-label={isExam ? 'Exam name' : 'Event title'} value={data.title || ''} onChange={event => update({ title: event.target.value })} maxLength={160}/>)}
          {field('Description', <Textarea aria-label="Event description" value={data.description || ''} onChange={event => update({ description: event.target.value })} rows={3}/>)}
          <div className="grid gap-3 sm:grid-cols-2">{field('Start date', <Input aria-label="Event start date" type="date" value={data.startDate || ''} onChange={event => update({ startDate: event.target.value, endDate: !data.endDate || data.endDate < event.target.value ? event.target.value : data.endDate })}/>)}{field('End date', <Input aria-label="Event end date" type="date" value={data.endDate || ''} min={data.startDate} onChange={event => update({ endDate: event.target.value })}/>)}</div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!!data.isAllDay} onChange={event => update({ isAllDay: event.target.checked })}/>All-day event</label>
          {!data.isAllDay && <div className="grid grid-cols-2 gap-3">{field('Start time', <Input aria-label="Event start time" type="time" value={data.startTime || ''} onChange={event => update({ startTime: event.target.value })}/>)}{field('End time', <Input aria-label="Event end time" type="time" value={data.endTime || ''} onChange={event => update({ endTime: event.target.value })}/>)}</div>}
          <p className="text-xs text-muted-foreground">All dates and times use East Africa time (UTC+3).</p>
          {field('Location', <Input aria-label="Event location" value={data.location || ''} onChange={event => update({ location: event.target.value })}/>)}
          <div className="grid grid-cols-2 gap-3">{field('Priority', <select aria-label="Event priority" className={selectStyle} value={data.priority || 'Medium'} onChange={event => update({ priority: event.target.value as Event['priority'] })}>{['Low', 'Medium', 'High', 'Urgent'].map(value => <option key={value}>{value}</option>)}</select>)}{field('Publication', <select aria-label="Event publication" className={selectStyle} value={data.status === 'Draft' ? 'Draft' : 'Scheduled'} onChange={event => update({ status: event.target.value as Event['status'] })}><option value="Scheduled">Publish to calendar</option><option value="Draft">Save as draft</option></select>)}</div>
        </section>
        {kind === 'academic' && <section className="space-y-4 rounded-2xl border p-3 sm:p-5"><h3 className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4"/>{isExam ? 'Exam settings' : 'Classes & subjects'}</h3>
          {isExam && <>
            {!!event?.id && <p className="text-xs text-muted-foreground">This event is linked to Exams. Change its class and assessment setup from the Exams component.</p>}
            <fieldset disabled={!!event?.id} className="grid gap-3 sm:grid-cols-2">
              {field('Exam type', <select aria-label="Exam type" className={selectStyle} value={exam.examTypeId} onChange={event => setExam({ ...exam, examTypeId: event.target.value })}>{EXAM_TYPES.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select>)}
              {field('Exam nature', <select aria-label="Exam nature" className={selectStyle} value={exam.examNature} onChange={event => setExam({ ...exam, examNature: event.target.value as typeof exam.examNature })}><option>Set based</option><option>Subject based</option></select>)}
              {field('Maximum marks', <Input aria-label="Maximum marks" type="number" min={1} value={exam.maxMarks} onChange={event => setExam({ ...exam, maxMarks: Number(event.target.value) })}/>)}{field('Passing marks', <Input aria-label="Passing marks" type="number" min={0} value={exam.passingMarks} onChange={event => setExam({ ...exam, passingMarks: Number(event.target.value) })}/>)}
              {field('Academic year', <select aria-label="Event academic year" className={selectStyle} value={data.academicYearId || ''} onChange={event => update({ academicYearId: event.target.value, termId: '' })}><option value="">Choose year</option>{years.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}</select>)}{field('Term', <select aria-label="Event term" className={selectStyle} value={data.termId || ''} onChange={event => update({ termId: event.target.value })}><option value="">Choose term</option>{year?.terms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}</select>)}
              <div className="sm:col-span-2">{field('Exam instructions', <Textarea aria-label="Exam instructions" value={exam.instructions} onChange={event => setExam({ ...exam, instructions: event.target.value })}/>)}</div>
            </fieldset>
          </>}
          <fieldset><legend className="mb-2 text-sm font-medium">Classes</legend>{classChoices}</fieldset>
          {!isExam && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selectSubjects} onChange={event => setSelectSubjects(event.target.checked)}/>Select subjects for each class</label>}
          {(selectSubjects || isExam && exam.examNature === 'Subject based') && (data.classIds || []).map(classId => { const cls = classes.find(item => item.id === classId), assigned = subjects.filter(subject => cls?.subjectAssignments?.some(assignment => assignment.subjectId === subject.id)); return <fieldset key={classId} disabled={!!event?.id && event.isExamEvent} className="rounded-xl border p-3"><legend className="px-1 text-sm font-semibold">{cls?.code || classId}</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{assigned.map(subject => <label key={subject.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={plan.subjectsByClass[classId]?.includes(subject.id) || false} onChange={() => toggleSubject(classId, subject.id)}/>{subject.code || subject.id}</label>)}</div>{!assigned.length && <p className="text-xs text-muted-foreground">No subjects assigned to this class. Assign them in Classes first.</p>}</fieldset>; })}
        </section>}
        <div className="rounded-2xl border p-3 sm:p-5"><EventAudienceFields plan={effectivePlan} onChange={setPlan} classes={classes} staff={staff} recipients={audience.data || []} loading={audience.isFetching} error={audience.error instanceof Error ? audience.error.message : !canInvite ? 'Event invitation permission is required.' : ''} retry={() => void audience.refetch()}/></div>
        <section className="space-y-3 rounded-2xl border p-3 sm:p-5"><h3 className="font-semibold">Event options</h3><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!!data.requiresApproval} onChange={event => update({ requiresApproval: event.target.checked })}/>Requires approval</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!!data.requiresAttendance} onChange={event => update({ requiresAttendance: event.target.checked })}/>Track attendance</label>{data.requiresApproval && <p className="text-xs text-muted-foreground">Reminders wait for approval. Times that pass before approval are skipped.</p>}</section>
        <div className="rounded-2xl border p-3 sm:p-5"><EventReminderFields plan={effectivePlan} onChange={setPlan} recipients={recipients} classes={classes} yearName={year?.name || ''} termName={term?.name || ''} canPush={canPerformAction('events', 'calendar', 'send_reminders') && canPerformAction('notifications', 'list', 'send_notification')} canSms={canPerformAction('events', 'calendar', 'send_reminders') && canPerformAction('bulk_sms', 'send', 'send_sms')}/></div>
      </>}
      {error && <p role="alert" className="rounded-xl border border-destructive bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    </fieldset></div>
    <DialogFooter className="m-0 shrink-0 border-t bg-background px-4 py-3 sm:px-6"><Button type="button" variant="outline" className="rounded-full" onClick={onClose} disabled={saving}>Cancel</Button><Button type="button" className="rounded-full" onClick={() => void submit()} disabled={!kind || saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}{saving ? 'Saving…' : event?.id ? 'Save changes' : isExam ? 'Create exam & event' : 'Create event'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
