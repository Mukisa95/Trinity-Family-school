import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { savePlannedEvent } from '@/lib/server/event-save';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
    try {
        const actor = await requireAppUser(request);
        return NextResponse.json(await savePlannedEvent(actor, await request.json()));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'The event could not be saved.';
        return NextResponse.json({ error: message }, { status: /AUTH_REQUIRED/.test(message) ? 401 : /FORBIDDEN|Circumference/.test(message) ? 403 : 400 });
    }
}
