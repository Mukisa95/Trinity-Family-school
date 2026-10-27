import 'server-only';
import { FieldValue, Timestamp, type Firestore, type DocumentReference } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AuthenticatedAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService as Permissions } from '@/lib/services/granular-permissions.service';
import { dutyClockingTimeError, dutyLocalDate } from '@/lib/staff-clocking/duty-schedule';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
const date = z.string().refine(value => !!dutyLocalDate(value), 'Choose a valid duty date.');
const team = z.enum(['staff', 'prefects', 'pupils']);
const rotaSchema = z.object({ dutyName: z.string().trim().min(1).max(200), teamsInvolved: z.array(team).min(1).max(3), frequency: z.enum(['one_time','daily','weekly','monthly','termly','yearly']), startDate: date, endDate: date,
  allowances: z.object({staff:z.number().nonnegative(),prefects:z.number().nonnegative(),pupils:z.number().nonnegative()}), isActive: z.boolean(), academicYearId: id, termId: z.union([id,z.literal('')]).optional(), isMarked: z.boolean().optional(), staffArrivalTime: z.string().optional(), staffDepartureTime: z.string().optional() }).strict();
const assignmentSchema = z.object({ rotaId: id, memberId: id, memberType: team, startDate: date, endDate: date, isSupervisor: z.boolean(), isActive: z.boolean(), performanceRating: z.number().finite().optional(), notes:z.string().max(5000).optional(), service:z.string().max(5000).optional() }).strict();
const requestSchema = z.discriminatedUnion('operation', [
  z.object({operation:z.literal('create_rota'),data:rotaSchema}), z.object({operation:z.literal('update_rota'),id,data:rotaSchema.partial()}), z.object({operation:z.literal('delete_rota'),id}),
  z.object({operation:z.literal('create_assignments'),assignments:z.array(assignmentSchema).min(1).max(450)}), z.object({operation:z.literal('update_assignment'),id,data:assignmentSchema.partial()}), z.object({operation:z.literal('delete_assignment'),id}),
]);
const rotaFields = ['dutyName','teamsInvolved','isActive','startDate','endDate','staffArrivalTime','staffDepartureTime'];
const assignmentFields = ['rotaId','memberId','memberType','startDate','endDate','isActive'];
const changed = (before: Record<string,unknown>, after: Record<string,unknown>, fields: string[]) => fields.some(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
const timed = (value: Record<string,any>) => Array.isArray(value.teamsInvolved) && value.teamsInvolved.includes('staff') && !!(value.staffArrivalTime || value.staffDepartureTime);
function validateRota(value: Record<string,any>) {
  rotaSchema.parse(value);
  if (dutyLocalDate(value.startDate)! > dutyLocalDate(value.endDate)!) throw new Error('Duty end date must follow its start date.');
  const error = dutyClockingTimeError(value.staffArrivalTime, value.staffDepartureTime);
  if (error) throw new Error(error);
}

/** Duty records are attendance inputs: authorize their writes on the server and publish one atomic revision. */
export async function manageClockingDutySource(db: Firestore, actor: AuthenticatedAppUser, input: unknown) {
  const request = requestSchema.parse(input);
  const action = request.operation === 'create_rota' || request.operation === 'create_assignments' ? 'assign_duties' : 'edit_assignments';
  if (actor.user.isActive === false || !Permissions.canPerformAction(actor.user, 'duty_service', 'list', action)) throw new Error('PERMISSION_DENIED');
  const rotaOperation = request.operation.endsWith('_rota');
  const collection = db.collection(rotaOperation ? 'dutyRotas' : 'dutyAssignments');
  const actorName = actor.user.username || actor.user.id;
  const now = Timestamp.now();
  // IDs stay stable across Firestore transaction retries.
  const newRefs = request.operation === 'create_assignments' ? request.assignments.map(() => collection.doc()) : request.operation === 'create_rota' ? [collection.doc()] : [];
  return db.runTransaction(async transaction => {
    const pending: Array<{ref: DocumentReference; data?: Record<string,any>; remove?: boolean}> = [];
    let affectsClocking = false;
    if (request.operation === 'create_rota') {
      validateRota(request.data);
      pending.push({ref:newRefs[0],data:{...request.data,createdAt:now,createdBy:actor.user.id}});
      affectsClocking = timed(request.data);
    } else if (request.operation === 'create_assignments') {
      const rotaIds = [...new Set(request.assignments.map(item => item.rotaId))];
      const rotas = new Map((await Promise.all(rotaIds.map(key => transaction.get(db.collection('dutyRotas').doc(key))))).map(item => [item.id,item.data()]));
      const members = new Map((await Promise.all([...new Set(request.assignments.map(item => `${item.memberType === 'staff' ? 'staff' : 'pupils'}/${item.memberId}`))].map(path => transaction.get(db.doc(path))))).map(item => [item.ref.path,item]));
      request.assignments.forEach((item,index) => {
        const rota = rotas.get(item.rotaId);
        const member = members.get(`${item.memberType === 'staff' ? 'staff' : 'pupils'}/${item.memberId}`);
        if (!rota || rota.isActive !== true || !rota.teamsInvolved?.includes(item.memberType)) throw new Error('Choose an active rota that includes this team.');
        if (!member?.exists || item.memberType === 'staff' && String(member.data()?.status || 'active').toLowerCase() !== 'active') throw new Error('Choose an active duty member.');
        if (dutyLocalDate(item.startDate)! > dutyLocalDate(item.endDate)! || dutyLocalDate(item.endDate)! < dutyLocalDate(rota.startDate)! || dutyLocalDate(item.startDate)! > dutyLocalDate(rota.endDate)!) throw new Error('Duty assignment dates must overlap the rota dates.');
        pending.push({ref:newRefs[index],data:{...item,createdAt:now,createdBy:actor.user.id}});
        affectsClocking ||= item.memberType === 'staff' && timed(rota);
      });
    } else {
      const ref = collection.doc(request.id), snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error('The duty record no longer exists.');
      const before = snapshot.data()!;
      const remove = request.operation === 'delete_rota' || request.operation === 'delete_assignment';
      const data = 'data' in request ? request.data : {};
      const next: Record<string,any> = {...before,...data};
      if (!remove && rotaOperation) {
        // Validate editable fields only; older documents may contain audit metadata.
        validateRota(Object.fromEntries(Object.keys(rotaSchema.shape).filter(key => next[key] !== undefined).map(key => [key,next[key]])));
      } else if (!remove) {
        const parsed = assignmentSchema.parse(Object.fromEntries(Object.keys(assignmentSchema.shape).filter(key => next[key] !== undefined).map(key => [key,next[key]])));
        const [rota,member] = await Promise.all([transaction.get(db.collection('dutyRotas').doc(parsed.rotaId)),transaction.get(db.collection(parsed.memberType === 'staff' ? 'staff' : 'pupils').doc(parsed.memberId))]);
        if (!rota.exists || !rota.data()?.teamsInvolved?.includes(parsed.memberType) || !member.exists) throw new Error('Choose a valid duty rota and member.');
        if (dutyLocalDate(parsed.startDate)! > dutyLocalDate(parsed.endDate)!) throw new Error('Duty end date must follow its start date.');
      }
      pending.push({ref,remove,data:remove?undefined:{...next,updatedAt:now}});
      affectsClocking = rotaOperation ? (timed(before) || timed(next)) && (remove || changed(before,next,rotaFields)) : (before.memberType === 'staff' || next.memberType === 'staff') && (remove || changed(before,next,assignmentFields));
    }
    pending.forEach(item => item.remove ? transaction.delete(item.ref) : transaction.set(item.ref,item.data!));
    if (affectsClocking) transaction.set(db.collection('settings').doc('data-revisions-operational'),{staffClockingDuty:FieldValue.increment(1)},{merge:true});
    transaction.set(db.collection('historyLogs').doc(),{a:'duty_change',e:rotaOperation?'duty_rota':'duty_assignment',rid:pending[0].ref.id,rl:request.operation,uid:actor.user.id,un:actorName,m:{count:pending.length,affectsClocking},ts:now});
    return {id:pending[0].ref.id,ids:pending.map(item => item.ref.id)};
  });
}
