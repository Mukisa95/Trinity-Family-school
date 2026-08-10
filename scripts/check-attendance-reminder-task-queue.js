const assert = require('node:assert/strict');

const functions = require('../functions/index.js');

assert.equal(
  functions.attendanceReminderDispatcher,
  undefined,
  'The retired five-minute attendance reminder dispatcher must not be deployed.',
);

const planner = functions.attendanceReminderPlanner?.__endpoint;
assert.equal(planner, undefined, 'The Firebase attendance planner must remain disabled on the Spark deployment.');

const settingsTrigger = functions.attendanceReminderSettingsChanged?.__endpoint;
assert.equal(settingsTrigger, undefined, 'The Firebase attendance settings trigger must remain disabled on Spark.');

const task = functions.attendanceReminderTask?.__endpoint;
assert.equal(task, undefined, 'The Firebase attendance task queue must remain disabled on Spark.');

console.log('Firebase attendance scheduler retirement contract passed.');
