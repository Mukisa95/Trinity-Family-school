const fs = require('fs');
const assert = require('node:assert/strict');

const schoolPayService = fs.readFileSync('src/lib/services/schoolpay-integration.service.ts', 'utf8');

assert.ok(schoolPayService.includes('if (!pupil)'));
assert.ok(schoolPayService.includes('Non-fatal unmatched-payment push error'));
assert.ok(schoolPayService.includes('mappingRequired: true'));
assert.ok(schoolPayService.includes('paymentCode: payment.studentPaymentCode'));
assert.ok(schoolPayService.includes('SchoolPay Payment Needs Mapping'));
assert.ok(schoolPayService.includes("if (opts.source !== 'webhook') return"));
assert.ok(schoolPayService.includes('getFeesAccessUserIdsAdmin'));
assert.ok(schoolPayService.includes("isNotificationAutomationEnabled(automationSettings, 'schoolPay')"));

console.log('SchoolPay matched and unmatched webhook push contract passed.');
