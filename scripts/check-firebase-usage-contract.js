const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const statsRoute = read('src/app/api/firebase/stats/route.ts');
const usagePage = read('src/app/settings/firebase-usage/page.tsx');

assert(statsRoute.includes('await assertAdmin(request)'),
  'Firebase usage data must remain restricted to authenticated administrators.');
assert(statsRoute.includes('Promise.allSettled') && statsRoute.includes('metricPoints: MetricPoint[][]'),
  'One unavailable Cloud Monitoring metric must not erase other available usage data.');
assert(statsRoute.includes("response.status === 403") && statsRoute.includes('Monitoring Viewer role'),
  'Cloud Monitoring permission denials must give the administrator an actionable remediation.');
assert(usagePage.includes('stats?.monitoring.message'),
  'The Firebase Usage page must display the server-provided Monitoring failure reason.');

console.log('Firebase usage dashboard contract passed.');
