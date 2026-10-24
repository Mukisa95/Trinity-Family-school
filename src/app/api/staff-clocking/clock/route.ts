import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { recordStaffClockingScan } from '@/lib/server/staff-clocking';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) { try { const actor = await requireAppUser(request); return NextResponse.json({ success: true, result: await recordStaffClockingScan(getFirestore(getFirebaseAdminApp()), actor, await request.json()) }); } catch (error) { const message = error instanceof Error ? error.message : 'Unable to record clocking.'; return NextResponse.json({ success: false, error: message }, { status: ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : message === 'PERMISSION_DENIED' ? 403 : 409 }); } }
