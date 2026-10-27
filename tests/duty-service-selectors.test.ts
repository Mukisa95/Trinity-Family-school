import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dutyRotaStatus, dutyWeekAssignments, staffOnDutyToday } from '../src/lib/duty-service/selectors';
import type { DutyAssignment, DutyRota } from '../src/types/duty-service';

const rota = (changes: Partial<DutyRota> = {}): DutyRota => ({id:'rota',dutyName:'School supervision',isActive:true,startDate:'2026-10-26',endDate:'2026-11-01',academicYearId:'2026',frequency:'weekly',teamsInvolved:['staff'],allowances:{staff:0,prefects:0,pupils:0},createdAt:'',createdBy:'',...changes});
const assignment = (changes: Partial<DutyAssignment> = {}): DutyAssignment => ({id:'assignment',rotaId:'rota',memberId:'teacher',memberType:'staff',isActive:true,isSupervisor:false,startDate:'2026-10-26',endDate:'2026-11-01',createdAt:'',createdBy:'',...changes});

test('active rota status includes both boundary days and distinguishes future, ended and disabled duties', () => {
  assert.equal(dutyRotaStatus(rota(), '2026-10-26'), 'Active');
  assert.equal(dutyRotaStatus(rota(), '2026-11-01'), 'Active');
  assert.equal(dutyRotaStatus(rota(), '2026-10-25'), 'Upcoming');
  assert.equal(dutyRotaStatus(rota(), '2026-11-02'), 'Ended');
  assert.equal(dutyRotaStatus(rota({isActive:false}), '2026-10-27'), 'Inactive');
});

test('today card groups multiple duties per person and excludes pupils, inactive and out-of-date assignments', () => {
  const result = staffOnDutyToday([rota(), rota({id:'other',dutyName:'Meals'}), rota({id:'inactive',isActive:false})], [
    assignment(), assignment({id:'second',rotaId:'other',isSupervisor:true}),
    assignment({id:'pupil',memberType:'pupils'}), assignment({id:'inactive',isActive:false}),
    assignment({id:'future',startDate:'2026-10-28'}), assignment({id:'past',endDate:'2026-10-26'}),
    assignment({id:'inactive-rota',rotaId:'inactive'}), assignment({id:'deleted-rota',rotaId:'missing'}),
  ], '2026-10-27');
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].duties.map(item => item.dutyName), ['School supervision','Meals']);
  assert.equal(result[0].duties[1].isSupervisor, true);
});

test('a final-day duty remains visible throughout that school date', () => {
  assert.equal(staffOnDutyToday([rota()], [assignment()], '2026-11-01').length, 1);
  assert.equal(staffOnDutyToday([rota()], [assignment()], '2026-11-02').length, 0);
});

test('Monday-to-Sunday week includes upcoming assignments but respects rota bounds and inactive records', () => {
  const records = [assignment(), assignment({id:'sunday',startDate:'2026-11-01',endDate:'2026-11-01'}), assignment({id:'next-week',startDate:'2026-11-02',endDate:'2026-11-08'}), assignment({id:'inactive',isActive:false})];
  assert.deepEqual(dutyWeekAssignments(rota(), records, '2026-10-27').map(item => item.id), ['assignment','sunday']);
  assert.deepEqual(dutyWeekAssignments(rota(), records, '2026-11-01').map(item => item.id), ['assignment','sunday']);
  assert.deepEqual(dutyWeekAssignments(rota(), records, '2026-11-02'), []);
});
