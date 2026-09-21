import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { DocumentData, DocumentReference, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

type MetricPoint = {
  interval?: { endTime?: string };
  value?: { int64Value?: string; doubleValue?: number };
};

type MonitoringResponse = {
  timeSeries?: Array<{ points?: MetricPoint[] }>;
  nextPageToken?: string;
  error?: { code?: number; message?: string };
};

type BigQueryResponse = {
  cacheHit?: boolean;
  error?: { message?: string };
  errors?: Array<{ message?: string }>;
  jobComplete?: boolean;
  jobReference?: { jobId?: string; location?: string };
  rows?: Array<{ f?: Array<{ v?: string | null }> }>;
  schema?: { fields?: Array<{ name?: string }> };
  totalBytesProcessed?: string;
};

type BigQueryTablesResponse = {
  error?: { message?: string };
  tables?: Array<{ tableReference?: { projectId?: string; datasetId?: string; tableId?: string } }>;
};

type UsageRangePreset = '24h' | '7d' | '30d' | '90d' | 'custom';
type RefreshSection = 'collections' | 'operations' | 'storage' | 'billing';

type UsageRange = {
  preset: UsageRangePreset;
  startTime: Date;
  endTime: Date;
  bucketSeconds: number;
  cacheKey: string;
};

type CollectionUsage = {
  name: string;
  documents: number;
  estimatedDocumentBytes: number | null;
  sampledDocuments: number;
};

type UsageStats = {
  checkedAt: string;
  refreshed: RefreshSection[];
  range: {
    preset: UsageRangePreset;
    startTime: string;
    endTime: string;
    bucketSeconds: number;
  };
  firestore: {
    collections: CollectionUsage[];
    totalDocuments: number;
    collectionStatsMeasuredAt: string;
    collectionCountReads: number;
    collectionSampleReads: number;
    collectionStatsServedFromCache: boolean;
    dataAndIndexBytes: number | null;
    dataAndIndexMeasuredAt: string | null;
    freeStorageAllowanceBytes: number;
    freeStorageRemainingBytes: number | null;
    freeStorageOverageBytes: number | null;
  };
  storage: {
    bytes: number | null;
    objects: number | null;
    measuredAt: string | null;
  };
  operations: {
    reads: number | null;
    writes: number | null;
    deletes: number | null;
    measuredAt: string | null;
    trend: Array<{ timestamp: string; reads: number; writes: number; deletes: number }>;
  };
  billing: {
    configured: boolean;
    available: boolean;
    currency: string | null;
    grossCost: number | null;
    credits: number | null;
    netCost: number | null;
    bytesProcessed: number | null;
    cacheHit: boolean;
    daily: Array<{ date: string; cost: number }>;
    services: Array<{ name: string; cost: number }>;
    message?: string;
  };
  monitoring: { ran: boolean; available: boolean; message?: string };
  servedFromCache: boolean;
};

type CollectionStats = {
  collections: CollectionUsage[];
  totalDocuments: number;
  countReads: number;
  sampleReads: number;
  measuredAt: string;
};

class MonitoringRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'MonitoringRequestError';
  }
}

const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const COLLECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FIRESTORE_FREE_STORAGE_BYTES = 1024 ** 3;
const MAX_COLLECTION_SAMPLE_READS = 250;
const MAX_SAMPLES_PER_COLLECTION = 5;
const DEFAULT_BIGQUERY_MAX_BYTES = 100 * 1024 * 1024;
const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
const REFRESH_SECTIONS: RefreshSection[] = ['collections', 'operations', 'storage', 'billing'];

const cachedStatsByRange = new Map<string, { value: Omit<UsageStats, 'servedFromCache'>; expiresAt: number }>();
let cachedCollectionStats: CollectionStats | null = null;
let collectionCacheExpiresAt = 0;
let cachedBillingTable: { projectId: string; table: string; expiresAt: number } | null = null;

function numericValue(point: MetricPoint): number | null {
  const value = point.value?.int64Value ?? point.value?.doubleValue;
  const numberValue = typeof value === 'string' ? Number(value) : value;
  return typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : null;
}

function resolveUsageRange(request: NextRequest): UsageRange {
  const presetValue = request.nextUrl.searchParams.get('range') || '24h';
  const preset = ['24h', '7d', '30d', '90d', 'custom'].includes(presetValue)
    ? presetValue as UsageRangePreset
    : '24h';
  const now = new Date();

  if (preset === 'custom') {
    const startTime = new Date(request.nextUrl.searchParams.get('start') || '');
    const endTime = new Date(request.nextUrl.searchParams.get('end') || '');
    const duration = endTime.getTime() - startTime.getTime();
    if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || duration <= 0) {
      throw new Error('Choose a valid custom start and end date.');
    }
    if (duration > MAX_RANGE_MS) throw new Error('Custom usage ranges cannot exceed 90 days.');
    if (endTime.getTime() > now.getTime() + 60_000) throw new Error('The usage range cannot end in the future.');
    return {
      preset,
      startTime,
      endTime,
      bucketSeconds: duration <= 7 * 24 * 60 * 60 * 1000 ? 3600 : 86400,
      cacheKey: `custom:${startTime.toISOString()}:${endTime.toISOString()}`,
    };
  }

  const durationMs = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  }[preset];
  return {
    preset,
    startTime: new Date(now.getTime() - durationMs),
    endTime: now,
    bucketSeconds: durationMs <= 7 * 24 * 60 * 60 * 1000 ? 3600 : 86400,
    cacheKey: preset,
  };
}

function resolveRefreshSections(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('include');
  if (!requested) return new Set<RefreshSection>(REFRESH_SECTIONS);
  const selected = requested
    .split(',')
    .filter((value): value is RefreshSection => REFRESH_SECTIONS.includes(value as RefreshSection));
  if (!selected.length) throw new Error('Select at least one item to refresh.');
  return new Set<RefreshSection>(selected);
}

async function assertAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) throw new Error('Sign in as an administrator to view resource usage.');

  const app = getFirebaseAdminApp();
  const decoded = await getAuth(app).verifyIdToken(token);
  if (decoded.appUser !== true || decoded.isActive !== true) {
    throw new Error('Only active application administrators can view resource usage.');
  }
  const user = await getFirestore(app).collection('system_users').doc(decoded.uid).get();
  if (user.data()?.role !== 'Admin') throw new Error('Only administrators can view resource usage.');
}

async function getAccessToken(): Promise<string> {
  const credential = getFirebaseAdminApp().options.credential;
  if (!credential) throw new Error('No server credential is configured.');
  const token = await credential.getAccessToken();
  if (!token.access_token) throw new Error('Could not obtain a Google Cloud access token.');
  return token.access_token;
}

async function queryMetric(
  metricType: string,
  startTime: Date,
  endTime: Date,
  options: {
    resourceFilter?: string;
    alignmentPeriodSeconds?: number;
    aligner?: 'ALIGN_SUM' | 'ALIGN_MAX';
    reducer?: 'REDUCE_SUM';
  } = {},
): Promise<MetricPoint[]> {
  const projectId = getFirebaseAdminProjectId();
  if (!projectId) throw new Error('FIREBASE_ADMIN_PROJECT_ID is not configured.');

  const accessToken = await getAccessToken();
  const filter = [`metric.type = \"${metricType}\"`, options.resourceFilter].filter(Boolean).join(' AND ');
  const fixedEndTime = endTime.toISOString();
  const points: MetricPoint[] = [];
  let pageToken: string | undefined;

  do {
    const search = new URLSearchParams({
      filter,
      'interval.startTime': startTime.toISOString(),
      'interval.endTime': fixedEndTime,
      view: 'FULL',
      pageSize: '1000',
    });
    if (options.alignmentPeriodSeconds) search.set('aggregation.alignmentPeriod', `${options.alignmentPeriodSeconds}s`);
    if (options.aligner) search.set('aggregation.perSeriesAligner', options.aligner);
    if (options.reducer) search.set('aggregation.crossSeriesReducer', options.reducer);
    if (pageToken) search.set('pageToken', pageToken);

    const response = await fetch(`https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${search}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const payload = await response.json() as MonitoringResponse;
    if (!response.ok) {
      const detail = payload.error?.message || `Cloud Monitoring returned ${response.status}.`;
      if (response.status === 403) {
        throw new MonitoringRequestError(
          403,
          `Cloud Monitoring denied the configured service account: ${detail} ` +
            'Grant that exact FIREBASE_ADMIN_CLIENT_EMAIL the Monitoring Viewer role in this Firebase project, then confirm the Cloud Monitoring API is enabled.',
        );
      }
      throw new MonitoringRequestError(response.status, `Cloud Monitoring returned ${response.status}: ${detail}`);
    }
    for (const series of payload.timeSeries || []) points.push(...(series.points || []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return points;
}

function stringBytes(value: string) {
  return Buffer.byteLength(value, 'utf8') + 1;
}

function documentNameBytes(path: string) {
  return path.split('/').reduce((sum, segment) => sum + stringBytes(segment), 16);
}

function firestoreValueBytes(value: unknown, seen = new WeakSet<object>()): number {
  if (value === null || value === undefined) return 1;
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number' || typeof value === 'bigint') return 8;
  if (typeof value === 'string') return stringBytes(value);
  if (value instanceof Date) return 8;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value.byteLength;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + firestoreValueBytes(item, seen), 0);
  if (typeof value !== 'object') return 0;

  const objectValue = value as Record<string, unknown>;
  if (typeof objectValue.toDate === 'function') return 8;
  if (typeof objectValue.latitude === 'number' && typeof objectValue.longitude === 'number') return 16;
  if (typeof objectValue.path === 'string' && 'firestore' in objectValue) return documentNameBytes(objectValue.path);
  if (seen.has(objectValue)) return 0;
  seen.add(objectValue);
  const size = Object.entries(objectValue).reduce(
    (sum, [field, fieldValue]) => sum + stringBytes(field) + firestoreValueBytes(fieldValue, seen),
    0,
  );
  seen.delete(objectValue);
  return size;
}

function documentBytes(reference: DocumentReference<DocumentData>, data: DocumentData) {
  return documentNameBytes(reference.path) + firestoreValueBytes(data) + 32;
}

function allocateCollectionSamples(collectionCount: number) {
  if (collectionCount === 0) return [];
  const limits = Array.from({ length: collectionCount }, () => 0);
  let remaining = MAX_COLLECTION_SAMPLE_READS;
  while (remaining > 0) {
    let assigned = false;
    for (let index = 0; index < collectionCount && remaining > 0; index += 1) {
      if (limits[index] >= MAX_SAMPLES_PER_COLLECTION) continue;
      limits[index] += 1;
      remaining -= 1;
      assigned = true;
    }
    if (!assigned) break;
  }
  return limits;
}

async function getCollectionStats(): Promise<{ value: CollectionStats; servedFromCache: boolean }> {
  if (cachedCollectionStats && Date.now() < collectionCacheExpiresAt) {
    return { value: cachedCollectionStats, servedFromCache: true };
  }

  const firestore = getFirestore(getFirebaseAdminApp());
  const collectionReferences = await firestore.listCollections();
  const sampleLimits = allocateCollectionSamples(collectionReferences.length);
  const collections = await Promise.all(collectionReferences.map(async (collection, index) => {
    const [countSnapshot, sampleSnapshot] = await Promise.all([
      collection.count().get(),
      sampleLimits[index] > 0 ? collection.limit(sampleLimits[index]).get() : Promise.resolve(null),
    ]);
    const documents = countSnapshot.data().count;
    const sampledDocuments = sampleSnapshot?.size || 0;
    const sampledBytes = sampleSnapshot?.docs.reduce(
      (sum, document) => sum + documentBytes(document.ref, document.data()),
      0,
    ) || 0;
    return {
      name: collection.id,
      documents,
      sampledDocuments,
      estimatedDocumentBytes: documents === 0
        ? 0
        : sampledDocuments > 0
          ? Math.round((sampledBytes / sampledDocuments) * documents)
          : null,
    };
  }));

  collections.sort((a, b) => b.documents - a.documents);
  cachedCollectionStats = {
    collections,
    totalDocuments: collections.reduce((sum, collection) => sum + collection.documents, 0),
    countReads: collections.reduce(
      (sum, collection) => sum + Math.max(1, Math.ceil(collection.documents / 1000)),
      0,
    ),
    sampleReads: collections.reduce((sum, collection) => sum + collection.sampledDocuments, 0),
    measuredAt: new Date().toISOString(),
  };
  collectionCacheExpiresAt = Date.now() + COLLECTION_CACHE_TTL_MS;
  return { value: cachedCollectionStats, servedFromCache: false };
}

function latestMetric(points: MetricPoint[]) {
  const values = points
    .map(point => ({ value: numericValue(point), measuredAt: point.interval?.endTime || null }))
    .filter((point): point is { value: number; measuredAt: string | null } => point.value !== null);
  if (!values.length) return { value: null, measuredAt: null };

  const latestTimestamp = Math.max(...values.map(point => Date.parse(point.measuredAt || '') || 0));
  const latest = values.filter(point => (Date.parse(point.measuredAt || '') || 0) === latestTimestamp);
  return { value: latest.reduce((sum, point) => sum + point.value, 0), measuredAt: latest[0]?.measuredAt || null };
}

function metricBuckets(points: MetricPoint[]) {
  const buckets = new Map<string, number>();
  for (const point of points) {
    const timestamp = point.interval?.endTime;
    const value = numericValue(point);
    if (!timestamp || value === null) continue;
    buckets.set(timestamp, (buckets.get(timestamp) || 0) + value);
  }
  return buckets;
}

function buildOperationTrend(readPoints: MetricPoint[], writePoints: MetricPoint[], deletePoints: MetricPoint[]) {
  const reads = metricBuckets(readPoints);
  const writes = metricBuckets(writePoints);
  const deletes = metricBuckets(deletePoints);
  const timestamps = new Set([...reads.keys(), ...writes.keys(), ...deletes.keys()]);
  return [...timestamps]
    .sort((left, right) => Date.parse(left) - Date.parse(right))
    .map(timestamp => ({
      timestamp,
      reads: reads.get(timestamp) || 0,
      writes: writes.get(timestamp) || 0,
      deletes: deletes.get(timestamp) || 0,
    }));
}

function validateBigQueryTable(value: string | undefined) {
  if (!value) return null;
  const table = value.replace(/^`|`$/g, '');
  return /^[A-Za-z0-9_\-]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_\-]+$/.test(table) ? table : null;
}

async function resolveBigQueryTable(projectId: string, accessToken: string) {
  const configured = validateBigQueryTable(process.env.FIREBASE_BILLING_BIGQUERY_TABLE);
  if (configured) return configured;
  if (cachedBillingTable?.projectId === projectId && Date.now() < cachedBillingTable.expiresAt) {
    return cachedBillingTable.table;
  }

  const datasetId = 'billing_export';
  const response = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}/datasets/${datasetId}/tables?maxResults=1000`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
  );
  const payload = await response.json() as BigQueryTablesResponse;
  if (!response.ok) throw new Error(payload.error?.message || `BigQuery table discovery returned ${response.status}.`);
  const tableId = payload.tables
    ?.map(table => table.tableReference?.tableId)
    .find((value): value is string => Boolean(value?.startsWith('gcp_billing_export_v1_')));
  if (!tableId) {
    throw new Error('Standard billing export is enabled, but Google has not created the daily cost table yet. Try again after the next export cycle.');
  }

  const table = `${projectId}.${datasetId}.${tableId}`;
  cachedBillingTable = { projectId, table, expiresAt: Date.now() + 60 * 60 * 1000 };
  return table;
}

async function waitForBigQueryResult(projectId: string, accessToken: string, payload: BigQueryResponse) {
  let result = payload;
  for (let attempt = 0; result.jobComplete === false && attempt < 3; attempt += 1) {
    const jobId = result.jobReference?.jobId;
    if (!jobId) break;
    const search = new URLSearchParams({ timeoutMs: '10000', maxResults: '1000' });
    if (result.jobReference?.location) search.set('location', result.jobReference.location);
    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries/${jobId}?${search}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
    );
    result = await response.json() as BigQueryResponse;
    if (!response.ok) throw new Error(result.error?.message || `BigQuery returned ${response.status}.`);
  }
  if (result.jobComplete === false) throw new Error('The billing query did not finish within 30 seconds.');
  return result;
}

async function queryBilling(range: UsageRange): Promise<UsageStats['billing']> {
  const projectId = getFirebaseAdminProjectId();
  if (!projectId) throw new Error('FIREBASE_ADMIN_PROJECT_ID is not configured.');
  const queryProjectId = process.env.FIREBASE_BILLING_BIGQUERY_PROJECT_ID || projectId;
  const maxBytes = Number(process.env.FIREBASE_BILLING_BIGQUERY_MAX_BYTES || DEFAULT_BIGQUERY_MAX_BYTES);
  const maximumBytesBilled = Number.isFinite(maxBytes) && maxBytes > 0 ? Math.floor(maxBytes) : DEFAULT_BIGQUERY_MAX_BYTES;
  const accessToken = await getAccessToken();
  const table = await resolveBigQueryTable(projectId, accessToken);
  const query = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE(usage_start_time, 'Africa/Nairobi')) AS usage_date,
      service.description AS service_name,
      currency,
      SUM(cost) AS gross_cost,
      COALESCE(SUM((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit)), 0) AS credits,
      SUM(cost) + COALESCE(SUM((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit)), 0) AS net_cost
    FROM \`${table}\`
    WHERE _PARTITIONTIME >= TIMESTAMP_TRUNC(@start_time, DAY)
      AND _PARTITIONTIME < TIMESTAMP_ADD(TIMESTAMP_TRUNC(@end_time, DAY), INTERVAL 1 DAY)
      AND project.id = @project_id
      AND usage_start_time >= @start_time
      AND usage_start_time < @end_time
    GROUP BY usage_date, service_name, currency
    ORDER BY usage_date ASC, net_cost DESC
  `;
  const response = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${queryProjectId}/queries`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      query,
      useLegacySql: false,
      useQueryCache: true,
      maximumBytesBilled: String(maximumBytesBilled),
      timeoutMs: 10000,
      maxResults: 1000,
      parameterMode: 'NAMED',
      queryParameters: [
        { name: 'project_id', parameterType: { type: 'STRING' }, parameterValue: { value: projectId } },
        { name: 'start_time', parameterType: { type: 'TIMESTAMP' }, parameterValue: { value: range.startTime.toISOString() } },
        { name: 'end_time', parameterType: { type: 'TIMESTAMP' }, parameterValue: { value: range.endTime.toISOString() } },
      ],
    }),
  });
  let payload = await response.json() as BigQueryResponse;
  if (!response.ok) throw new Error(payload.error?.message || `BigQuery returned ${response.status}.`);
  payload = await waitForBigQueryResult(queryProjectId, accessToken, payload);
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message || 'The billing query failed.');

  const fields = payload.schema?.fields?.map(field => field.name || '') || [];
  const rows = (payload.rows || []).map(row => Object.fromEntries(
    fields.map((field, index) => [field, row.f?.[index]?.v ?? null]),
  ));
  let grossCost = 0;
  let credits = 0;
  let netCost = 0;
  let currency: string | null = null;
  const daily = new Map<string, number>();
  const services = new Map<string, number>();
  for (const row of rows) {
    const rowGross = Number(row.gross_cost || 0);
    const rowCredits = Number(row.credits || 0);
    const rowNet = Number(row.net_cost || 0);
    grossCost += rowGross;
    credits += rowCredits;
    netCost += rowNet;
    currency ||= typeof row.currency === 'string' ? row.currency : null;
    if (typeof row.usage_date === 'string') daily.set(row.usage_date, (daily.get(row.usage_date) || 0) + rowNet);
    if (typeof row.service_name === 'string') services.set(row.service_name, (services.get(row.service_name) || 0) + rowNet);
  }

  return {
    configured: true,
    available: true,
    currency,
    grossCost,
    credits,
    netCost,
    bytesProcessed: payload.totalBytesProcessed ? Number(payload.totalBytesProcessed) : 0,
    cacheHit: payload.cacheHit === true,
    daily: [...daily].map(([date, cost]) => ({ date, cost })),
    services: [...services]
      .map(([name, cost]) => ({ name, cost }))
      .sort((left, right) => right.cost - left.cost),
  };
}

async function buildUsageStats(
  range: UsageRange,
  selected: Set<RefreshSection>,
): Promise<Omit<UsageStats, 'servedFromCache'>> {
  const now = new Date();
  const bucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const currentStorageStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const collectionStatsPromise = selected.has('collections')
    ? getCollectionStats()
    : Promise.resolve({
        value: { collections: [], totalDocuments: 0, countReads: 0, sampleReads: 0, measuredAt: now.toISOString() },
        servedFromCache: true,
      });
  const billingPromise = selected.has('billing') ? queryBilling(range).catch((error): UsageStats['billing'] => ({
    configured: Boolean(getFirebaseAdminProjectId()),
    available: false,
    currency: null,
    grossCost: null,
    credits: null,
    netCost: null,
    bytesProcessed: null,
    cacheHit: false,
    daily: [],
    services: [],
    message: error instanceof Error ? error.message : 'Cloud Billing expenditure is unavailable.',
  })) : Promise.resolve<UsageStats['billing']>({
    configured: Boolean(getFirebaseAdminProjectId()),
    available: false,
    currency: null,
    grossCost: null,
    credits: null,
    netCost: null,
    bytesProcessed: null,
    cacheHit: false,
    daily: [],
    services: [],
    message: 'Exact expenditure was not selected for this refresh.',
  });

  const metricResults = await Promise.allSettled([
    selected.has('storage') ? queryMetric('firestore.googleapis.com/storage/data_and_index_storage_bytes', currentStorageStart, now, {
      alignmentPeriodSeconds: 3600, aligner: 'ALIGN_MAX', reducer: 'REDUCE_SUM',
    }) : Promise.resolve([]),
    selected.has('storage') && bucket ? queryMetric('storage.googleapis.com/storage/v2/total_bytes', currentStorageStart, now, {
      resourceFilter: `resource.labels.bucket_name = \"${bucket}\"`,
      alignmentPeriodSeconds: 3600, aligner: 'ALIGN_MAX', reducer: 'REDUCE_SUM',
    }) : Promise.resolve([]),
    selected.has('storage') && bucket ? queryMetric('storage.googleapis.com/storage/v2/total_count', currentStorageStart, now, {
      resourceFilter: `resource.labels.bucket_name = \"${bucket}\"`,
      alignmentPeriodSeconds: 3600, aligner: 'ALIGN_MAX', reducer: 'REDUCE_SUM',
    }) : Promise.resolve([]),
    selected.has('operations') ? queryMetric('firestore.googleapis.com/document/read_count', range.startTime, range.endTime, {
      alignmentPeriodSeconds: range.bucketSeconds, aligner: 'ALIGN_SUM', reducer: 'REDUCE_SUM',
    }) : Promise.resolve([]),
    selected.has('operations') ? queryMetric('firestore.googleapis.com/document/write_count', range.startTime, range.endTime, {
      alignmentPeriodSeconds: range.bucketSeconds, aligner: 'ALIGN_SUM', reducer: 'REDUCE_SUM',
    }) : Promise.resolve([]),
    selected.has('operations') ? queryMetric('firestore.googleapis.com/document/delete_count', range.startTime, range.endTime, {
      alignmentPeriodSeconds: range.bucketSeconds, aligner: 'ALIGN_SUM', reducer: 'REDUCE_SUM',
    }) : Promise.resolve([]),
  ]);

  const metricPoints: MetricPoint[][] = metricResults.map(result => result.status === 'fulfilled' ? result.value : []);
  const monitoringFailure = metricResults.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  const monitoringMessage = monitoringFailure
    ? monitoringFailure.reason instanceof Error
      ? monitoringFailure.reason.message
      : 'Cloud Monitoring is unavailable.'
    : undefined;
  const [firestoreStorage, storageBytesMetric, storageObjectsMetric, readPoints, writePoints, deletePoints] = metricPoints;
  const firestoreStorageResult = latestMetric(firestoreStorage);
  const storageBytesResult = latestMetric(storageBytesMetric);
  const storageObjectsResult = latestMetric(storageObjectsMetric);
  const operationPoints = [readPoints, writePoints, deletePoints];
  const operationTotals = operationPoints.map(points => points.reduce((sum, point) => sum + (numericValue(point) || 0), 0));
  const dataAndIndexBytes = firestoreStorageResult.value;
  const [collectionStats, billing] = await Promise.all([collectionStatsPromise, billingPromise]);

  return {
    checkedAt: now.toISOString(),
    refreshed: REFRESH_SECTIONS.filter(section => selected.has(section)),
    range: {
      preset: range.preset,
      startTime: range.startTime.toISOString(),
      endTime: range.endTime.toISOString(),
      bucketSeconds: range.bucketSeconds,
    },
    firestore: {
      collections: collectionStats.value.collections,
      totalDocuments: collectionStats.value.totalDocuments,
      collectionStatsMeasuredAt: collectionStats.value.measuredAt,
      collectionCountReads: collectionStats.value.countReads,
      collectionSampleReads: collectionStats.value.sampleReads,
      collectionStatsServedFromCache: collectionStats.servedFromCache,
      dataAndIndexBytes,
      dataAndIndexMeasuredAt: firestoreStorageResult.measuredAt,
      freeStorageAllowanceBytes: FIRESTORE_FREE_STORAGE_BYTES,
      freeStorageRemainingBytes: dataAndIndexBytes === null ? null : Math.max(0, FIRESTORE_FREE_STORAGE_BYTES - dataAndIndexBytes),
      freeStorageOverageBytes: dataAndIndexBytes === null ? null : Math.max(0, dataAndIndexBytes - FIRESTORE_FREE_STORAGE_BYTES),
    },
    storage: {
      bytes: storageBytesResult.value,
      objects: storageObjectsResult.value,
      measuredAt: storageBytesResult.measuredAt || storageObjectsResult.measuredAt,
    },
    operations: {
      reads: selected.has('operations') ? operationTotals[0] : null,
      writes: selected.has('operations') ? operationTotals[1] : null,
      deletes: selected.has('operations') ? operationTotals[2] : null,
      measuredAt: selected.has('operations') && operationPoints.some(points => points.length > 0)
        ? range.endTime.toISOString()
        : null,
      trend: selected.has('operations') ? buildOperationTrend(readPoints, writePoints, deletePoints) : [],
    },
    billing,
    monitoring: {
      ran: selected.has('operations') || selected.has('storage'),
      available: !monitoringMessage,
      message: monitoringMessage,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    await assertAdmin(request);
    const range = resolveUsageRange(request);
    const selected = resolveRefreshSections(request);
    const selectionKey = REFRESH_SECTIONS.filter(section => selected.has(section)).join(',');
    const cacheKey = `${range.cacheKey}|${selectionKey}`;
    const cached = cachedStatsByRange.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json({ ...cached.value, servedFromCache: true });
    }

    const stats = await buildUsageStats(range, selected);
    cachedStatsByRange.set(cacheKey, { value: stats, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
    if (cachedStatsByRange.size > 12) cachedStatsByRange.delete(cachedStatsByRange.keys().next().value as string);
    return NextResponse.json({ ...stats, servedFromCache: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Firebase usage.';
    const status = message.includes('administrator') || message.includes('Sign in') ? 403 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
