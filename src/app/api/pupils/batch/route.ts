import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pupilIds } = body;

    if (!pupilIds || !Array.isArray(pupilIds)) {
      return NextResponse.json(
        { error: 'pupilIds array is required' },
        { status: 400 }
      );
    }

    if (pupilIds.length === 0) {
      return NextResponse.json({});
    }

    const db = getFirestore(getFirebaseAdminApp());

    console.log(`🚀 BATCH API: Fetching ${pupilIds.length} pupils via Admin SDK`);
    const startTime = Date.now();

    // Firestore Admin SDK supports up to 30 document IDs per getAll() call.
    // Chunk into groups of 30 to handle large batches safely.
    const CHUNK_SIZE = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < pupilIds.length; i += CHUNK_SIZE) {
      chunks.push(pupilIds.slice(i, i + CHUNK_SIZE));
    }

    const allDocs = await Promise.all(
      chunks.map((chunk) => {
        const docRefs = chunk.map((id) => db.collection('pupils').doc(id));
        return db.getAll(...docRefs);
      })
    );

    const pupilsMap: Record<string, any> = {};
    for (const snapshots of allDocs) {
      for (const snap of snapshots) {
        if (snap.exists) {
          pupilsMap[snap.id] = { id: snap.id, ...snap.data() };
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ BATCH API: Fetched ${Object.keys(pupilsMap).length} pupils in ${duration}ms`);

    return NextResponse.json(pupilsMap);
  } catch (error) {
    console.error('❌ BATCH API: Error fetching pupils:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pupils data' },
      { status: 500 }
    );
  }
}
