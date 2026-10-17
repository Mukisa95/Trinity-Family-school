import assert from 'node:assert/strict';
import test from 'node:test';
import { agendaEvents, readAgendaPreferences, schoolClock, trackedLesson, trackingOptions } from '../src/lib/pwa/agenda';
import type { AndroidOfflineSession, AndroidOfflineSnapshot } from '../src/lib/offline/android-contracts';
import { schoolWebAppManifest } from '../src/lib/pwa/manifest';
import { NextRequest } from 'next/server';
import { GET as getManifest } from '../src/app/api/pwa/manifest/route';

const session = { schema: 1, accountId: 'fixture', role: 'Admin', timeZone: 'Africa/Kampala', grants: { timetable: true, events: true } } as AndroidOfflineSession;
const now = new Date('2026-10-19T05:45:00Z'); // Monday 08:45 at school
const snapshot = {
  schema: 1, accountId: 'fixture', role: 'Admin', capturedAt: now.toISOString(), datasets: {
    academicYears: { data: [{ id: 'year', isActive: true, terms: [{ id: 'term', isCurrent: true, startDate: '2026-09-01', endDate: '2026-12-01' }] }] },
    classes: { data: [{ id: 'p4', code: 'P4', streams: [{ id: 'east', code: 'E' }] }, { id: 'p5', code: 'P5' }] },
    subjects: { data: [{ id: 'math', code: 'MTC' }, { id: 'eng', code: 'ENG' }] },
    timetables: { data: [{ profile: { id: 'table', academicYearId: 'year', termId: 'term' }, complete: true,
      periods: [{ id: 'one', dayOfWeek: 1, startTime: '08:00', endTime: '08:40', type: 'lesson' }, { id: 'two', dayOfWeek: 1, startTime: '08:40', endTime: '09:20', type: 'lesson' }, { id: 'three', dayOfWeek: 1, startTime: '10:00', endTime: '10:40', type: 'lesson' }],
      entries: [{ id: 'double', classId: 'p4', streamId: 'east', subjectId: 'math', optionalSubjectId: 'eng', periodId: 'one', periodSpan: 2 }, { id: 'next', classId: 'p4', streamId: 'east', subjectId: 'math', periodId: 'three' }, { id: 'other', classId: 'p5', subjectId: 'eng', periodId: 'three' }],
    }] },
  },
} as unknown as AndroidOfflineSnapshot;

test('tracking includes optional subjects and distinct classes/streams without teachers', () => {
  const options = trackingOptions(snapshot, now);
  assert.deepEqual(options.map(item => [item.classCode, item.subjectCode]), [['P4 E', 'ENG'], ['P4 E', 'MTC'], ['P5', 'ENG']]);
  assert.equal(options.length, new Set(options.map(item => item.key)).size);
  assert.ok(options.every(item => !('teacher' in item)));
});

test('active double lesson lasts through its second period, then shows next today', () => {
  const option = trackingOptions(snapshot, now).find(item => item.subjectId === 'math')!;
  assert.deepEqual(trackedLesson(snapshot, option, session, now), { status: 'Now', start: '08:00', end: '09:20' });
  assert.deepEqual(trackedLesson(snapshot, option, session, new Date('2026-10-19T06:20:00Z')), { status: 'Next', start: '10:00', end: '10:40' });
  assert.deepEqual(trackedLesson(snapshot, option, session, new Date('2026-10-19T07:40:00Z')), { status: 'Done today' });
  assert.deepEqual(trackedLesson(snapshot, option, session, new Date('2026-10-20T05:00:00Z')), { status: 'No lesson today' });
});

test('incomplete and out-of-term data cannot become a false no-lesson state', () => {
  const option = trackingOptions(snapshot, now)[0];
  const partial = structuredClone(snapshot); partial.datasets.timetables!.data[0].complete = false;
  assert.equal(trackedLesson(partial, option, session, now).status, 'Timetable not fully saved');
  assert.equal(trackedLesson(snapshot, option, session, new Date('2027-01-04T06:00:00Z')).status, 'Outside this school term');
});

test('clock uses school day even when UTC or the phone has a different date', () => {
  assert.deepEqual(schoolClock('Africa/Kampala', new Date('2026-10-18T22:30:00Z')), { date: '2026-10-19', time: '01:30', day: 1 });
});

test('smart event begins tomorrow and remains through its end; hidden/draft/expired events stay out', () => {
  const events = structuredClone(snapshot);
  const create = (id: string, start: string, end = start, fields = {}) => ({ id, title: id, startDate: start, endDate: end, isAllDay: true, status: 'Scheduled', ...fields });
  events.datasets.events = { preparedAt: now.toISOString(), data: [
    create('tomorrow', '2026-10-20', '2026-10-22'), create('future', '2026-10-23'), create('past', '2026-10-18'),
    create('draft', '2026-10-20', undefined, { status: 'Draft' }), create('pending', '2026-10-20', undefined, { requiresApproval: true, approvalStatus: 'Pending' }),
    create('cancelled', '2026-10-20', undefined, { status: 'Cancelled' }), create('invalid', 'bad'),
  ] as never };
  assert.deepEqual(agendaEvents(events, session, false, now).map(item => item.id), ['tomorrow']);
  assert.deepEqual(agendaEvents(events, session, true, now).map(item => item.id), ['tomorrow', 'future']);
  assert.deepEqual(agendaEvents(events, session, false, new Date('2026-10-21T07:00:00Z')).map(item => item.id), ['tomorrow']);
  assert.equal(agendaEvents(events, session, false, new Date('2026-10-23T21:00:00Z')).some(item => item.id === 'tomorrow'), false);
});

test('saved preferences reject malformed lists and retain a usable custom order', () => {
  assert.deepEqual(readAgendaPreferences({ tracked: ['a', 'a', 3], order: ['events', 'events', 'bad'], periods: false }), {
    tracked: ['a'], periods: false, events: true, order: ['events', 'periods', 'tracked'],
  });
  assert.deepEqual(readAgendaPreferences(null).order, ['periods', 'tracked', 'events']);
});

test('installed identities use the correct school and retain stable staff/parent launch paths', () => {
  for (const [project, name] of [['trinity-family-schools', 'Trinity Live'], ['trinity-family-ganda', 'Trinity Ganda']]) {
    const staff = schoolWebAppManifest(project), parent = schoolWebAppManifest(project, true);
    assert.equal(staff.name, name); assert.equal(staff.start_url, '/'); assert.equal(staff.id, '/');
    assert.equal(parent.name, `${name} Parent`); assert.equal(parent.start_url, '/parent'); assert.equal(parent.id, '/parent');
    assert.equal(staff.display, 'standalone'); assert.equal(staff.orientation, 'any');
  }
});

test('public install metadata returns the manifest content type and the parent launch identity', async () => {
  const response = getManifest(new NextRequest('https://school.invalid/api/pwa/manifest?portal=parent'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/manifest+json');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600');
  const data = await response.json();
  assert.equal(data.start_url, '/parent'); assert.equal(data.id, '/parent');
  assert.equal(data.name, schoolWebAppManifest(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools', true).name);
});
