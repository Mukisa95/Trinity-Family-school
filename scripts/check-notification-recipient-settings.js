const fs = require('fs');
const assert = require('node:assert/strict');

const settingsModel = fs.readFileSync('src/lib/notifications/automation-settings.ts', 'utf8');
const settingsRoute = fs.readFileSync('src/app/api/notifications/settings/route.ts', 'utf8');
const settingsPage = fs.readFileSync('src/app/push-notifications/settings/page.tsx', 'utf8');
const attendanceRoute = fs.readFileSync('src/app/api/attendance/notify-class-summary/route.ts', 'utf8');
const scheduledDispatchRoute = fs.readFileSync('src/app/api/cron/send-scheduled-sms/route.ts', 'utf8');
const feeService = fs.readFileSync('src/lib/services/fees-payment-notification.server.ts', 'utf8');
const schoolPayService = fs.readFileSync('src/lib/services/schoolpay-integration.service.ts', 'utf8');
const serverPush = fs.readFileSync('src/lib/server/push-notifications.ts', 'utf8');
const functionsSource = fs.readFileSync('functions/index.js', 'utf8');

assert.ok(settingsModel.includes("mode: 'automatic' | 'custom'"));
assert.ok(settingsModel.includes('resolveAutomatedNotificationRecipientIds'));
assert.ok(settingsRoute.includes("collection('system_users').where('isActive', '==', true)"));
assert.ok(settingsRoute.includes("collection('pushSubscriptions').where('isActive', '==', true)"));
assert.ok(settingsPage.includes('Choose recipients manually'));
assert.ok(settingsPage.includes('RECIPIENT_CATEGORIES.map'));
assert.ok(attendanceRoute.includes("'attendanceRecorded'"));
assert.ok(attendanceRoute.includes("where('isActive', '==', true)"));
assert.ok(attendanceRoute.includes('activeUsers.docs.map(userDoc => userDoc.id)'));
assert.ok(scheduledDispatchRoute.includes('users.map(user => user.id)'));
assert.ok(feeService.includes("'schoolPay'"));
assert.ok(!feeService.includes('const parents = await this.getParentsByFamilyId'));
assert.ok(feeService.includes("canAccessPage(user as unknown as SystemUser, 'fees', 'collection')"));
assert.ok(feeService.includes("canAccessPage(user as unknown as SystemUser, 'fees', 'collect')"));
assert.ok(schoolPayService.includes("'schoolPay'"));
assert.ok(serverPush.includes("canAccessPage(user, 'fees', 'collection')"));
assert.ok(serverPush.includes("canAccessPage(user, 'fees', 'collect')"));
assert.ok(functionsSource.includes('recipients.attendanceMissing'));
assert.ok(functionsSource.includes('claim.recipientUserIds'));

console.log('Notification recipient settings contract passed.');
