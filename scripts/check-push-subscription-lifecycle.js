const fs = require('fs');

const route = fs.readFileSync('src/app/api/notifications/subscribe/route.ts', 'utf8');
const client = fs.readFileSync('src/lib/push-subscription-client.ts', 'utf8');
const authContext = fs.readFileSync('src/lib/contexts/auth-context.tsx', 'utf8');
const autoPrompt = fs.readFileSync(
  'src/components/notifications/auto-notification-permission.tsx',
  'utf8',
);
const service = fs.readFileSync('src/lib/services/push-notifications.service.ts', 'utf8');
const hook = fs.readFileSync('src/lib/hooks/use-push-subscribe.ts', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const explicitLogout = authContext.slice(authContext.indexOf('const logout = async () =>'));
const failures = [];

for (const requirement of [
  ['subscribe route verifies the Firebase identity', route.includes('requireAppUser(request)')],
  ['subscribe route derives ownership from the verified UID', route.includes('actor.decoded.uid')],
  ['subscribe route rejects a mismatched caller-supplied UID', route.includes('userId !== actor.decoded.uid')],
  ['logout cleanup is endpoint-scoped', route.includes('deactivateSubscriptionEndpoint')],
  ['logout cleanup does not deactivate every user device', !route.includes('deactivateUserSubscriptions')],
  ['client requests use a Firebase bearer token', client.includes('Authorization: `Bearer ${token}`')],
  ['logout sends the current endpoint only', client.includes("JSON.stringify({ endpoint: subscription.endpoint })")],
  ['logout removes the browser subscription locally', client.includes('subscription.unsubscribe()')],
  ['VAPID changes rotate an incompatible browser subscription', client.includes('applicationServerKeyMatches')],
  ['authorized subscriptions reconcile without another prompt', client.includes('reconcilePushSubscription')],
  ['explicit logout detaches push before Firebase sign-out',
    explicitLogout.indexOf('detachPushSubscriptionForLogout(departingUserId)')
      < explicitLogout.indexOf('await firebaseSignOut(auth)')],
  ['PWA subscriptions reconcile when connectivity returns', autoPrompt.includes("addEventListener('online', reconcile)")],
  ['PWA subscriptions reconcile on foreground return', autoPrompt.includes("addEventListener('visibilitychange', handleVisibility)")],
  ['iOS users receive Add to Home Screen guidance', autoPrompt.includes('Add to Home Screen')],
  ['endpoint reconciliation updates an existing record', service.includes('if (matching)')],
  ['the hook exposes automatic sync', hook.includes('sync: (userId: string) => Promise<boolean>')],
  ['Firestore removes push endpoints from the transitional catch-all',
    rules.includes("collection != 'pushSubscriptions'")],
  ['Firestore allows only the trusted server to mutate push endpoints',
    rules.includes('match /pushSubscriptions/{subscriptionId}')
      && rules.includes('allow write: if isTrustedServerApp();')],
]) {
  if (!requirement[1]) failures.push(requirement[0]);
}

const obsoleteVapidKey = 'BMOU7Zc7H4Kx4pgm8KBjrIxPBZcYxFYoz5kxVOmHHI4Up5mNxnXGpbc91fBEZcndzU0E9Zk7AFUAelNuD6RXnWY';
for (const [label, source] of [
  ['push client', client],
  ['push hook', hook],
  ['push service', service],
]) {
  if (source.includes(obsoleteVapidKey)) {
    failures.push(`${label} must not fall back to the obsolete VAPID key`);
  }
}

if (failures.length) {
  console.error('Push subscription lifecycle contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Push subscription lifecycle contract passed: verified ownership, endpoint-scoped logout, PWA reconciliation, and one VAPID key.');
