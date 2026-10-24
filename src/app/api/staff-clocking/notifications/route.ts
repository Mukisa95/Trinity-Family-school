import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { listOwnStaffClockingNotifications } from '@/lib/server/staff-clocking';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { try { const actor = await requireAppUser(request); return NextResponse.json({ success: true, result: { notifications: await listOwnStaffClockingNotifications(getFirestore(getFirebaseAdminApp()), actor) } }); } catch (error) { const message = error instanceof Error ? error.message : 'Unable to load clocking notifications.'; return NextResponse.json({ success: false, error: message }, { status: message === 'PERMISSION_DENIED' ? 403 : 400 }); } }
