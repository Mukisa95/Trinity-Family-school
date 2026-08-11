const assert = require('node:assert/strict');
const fs = require('fs');

const route = fs.readFileSync('src/app/api/exams/unlock-notifications/route.ts', 'utf8');
const lease = fs.readFileSync('src/lib/services/exam-lease.service.ts', 'utf8');
const examService = fs.readFileSync('src/lib/services/exams.service.ts', 'utf8');
const view = fs.readFileSync('src/app/exams/[examId]/record-results/RecordResultsView.tsx', 'utf8');
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');

assert.ok(route.includes('requireAppUser(request)'), 'Unlock notification routes must require a signed-in app user.');
assert.ok(route.includes("'exams', 'results', 'enter_results'"), 'Unlock notifications must require exam-result permission.');
assert.ok(route.includes("collection('examUnlockNotificationRequests')"), 'Requests must be stored server-side until the exam unlocks.');
assert.ok(route.includes("collection('examLocks').doc(examId)"), 'Dispatch must verify that the exam is no longer locked.');
assert.ok(route.includes('getServerPushSubscriptionsForUsers') && route.includes('sendServerWebPush'), 'Unlock alerts must use the shared server Web Push sender.');
assert.ok(route.includes('/record-results?classId='), 'Unlock push must deep-link to the affected Record Results page.');
assert.ok(lease.includes('if (released) void this.notifyUnlockWaiters(examId)'), 'The lease owner must dispatch notifications only after releasing its lock.');
assert.ok(examService.includes('void ExamLeaseService.notifyUnlockWaiters(resultData.examId!)'), 'Saving results must dispatch pending unlock notifications after its atomic lease release.');
assert.ok(view.includes('Notify me when ready') && view.includes('usePushSubscribe') && view.includes('/api/exams/unlock-notifications'), 'Blocked editors must be able to request a push notification from the entry notice.');
assert.ok(serviceWorker.includes("type: 'PUSH_NOTIFICATION_CLICKED'") && serviceWorker.includes('clients.openWindow(url.href)'), 'Push notification clicks must route an existing app client or open a new app window to the supplied URL.');

console.log('Exam unlock notification contract passed: request, release dispatch, push delivery, and deep link are connected.');
