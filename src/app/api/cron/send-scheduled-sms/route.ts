import { NextRequest, NextResponse } from 'next/server';
import { getServerFirestoreRestHeaders } from '@/lib/server/firestore-rest-auth';

export const dynamic = 'force-dynamic';

const PROJECT_ID = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools').trim();
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const API_KEY = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '').trim();
const KAMPALA_UTC_OFFSET_MINUTES = 3 * 60;

// ─── Firestore REST helpers ──────────────────────────────────────────────────

function fsUrl(path: string, params?: Record<string, string>) {
  const url = new URL(`${FIRESTORE_BASE}/${path}`);
  if (API_KEY) url.searchParams.set('key', API_KEY);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

function tsNow(): string {
  return new Date().toISOString();
}

function parseValue(val: Record<string, unknown>): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const arr = (val.arrayValue as Record<string, unknown>).values as Array<Record<string, unknown>> | undefined;
    return arr ? arr.map(parseValue) : [];
  }
  if ('mapValue' in val) {
    const nested = (val.mapValue as Record<string, unknown>).fields as Record<string, unknown> | undefined;
    if (!nested) return {};
    return Object.fromEntries(Object.entries(nested).map(([k, v]) => [k, parseValue(v as Record<string, unknown>)]));
  }
  return null;
}

function parseDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const name = doc.name as string;
  const id = name.split('/').pop() as string;
  const fields = (doc.fields as Record<string, unknown>) ?? {};
  const out: Record<string, unknown> = { id };
  for (const [key, val] of Object.entries(fields)) {
    out[key] = parseValue(val as Record<string, unknown>);
  }
  return out;
}

async function patchField(docId: string, fields: Record<string, unknown>) {
  const paths = Object.keys(fields);
  const url = new URL(`${FIRESTORE_BASE}/scheduledSMS/${docId}`);
  if (API_KEY) url.searchParams.set('key', API_KEY);
  paths.forEach(p => url.searchParams.append('updateMask.fieldPaths', p));

  const fsFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') fsFields[k] = { stringValue: v };
    else if (typeof v === 'number') fsFields[k] = { doubleValue: v };
    else if (v === null) fsFields[k] = { nullValue: null };
  }

  await fetch(url.toString(), {
    method: 'PATCH',
    headers: await getServerFirestoreRestHeaders(),
    body: JSON.stringify({ fields: fsFields }),
  });
}

// ─── Schedule logic ──────────────────────────────────────────────────────────

function parseKampalaDateTime(dateTime: string): Date {
  if (!dateTime) return new Date(NaN);

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(dateTime)) {
    return new Date(dateTime);
  }

  const [datePart, timePart = '00:00'] = dateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = 0, minute = 0] = timePart.split(':').map(Number);

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - KAMPALA_UTC_OFFSET_MINUTES * 60_000);
}

function parseKampalaDateAndTime(date: string, time = '08:00'): Date {
  return parseKampalaDateTime(`${date}T${time}`);
}

function formatKampalaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDaysToDateString(date: string, days: number): string {
  const next = parseKampalaDateAndTime(date, '12:00');
  next.setUTCDate(next.getUTCDate() + days);
  return formatKampalaDate(next);
}

function getDueRunTime(job: Record<string, unknown>, now: Date): Date | null {
  const type = job.type as string;
  const schedule = (job.schedule ?? {}) as Record<string, unknown>;
  const lastSentStr = job.lastSentAt as string | undefined;
  const lastSent = lastSentStr ? new Date(lastSentStr) : null;

  if (type === 'once') {
    const runAt = parseKampalaDateTime(schedule.dateTime as string);
    if (Number.isNaN(runAt.getTime()) || runAt > now) return null;
    if (lastSent && lastSent >= runAt) return null;
    return runAt;
  }

  if (type === 'weekly') {
    const days = (schedule.days as string[]) || [];
    const times = (schedule.times as Record<string, string>) || {};
    const startDate = schedule.startDate as string | undefined;
    const endDate = schedule.endDate as string | undefined;
    const today = formatKampalaDate(now);

    if (!startDate || !endDate || days.length === 0) return null;
    if (parseKampalaDateAndTime(endDate, '23:59') < now && endDate < today) return null;

    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };

    let cursor = startDate;
    const searchUntil = today < endDate ? today : endDate;

    while (cursor <= searchUntil) {
      const dayNumber = parseKampalaDateAndTime(cursor, '12:00').getUTCDay();
      const dayName = Object.entries(dayMap).find(([, value]) => value === dayNumber)?.[0];

      if (dayName && days.includes(dayName)) {
        const candidate = parseKampalaDateAndTime(cursor, times[dayName] || '08:00');
        if (candidate <= now && (!lastSent || candidate > lastSent)) return candidate;
      }

      cursor = addDaysToDateString(cursor, 1);
    }

    return null;
  }

  if (type === 'dates') {
    const entries = (schedule.entries as Array<{ date: string; time: string }>) || [];
    const due = entries
      .map(e => parseKampalaDateAndTime(e.date, e.time || '08:00'))
      .filter(d => d <= now && (!lastSent || d > lastSent))
      .sort((a, b) => a.getTime() - b.getTime());

    return due[0] ?? null;
  }

  return null;
}

function formatPhone(phone: string): string {
  let p = String(phone).replace(/[\s\-\(\)]/g, '');
  if (!p.startsWith('+')) {
    if (p.startsWith('0')) p = '256' + p.substring(1);
    else if (!p.startsWith('256')) p = '256' + p;
    p = '+' + p;
  }
  return p;
}

// ─── GET — cron entry point ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('user-agent') === 'vercel-cron/1.0';

  if (
    process.env.CRON_SECRET &&
    secret !== process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    !isVercelCron
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const creds = (() => {
    const u = process.env.WIZA_SMS_USERNAME || '';
    const p = process.env.WIZA_SMS_PASSWORD || '';
    if (!u || !p) return null;
    return { auth: Buffer.from(`${u}:${p}`).toString('base64'), senderId: process.env.WIZA_SMS_SENDER_ID || 'TRINITY' };
  })();

  if (!creds) return NextResponse.json({ error: 'Wiza credentials not configured' }, { status: 500 });

  // Fetch scheduled jobs from Firestore REST using runQuery to save massive read quota
  const queryUrl = new URL(`${FIRESTORE_BASE}:runQuery`);
  if (API_KEY) queryUrl.searchParams.set('key', API_KEY);

  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'scheduledSMS' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'scheduled' }
        }
      },
      limit: 50
    }
  };

  const listRes = await fetch(queryUrl.toString(), {
    method: 'POST',
    headers: await getServerFirestoreRestHeaders(),
    body: JSON.stringify(queryBody)
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    return NextResponse.json({ error: 'Could not read Firestore', details: errText }, { status: 502 });
  }

  const listData = await listRes.json();
  // runQuery returns an array of objects like { document: { name, fields, ... }, readTime }
  const docs = listData.map((d: any) => d.document).filter(Boolean);
  const now = new Date();

  const results: Array<{ id: string; sent: boolean; error?: string }> = [];

  for (const raw of docs) {
    const job = parseDoc(raw);
    if (job.status !== 'scheduled') continue;

    const dueRun = getDueRunTime(job, now);
    if (!dueRun) continue;

    const id = job.id as string;

    try {
      const phones: string[] = ((job.recipients as Record<string, unknown>)?.resolvedPhones as string[] ?? []).map(formatPhone);
      if (phones.length === 0) {
        await patchField(id, { status: 'error', lastError: 'No phone numbers' });
        continue;
      }

      const sendRes = await fetch('https://api.wizasms.ug/v1/sms/send', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${creds.auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: phones, message: job.message, sender_id: creds.senderId }),
      });

      const sendText = await sendRes.text();
      let sendData: Record<string, unknown> = {};
      try { sendData = JSON.parse(sendText); } catch { /* non-JSON */ }
      const success = sendRes.ok && (sendData.success === true || sendData.status === 'success' || sendRes.ok);

      if (success) {
        // Determine new status
        let newStatus = 'sent';
        const schedule = (job.schedule ?? {}) as Record<string, unknown>;
        if (job.type === 'weekly') {
          const endDate = schedule.endDate ? parseKampalaDateAndTime(schedule.endDate as string, '23:59') : null;
          newStatus = (!endDate || now < endDate) ? 'scheduled' : 'completed';
        } else if (job.type === 'dates') {
          const entries = (schedule.entries as Array<{ date: string; time: string }>) || [];
          const remaining = entries.filter(e => parseKampalaDateAndTime(e.date, e.time || '08:00') > now);
          newStatus = remaining.length > 0 ? 'scheduled' : 'completed';
        }

        await patchField(id, { status: newStatus, lastSentAt: tsNow() });
        results.push({ id, sent: true });
      } else {
        await patchField(id, { status: 'error', lastError: sendText.substring(0, 300), lastAttemptAt: tsNow() });
        results.push({ id, sent: false, error: sendText.substring(0, 200) });
      }
    } catch (err) {
      results.push({ id, sent: false, error: err instanceof Error ? err.message : 'Unknown' });
    }
  }

  return NextResponse.json({ success: true, processed: results.length, results });
}
