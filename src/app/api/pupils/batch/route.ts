import { NextRequest, NextResponse } from 'next/server';
import { PupilsService } from '@/lib/services/pupils.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pupilIds } = body;
    
    if (!pupilIds || !Array.isArray(pupilIds)) {
      return NextResponse.json(
        { error: 'pupilIds array is required' },
        { status: 400 }
      );
    }

    if (pupilIds.length === 0) {
      return NextResponse.json([]);
    }

    console.log(`🚀 BATCH API: Fetching ${pupilIds.length} pupils in one request`);
    const startTime = Date.now();
    
    const pupils = await PupilsService.getPupilsByIds(pupilIds);
    
    const duration = Date.now() - startTime;
    console.log(`✅ BATCH API: Fetched ${pupils.length} pupils in ${duration}ms`);
    
    // Create a map for quick lookup
    const pupilsMap = pupils.reduce((acc, pupil) => {
      acc[pupil.id] = pupil;
      return acc;
    }, {} as Record<string, typeof pupils[0]>);
    
    return NextResponse.json(pupilsMap);
  } catch (error) {
    console.error('❌ BATCH API: Error fetching pupils:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pupils data' },
      { status: 500 }
    );
  }
}

