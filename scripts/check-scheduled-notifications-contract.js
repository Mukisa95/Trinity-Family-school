const fs = require('fs');
const assert = require('node:assert/strict');

const workflow = fs.readFileSync('.github/workflows/scheduled-sms.yml', 'utf8');
const cron = fs.readFileSync('src/app/api/cron/send-scheduled-sms/route.ts', 'utf8');
const queue = fs.readFileSync('src/lib/server/scheduled-dispatch-queue.ts', 'utf8');
const scheduleApi = fs.readFileSync('src/app/api/notifications/scheduled/route.ts', 'utf8');
const cancelApi = fs.readFileSync('src/app/api/notifications/scheduled/[id]/route.ts', 'utf8');
const smsApi = fs.readFileSync('src/app/api/sms/schedule/route.ts', 'utf8');
const smsItemApi = fs.readFileSync('src/app/api/sms/schedule/[id]/route.ts', 'utf8');
const smsDialog = fs.readFileSync('src/components/BulkSMS/SMSScheduleDialog.tsx', 'utf8');
const smsList = fs.readFileSync('src/components/BulkSMS/SMSScheduleListDialog.tsx', 'utf8');
const backfill = fs.readFileSync('src/app/api/admin/scheduler/backfill/route.ts', 'utf8');
const sender = fs.readFileSync('src/app/api/notifications/send-push/route.ts', 'utf8');
const settingsServer = fs.readFileSync('src/lib/server/notification-automation.ts', 'utf8');
const page = fs.readFileSync('src/app/push-notifications/page.tsx', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));

assert.ok(workflow.includes('*/5 * * * *'));
assert.ok(workflow.includes('/api/cron/send-scheduled-sms'));
assert.ok(!workflow.includes('/api/cron/send-scheduled-notifications'));
assert.ok(workflow.includes('CRON_SECRET is required'));
assert.ok(workflow.includes('https://gandalocked.vercel.app'));
assert.ok(workflow.includes('GANDA_CRON_SECRET'));
assert.ok(workflow.includes('migrate-ganda'));
assert.ok(!fs.existsSync('src/app/api/cron/send-scheduled-notifications/route.ts'));

assert.ok(cron.includes('SCHEDULED_DISPATCH_QUEUE'));
assert.ok(cron.includes("where('status', '==', 'scheduled')"));
assert.ok(cron.includes("where('dueAt', '<=', Timestamp.fromDate(now))"));
assert.ok(cron.includes("orderBy('dueAt', 'asc')"));
assert.ok(!cron.includes("collection('pupils')"));
assert.ok(!cron.includes('enqueueDueAttendanceReminders'));
assert.ok(cron.includes("claimed.channel === 'sms'"));
assert.ok(cron.includes("claimed.channel === 'push'"));
assert.ok(cron.includes('dispatchAttendance'));
assert.ok(cron.includes("'attendanceMissing'"));
assert.ok(cron.includes('users.map(user => user.id)'));
assert.ok(!cron.includes("filter(user => user.role === 'Admin')"));

assert.ok(queue.includes("channel: 'attendance'"));
assert.ok(queue.includes('nextAttendanceRunAt'));
assert.ok(settingsServer.includes('syncAttendanceDispatches'));
assert.ok(scheduleApi.includes('pushQueueId(ref.id)'));
assert.ok(scheduleApi.includes("channel: 'push'"));
assert.ok(cancelApi.includes("status: 'cancelled'"));
assert.ok(cancelApi.includes('pushQueueId(id)'));
assert.ok(smsApi.includes('smsQueueId(jobRef.id)'));
assert.ok(smsItemApi.includes('smsQueueId(id)'));
assert.ok(smsDialog.includes("fetch('/api/sms/schedule'"));
assert.ok(!smsDialog.includes("addDoc(collection(db, 'scheduledSMS')"));
assert.ok(smsList.includes("fetch(`/api/sms/schedule/${encodeURIComponent(id)}`"));
assert.ok(!smsList.includes("updateDoc(doc(db, 'scheduledSMS'"));
assert.ok(backfill.includes('authorizeBackfill'));
assert.ok(backfill.includes("request.headers.get('x-cron-secret')"));
assert.ok(backfill.includes('updateNotificationAutomationSettings({}, actorId)'));
assert.ok(sender.includes("collection('scheduledNotifications').doc(scheduledJobId)"));
assert.ok(page.includes('Schedule notification'));
assert.ok(page.includes('Scheduled notifications'));
assert.ok(rules.includes('match /scheduledDispatchQueue/{dispatchId}'));
assert.ok(rules.includes('match /scheduledSMS/{scheduleId}'));
assert.ok(rules.includes("collection != 'scheduledDispatchQueue'"));
assert.ok(indexes.indexes.some(index => index.collectionGroup === 'scheduledDispatchQueue'
  && index.fields.some(field => field.fieldPath === 'status')
  && index.fields.some(field => field.fieldPath === 'dueAt')));

console.log('Unified scheduled communication contract passed.');
