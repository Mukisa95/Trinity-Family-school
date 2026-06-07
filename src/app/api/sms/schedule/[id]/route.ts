import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools').trim();
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const API_KEY = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '').trim();

function firestoreUrl(path: string) {
  const url = new URL(`${FIRESTORE_BASE}/${path}`);
  if (API_KEY) url.searchParams.set('key', API_KEY);
  return url.toString();
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // Read the doc first to get the lockedAmount (purely informational for the response)
    const getRes = await fetch(firestoreUrl(`scheduledSMS/${id}`));
    let lockedAmount = 0;
    if (getRes.ok) {
      const doc = await getRes.json();
      const fields = doc.fields ?? {};
      lockedAmount = Number(fields.lockedAmount?.integerValue ?? fields.lockedAmount?.doubleValue ?? 0);
    }

    // Update status to cancelled via PATCH
    const patchUrl = new URL(`${FIRESTORE_BASE}/scheduledSMS/${id}`);
    if (API_KEY) patchUrl.searchParams.set('key', API_KEY);
    patchUrl.searchParams.set('updateMask.fieldPaths', 'status');

    const patchRes = await fetch(patchUrl.toString(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          status: { stringValue: 'cancelled' },
        },
      }),
    });

    if (!patchRes.ok) {
      const txt = await patchRes.text();
      return NextResponse.json({ success: false, error: txt }, { status: 502 });
    }

    return NextResponse.json({ success: true, lockedAmount });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
