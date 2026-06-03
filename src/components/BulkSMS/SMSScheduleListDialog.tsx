'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  RotateCcw,
  CalendarRange,
  Loader2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  History,
  List,
  Edit2,
  Save,
  Plus,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScheduledJob {
  id: string;
  type: 'once' | 'weekly' | 'dates';
  message: string;
  recipients: { resolvedPhones?: string[]; classes?: string[]; guardians?: string[] };
  schedule: Record<string, unknown>;
  status: 'scheduled' | 'draft' | 'sent' | 'completed' | 'cancelled' | 'error';
  lockedAmount: number;
  estimatedSMSCount: number;
  estimatedCost: number;
  createdAt: string | null;
  sentAt: string | null;
  lastSentAt?: string | null;
}

interface SMSScheduleListDialogProps {
  open: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextRun(job: ScheduledJob): Date | null {
  const type = job.type as string;
  const schedule = (job.schedule ?? {}) as Record<string, unknown>;
  const now = new Date();

  // Helper to get time today as Date
  const parseTimeToday = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  if (type === 'once') {
    return new Date(schedule.dateTime as string);
  }

  if (type === 'weekly') {
    const days = (schedule.days as string[]) || [];
    const times = (schedule.times as Record<string, string>) || {};
    const startDate = schedule.startDate ? new Date(schedule.startDate as string) : null;
    const endDate = schedule.endDate ? new Date(schedule.endDate as string) : null;
    
    // Adjust dates to cover full days
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    if (endDate && now > endDate) return null;

    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };

    let earliest: Date | null = null;
    const currentDayHash = now.getDay();
    const lastSentStr = job.lastSentAt as string | undefined;
    const lastSent = lastSentStr ? new Date(lastSentStr) : null;

    for (const day of days) {
      const targetDay = dayMap[day];
      const timeStr = (times[day] || '08:00') as string;
      const targetTimeToday = parseTimeToday(timeStr);
      
      const candidate = new Date(now);
      let diff = (targetDay - currentDayHash + 7) % 7;

      // If the target day is today
      if (diff === 0) {
        // If the target time hasn't passed yet, it's today's occurrence
        if (now < targetTimeToday) {
          // Keep diff = 0
        } 
        // If the target time HAS passed
        else {
          // Check if we already sent it today
          const sentToday = lastSent && lastSent.toDateString() === now.toDateString();
          if (!sentToday && now.getTime() - targetTimeToday.getTime() < 60 * 60 * 1000) {
            const missedCandidate = new Date(targetTimeToday);
            if (!earliest || missedCandidate < earliest) earliest = missedCandidate;
            continue;
          } else {
            diff = 7;
          }
        }
      }

      candidate.setDate(candidate.getDate() + diff);
      const [h, m] = timeStr.split(':').map(Number);
      candidate.setHours(h, m, 0, 0);

      if (startDate && candidate < startDate) continue;
      if (!earliest || candidate < earliest) earliest = candidate;
    }
    return earliest;
  }

  if (type === 'dates') {
    const entries = (schedule.entries as Array<{ date: string; time: string }>) || [];
    const lastSentStr = job.lastSentAt as string | undefined;
    const lastSent = lastSentStr ? new Date(lastSentStr) : null;
    
    // We want the earliest date that is either in the future, OR in the past 1hr and not sent today
    const upcoming = entries
      .map(e => new Date(`${e.date}T${e.time || '08:00'}`))
      .filter(d => {
         if (d > now) return true; // future
         // If past, but within 1 hour and haven't sent today
         const sentToday = lastSent && lastSent.toDateString() === d.toDateString();
         if (!sentToday && now.getTime() - d.getTime() < 60 * 60 * 1000) return true;
         return false;
      })
      .sort((a, b) => a.getTime() - b.getTime());
    return upcoming[0] ?? null;
  }

  return null;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return { weeks: 0, days: 0, hours: 0, mins: 0, secs: 0 };
  const totalSecs = Math.floor(ms / 1000);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const totalHours = Math.floor(totalMins / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { weeks, days, hours, mins, secs };
}

function typeIcon(type: string) {
  if (type === 'weekly') return <RotateCcw className="h-3.5 w-3.5" />;
  if (type === 'dates') return <CalendarRange className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
}

function typeLabel(type: string) {
  if (type === 'weekly') return 'Weekly';
  if (type === 'dates') return 'Multi-Date';
  return 'Once';
}

// ─── Countdown Cell ───────────────────────────────────────────────────────────

function CountdownCell({ targetDate, onTrigger }: { targetDate: Date; onTrigger?: () => void }) {
  const [, setTick] = useState(0);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const ms = targetDate.getTime() - Date.now();

  useEffect(() => {
    if (ms <= 0 && !triggered && onTrigger) {
      setTriggered(true);
      onTrigger();
    }
  }, [ms, triggered, onTrigger]);

  const { weeks, days, hours, mins, secs } = formatCountdown(ms);

  if (ms <= 0) return <span className="text-xs text-green-600 font-semibold text-center whitespace-nowrap animate-pulse">Sending soon…</span>;

  return (
    <div className="flex items-center gap-1 text-xs font-mono">
      {weeks > 0 && <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">{weeks}w</span>}
      {(weeks > 0 || days > 0) && <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-semibold">{days}d</span>}
      <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold">{String(hours).padStart(2, '0')}h</span>
      <span className="bg-pink-100 text-pink-800 px-1.5 py-0.5 rounded font-semibold">{String(mins).padStart(2, '0')}m</span>
      <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-semibold">{String(secs).padStart(2, '0')}s</span>
    </div>
  );
}

// ─── Edit UI Helpers ──────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function JobCard({
  job,
  onCancel,
  onUpdate,
  onTriggerRefresh,
}: {
  job: ScheduledJob;
  onCancel: (id: string) => void;
  onUpdate: (id: string, newSchedule: Record<string, unknown>) => Promise<void>;
  onTriggerRefresh?: () => void;
}) {
  const nextRun = getNextRun(job);
  const recipient = job.recipients?.resolvedPhones?.length ?? 0;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTriggerSend = useCallback(() => {
    if (!isEditing) {
      fetch('/api/cron/send-scheduled-sms').catch(console.error).finally(() => {
        if (onTriggerRefresh) {
          setTimeout(onTriggerRefresh, 2500);
        }
      });
    }
  }, [isEditing, onTriggerRefresh]);

  // Edit State
  const [editOnce, setEditOnce] = useState(() => (job.schedule.dateTime as string) || '');
  const [editWeeklyDays, setEditWeeklyDays] = useState<string[]>(() => (job.schedule.days as string[]) || []);
  const [editWeeklyTimes, setEditWeeklyTimes] = useState<Record<string, string>>(() => (job.schedule.times as Record<string, string>) || {});
  const [editWeeklyStart, setEditWeeklyStart] = useState(() => (job.schedule.startDate as string) || todayStr());
  const [editWeeklyEnd, setEditWeeklyEnd] = useState(() => (job.schedule.endDate as string) || '');
  const [editDates, setEditDates] = useState<Array<{date: string, time: string}>>(() => (job.schedule.entries as Array<{date: string, time: string}>) || []);

  const handleSave = async () => {
    setSaving(true);
    try {
      let newSchedule: Record<string, unknown> = {};
      if (job.type === 'once') {
        newSchedule = { dateTime: editOnce };
      } else if (job.type === 'weekly') {
        newSchedule = { days: editWeeklyDays, times: editWeeklyTimes, startDate: editWeeklyStart, endDate: editWeeklyEnd };
      } else if (job.type === 'dates') {
        newSchedule = { entries: editDates };
      }
      await onUpdate(job.id, newSchedule);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    // reset to original
    if (job.type === 'once') setEditOnce((job.schedule.dateTime as string) || '');
    if (job.type === 'weekly') {
      setEditWeeklyDays((job.schedule.days as string[]) || []);
      setEditWeeklyTimes((job.schedule.times as Record<string, string>) || {});
      setEditWeeklyStart((job.schedule.startDate as string) || todayStr());
      setEditWeeklyEnd((job.schedule.endDate as string) || '');
    }
    if (job.type === 'dates') setEditDates((job.schedule.entries as Array<{date: string, time: string}>) || []);
    setIsEditing(false);
  };

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm transition-colors relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="outline" className="text-[10px] shrink-0 flex items-center gap-1">
            {typeIcon(job.type)} {typeLabel(job.type)}
          </Badge>
          {job.status === 'draft' && (
            <Badge variant="secondary" className="text-[10px]">Draft</Badge>
          )}
          {job.status === 'error' && (
            <Badge variant="destructive" className="text-[10px]">Error</Badge>
          )}
        </div>
        {job.lockedAmount > 0 && !isEditing && (
          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium whitespace-nowrap">
            🔒 UGX {job.lockedAmount.toLocaleString()} reserved
          </span>
        )}
      </div>

      <p className="text-sm text-gray-700 line-clamp-2">{job.message}</p>

      {!isEditing ? (
        <>
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
            <span>{recipient > 0 && `${recipient} recipients · `}{job.estimatedSMSCount} SMS · UGX {(job.estimatedCost ?? 0).toLocaleString()}</span>
            <span>Created {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '—'}</span>
          </div>

          {nextRun && (
            <div className="flex items-center gap-2 pb-1">
              <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <CountdownCell targetDate={nextRun} onTrigger={handleTriggerSend} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t">
            <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 hover:bg-blue-50" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit Time
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:bg-red-50" onClick={() => onCancel(job.id)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="bg-slate-50 border rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
          {job.type === 'once' && (
            <div className="space-y-2">
              <Label className="text-xs">New Date & Time</Label>
              <Input type="datetime-local" className="h-8 text-sm" value={editOnce} min={new Date().toISOString().slice(0, 16)} onChange={e => setEditOnce(e.target.value)} />
            </div>
          )}

          {job.type === 'weekly' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Active Days</Label>
                <div className="flex flex-wrap gap-1">
                  {DAYS_OF_WEEK.map(day => (
                    <Badge key={day} variant={editWeeklyDays.includes(day) ? 'default' : 'outline'} className="cursor-pointer text-xs py-0.5 px-2" onClick={() => setEditWeeklyDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}>
                      {day.slice(0, 3)}
                    </Badge>
                  ))}
                </div>
              </div>
              {editWeeklyDays.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Times</Label>
                  <div className="grid gap-1 max-h-32 overflow-y-auto pr-1">
                    {editWeeklyDays.map(day => (
                      <div key={day} className="flex items-center gap-2">
                        <span className="text-xs w-16">{day.slice(0, 3)}</span>
                        <Input type="time" className="h-7 text-xs" value={editWeeklyTimes[day] || '08:00'} onChange={e => setEditWeeklyTimes(prev => ({ ...prev, [day]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input type="date" className="h-7 text-xs" value={editWeeklyStart} onChange={e => setEditWeeklyStart(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">End</Label>
                  <Input type="date" className="h-7 text-xs" value={editWeeklyEnd} min={editWeeklyStart} onChange={e => setEditWeeklyEnd(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {job.type === 'dates' && (
            <div className="space-y-2">
              <Label className="text-xs">Dates & Times</Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {editDates.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input type="date" className="h-7 text-xs" value={entry.date} min={todayStr()} onChange={e => setEditDates(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                    <Input type="time" className="h-7 w-20 text-xs" value={entry.time} onChange={e => setEditDates(prev => prev.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} />
                    <button onClick={() => setEditDates(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 p-1" disabled={editDates.length === 1}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setEditDates(prev => [...prev, { date: todayStr(), time: '08:00' }])}>
                <Plus className="h-3 w-3 mr-1" /> Add Date
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs flex items-center gap-1" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({ job }: { job: ScheduledJob }) {
  const sentDate = job.sentAt ?? job.lastSentAt ?? null;
  const recipient = job.recipients?.resolvedPhones?.length ?? 0;

  return (
    <div className="bg-white border rounded-xl p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-[10px] flex items-center gap-1">
          {typeIcon(job.type)} {typeLabel(job.type)}
        </Badge>
        <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">
          <CheckCircle className="h-3 w-3 mr-1" /> Sent
        </Badge>
      </div>
      <p className="text-sm text-gray-700 line-clamp-2">{job.message}</p>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{recipient > 0 && `${recipient} recipients · `}{job.estimatedSMSCount} SMS</span>
        <span className="text-green-700 font-medium">
          Sent {sentDate ? new Date(sentDate).toLocaleString() : '—'}
        </span>
      </div>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export const SMSScheduleListDialog: React.FC<SMSScheduleListDialogProps> = ({ open, onClose }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'scheduledSMS')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : d.data().createdAt,
        sentAt: d.data().sentAt?.toDate ? d.data().sentAt.toDate().toISOString() : d.data().sentAt,
      })) as ScheduledJob[];
      
      // Sort by status, then created date
      data.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setJobs(data);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load scheduled SMS' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) fetchJobs();
  }, [open, fetchJobs]);

  async function handleCancel(id: string) {
    setCancelling(id);
    try {
      await updateDoc(doc(db, 'scheduledSMS', id), {
        status: 'cancelled'
      });
      toast({ title: 'Schedule Cancelled', description: 'The scheduled SMS has been cancelled and balance released.' });
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'cancelled' } : j));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setCancelling(null);
    }
  }

  async function handleUpdateSchedule(id: string, newSchedule: Record<string, unknown>) {
    try {
      await updateDoc(doc(db, 'scheduledSMS', id), {
        schedule: newSchedule
      });
      toast({ title: 'Schedule Updated', description: 'The time and dates for this message have been updated successfully.' });
      setJobs(prev => prev.map(j => j.id === id ? { ...j, schedule: newSchedule } : j));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update schedule';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    }
  }

  const upcoming = jobs.filter(j => ['scheduled', 'draft'].includes(j.status));
  const history = jobs.filter(j => ['sent', 'completed', 'cancelled', 'error'].includes(j.status));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5 text-blue-600" />
            Scheduled SMS
          </DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex border-b">
          <button
            onClick={() => setTab('upcoming')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'upcoming' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Upcoming
            {upcoming.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-1.5">{upcoming.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="h-4 w-4" />
            History
            {history.length > 0 && (
              <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-1.5">{history.length}</span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading schedules…
            </div>
          ) : tab === 'upcoming' ? (
            upcoming.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No scheduled SMS yet.<br />Create one and it will appear here.</p>
              </div>
            ) : (
              upcoming.map(job => (
                <div key={job.id} className={cancelling === job.id ? 'opacity-50 pointer-events-none' : ''}>
                  <JobCard job={job} onCancel={handleCancel} onUpdate={handleUpdateSchedule} onTriggerRefresh={fetchJobs} />
                </div>
              ))
            )
          ) : (
            history.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No sent history yet.</p>
              </div>
            ) : (
              history.map(job => (
                <HistoryCard key={job.id} job={job} />
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-3 flex items-center justify-between">
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Reserved balances are automatically released when sent or cancelled
          </div>
          <Button size="sm" variant="ghost" onClick={fetchJobs} className="h-7 text-xs" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SMSScheduleListDialog;
