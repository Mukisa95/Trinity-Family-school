import { NextRequest, NextResponse } from 'next/server';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { PupilsService } from '@/lib/services/pupils.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pupilIds, termId, academicYearId } = body;

        // Validate input
        if (!pupilIds || !Array.isArray(pupilIds) || pupilIds.length === 0) {
            return NextResponse.json(
                { error: 'Pupil IDs are required and must be a non-empty array' },
                { status: 400 }
            );
        }

        if (!termId) {
            return NextResponse.json(
                { error: 'Term ID is required' },
                { status: 400 }
            );
        }

        if (!academicYearId) {
            return NextResponse.json(
                { error: 'Academic Year ID is required' },
                { status: 400 }
            );
        }

        // Fetch academic year
        const academicYear = await AcademicYearsService.getAcademicYearById(academicYearId);
        if (!academicYear) {
            return NextResponse.json(
                { error: 'Academic year not found' },
                { status: 404 }
            );
        }

        // Fetch pupils
        const pupils = await Promise.all(
            pupilIds.map(async (pupilId: string) => {
                try {
                    return await PupilsService.getPupilById(pupilId);
                } catch (error) {
                    console.error(`Failed to fetch pupil ${pupilId}:`, error);
                    return null;
                }
            })
        );

        // Filter out null values (pupils that failed to fetch)
        const validPupils = pupils.filter((p): p is NonNullable<typeof p> => p !== null);

        if (validPupils.length === 0) {
            return NextResponse.json(
                { error: 'No valid pupils found' },
                { status: 404 }
            );
        }

        // Execute batch recapture
        const result = await PupilSnapshotsService.recaptureSnapshotsBatch(
            validPupils,
            termId,
            academicYear
        );

        return NextResponse.json(result);
    } catch (error) {
        console.error('Batch recapture API error:', error);
        return NextResponse.json(
            {
                error: 'Failed to execute batch recapture',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
