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
assert(assign.includes('requireAppUser(request)') && assign.includes("canAccessPage(actor.user, 'fees', 'schoolpay_feed')"),
  'Code assignment must require an authenticated, permitted staff user.');
assert(hook.includes('acquireSharedFirestoreSubscription') && hook.includes("where('status', 'in', ['unmatched', 'failed'])"),
  'All UI consumers must share one unresolved-payment listener.');
assert(!feed.includes("getDocs(collection(db, 'pupils'))") && feed.includes('reverted: !!d.reverted'),
  'Live Feed must reuse the pupil cache and retain the reverted-payment filter field.');
assert(card.includes('Copy code') && card.includes('Assign code') && card.includes('Dismiss prompt'),
  'The prompt must expose the required recovery actions.');
assert(rules.includes('match /schoolPayInboundTransactions/{transactionId}') &&
  rules.includes("collection != 'schoolPayInboundTransactions'"),
  'Inbox rules must block the transitional catch-all and permit only the specific staff read.');
assert(vercel.crons.some(item => item.path === '/api/cron/schoolpay-sync'),
  'A SchoolPay reconciliation cron must be registered.');

console.log('SchoolPay inbox integrity contract passed.');
