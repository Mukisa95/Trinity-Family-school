"use client";

import { CheckCircle2, Clock3, UserRoundX } from 'lucide-react';
import type { AttendanceRecord, Pupil } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { summariseAttendanceClass } from '@/lib/attendance-notification';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  classId: string;
  records: AttendanceRecord[];
  pupils: Pupil[];
};

const pupilName = (pupil: Pupil | undefined, fallback: string) => {
  if (!pupil) return fallback;
  return [pupil.firstName, pupil.otherNames, pupil.lastName].filter(Boolean).join(' ') || pupil.admissionNumber || fallback;
};

export function ClassAttendanceSummaryDialog({ open, onOpenChange, date, classId, records, pupils }: Props) {
  const summary = summariseAttendanceClass(date, classId, records);
  const pupilById = new Map(pupils.map(pupil => [pupil.id, pupil]));
  const sections = [
    {
      id: 'present',
      title: 'Present',
      value: summary.present,
      icon: CheckCircle2,
      tone: 'emerald',
      records: summary.records.filter(record => record.status === 'Present' || record.status === 'Late'),
    },
    {
      id: 'absent',
      title: 'Absent',
      value: summary.absent,
      icon: UserRoundX,
      tone: 'rose',
      records: summary.records.filter(record => record.status === 'Absent' || record.status === 'Excused'),
    },
    ...(summary.delayed > 0 ? [{
      id: 'delayed',
      title: 'Delayed',
      value: summary.delayed,
      icon: Clock3,
      tone: 'amber',
      records: summary.records.filter(record => record.status === 'Delayed'),
    }] : []),
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-4 p-0">
        <DialogHeader className="rounded-t-2xl border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-5 py-5 sm:px-6">
          <DialogTitle className="text-lg text-slate-900 sm:text-xl">
            {summary.className} attendance
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            {date} · {summary.total} pupil{summary.total === 1 ? '' : 's'} recorded
          </DialogDescription>
        </DialogHeader>

        <div className={`grid gap-3 px-5 pb-5 sm:px-6 sm:pb-6 ${sections.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {sections.map(section => {
            const Icon = section.icon;
            const palette = section.tone === 'emerald'
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
              : section.tone === 'rose'
                ? 'border-rose-200 bg-rose-50/70 text-rose-700'
                : 'border-amber-200 bg-amber-50/70 text-amber-700';
            return (
              <section key={section.id} className={`min-w-0 overflow-hidden rounded-2xl border ${palette}`}>
                <div className="flex items-center justify-between border-b border-current/10 px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold">
                    <Icon className="h-4 w-4" />
                    {section.title}
                  </div>
                  <span className="text-xl font-black tabular-nums">{section.value}</span>
                </div>
                <div className="max-h-64 divide-y divide-current/10 overflow-y-auto bg-white/65">
                  {section.records.length ? section.records.map(record => (
                    <div key={record.pupilId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-700">
                      <span className="min-w-0 truncate font-medium">{pupilName(pupilById.get(record.pupilId), record.pupilId)}</span>
                      {(record.status === 'Late' || record.status === 'Excused') && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 shadow-sm">
                          {record.status}
                        </span>
                      )}
                    </div>
                  )) : (
                    <p className="px-4 py-6 text-center text-sm text-slate-500">No pupils in this group.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
