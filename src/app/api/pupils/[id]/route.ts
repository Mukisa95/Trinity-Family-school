import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { updatePupilWithCacheRevision } from '@/lib/server/pupil-cache-revisions.admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pupilId } = await params;
    console.log('🔍 API: Fetching pupil with ID:', pupilId);

    if (!pupilId) {
      return NextResponse.json(
        { error: 'Pupil ID is required' },
        { status: 400 }
      );
    }

    const db = getFirestore(getFirebaseAdminApp());
    const snap = await db.collection('pupils').doc(pupilId).get();

    if (!snap.exists) {
      console.error('🔍 API: Pupil not found for ID:', pupilId);
      return NextResponse.json(
        { error: 'Pupil not found' },
        { status: 404 }
      );
    }

    const pupil = { id: snap.id, ...snap.data() };
    console.log('🔍 API: Pupil data keys:', Object.keys(pupil));

    return NextResponse.json(pupil);
  } catch (error) {
    console.error('🔍 API: Error fetching pupil:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pupil data' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pupilId } = await params;
    const body = await request.json();

    if (!pupilId) {
      return NextResponse.json(
        { error: 'Pupil ID is required' },
        { status: 400 }
      );
    }

    const db = getFirestore(getFirebaseAdminApp());
    await updatePupilWithCacheRevision(db, db.collection('pupils').doc(pupilId), body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating pupil:', error);
    return NextResponse.json(
      { error: 'Failed to update pupil' },
      { status: 500 }
    );
  }
}
