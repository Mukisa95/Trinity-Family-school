'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dutyClockingTimeError } from '@/lib/staff-clocking/duty-schedule';

export function DutyClockingFields({ arrival = '', departure = '', onChange }: { arrival?: string; departure?: string; onChange: (field: 'staffArrivalTime' | 'staffDepartureTime', value: string) => void }) {
  const error = dutyClockingTimeError(arrival, departure);
  return <fieldset className="space-y-3 rounded-2xl border border-blue-200/70 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/20"><legend className="px-1 text-sm font-semibold">Staff clocking times</legend><p className="text-xs leading-5 text-muted-foreground">Applies only to staff assigned to this rota, during their assigned dates and scheduled working days. Leave either time blank to keep their normal time. Their usual grace period still applies.</p><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="duty-staff-arrival">Duty arrival time</Label><Input id="duty-staff-arrival" type="time" value={arrival} aria-invalid={!!error} aria-describedby={error ? 'duty-clocking-error' : undefined} onChange={event => onChange('staffArrivalTime', event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="duty-staff-departure">Duty departure time</Label><Input id="duty-staff-departure" type="time" value={departure} aria-invalid={!!error} aria-describedby={error ? 'duty-clocking-error' : undefined} onChange={event => onChange('staffDepartureTime', event.target.value)} /></div></div>{error && <p id="duty-clocking-error" role="alert" className="text-xs text-destructive">{error}</p>}</fieldset>;
}
