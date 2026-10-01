const {feeReminderTarget} = require('./fee-reminder-targets');
// Keep push signing in the website that owns the live browser subscriptions.
// Google signs this short-lived identity; no shared key is copied between hosts.
async function sendFeeReminderWebsitePush(projectId, delivery, request = fetch) {
  const {audience} = feeReminderTarget(projectId);
  const identity = await request('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' + encodeURIComponent(audience) + '&format=full', {
    headers: {'Metadata-Flavor': 'Google'}, signal: AbortSignal.timeout(10000),
  });
  if (!identity.ok) throw new Error('Could not obtain the reminder function identity.');
  const token = await identity.text();
  const response = await request(audience, {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
    body: JSON.stringify(delivery), signal: AbortSignal.timeout(55000),
  });
  if (!response.ok) throw new Error(`Fee reminder delivery failed (${response.status}); it will retry.`);
}
module.exports = {sendFeeReminderWebsitePush};
