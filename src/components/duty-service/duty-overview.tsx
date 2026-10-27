'use client';

import { useState } from 'react';
import { Calendar, ChevronDown, Edit, Loader2, Printer, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DutyOnlineAction } from './DutyOnlineAction';
import { dutyRotaStatus, dutyWeekAssignments, staffOnDutyToday } from '@/lib/duty-service/selectors';
import type { DutyAssignment, DutyRota, TeamType } from '@/types/duty-service';

type MemberName = (id: string, type: TeamType) => string;
const shortDate = (date: string) => format(new Date(`${date.slice(0, 10)}T12:00:00`), 'd MMM');

export function StaffOnDutyCard({ rotas, assignments, date, memberName }: {
  rotas: DutyRota[]; assignments: DutyAssignment[]; date: string; memberName: MemberName;
}) {
  const people = staffOnDutyToday(rotas, assignments, date).sort((a, b) => memberName(a.memberId, 'staff').localeCompare(memberName(b.memberId, 'staff')));
  return <Card data-duty-staff-today>
    <CardHeader className="space-y-1 p-4 sm:p-6 sm:pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-base sm:text-lg"><Users className="h-5 w-5 text-brand-ink-600 dark:text-brand-ink-400" />Staff on duty today</CardTitle>
        <Badge variant="secondary">{people.length} {people.length === 1 ? 'staff member' : 'staff'}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{format(new Date(`${date}T12:00:00`), 'EEEE, d MMMM yyyy')}</p>
    </CardHeader>
    <CardContent className="p-4 pt-0 sm:px-6 sm:pb-6">
      {people.length ? <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{people.map(person => <li key={person.memberId} className="min-w-0 rounded-lg border bg-muted/30 p-3">
        <p className="break-words text-sm font-semibold">{memberName(person.memberId, 'staff')}</p>
        <ul className="mt-1 space-y-1">{person.duties.map(duty => <li key={duty.id} className="break-words text-xs leading-relaxed text-muted-foreground">
          <span>{duty.dutyName}</span>{duty.isSupervisor && <span className="font-medium"> · Supervisor</span>}
          {duty.service && <p>{duty.service}</p>}
        </li>)}</ul>
      </li>)}</ul> : <p className="text-sm text-muted-foreground">No staff are assigned to duty today.</p>}
    </CardContent>
  </Card>;
}

export function DutyRotaCard({ rota, assignments, date, memberName, onTimeline, onEdit, onDelete, onPrint, printing, deleting }: {
  rota: DutyRota; assignments: DutyAssignment[]; date: string; memberName: MemberName;
  onTimeline: () => void; onEdit: () => void; onDelete: () => void; onPrint: () => void; printing: boolean; deleting: boolean;
}) {
  const status = dutyRotaStatus(rota, date);
  // Preserve a person's collapse choice through cache refreshes.
  const [choice, setChoice] = useState<boolean>();
  const open = choice ?? status === 'Active';
  const week = dutyWeekAssignments(rota, assignments, date);
  return <Collapsible open={open} onOpenChange={setChoice} asChild>
    <Card data-duty-rota={rota.id} className="overflow-hidden">
      <CollapsibleTrigger asChild><button className="flex min-h-11 w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5" aria-label={`${open ? 'Collapse' : 'Expand'} ${rota.dutyName}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold sm:text-base">{rota.dutyName}</h3><Badge variant={status === 'Active' ? 'default' : 'secondary'}>{status}</Badge></div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground"><span className="capitalize">{rota.frequency.replace('_', ' ')}</span> · {shortDate(rota.startDate)} – {shortDate(rota.endDate)}{rota.isMarked ? ' · Academic period' : ''}</p>
        </div>
        <ChevronDown aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 text-muted-foreground ${open ? 'rotate-180' : ''}`} />
      </button></CollapsibleTrigger>
      <CollapsibleContent>
        <CardContent className="space-y-4 border-t p-4 sm:p-5">
          <div className="flex flex-wrap gap-1.5">{rota.teamsInvolved.map(team => <Badge key={team} variant="outline" className="capitalize">{team}</Badge>)}</div>
          <div><h4 className="mb-2 text-xs font-medium text-muted-foreground">This week’s assignments</h4>
            {week.length ? <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{week.map(assignment => <li key={assignment.id} className="min-w-0 rounded-lg bg-muted/40 p-3">
              <p className="break-words text-sm font-medium">{memberName(assignment.memberId, assignment.memberType)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground"><span className="capitalize">{assignment.memberType}</span>{assignment.isSupervisor ? ' · Supervisor' : ''} · {shortDate(assignment.startDate)} – {shortDate(assignment.endDate)}</p>
              {assignment.service && <p className="mt-1 break-words text-xs text-muted-foreground">{assignment.service}</p>}
            </li>)}</ul> : <p className="text-sm text-muted-foreground">No assignments this week.</p>}
          </div>
          {(rota.staffArrivalTime || rota.staffDepartureTime) && <p className="text-xs text-muted-foreground">Arrival {rota.staffArrivalTime || 'usual time'} · Departure {rota.staffDepartureTime || 'usual time'}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onTimeline} className="min-h-11 gap-2"><Calendar className="h-4 w-4" />Full schedule</Button>
            <Button variant="outline" onClick={onPrint} disabled={printing} className="min-h-11 gap-2" aria-label={`Print ${rota.dutyName}`}>{printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Print</Button>
            <DutyOnlineAction>
              <Button variant="outline" onClick={onEdit} className="h-11 w-11 p-0" aria-label={`Edit ${rota.dutyName}`}><Edit className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={onDelete} disabled={deleting} className="h-11 w-11 p-0 text-destructive" aria-label={`Delete ${rota.dutyName}`}><Trash2 className="h-4 w-4" /></Button>
            </DutyOnlineAction>
          </div>
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>;
}
