const fs = require('fs');
const assert = require('node:assert/strict');

const attendance = fs.readFileSync('src/lib/attendance-notification.ts', 'utf8');
const attendanceRoute = fs.readFileSync('src/app/api/attendance/notify-class-summary/route.ts', 'utf8');
const dispatch = fs.readFileSync('src/app/api/cron/send-scheduled-sms/route.ts', 'utf8');
const inbox = fs.readFileSync('src/lib/notification-inbox-store.ts', 'utf8');
const cache = fs.readFileSync('src/lib/notification-inbox-cache.ts', 'utf8');
const threads = fs.readFileSync('src/lib/notification-threads.ts', 'utf8');
const page = fs.readFileSync('src/app/push-notifications/page.tsx', 'utf8');
const sender = fs.readFileSync('src/app/api/notifications/send-push/route.ts', 'utf8');
const reply = fs.readFileSync('src/app/api/notifications/[id]/reply/route.ts', 'utf8');
const cleanup = fs.readFileSync('src/app/api/cron/cleanup-notification-history/route.ts', 'utf8');
const workflow = fs.readFileSync('.github/workflows/scheduled-sms.yml', 'utf8');
const indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));

assert.ok(attendance.includes('classCode: string'));
assert.ok(attendanceRoute.includes('summary.classCode'));
assert.ok(dispatch.includes(".code\n      || classItem.id"));
assert.ok(!dispatch.includes('classItem.name || classItem.code'));

assert.ok(cache.includes("DATABASE_NAME = 'trinity-notification-history'"));
assert.ok(inbox.includes('readPersistedInbox'));
assert.ok(inbox.includes('writePersistedInbox'));
assert.ok(inbox.includes('cacheOnlyNotificationIds'));
assert.ok(inbox.includes('removeInboxNotification'));
assert.ok(threads.includes('groupNotificationThreads'));
assert.ok(page.includes('groupNotificationThreads'));
assert.ok(page.includes('threadNotifications={selectedThread?.messages}'));

assert.ok(sender.includes('threadSubject: payload.title'));
assert.ok(sender.includes('notification-thread-${notificationRef.id}'));
assert.ok(reply.includes('threadSubject'));
assert.ok(reply.includes('notification-thread-${threadId}'));

assert.ok(cleanup.includes("collection('notificationDeliveries')"));
assert.ok(cleanup.includes("collection('scheduledNotifications')"));
assert.ok(cleanup.includes("collection('scheduledDispatchQueue')"));
assert.ok(cleanup.includes('HISTORY_RETENTION_MS'));
assert.ok(cleanup.includes('COMPLETED_SCHEDULE_RETENTION_MS'));
assert.ok(workflow.includes('17 1 * * *'));
assert.ok(workflow.includes('/api/cron/cleanup-notification-history'));
assert.ok(workflow.includes("github.event.schedule != '17 1 * * *'"));
assert.ok(indexes.indexes.some(index => index.collectionGroup === 'notificationDeliveries'
  && index.fields.some(field => field.fieldPath === 'userId')
  && index.fields.some(field => field.fieldPath === 'sentAt' && field.order === 'ASCENDING')));
assert.ok(indexes.indexes.some(index => index.collectionGroup === 'scheduledDispatchQueue'
  && index.fields.some(field => field.fieldPath === 'completedAt')));

console.log('Notification history, threading, and retention contract passed.');
