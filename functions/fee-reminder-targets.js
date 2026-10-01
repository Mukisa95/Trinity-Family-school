const targets = {
  'trinity-family-schools': {origin: 'https://trinityfamilyschool.vercel.app', number: '148171496339'},
  'trinity-family-ganda': {origin: 'https://gandalocked.vercel.app', number: '386680805645'},
};
function feeReminderTarget(projectId) {
  const target = targets[projectId];
  if (!target) throw new Error('Fee reminder delivery is not configured for this Firebase project.');
  return {...target, audience: `${target.origin}/api/fees/reminders/function-delivery`,
    identities: [`${target.number}-compute@developer.gserviceaccount.com`, `${projectId}@appspot.gserviceaccount.com`]};
}
module.exports = {feeReminderTarget};
