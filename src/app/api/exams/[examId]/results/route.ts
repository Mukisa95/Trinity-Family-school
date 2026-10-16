import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { CircumferenceError, readWithinCircumference } from '@/lib/server/circumference';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const actor = await requireAppUser(request), { examId } = await params;
    if (!examId || examId.includes('/')) return NextResponse.json({ error: 'Choose a valid exam.' }, { status: 400 });
    const [result] = await readWithinCircumference(actor, { collection: 'examResults', filters: [{ field: 'examId', op: '==', value: examId }] });
    if (!result) return NextResponse.json({ error: 'Exam results were not found in your scope.' }, { status: 404 });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return NextResponse.json({ error: 'Could not load the authorized exam results.' }, { status: error instanceof CircumferenceError ? error.status : String(error).includes('AUTH') || String(error).includes('INACTIVE') ? 401 : 500 }); }
}
