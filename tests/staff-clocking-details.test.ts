import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStaffDetailRows, summarizeStaffDetail, detailPeriodRange, detailMonths, detailDates, departureStatus, individualCsv, detailElapsed } from '../src/lib/staff-clocking/details-report';
import type { StaffClockingDetailPlan } from '../src/lib/staff-clocking/details-contracts';

const plan: StaffClockingDetailPlan = {staffId: 'ada', groups: ['Teaching'], stableSince: '2026-10-01', schedules: [{id: 'school', scope: 'school', kind: 'recurring', weekdays: [1,2,3,4,5], clockInBy: '07:30', clockOutBy: '17:00', graceMinutes: 10, isActive: true, availableFrom: '2026-10-01'}], closures: []};

test('periods share month buckets, use Monday weeks and reject invalid or excessive ranges', () => {
  assert.deepEqual(detailPeriodRange('week', '2026-11-01'), {from:'2026-10-26', to:'2026-11-01'});
  assert.deepEqual(detailMonths({from:'2026-10-31', to:'2026-11-02'}), [{from:'2026-10-01',to:'2026-10-31'},{from:'2026-11-01',to:'2026-11-30'}]);
  assert.equal(detailDates({from:'2026-02-30', to:'2026-03-01'}).length,0);
  assert.equal(detailDates({from:'2026-01-01', to:'2027-01-02'}).length,0);
  assert.equal(detailDates({from:'2024-01-01', to:'2024-12-31'}).length,366);
  assert.deepEqual(detailPeriodRange('term', '2026-11-01', {from:'2026-09-07',to:'2026-12-04'}),{from:'2026-09-07',to:'2026-12-04'});
  assert.doesNotThrow(()=>detailPeriodRange('month',''));
});

test('historical fields never inherit current rules and unknown dates are not marked absent', () => {
  const rows=buildStaffDetailRows({from:'2026-09-29',to:'2026-10-02'}, [{id:'old', staffId:'ada', accountId:'a',localDate:'2026-09-30',status:'complete',clockInTime:'08:00',arrivalStatus:'late',clockInBy:'07:45',graceMinutes:5}], plan, '2026-10-26');
  assert.equal(rows[0].status,'unresolved');
  assert.equal(rows[1].expectedIn,'07:45'); assert.equal(rows[1].expectedOut,undefined); assert.equal(rows[1].recordedGroup,undefined);
  assert.equal(rows[2].status,'absent'); assert.equal(rows[3].status,'absent');
  const totals=summarizeStaffDetail(rows);assert.equal(totals.attended,1);assert.equal(totals.late,1);assert.equal(totals.absent,2);
});

test('saved rules, corrections, leave and departure remain distinct', () => {
  const rows=buildStaffDetailRows({from:'2026-10-19',to:'2026-10-21'},[
    {id:'one',staffId:'ada',accountId:'a',localDate:'2026-10-19',status:'complete',clockInTime:'08:00',effectiveClockInTime:'07:25',clockOutTime:'16:30',arrivalStatus:'on_time',scheduleSnapshot:{clockInBy:'07:30',clockOutBy:'17:00',graceMinutes:10,groups:['Teaching'],scope:'staff',kind:'recurring'}},
    {id:'two',staffId:'ada',accountId:'a',localDate:'2026-10-20',status:'open',reviewStatus:'exempted'},
    {id:'three',staffId:'ada',accountId:'a',localDate:'2026-10-21',status:'open',clockInTime:'08:01',arrivalStatus:'late',reviewStatus:'exempted'},
  ],plan,'2026-10-26');
  assert.equal(departureStatus(rows[0]),'early');assert.equal(rows[0].recordedGroup,'Teaching');assert.equal(rows[1].status,'exempt');assert.equal(rows[2].status,'late');
  const total=summarizeStaffDetail(rows);assert.equal(total.attended,2);assert.equal(total.exempt,1);assert.equal(total.onTime+total.grace+total.late,2);
  assert.equal(detailElapsed(rows[0].record),undefined,'Do not invent elapsed work from absent original timestamps');
});

test('individual CSV escapes formulas and quotes and omits private reasons', () => {
  const rows=buildStaffDetailRows({from:'2026-10-19',to:'2026-10-19'},[],plan,'2026-10-26');
  const csv=individualCsv('=HYPERLINK("bad")','A"1',rows);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));assert.ok(csv.includes('"A""1"'));
  assert.ok(!csv.includes('reason'));assert.ok(csv.includes('Expected out'));
});
