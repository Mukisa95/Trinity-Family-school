import assert from 'node:assert/strict';
import test from 'node:test';
import type { Class, Event } from '../src/types';
import { getExamEventClassNames, getExamEventClassesText } from '../src/lib/utils/exam-event-classes';
import { exportAndroidCachedSnapshot } from '../src/lib/offline/android-cache-export';
import type { AndroidOfflineSession } from '../src/lib/offline/android-contracts';
import { getEventCacheScope, writeEventCache, writeLegacyExamEventCache } from '../src/lib/cache/event-cache';
import { getClassCacheScope, writeClassCache } from '../src/lib/cache/class-cache';

const classes = Array.from({ length: 6 }, (_, index) => ({ id: `p${index + 1}`, code: `P.${index + 1}`, name: `Primary ${index + 1}` } as Class));
const exam = { id: 'exam-batch-test', title: 'MID TERM', isExamEvent: true, classIds: classes.map(item => item.id) } as Event;

test('all recorded classes are shown as compact labels without adding unrelated classes', () => {
  assert.equal(getExamEventClassesText(exam, classes), 'Classes: P.1, P.2, P.3, P.4, P.5, P.6');
  assert.equal(getExamEventClassesText({ ...exam, classIds: ['p6'] }, classes), 'Classes: P.6');
  assert.deepEqual(getExamEventClassNames({ ...exam, classIds: ['p1', 'p1', 'p6'] }, classes), ['P.1', 'P.6']);
  assert.equal(getExamEventClassesText({ ...exam, isExamEvent: false }, classes), '');
});

test('canonical integration and saved class metadata work before the class cache loads', () => {
  assert.equal(getExamEventClassesText({ ...exam, classIds: [], examIntegration: { classIds: ['p6'], examIds: ['exam-p6'], examName: 'Exam', maxMarks: 100, passingMarks: 50 } }, classes), 'Classes: P.6');
  assert.equal(getExamEventClassesText({ ...exam, classIds: ['p6'], customFields: { classDetails: [classes[5]] } }), 'Classes: P.6');
  assert.equal(getExamEventClassesText({ ...exam, classIds: ['retired'], classNames: ['Retired Class'] }, classes), 'Classes: Retired Class');
  assert.equal(getExamEventClassesText({ ...exam, classIds: [], customFields: { classExamDetails: [{ classId: 'old', className: 'Old class' }] } }), 'Classes: Old class');
  assert.equal(getExamEventClassesText({ ...exam, classIds: [], targetAudience: ['All staff'] }), 'Classes not specified');
});

test('Android event export retains all exam class labels and excludes private event metadata', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window'), oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  try {
    const scope = getEventCacheScope('exam-label-test', 'Admin');
    writeClassCache(getClassCacheScope('exam-label-test', 'Admin'), 1, classes);
    writeEventCache(scope, 1, [{ ...exam, id: 'canonical', actualAttendees: ['private-pupil'], customFields: { private: 'secret' } }]);
    writeLegacyExamEventCache(scope, 1, [{ ...exam, id: 'exam-batch-legacy' }], 3);
    const session = { accountId: 'exam-label-test', role: 'Admin', grants: { events: true, eventCacheScope: scope } } as AndroidOfflineSession;
    const snapshot = await exportAndroidCachedSnapshot(session);
    const events = snapshot?.datasets.events?.data || [];
    assert.equal(events.length, 2);
    for (const event of events) {
      assert.deepEqual(event.classNames, classes.map(item => item.code));
      assert.equal('actualAttendees' in event, false);
      assert.equal('customFields' in event, false);
    }
    assert.equal((await exportAndroidCachedSnapshot({ ...session, accountId: 'other', grants: { ...session.grants, eventCacheScope: undefined } }))?.datasets.events, undefined);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
