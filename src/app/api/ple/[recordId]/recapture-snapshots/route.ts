import { requireAppUser } from '@/lib/server/app-auth';
import { CircumferenceError, requireScopedPupil, canReadScopedModule } from '@/lib/server/circumference';
import { NextRequest, NextResponse } from 'next/server';
import { PLEResultsService } from '@/lib/services/ple-results.service';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ recordId: string }> }
) {
    try {
        const actor = await requireAppUser(request);
        if (!canReadScopedModule(actor, 'pupilTermSnapshots')) throw new CircumferenceError();
        await ensureServerFirestoreAuth();
        const { recordId } = await params;
        const body = await request.json();
        const { pupilIds } = body;

        if (!pupilIds || !Array.isArray(pupilIds) || pupilIds.length === 0) {
            return NextResponse.json(
                { error: 'pupilIds array is required and must not be empty' },
                { status: 400 }
            );
        }

        // Call the service to recapture snapshots
        await Promise.all(pupilIds.map((id: string) => requireScopedPupil(actor, id)));
        const result = await PLEResultsService.recapturePLEPupilSnapshotsBatch(
            recordId,
            pupilIds
        );

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error) {
        if (error instanceof CircumferenceError) return NextResponse.json({error: error.message}, {status: error.status});
        console.error('Error in recapture-snapshots API:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to recapture snapshots',
                success: false
            },
            { status: 500 }
        );
    }
}
