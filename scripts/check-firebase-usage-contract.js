const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const statsRoute = read('src/app/api/firebase/stats/route.ts');
const usagePage = read('src/app/settings/firebase-usage/page.tsx');
const queryMetricSource = statsRoute.slice(
  statsRoute.indexOf('async function queryMetric'),
  statsRoute.indexOf('\nfunction latestMetric'),
);

assert(statsRoute.includes('await assertAdmin(request)'),
  'Firebase usage data must remain restricted to authenticated administrators.');
assert(statsRoute.includes('Promise.allSettled') && statsRoute.includes('metricPoints: MetricPoint[][]'),
  'One unavailable Cloud Monitoring metric must not erase other available usage data.');
assert(statsRoute.includes("response.status === 403") && statsRoute.includes('Monitoring Viewer role'),
  'Cloud Monitoring permission denials must give the administrator an actionable remediation.');
assert(queryMetricSource.indexOf('const fixedEndTime = endTime.toISOString();') >= 0 &&
  queryMetricSource.indexOf('const fixedEndTime = endTime.toISOString();') < queryMetricSource.indexOf('do {') &&
  queryMetricSource.includes("'interval.endTime': fixedEndTime"),
  'Cloud Monitoring pagination must reuse the original interval end time on every page.');
assert(usagePage.includes('stats.monitoring.message'),
  'The Firebase Usage page must display the server-provided Monitoring failure reason.');
assert(!usagePage.includes('useEffect(') && usagePage.includes('onClick={loadUsage}'),
  'Firebase usage must load only after an administrator presses the manual refresh button.');
assert(statsRoute.includes('maximumBytesBilled') && statsRoute.includes("_PARTITIONTIME >="),
  'Cloud Billing queries must remain partition-pruned and protected by a bytes-billed ceiling.');
assert(statsRoute.includes("startsWith('gcp_billing_export_v1_')") && statsRoute.includes('resolveBigQueryTable'),
  'The Standard billing table must be discovered without requiring a production environment update.');
assert(statsRoute.includes('MAX_COLLECTION_SAMPLE_READS = 250'),
  'Collection size estimates must retain their global Firestore read ceiling.');
assert(statsRoute.includes("request.nextUrl.searchParams.get('include')") &&
  statsRoute.includes("selected.has('collections')") &&
  statsRoute.includes("selected.has('billing')"),
  'Every refresh source must be independently selectable and unselected sources must not run.');
assert(usagePage.includes('Choose exactly what to refresh') && usagePage.includes('<Checkbox'),
  'The page must clearly expose the manual refresh choices as checkboxes.');
assert(statsRoute.includes('collectionCountReads') && statsRoute.includes('Math.ceil(collection.documents / 1000)'),
  'Collection refreshes must report their aggregate count-query read estimate instead of a fixed guess.');
assert(usagePage.includes('loadedFilterKeys.operations === filterKey') &&
  usagePage.includes('loadedFilterKeys.billing === filterKey'),
  'Operations and billing must be tracked independently so stale results are not labelled with a new date range.');

console.log('Firebase usage dashboard contract passed.');
