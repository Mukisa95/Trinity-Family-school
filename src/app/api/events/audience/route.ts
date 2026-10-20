import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { eventPlanningSchema, loadEventAudience } from '@/lib/server/event-audience';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
    try {
        const actor = await requireAppUser(request), plan = eventPlanningSchema.parse(await request.json());
        const { recipients } = await loadEventAudience(actor, plan);
        // Names, routing and contact details only; never return account credentials.
        return NextResponse.json({ recipients: recipients.map(person => ({ ...person, pupil: person.pupil ? { id: person.pupil.id, firstName: person.pupil.firstName, lastName: person.pupil.lastName, otherNames: person.pupil.otherNames || '', admissionNumber: person.pupil.admissionNumber, classId: person.pupil.classId, classCode: person.pupil.classCode || '', section: person.pupil.section, gender: person.pupil.gender, status: person.pupil.status, guardians: [] } : undefined, guardian: person.guardian ? { id: person.guardian.id, firstName: person.guardian.firstName, lastName: person.guardian.lastName, phone: person.guardian.phone } : undefined })) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : '';
        const status = /AUTH_REQUIRED/.test(message) ? 401 : /FORBIDDEN|Circumference|permission/.test(message) ? 403 : 400;
        return NextResponse.json({ error: status === 401 ? 'Sign in to select event recipients.' : message || 'The event audience could not load.' }, { status });
    }
}
