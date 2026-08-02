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
const sendRoute = fs.readFileSync('src/app/api/notifications/send-push/route.ts', 'utf8');
const vapidConfig = fs.readFileSync('src/lib/server/vapid-config.ts', 'utf8');
const vapidRoute = fs.readFileSync('src/app/api/notifications/vapid-public-key/route.ts', 'utf8');
const pushPage = fs.readFileSync('src/app/push-notifications/page.tsx', 'utf8');
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
const manifest = fs.readFileSync('public/manifest.json', 'utf8');
const swVersionScript = fs.readFileSync('scripts/update-sw-version.js', 'utf8');
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
  ['unknown browser VAPID keys are rotated instead of trusted', client.includes('if (!currentKey) return false')],
  ['subscription rotation reports the replaced endpoint',
    client.includes('previousEndpoint = subscription.endpoint')
      && client.includes('...(previousEndpoint ? { previousEndpoint } : {})')],
  ['the browser obtains the authoritative VAPID public key from the server',
    client.includes("fetch('/api/notifications/vapid-public-key'")],
  ['the server derives the VAPID public key from its private key',
    vapidConfig.includes("createECDH('prime256v1')")],
  ['the public-key endpoint disables caching',
    vapidRoute.includes("'Cache-Control': 'no-store, max-age=0'")],
  ['authorized subscriptions reconcile without another prompt', client.includes('reconcilePushSubscription')],
  ['explicit logout detaches push before Firebase sign-out',
    explicitLogout.indexOf('detachPushSubscriptionForLogout(departingUserId)')
      < explicitLogout.indexOf('await firebaseSignOut(auth)')],
  ['PWA subscriptions reconcile when connectivity returns', autoPrompt.includes("addEventListener('online', reconcile)")],
  ['PWA subscriptions reconcile on foreground return', autoPrompt.includes("addEventListener('visibilitychange', handleVisibility)")],
  ['PWA subscriptions reconcile immediately after a worker update',
    autoPrompt.includes("addEventListener('trinity-service-worker-updated', reconcile)")],
  ['open installed PWAs are refreshed when a new worker activates',
    serviceWorker.includes("client.navigate(client.url)")],
  ['each deployment receives a unique service-worker cache version',
    swVersionScript.includes("const newVersion = `build-${timestamp.replace")],
  ['iOS users receive Add to Home Screen guidance', autoPrompt.includes('Add to Home Screen')],
  ['the manifest uses the canonical Trinity logo assets',
    manifest.includes('/trinity-logo-192.png') && manifest.includes('/trinity-logo-512.png')],
  ['push notifications use the Trinity logo and badge',
    serviceWorker.includes("icon: '/trinity-logo-192.png'")
      && serviceWorker.includes("badge: '/icons/trinity-badge-72.png'")],
  ['endpoint reconciliation updates an existing record', service.includes('if (matching)')],
  ['the subscribe route rejects stale client VAPID keys',
    route.includes('publicKey !== currentPublicKey') && route.includes('{ status: 409 }')],
  ['the server records which VAPID key created each subscription',
    route.includes('vapidPublicKey: currentPublicKey') && service.includes('vapidPublicKey?: string')],
  ['rotated browser endpoints are retired for the same user',
    service.includes('deactivateSubscriptionEndpoint(userId, previousEndpoint)')],
  ['senders exclude subscriptions created for another VAPID key',
    service.includes('subscription.vapidPublicKey === vapidPublicKey')
      && sendRoute.includes('getSubscriptionsForUsers(targetUserIds, currentVapidPublicKey)')],
  ['the hook exposes automatic sync', hook.includes('sync: (userId: string) => Promise<boolean>')],
  ['push permission refreshes when the browser regains focus',
    hook.includes("addEventListener('focus', refresh)")],
  ['push permission refreshes when the page becomes visible',
    hook.includes("addEventListener('visibilitychange', refreshWhenVisible)")],
  ['native notification permission changes refresh the hook',
    hook.includes("query({ name: 'notifications' as PermissionName })")
      && hook.includes("addEventListener('change', refresh)")],
  ['parallel push hooks share subscription state changes',
    hook.includes('PUSH_SUBSCRIPTION_CHANGE_EVENT')
      && hook.includes('window.dispatchEvent(new Event(PUSH_SUBSCRIPTION_CHANGE_EVENT))')],
  ['notification sending verifies the Firebase identity', sendRoute.includes('requireAppUser(request)')],
  ['notification sending checks the send-notification permission',
    sendRoute.includes("'send_notification'") && sendRoute.includes('GranularPermissionService.canPerformAction')],
  ['notification sending derives its audit identity from the verified UID',
    sendRoute.includes('sentBy: actor.decoded.uid')],
  ['notification sender requests use a Firebase bearer token',
    pushPage.includes('Authorization: `Bearer ${await firebaseUser.getIdToken()}`')],
  ['all targeted users receive a user-scoped in-app fallback',
    sendRoute.includes("collection('notificationDeliveries')")
      && sendRoute.includes('recipientIds: targetUserIds')
      && sendRoute.includes('automaticInAppFallback: true')],
  ['fallback targeting resolves users independently of active push subscriptions',
    sendRoute.includes('getSubscriptionsForUsers(targetUserIds, currentVapidPublicKey)')
      && !sendRoute.includes('getAllActiveSubscriptions')],
  ['blocked and unsupported browsers explain the automatic inbox fallback',
    autoPrompt.includes('in-app inbox') && autoPrompt.includes('register this device automatically')],
  ['Firestore removes push endpoints from the transitional catch-all',
    rules.includes("collection != 'pushSubscriptions'")],
  ['Firestore allows only the trusted server to mutate push endpoints',
    rules.includes('match /pushSubscriptions/{subscriptionId}')
      && rules.includes('allow write: if isTrustedServerApp();')],
]) {
  if (!requirement[1]) failures.push(requirement[0]);
}

if (failures.length) {
  console.error('Push subscription lifecycle contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Push subscription lifecycle contract passed: verified ownership, automatic inbox fallback, endpoint-scoped logout, PWA reconciliation, and one VAPID key.');
