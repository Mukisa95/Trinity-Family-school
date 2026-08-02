const assert = require('node:assert/strict');

const functions = require('../functions/index.js');

assert.equal(
  functions.attendanceReminderDispatcher,
  undefined,
  'The retired five-minute attendance reminder dispatcher must not be deployed.',
);

const planner = functions.attendanceReminderPlanner?.__endpoint;
assert.equal(planner?.scheduleTrigger?.schedule, '5 0 * * *', 'The daily planner must run once at 00:05.');
assert.deepEqual(planner?.region, ['us-central1']);

const settingsTrigger = functions.attendanceReminderSettingsChanged?.__endpoint;
assert.equal(settingsTrigger?.eventTrigger?.eventType, 'google.cloud.firestore.document.v1.written');
assert.equal(settingsTrigger?.eventTrigger?.eventFilters?.document, 'notificationAutomationSettings/current');

const task = functions.attendanceReminderTask?.__endpoint;
assert.ok(task?.taskQueueTrigger, 'Attendance reminders must be delivered by a Firebase task queue.');
assert.deepEqual(task?.region, ['us-central1']);
assert.equal(task?.taskQueueTrigger?.retryConfig?.maxAttempts, 3);
assert.equal(task?.taskQueueTrigger?.rateLimits?.maxConcurrentDispatches, 1);

console.log('Attendance reminder task-queue contract passed.');
