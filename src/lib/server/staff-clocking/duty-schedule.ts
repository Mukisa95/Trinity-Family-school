import 'server-only';
import type { DocumentData, Firestore, Transaction } from 'firebase-admin/firestore';
import type { StaffClockingDutyAssignment } from '@/lib/staff-clocking/contracts';
import { dutyLocalDate } from '@/lib/staff-clocking/duty-schedule';

/** Read only this employee's assignments. The scan passes its transaction so concurrent edits retry safely. */
export async function loadStaffClockingDuties(db: Firestore, staffId: string, transaction?: Transaction): Promise<StaffClockingDutyAssignment[]> {
  const query = db.collection('dutyAssignments').where('memberId', '==', staffId);
  const snapshot = await (transaction ? transaction.get(query) : query.get());
  const assignments = snapshot.docs.filter(item => item.data().memberType === 'staff' && item.data().isActive === true);
  const rotaIds = [...new Set(assignments.map(item => item.data().rotaId).filter((id): id is string => typeof id === 'string' && id.length > 0 && !id.includes('/')))];
  const rotas = new Map((await Promise.all(rotaIds.map(id => { const ref = db.collection('dutyRotas').doc(id); return transaction ? transaction.get(ref) : ref.get(); }))).map(item => [item.id, item]));
  return projectStaffClockingDuties(assignments, new Map([...rotas].map(([id, snapshot]) => [id, snapshot.data()])));
}

/** Reuse already-loaded dashboard documents instead of rereading duties per teacher. */
export function projectStaffClockingDuties(assignments: Array<{ id: string; data(): DocumentData }>, rotas: Map<string, DocumentData | undefined>): StaffClockingDutyAssignment[] {
  const availableDate = (value: unknown) => dutyLocalDate(value) || '9999-12-31';
  return assignments.flatMap(item => {
    const assignment = item.data(), rota = rotas.get(assignment.rotaId);
    if (assignment.memberType !== 'staff' || assignment.isActive !== true) return [];
    if (!rota || rota.isActive !== true || !Array.isArray(rota.teamsInvolved) || !rota.teamsInvolved.includes('staff')) return [];
    const clockInBy = typeof rota.staffArrivalTime === 'string' ? rota.staffArrivalTime : undefined;
    const clockOutBy = typeof rota.staffDepartureTime === 'string' ? rota.staffDepartureTime : undefined;
    if (!clockInBy && !clockOutBy) return [];
    const bounds = [assignment.startDate, assignment.endDate, rota.startDate, rota.endDate].map(dutyLocalDate);
    if (bounds.some(value => !value)) return [];
    const startsOn = bounds[0]! > bounds[2]! ? bounds[0]! : bounds[2]!, endsOn = bounds[1]! < bounds[3]! ? bounds[1]! : bounds[3]!;
    if (startsOn > endsOn) return [];
    return [{ id: item.id, rotaId: assignment.rotaId, dutyName: String(rota.dutyName || 'Staff duty'), staffId: assignment.memberId, startsOn, endsOn,
      ...(clockInBy ? { clockInBy } : {}), ...(clockOutBy ? { clockOutBy } : {}),
      availableFrom: [availableDate(assignment.updatedAt || assignment.createdAt), availableDate(rota.updatedAt || rota.createdAt)].sort().at(-1)!,
    }];
  });
}
