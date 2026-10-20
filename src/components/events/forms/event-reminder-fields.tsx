"use client";
import { useRef, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import type { Class } from '@/types';
import { eventChannelRecipients, eventSmsPreview, type EventPlanning, type EventRecipient } from '@/lib/events/event-planning';
import { SMSComposer, type SMSComposerHandle } from '@/components/BulkSMS/SMSComposer';
import { SMSCustomisation } from '@/components/BulkSMS/SMSCustomisation';
import { SMSScheduleDialog } from '@/components/BulkSMS/SMSScheduleDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
const staffLabels = { guardian_name: 'Staff name' };
export function EventReminderFields({ plan, onChange, recipients, classes, yearName, termName, canPush, canSms }: {
    plan: EventPlanning;
    onChange: (value: EventPlanning) => void;
    recipients: EventRecipient[];
    classes: Class[];
    yearName: string;
    termName: string;
    canPush: boolean;
    canSms: boolean;
}) {
    const [scheduleOpen, setScheduleOpen] = useState(false), composer = useRef<SMSComposerHandle>(null);
    const channels = eventChannelRecipients(plan, recipients), preview = plan.sms !== 'none' ? eventSmsPreview(plan, recipients, classes, yearName, termName) : null;
    const active = plan.push || plan.sms !== 'none';
    const update = (patch: Partial<EventPlanning>) => onChange({ ...plan, ...patch });
    return <section className="space-y-4" aria-label="Event reminders">
    <h3 className="font-semibold">Notifications & reminders</h3>
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={plan.push} disabled={!canPush} onChange={event => update({ push: event.target.checked })} className="h-4 w-4"/><span><span className="block text-sm font-medium">Push notifications to people with accounts</span><span className="block text-xs text-muted-foreground">{canPush ? `${channels.pushUserIds.length} selected accounts. Includes their app inbox. The reminder contains the event title, date, time, location and description.` : 'Notification sending permission is required.'}</span></span></label>
    <label className="block space-y-1 text-sm"><span className="font-medium">Bulk SMS</span><select aria-label="Event SMS recipients" className="h-11 w-full rounded-xl border bg-background px-3" disabled={!canSms} value={plan.sms} onChange={event => update({ sms: event.target.value as EventPlanning['sms'] })}><option value="none">Do not send SMS</option><option value="without_account">SMS to people without accounts</option>{plan.kind !== 'staff' && <option value="all">SMS to everyone selected, including account holders</option>}</select>{!canSms && <span className="text-xs text-muted-foreground">Bulk SMS sending permission is required.</span>}</label>
    {plan.sms !== 'none' && <div className="space-y-3 rounded-2xl border bg-muted/20 p-3 sm:p-4">
      <details open><summary className="cursor-pointer text-sm font-medium">SMS recipients ({channels.smsRecipients.length})</summary><ul className="mt-2 max-h-40 overflow-auto text-xs">{channels.smsRecipients.map(person => <li key={person.key} className="flex justify-between gap-3 border-b py-2"><span>{person.name} / {person.context}</span><span>{person.phone}</span></li>)}</ul></details>
      <Label htmlFor="event-sms-message">SMS message</Label><SMSComposer ref={composer} id="event-sms-message" aria-label="Event SMS message" value={plan.message} onChange={message => update({ message })} placeholder="Write the event invitation or reminder…" fieldLabels={plan.kind === 'staff' ? staffLabels : undefined}/>
      <SMSCustomisation options={plan.smsOptions} onChange={smsOptions => update({ smsOptions })} onInsertField={field => composer.current?.insertField(field)} onInsertText={text => composer.current?.insertText(text)} allowFees={false} allowedFields={plan.kind === 'staff' ? ['guardian_name', 'term', 'year'] : ['pupil_name', 'guardian_name', 'class', 'admission_number', 'term', 'year']} fieldLabels={plan.kind === 'staff' ? staffLabels : undefined}/>
      {preview && <><p className="text-xs text-muted-foreground">{preview.messages.length} messages per reminder · {preview.segments} SMS segments · Estimated UGX {(preview.segments * Math.max(1, plan.times.length) * 35).toLocaleString()} for {plan.times.length || 1} reminder(s).</p>{!!preview.skipped.length && <p className="text-xs text-amber-700">{preview.skipped.length} contacts have no valid phone or message.</p>}{!!preview.issues.length && <ul role="alert" className="list-inside list-disc text-xs text-destructive">{preview.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}{!!preview.messages.length && <details><summary className="cursor-pointer text-xs font-medium">Preview personalised messages</summary><div className="max-h-52 space-y-2 overflow-auto pt-2">{preview.messages.slice(0, 10).map(message => <div key={message.id} className="rounded-xl border bg-background p-3 text-xs"><p className="font-semibold">{message.pupilNames.join(', ')} / {message.phone}</p><p className="mt-1 whitespace-pre-wrap">{message.message}</p></div>)}</div></details>}</>}
    </div>}
    {active && <div className="space-y-3 rounded-2xl border p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-semibold">When to send reminders</h4><p className="text-xs text-muted-foreground">East Africa time (UTC+3). Add several times on the same day or on different dates.</p></div><Button type="button" variant="outline" className="rounded-full" onClick={() => setScheduleOpen(true)}><CalendarClock className="mr-2 h-4 w-4"/>Schedule</Button></div>
      {plan.times.map((entry, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"><Input aria-label={`Reminder ${index + 1} date`} type="date" value={entry.date} onChange={event => update({ times: plan.times.map((value, i) => i === index ? { ...value, date: event.target.value } : value) })}/><Input aria-label={`Reminder ${index + 1} time`} type="time" value={entry.time} onChange={event => update({ times: plan.times.map((value, i) => i === index ? { ...value, time: event.target.value } : value) })}/><Button type="button" variant="ghost" size="icon" aria-label={`Remove reminder ${index + 1}`} onClick={() => update({ times: plan.times.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4"/></Button></div>)}
      <Button type="button" variant="ghost" size="sm" onClick={() => update({ times: [...plan.times, { date: '', time: '08:00' }] })} disabled={plan.times.length >= 50}><Plus className="mr-2 h-4 w-4"/>Add date and time</Button>
      <SMSScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} initialEntries={plan.times} onSelectSchedule={times => update({ times })} message={plan.message} recipientCount={channels.smsRecipients.length} messageCount={preview?.messages.length ? Math.ceil(preview.segments / preview.messages.length) : 0} resolvedPhones={[]} selectedClasses={plan.audience.classIds} selectedGuardians={[]} selectedSections={plan.audience.sections} selectedGenders={plan.audience.genders} manualNumbers={[]} walletBalance={null}/>
    </div>}
  </section>;
}
