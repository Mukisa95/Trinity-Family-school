import { NextRequest, NextResponse } from 'next/server';
import { PLEResultsService } from '@/lib/services/ple-results.service';

export async function POST(
    request: NextRequest,
    { params }: { params: { recordId: string } }
) {
    try {
        const { recordId } = params;
        const body = await request.json();
        const { pupilIds } = body;

        if (!pupilIds || !Array.isArray(pupilIds) || pupilIds.length === 0) {
            return NextResponse.json(
                { error: 'pupilIds array is required and must not be empty' },
                { status: 400 }
            );
        }

        // Call the service to recapture snapshots
        const result = await PLEResultsService.recapturePLEPupilSnapshotsBatch(
            recordId,
            pupilIds
        );

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error) {
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
