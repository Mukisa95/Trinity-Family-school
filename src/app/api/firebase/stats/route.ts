import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
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

class MonitoringRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MonitoringRequestError';
  }
}

type UsageStats = {
  checkedAt: string;
  windowHours: number;
  firestore: {
    collections: Array<{ name: string; documents: number }>;
    totalDocuments: number;
    dataAndIndexBytes: number | null;
    dataAndIndexMeasuredAt: string | null;
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
  };
  monitoring: { available: boolean; message?: string };
  servedFromCache: boolean;
};

let cachedStats: Omit<UsageStats, 'servedFromCache'> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function numericValue(point: MetricPoint): number | null {
  const value = point.value?.int64Value ?? point.value?.doubleValue;
  const numberValue = typeof value === 'string' ? Number(value) : value;
  return typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : null;
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

async function queryMetric(metricType: string, startTime: Date, resourceFilter?: string): Promise<MetricPoint[]> {
  const projectId = getFirebaseAdminProjectId();
  if (!projectId) throw new Error('FIREBASE_ADMIN_PROJECT_ID is not configured.');

  const accessToken = await getAccessToken();
  const filter = [`metric.type = \"${metricType}\"`, resourceFilter].filter(Boolean).join(' AND ');
  const points: MetricPoint[] = [];
  let pageToken: string | undefined;

  do {
    const search = new URLSearchParams({
      filter,
      'interval.startTime': startTime.toISOString(),
      'interval.endTime': new Date().toISOString(),
      view: 'FULL',
      pageSize: '1000',
    });
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

function latestMetric(points: MetricPoint[]) {
  const values = points
    .map(point => ({ value: numericValue(point), measuredAt: point.interval?.endTime || null }))
    .filter((point): point is { value: number; measuredAt: string | null } => point.value !== null);
  if (!values.length) return { value: null, measuredAt: null };

  const latestTimestamp = Math.max(...values.map(point => Date.parse(point.measuredAt || '') || 0));
  const latest = values.filter(point => (Date.parse(point.measuredAt || '') || 0) === latestTimestamp);
  return { value: latest.reduce((sum, point) => sum + point.value, 0), measuredAt: latest[0]?.measuredAt || null };
}

async function buildUsageStats(): Promise<Omit<UsageStats, 'servedFromCache'>> {
  const app = getFirebaseAdminApp();
  const firestore = getFirestore(app);
  const collections = await firestore.listCollections();
  const collectionCounts = await Promise.all(collections.map(async collection => ({
    name: collection.id,
    documents: (await collection.count().get()).data().count,
  })));
  collectionCounts.sort((a, b) => b.documents - a.documents);

  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const bucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  let dataAndIndexBytes: number | null = null;
  let dataAndIndexMeasuredAt: string | null = null;
  let storageBytes: number | null = null;
  let storageObjects: number | null = null;
  let storageMeasuredAt: string | null = null;
  let reads: number | null = null;
  let writes: number | null = null;
  let deletes: number | null = null;
  let operationsMeasuredAt: string | null = null;
  let monitoringMessage: string | undefined;

  try {
    const metricResults = await Promise.allSettled([
      queryMetric('firestore.googleapis.com/storage/data_and_index_storage_bytes', windowStart),
      bucket ? queryMetric('storage.googleapis.com/storage/v2/total_bytes', new Date(now.getTime() - 48 * 60 * 60 * 1000), `resource.labels.bucket_name = \"${bucket}\"`) : Promise.resolve([]),
      bucket ? queryMetric('storage.googleapis.com/storage/v2/total_count', new Date(now.getTime() - 48 * 60 * 60 * 1000), `resource.labels.bucket_name = \"${bucket}\"`) : Promise.resolve([]),
      queryMetric('firestore.googleapis.com/document/read_count', windowStart),
      queryMetric('firestore.googleapis.com/document/write_count', windowStart),
      queryMetric('firestore.googleapis.com/document/delete_count', windowStart),
    ]);

    const metricPoints: MetricPoint[][] = metricResults.map(result =>
      result.status === 'fulfilled' ? result.value : [],
    );
    const monitoringFailure = metricResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (monitoringFailure) {
      monitoringMessage = monitoringFailure.reason instanceof Error
        ? monitoringFailure.reason.message
        : 'Cloud Monitoring is unavailable.';
    }
    const [firestoreStorage, storageBytesMetric, storageObjectsMetric, readPoints, writePoints, deletePoints] = metricPoints;

    const firestoreStorageResult = latestMetric(firestoreStorage);
    const storageBytesResult = latestMetric(storageBytesMetric);
    const storageObjectsResult = latestMetric(storageObjectsMetric);
    dataAndIndexBytes = firestoreStorageResult.value;
    dataAndIndexMeasuredAt = firestoreStorageResult.measuredAt;
    storageBytes = storageBytesResult.value;
    storageObjects = storageObjectsResult.value;
    storageMeasuredAt = storageBytesResult.measuredAt || storageObjectsResult.measuredAt;

    const operationPoints = [readPoints, writePoints, deletePoints];
    const operationTotals = operationPoints.map(points => points.reduce((sum, point) => sum + (numericValue(point) || 0), 0));
    reads = operationTotals[0];
    writes = operationTotals[1];
    deletes = operationTotals[2];
    if (operationPoints.some(points => points.length > 0)) {
      operationsMeasuredAt = now.toISOString();
    }
  } catch (error) {
    monitoringMessage = error instanceof Error ? error.message : 'Cloud Monitoring is unavailable.';
  }

  return {
    checkedAt: now.toISOString(),
    windowHours: 24,
    firestore: {
      collections: collectionCounts,
      totalDocuments: collectionCounts.reduce((sum, collection) => sum + collection.documents, 0),
      dataAndIndexBytes,
      dataAndIndexMeasuredAt,
    },
    storage: { bytes: storageBytes, objects: storageObjects, measuredAt: storageMeasuredAt },
    operations: { reads, writes, deletes, measuredAt: operationsMeasuredAt },
    monitoring: { available: !monitoringMessage, message: monitoringMessage },
  };
}

export async function GET(request: NextRequest) {
  try {
    await assertAdmin(request);

    if (cachedStats && Date.now() < cacheExpiresAt) {
      return NextResponse.json({ ...cachedStats, servedFromCache: true });
    }

    cachedStats = await buildUsageStats();
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return NextResponse.json({ ...cachedStats, servedFromCache: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Firebase usage.';
    const status = message.includes('administrator') || message.includes('Sign in') ? 403 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
