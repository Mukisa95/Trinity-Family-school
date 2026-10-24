import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { createStaffClockingClosure, listStaffClockingClosures } from '@/lib/server/staff-clocking';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { try { const actor = await requireAppUser(request); return NextResponse.json({ success: true, result: { closures: await listStaffClockingClosures(getFirestore(getFirebaseAdminApp()), actor) } }); } catch (error) { const message = error instanceof Error ? error.message : 'Unable to load closures.'; return NextResponse.json({ success: false, error: message }, { status: message === 'PERMISSION_DENIED' ? 403 : 400 }); } }
export async function POST(request: NextRequest) { try { const actor = await requireAppUser(request); return NextResponse.json({ success: true, result: await createStaffClockingClosure(getFirestore(getFirebaseAdminApp()), actor, await request.json()) }, { status: 201 }); } catch (error) { const message = error instanceof Error ? error.message : 'Unable to create closure.'; return NextResponse.json({ success: false, error: message }, { status: message === 'PERMISSION_DENIED' ? 403 : 400 }); } }
