import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { manageClockingDutySource } from '@/lib/server/staff-clocking/duty-management';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    return NextResponse.json({success:true,result:await manageClockingDutySource(getFirestore(getFirebaseAdminApp()),actor,await request.json())});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save the duty record.';
    return NextResponse.json({success:false,error:message},{status:['AUTH_REQUIRED','APP_AUTH_REQUIRED'].includes(message)?401:['PERMISSION_DENIED','ACCOUNT_INACTIVE'].includes(message)?403:400});
  }
}
