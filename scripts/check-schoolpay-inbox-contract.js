const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const notify = read('src/app/api/schoolpay/notify/route.ts');
const callback = read('src/app/api/schoolpay/callback/route.ts');
const integration = read('src/lib/services/schoolpay-integration.service.ts');
const assign = read('src/app/api/schoolpay/inbox/[id]/assign/route.ts');
const reconcile = read('src/app/api/schoolpay/reconcile/route.ts');
const logs = read('src/app/api/schoolpay/logs/route.ts');
const cron = read('src/app/api/cron/schoolpay-sync/route.ts');
const inbox = read('src/lib/services/schoolpay-inbox.server.ts');
const hook = read('src/lib/hooks/use-schoolpay-inbox.ts');
const feed = read('src/app/accounts/schoolpay-feed/page.tsx');
const card = read('src/components/schoolpay/schoolpay-inbox-card.tsx');
const rules = read('firestore.rules');
const vercel = JSON.parse(read('vercel.json'));

const savedAt = notify.indexOf("recordReceived(payload, 'webhook')");
const authenticatedAt = notify.indexOf('await ensureServerFirestoreAuth()', savedAt);
const processedAt = notify.indexOf('processVerifiedWebhookPayload(payload)', savedAt);
assert(savedAt >= 0 && authenticatedAt > savedAt && processedAt > authenticatedAt,
  'Webhook must persist the callback before legacy allocation authentication and processing.');
assert(notify.includes('const claimed = await SchoolPayInboxService.markProcessing'),
  'Webhook must claim the receipt before allocating it.');
assert(callback.includes("export const dynamic = 'force-dynamic'") && callback.includes("export const runtime = 'nodejs'"),
  'The legacy callback alias must declare literal Next.js route settings.');
assert(inbox.includes('runTransaction') && inbox.includes("data.status === 'processing'"),
  'Inbox processing must use a transactional concurrency claim.');
assert(integration.includes("getAdminFirestore(getFirebaseAdminApp())") && !integration.includes("from './pupils.service'"),
  'Financial pupil matching must use authoritative Admin Firestore reads.');
assert(integration.includes("where('schoolPayReceiptNumber', '==', receiptNumber)") &&
  integration.includes("where('schoolPayTransactionId', '==', transactionId)") &&
  integration.includes('repairPaymentMapping'),
  'Recovery must detect existing local receipts and transaction ids before allocating money.');
assert(!integration.includes('getDoc(doc(db, SCHOOLPAY_PAYMENT_MAPPINGS') &&
  !integration.includes('setDoc(doc(db, SCHOOLPAY_PAYMENT_MAPPINGS') &&
  !integration.includes('collection(db, SCHOOLPAY_SYNC_LOGS)') &&
  integration.includes(".collection(SCHOOLPAY_PAYMENT_MAPPINGS)") &&
  integration.includes(".collection(SCHOOLPAY_SYNC_LOGS)"),
  'Webhook mapping and diagnostic operations must use Admin Firestore, not staff-only browser rules.');
assert(integration.includes('SCHOOLPAY_RECONCILIATION_STATE') && integration.includes('responseHash'),
  'Unchanged reconciliation days must use one state read instead of replaying every receipt.');
assert(assign.includes('requireAppUser(request)') && assign.includes("canAccessPage(actor.user, 'fees', 'schoolpay_feed')"),
  'Code assignment must require an authenticated, permitted staff user.');
assert(reconcile.includes('requireAppUser(request)') && reconcile.includes("canAccessPage(actor.user, 'fees', 'schoolpay_feed')") &&
  reconcile.includes('{ force: true }'),
  'Manual date recovery must be permission protected and intentionally bypass unchanged-day caching.');
assert(logs.includes('requireAppUser(request)') && logs.includes("canAccessPage(actor.user, 'fees', 'schoolpay_feed')"),
  'SchoolPay diagnostics must not be exposed without app-user authorization.');
assert(logs.includes('getFirestore(getFirebaseAdminApp())') && !logs.includes("await import('firebase/firestore')"),
  'SchoolPay diagnostics API must use Admin Firestore after permission checks.');
assert(cron.includes("get('daysBack') || '7'") && cron.includes('dates.length > 14'),
  'Automatic recovery must cover seven days while bounding explicit ranges.');
assert(hook.includes('acquireSharedFirestoreSubscription') && hook.includes("where('status', 'in', ['unmatched', 'failed'])"),
  'All UI consumers must share one unresolved-payment listener.');
assert(!feed.includes("getDocs(collection(db, 'pupils'))") && feed.includes('reverted: !!d.reverted'),
  'Live Feed must reuse the pupil cache and retain the reverted-payment filter field.');
assert(card.includes('Copy code') && card.includes('Assign code') && card.includes('Dismiss prompt'),
  'The prompt must expose the required recovery actions.');
assert(rules.includes('match /schoolPayInboundTransactions/{transactionId}') &&
  rules.includes("collection != 'schoolPayInboundTransactions'") &&
  rules.includes("collection != 'schoolPayReconciliationState'") &&
  rules.includes("collection != 'schoolPaySyncLogs'"),
  'SchoolPay financial collections must be excluded from the transitional catch-all.');
assert(vercel.crons.some(item => item.path === '/api/cron/schoolpay-sync'),
  'A SchoolPay reconciliation cron must be registered.');

console.log('SchoolPay inbox integrity contract passed.');
