import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { collection, limit, orderBy, query, getDocs } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');

    const url = new URL(request.url);
    const maxResults = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

    const q = query(
      collection(db, 'schoolPaySyncLogs'),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('❌ [SchoolPay Logs] Error fetching logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
