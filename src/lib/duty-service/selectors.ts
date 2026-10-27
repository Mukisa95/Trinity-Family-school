import type { DutyAssignment, DutyRota } from '@/types/duty-service';

export function dutyRotaStatus(rota: DutyRota, date: string) {
  if (!rota.isActive) return 'Inactive';
  if (date < rota.startDate.slice(0, 10)) return 'Upcoming';
  if (date > rota.endDate.slice(0, 10)) return 'Ended';
  return 'Active';
}

/** Date-only comparisons include the whole final school day. */
export function staffOnDutyToday(rotas: DutyRota[], assignments: DutyAssignment[], date: string) {
  const current = new Map(rotas.filter(rota => dutyRotaStatus(rota, date) === 'Active').map(rota => [rota.id, rota]));
  const people = new Map<string, Array<DutyAssignment & { dutyName: string }>>();
  for (const assignment of assignments) {
    const rota = current.get(assignment.rotaId);
    if (!rota || !assignment.isActive || assignment.memberType !== 'staff'
      || assignment.startDate.slice(0, 10) > date || assignment.endDate.slice(0, 10) < date) continue;
    const duties = people.get(assignment.memberId) || [];
    duties.push({ ...assignment, dutyName: rota.dutyName });
    people.set(assignment.memberId, duties);
  }
  return [...people].map(([memberId, duties]) => ({ memberId, duties }));
}

export function dutyWeekAssignments(rota: DutyRota, assignments: DutyAssignment[], date: string) {
  const monday = new Date(`${date}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const start = [monday.toISOString().slice(0, 10), rota.startDate.slice(0, 10)].sort()[1];
  const end = [sunday.toISOString().slice(0, 10), rota.endDate.slice(0, 10)].sort()[0];
  if (start > end) return [];
  return assignments.filter(item => item.rotaId === rota.id && item.isActive
    && item.startDate.slice(0, 10) <= end && item.endDate.slice(0, 10) >= start);
}
