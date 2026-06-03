'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  Clock,
  CalendarRange,
  Plus,
  X,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';

// ─── Types ───────────────────────────────────────────────────────────────────

type ScheduleType = 'once' | 'weekly' | 'dates';

interface ScheduleEntry { date: string; time: string; }

interface WeeklySchedule {
  days: string[];
  times: Record<string, string>;
  startDate: string;
  endDate: string;
}

interface OnceSchedule {
  dateTime: string;        // ISO local datetime string
}

interface MultiDatesSchedule {
  entries: ScheduleEntry[];
}

type ScheduleConfig = OnceSchedule | WeeklySchedule | MultiDatesSchedule;

export interface ScheduleJobPayload {
  type: ScheduleType;
  message: string;
  recipients: {
    classes: string[];
    guardians: string[];
    sections: string[];
    genders: string[];
    manualNumbers: string[];
    resolvedPhones: string[];
  };
  schedule: ScheduleConfig;
  estimatedSMSCount: number;
  estimatedCost: number;
}

interface SMSScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  message: string;
  recipientCount: number;
  messageCount: number;
  resolvedPhones: string[];
  selectedClasses: string[];
  selectedGuardians: string[];
  selectedSections: string[];
  selectedGenders: string[];
  manualNumbers: string[];
  walletBalance: string | null;
  pricePerSMS?: number;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function toLocalDateTimeInput(dateStr: string) {
  // Converts YYYY-MM-DD to YYYY-MM-DDTHH:MM
  return `${dateStr}T08:00`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SMSScheduleDialog: React.FC<SMSScheduleDialogProps> = ({
  open,
  onClose,
  message,
  recipientCount,
  messageCount,
  resolvedPhones,
  selectedClasses,
  selectedGuardians,
  selectedSections,
  selectedGenders,
  manualNumbers,
  walletBalance,
  pricePerSMS = 35,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();

  // Step: 1 = pick type, 2 = configure, 3 = confirm
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scheduleType, setScheduleType] = useState<ScheduleType>('once');
  const [loading, setLoading] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);

  // Once
  const [onceDateTime, setOnceDateTime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });

  // Weekly
  const [weeklyDays, setWeeklyDays] = useState<string[]>([]);
  const [weeklyTimes, setWeeklyTimes] = useState<Record<string, string>>({});
  const [weeklyStart, setWeeklyStart] = useState(todayStr());
  const [weeklyEnd, setWeeklyEnd] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });

  // Multi-dates
  const [dateEntries, setDateEntries] = useState<ScheduleEntry[]>([
    { date: todayStr(), time: '08:00' },
  ]);

  // ─── Computed cost ─────────────────────────────────────────────────────────

  const totalSMSPerSend = recipientCount * messageCount;
  const costPerSend = totalSMSPerSend * pricePerSMS;

  const occurrenceCount = useMemo(() => {
    if (scheduleType === 'once') return 1;
    if (scheduleType === 'dates') return dateEntries.length;
    if (scheduleType === 'weekly') {
      if (!weeklyStart || !weeklyEnd || weeklyDays.length === 0) return 0;
      const start = new Date(weeklyStart);
      const end = new Date(weeklyEnd);
      let count = 0;
      const cur = new Date(start);
      const dayMap: Record<string, number> = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6,
      };
      while (cur <= end) {
        const dayName = Object.entries(dayMap).find(([, n]) => n === cur.getDay())?.[0];
        if (dayName && weeklyDays.includes(dayName)) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    }
    return 0;
  }, [scheduleType, dateEntries, weeklyDays, weeklyStart, weeklyEnd]);

  const totalCost = costPerSend * occurrenceCount;
  const balanceNum = walletBalance ? parseFloat(walletBalance) : null;
  const canAfford = balanceNum !== null ? balanceNum >= totalCost : null;

  // ─── Schedule config ───────────────────────────────────────────────────────

  function buildSchedule(): ScheduleConfig {
    if (scheduleType === 'once') return { dateTime: onceDateTime };
    if (scheduleType === 'weekly') return { days: weeklyDays, times: weeklyTimes, startDate: weeklyStart, endDate: weeklyEnd };
    return { entries: dateEntries };
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function submitSchedule(saveDraft: boolean) {
    setLoading(true);
    try {
      const status = saveDraft ? 'draft' : (canAfford ? 'scheduled' : 'draft');
      const lockedAmount = status === 'scheduled' ? totalCost : 0;

      const payload = {
        type: scheduleType,
        message,
        recipients: {
          classes: selectedClasses,
          guardians: selectedGuardians,
          sections: selectedSections,
          genders: selectedGenders,
          manualNumbers,
          resolvedPhones,
        },
        schedule: buildSchedule(),
        estimatedSMSCount: totalSMSPerSend * occurrenceCount,
        estimatedCost: totalCost,
        status,
        lockedAmount,
        createdAt: serverTimestamp(),
        sentAt: null,
        schoolId: (user as any)?.schoolId || 'unknown',
        createdBy: user?.id || 'unknown',
      };

      await addDoc(collection(db, 'scheduledSMS'), payload);

      toast({
        title: saveDraft ? 'Saved as Draft' : '✅ SMS Scheduled',
        description: saveDraft
          ? 'The SMS has been saved as a draft. Activate it from the Schedule List when you have enough balance.'
          : `Your SMS is scheduled for ${occurrenceCount} occurrence${occurrenceCount > 1 ? 's' : ''}. UGX ${totalCost.toLocaleString()} has been reserved.`,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setLoading(false);
      setInsufficientOpen(false);
    }
  }

  function handleConfirm() {
    if (canAfford === false) {
      setInsufficientOpen(true);
    } else {
      submitSchedule(false);
    }
  }

  // ─── Step validation ───────────────────────────────────────────────────────

  function canProceedToStep3() {
    if (scheduleType === 'once') return !!onceDateTime;
    if (scheduleType === 'weekly') return weeklyDays.length > 0 && !!weeklyStart && !!weeklyEnd;
    return dateEntries.length > 0 && dateEntries.every(e => !!e.date);
  }

  const resetState = () => {
    setStep(1);
    setScheduleType('once');
    setInsufficientOpen(false);
  };

  // ─── UI ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { resetState(); onClose(); } }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Schedule SMS
            <Badge variant="outline" className="ml-auto text-xs">
              Step {step} of 3
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Pick type ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">How would you like to schedule this message?</p>
            <div className="grid gap-3">
              {([
                { id: 'once', icon: Clock, label: 'Once', desc: 'Send on a single specific date & time' },
                { id: 'weekly', icon: RotateCcw, label: 'Weekly (Recurring)', desc: 'Repeat on selected days for a date range' },
                { id: 'dates', icon: CalendarRange, label: 'Multiple Specific Dates', desc: 'Choose different dates at will with individual times' },
              ] as const).map(({ id, icon: Icon, label, desc }) => (
                <button
                  key={id}
                  onClick={() => setScheduleType(id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    scheduleType === id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`p-2 rounded-full ${scheduleType === id ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <Icon className={`h-5 w-5 ${scheduleType === id ? 'text-blue-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{label}</div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </div>
                  {scheduleType === id && <CheckCircle className="ml-auto h-5 w-5 text-blue-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} className="flex items-center gap-2">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Configure schedule ───────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            {/* ─ Once ─ */}
            {scheduleType === 'once' && (
              <div className="space-y-3">
                <Label>Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={onceDateTime}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={e => setOnceDateTime(e.target.value)}
                />
              </div>
            )}

            {/* ─ Weekly ─ */}
            {scheduleType === 'weekly' && (
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Select Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <Badge
                        key={day}
                        variant={weeklyDays.includes(day) ? 'default' : 'outline'}
                        className="cursor-pointer hover:opacity-80 transition-opacity py-1.5 px-3"
                        onClick={() => {
                          setWeeklyDays(prev =>
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          );
                        }}
                      >
                        {day.slice(0, 3)}
                      </Badge>
                    ))}
                  </div>
                </div>

                {weeklyDays.length > 0 && (
                  <div className="space-y-2">
                    <Label>Time for Each Day</Label>
                    {weeklyDays.map(day => (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-sm w-20 font-medium">{day}</span>
                        <Input
                          type="time"
                          className="h-8 w-32"
                          value={weeklyTimes[day] || '08:00'}
                          onChange={e => setWeeklyTimes(prev => ({ ...prev, [day]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1 block">Start Date</Label>
                    <Input type="date" value={weeklyStart} min={todayStr()} onChange={e => setWeeklyStart(e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-1 block">End Date</Label>
                    <Input type="date" value={weeklyEnd} min={weeklyStart} onChange={e => setWeeklyEnd(e.target.value)} />
                  </div>
                </div>

                {occurrenceCount > 0 && (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded px-3 py-2">
                    This schedule will send the message <strong>{occurrenceCount} times</strong> between {weeklyStart} and {weeklyEnd}.
                  </p>
                )}
              </div>
            )}

            {/* ─ Multiple Date ─ */}
            {scheduleType === 'dates' && (
              <div className="space-y-3">
                <Label>Add Dates & Times</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {dateEntries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="date"
                        className="h-8 flex-1"
                        value={entry.date}
                        min={todayStr()}
                        onChange={e => setDateEntries(prev =>
                          prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x)
                        )}
                      />
                      <Input
                        type="time"
                        className="h-8 w-28"
                        value={entry.time}
                        onChange={e => setDateEntries(prev =>
                          prev.map((x, j) => j === i ? { ...x, time: e.target.value } : x)
                        )}
                      />
                      <button
                        onClick={() => setDateEntries(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        disabled={dateEntries.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setDateEntries(prev => [...prev, { date: todayStr(), time: '08:00' }])}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Date
                </Button>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedToStep3()} className="flex items-center gap-2">
                Review <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="bg-gray-50 rounded-xl border p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">Schedule Summary</div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded border p-2">
                  <div className="text-xs text-gray-500">Recipients / Send</div>
                  <div className="font-bold text-gray-800">{recipientCount.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded border p-2">
                  <div className="text-xs text-gray-500">SMS per Send</div>
                  <div className="font-bold text-blue-700">{totalSMSPerSend.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded border p-2">
                  <div className="text-xs text-gray-500">Occurrences</div>
                  <div className="font-bold text-purple-700">{occurrenceCount}</div>
                </div>
                <div className="bg-white rounded border p-2">
                  <div className="text-xs text-gray-500">Cost / Send</div>
                  <div className="font-bold text-orange-600">UGX {costPerSend.toLocaleString()}</div>
                </div>
              </div>

              {/* Total Cost vs Balance */}
              <div className={`grid grid-cols-2 gap-2 rounded-lg p-3 border ${canAfford === false ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div>
                  <div className="text-xs text-gray-500 font-medium">Total Cost</div>
                  <div className={`text-xl font-bold ${canAfford === false ? 'text-red-700' : 'text-blue-700'}`}>
                    UGX {totalCost.toLocaleString()}
                  </div>
                </div>
                <div className="text-right border-l pl-2">
                  <div className="text-xs text-gray-500 font-medium">Your Balance</div>
                  <div className={`text-xl font-bold ${canAfford === false ? 'text-red-600' : 'text-green-600'}`}>
                    {balanceNum !== null ? `UGX ${balanceNum.toLocaleString()}` : '---'}
                  </div>
                </div>
              </div>

              {canAfford === false && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700">
                    You need <strong>UGX {(totalCost - (balanceNum ?? 0)).toLocaleString()}</strong> more to schedule this fully. 
                    You can top up, save as draft, or cancel.
                  </div>
                </div>
              )}

              {canAfford && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded p-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  Balance is sufficient. UGX {totalCost.toLocaleString()} will be reserved when you confirm.
                </div>
              )}
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                {canAfford === false && (
                  <Button variant="outline" size="sm" className="flex items-center gap-2 text-amber-700 border-amber-300"
                    onClick={() => submitSchedule(true)} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Draft
                  </Button>
                )}
                <Button onClick={handleConfirm} disabled={loading} className="flex items-center gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  {canAfford === false ? 'Top Up & Schedule' : 'Confirm Schedule'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Insufficient balance inline prompt (shown on confirm click) ─ */}
        {insufficientOpen && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Not enough balance. What would you like to do?
            </p>
            <div className="flex flex-col gap-2">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { setInsufficientOpen(false); window.open('https://wizasms.ug/dashboard', '_blank'); }}
              >
                Top Up on Wiza Dashboard
              </Button>
              <Button
                variant="outline"
                className="border-amber-300 text-amber-700"
                onClick={() => submitSchedule(true)}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BookOpen className="h-4 w-4 mr-2" />}
                Save as Draft
              </Button>
              <Button variant="ghost" onClick={() => setInsufficientOpen(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SMSScheduleDialog;
