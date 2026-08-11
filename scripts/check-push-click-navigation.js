const fs = require('fs');
const assert = require('node:assert/strict');

const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
const registration = fs.readFileSync('src/lib/utils/register-service-worker.ts', 'utf8');
const layout = fs.readFileSync('src/components/layout/app-layout.tsx', 'utf8');

assert.ok(serviceWorker.includes("type: 'PUSH_NOTIFICATION_CLICKED'"));
assert.ok(!serviceWorker.includes('client.navigate(url.href)'));
assert.ok(serviceWorker.includes('clients.openWindow(url.href)'));
assert.ok(registration.includes("type === 'PUSH_NOTIFICATION_CLICKED'"));
assert.ok(registration.includes('trinity-push-notification-click'));
assert.ok(layout.includes("addEventListener('trinity-push-notification-click'"));
assert.ok(layout.includes('router.push(url)'));

console.log('Push click navigation keeps an open app on client-side routing.');
