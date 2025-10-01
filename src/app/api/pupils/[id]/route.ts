import { NextRequest, NextResponse } from 'next/server';
import { PupilsService } from '@/lib/services/pupils.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: pupilId } = await params;
    console.log('🔍 API: Fetching pupil with ID:', pupilId);
    
    if (!pupilId) {
      console.error('🔍 API: No pupil ID provided');
      return NextResponse.json(
        { error: 'Pupil ID is required' },
        { status: 400 }
      );
    }

    const pupil = await PupilsService.getPupilById(pupilId);
    console.log('🔍 API: PupilsService returned:', pupil ? 'DATA' : 'NULL');
    
    if (!pupil) {
      console.error('🔍 API: Pupil not found for ID:', pupilId);
      return NextResponse.json(
        { error: 'Pupil not found' },
        { status: 404 }
      );
    }

    console.log('🔍 API: Pupil data keys:', Object.keys(pupil));
    console.log('🔍 API: Photo field value:', pupil.photo ? 'HAS PHOTO' : 'NO PHOTO');
    
    return NextResponse.json(pupil);
  } catch (error) {
    console.error('🔍 API: Error fetching pupil:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pupil data' },
      { status: 500 }
    );
  }
} 