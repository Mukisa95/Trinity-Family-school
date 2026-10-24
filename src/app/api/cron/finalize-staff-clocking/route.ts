import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { finalizeOpenStaffClockingDate } from '@/lib/server/staff-clocking';

export const runtime = 'nodejs';
function yesterdayInKampala() { const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value])); const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); }
export async function GET(request: NextRequest) { const secret = process.env.CRON_SECRET; const supplied = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''); if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); try { return NextResponse.json({ success: true, result: await finalizeOpenStaffClockingDate(getFirestore(getFirebaseAdminApp()), yesterdayInKampala()) }); } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to finalize staff clocking.' }, { status: 500 }); } }
