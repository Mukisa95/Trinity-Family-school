import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fsFields }),
  });
}

// ─── Schedule logic ──────────────────────────────────────────────────────────

function getNextRunTime(job: Record<string, unknown>): Date | null {
  const type = job.type as string;
  const schedule = (job.schedule ?? {}) as Record<string, unknown>;
  const now = new Date();

  // Helper to get time today as Date
  const parseTimeToday = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  if (type === 'once') {
    return new Date(schedule.dateTime as string);
  }

  if (type === 'weekly') {
    const days = (schedule.days as string[]) || [];
    const times = (schedule.times as Record<string, string>) || {};
    const startDate = schedule.startDate ? new Date(schedule.startDate as string) : null;
    const endDate = schedule.endDate ? new Date(schedule.endDate as string) : null;
    
    // Adjust dates to cover full days
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    if (endDate && now > endDate) return null;

    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };

    let earliest: Date | null = null;
    const currentDayHash = now.getDay();
    const lastSentStr = job.lastSentAt as string | undefined;
    const lastSent = lastSentStr ? new Date(lastSentStr) : null;

    for (const day of days) {
      const targetDay = dayMap[day];
      const timeStr = (times[day] || '08:00') as string;
      const targetTimeToday = parseTimeToday(timeStr);
      
      const candidate = new Date(now);
      let diff = (targetDay - currentDayHash + 7) % 7;

      // If the target day is today
      if (diff === 0) {
        // If the target time hasn't passed yet, it's today's occurrence
        if (now < targetTimeToday) {
          // Keep diff = 0
        } 
        // If the target time HAS passed
        else {
          // Check if we already sent it today
          const sentToday = lastSent && lastSent.toDateString() === now.toDateString();
          if (!sentToday && now.getTime() - targetTimeToday.getTime() < 60 * 60 * 1000) {
            // We missed it within the last hour! We should fire it immediately.
            // Returning targetTimeToday (which is in the past) will cause it to fire.
            const missedCandidate = new Date(targetTimeToday);
            if (!earliest || missedCandidate < earliest) earliest = missedCandidate;
            continue;
          } else {
            // Either already sent, or missed by too far (or just push to next week)
            diff = 7;
          }
        }
      }

      candidate.setDate(candidate.getDate() + diff);
      const [h, m] = timeStr.split(':').map(Number);
      candidate.setHours(h, m, 0, 0);

      if (startDate && candidate < startDate) continue;
      if (!earliest || candidate < earliest) earliest = candidate;
    }
    return earliest;
  }

  if (type === 'dates') {
    const entries = (schedule.entries as Array<{ date: string; time: string }>) || [];
    const lastSentStr = job.lastSentAt as string | undefined;
    const lastSent = lastSentStr ? new Date(lastSentStr) : null;
    
    // We want the earliest date that is either in the future, OR in the past 1hr and not sent today
    const upcoming = entries
      .map(e => new Date(`${e.date}T${e.time || '08:00'}`))
      .filter(d => {
         if (d > now) return true; // future
         // If past, but within 1 hour and haven't sent today
         const sentToday = lastSent && lastSent.toDateString() === d.toDateString();
         if (!sentToday && now.getTime() - d.getTime() < 60 * 60 * 1000) return true;
         return false;
      })
      .sort((a, b) => a.getTime() - b.getTime());
    return upcoming[0] ?? null;
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
  // On Vercel, cron requests come from Vercel infrastructure — check x-vercel-signature or just rely on the secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
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
    headers: { 'Content-Type': 'application/json' },
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
  const windowEnd = new Date(now.getTime() + 65_000); // 65 second window

  const results: Array<{ id: string; sent: boolean; error?: string }> = [];

  for (const raw of docs) {
    const job = parseDoc(raw);
    if (job.status !== 'scheduled') continue;

    const nextRun = getNextRunTime(job);
    if (!nextRun || nextRun > windowEnd) continue;

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
      const success = sendRes.ok && (sendData.success === true || sendData.status === 'success');

      if (success) {
        // Determine new status
        let newStatus = 'sent';
        const schedule = (job.schedule ?? {}) as Record<string, unknown>;
        if (job.type === 'weekly') {
          const endDate = schedule.endDate ? new Date(schedule.endDate as string) : null;
          newStatus = (!endDate || now < endDate) ? 'scheduled' : 'completed';
        } else if (job.type === 'dates') {
          const entries = (schedule.entries as Array<{ date: string; time: string }>) || [];
          const remaining = entries.filter(e => new Date(`${e.date}T${e.time || '08:00'}`) > now);
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
