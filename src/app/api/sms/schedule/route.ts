import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firestoreUrl(path: string, query?: Record<string, string>) {
  const url = new URL(`${FIRESTORE_BASE}/${path}`);
  if (API_KEY) url.searchParams.set('key', API_KEY);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

/** Parse a Firestore REST document into a plain JS object */
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

function parseValue(val: Record<string, unknown>): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue; // ISO string
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

// ─── GET — list scheduled SMS from Firestore REST ────────────────────────────
export async function GET() {
  try {
    const url = firestoreUrl('scheduledSMS', { orderBy: 'createdAt desc', pageSize: '100' });
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ success: false, error: txt }, { status: 502 });
    }
    const data = await res.json();
    const docs = (data.documents as Array<Record<string, unknown>>) ?? [];
    const jobs = docs.map(parseDoc);

    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── POST — NOTE: job creation is now done from the client directly ────────
// This endpoint is kept for completeness (e.g., server-side validation) but
// the primary write path is the SMSScheduleDialog using the Firebase client SDK.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, message, recipients, schedule, estimatedSMSCount, estimatedCost } = body;

    if (!type || !message || !recipients) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check live Wiza balance
    const username = process.env.WIZA_SMS_USERNAME || '';
    const password = process.env.WIZA_SMS_PASSWORD || '';
    let walletBalance = -1;
    let balanceSufficient = true;

    if (username && password) {
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      try {
        const balRes = await fetch('https://api.wizasms.ug/v1/sms/balance', {
          headers: { 'Authorization': `Basic ${auth}` },
          signal: AbortSignal.timeout(6000),
        });
        if (balRes.ok) {
          const balData = await balRes.json();
          walletBalance = parseFloat(balData.balance ?? balData.wallet_balance ?? balData.amount ?? 0);
        }
      } catch { /* ignore — proceed without balance check */ }
    }

    if (walletBalance >= 0) {
      balanceSufficient = walletBalance >= (estimatedCost ?? 0);
    }

    return NextResponse.json({ success: true, balanceSufficient, walletBalance });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
