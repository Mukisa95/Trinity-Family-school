import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { scopedPupils, CircumferenceError, canReadScopedModule } from '@/lib/server/circumference';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (actor.user.role !== 'Parent' && !canReadScopedModule(actor, 'pupils')) throw new CircumferenceError();
    const { pupilIds } = await request.json();
    if (!Array.isArray(pupilIds) || pupilIds.length > 2000 || pupilIds.some(id => typeof id !== 'string' || !id || id.length > 160 || id.includes('/'))) return NextResponse.json({ error: 'Choose valid pupil IDs.' }, { status: 400 });
    const pupils = await scopedPupils(actor, [...new Set(pupilIds)] as string[]);
    return NextResponse.json(Object.fromEntries(pupils.map(pupil => [pupil.id, pupil])), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return NextResponse.json({ error: 'Could not load the authorized pupils.' }, { status: error instanceof CircumferenceError ? error.status : String(error).includes('AUTH') || String(error).includes('INACTIVE') ? 401 : 500 }); }
}
