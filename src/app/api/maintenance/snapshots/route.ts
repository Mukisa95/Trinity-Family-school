import { NextRequest, NextResponse } from 'next/server';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { PupilsService } from '@/lib/services/pupils.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';

/**
 * Daily Snapshot Maintenance API Endpoint
 * Call this endpoint daily to automatically create snapshots for newly ended terms
 * 
 * Usage:
 * - Set up a daily cron job to call: POST /api/maintenance/snapshots
 * - Or use a service like Vercel Cron, GitHub Actions, or external scheduler
 */
export async function POST(request: NextRequest) {
  try {
    console.log(`📅 Daily snapshot maintenance triggered at ${new Date().toISOString()}`);
    
    // Optional: Add authentication/authorization here
    // For production security, uncomment these lines and add MAINTENANCE_API_KEY to your environment variables
    // const authHeader = request.headers.get('authorization');
    // const expectedAuth = process.env.MAINTENANCE_API_KEY;
    // if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Fetch required data
    const pupils = await PupilsService.getAllPupils();
    const academicYears = await AcademicYearsService.getAllAcademicYears();
    
    console.log(`📊 Maintenance check: ${pupils.length} pupils, ${academicYears.length} academic years`);

    // Run automatic snapshot creation for ended terms
    const results = await PupilSnapshotsService.autoCreateSnapshotsForEndedTerms(pupils, academicYears);
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      message: `Daily maintenance complete: ${results.snapshotsCreated} snapshots created for ${results.termsChecked} recently ended terms`,
      details: {
        termsChecked: results.termsChecked,
        snapshotsCreated: results.snapshotsCreated,
        errors: results.errors.length,
        errorDetails: results.errors
      }
    };
    
    console.log(`✅ Daily snapshot maintenance completed:`, response.details);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error(`❌ Daily snapshot maintenance failed:`, error);
    
    const errorResponse = {
      success: false,
      timestamp: new Date().toISOString(),
      message: `Daily maintenance failed: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error)
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Get maintenance status (optional)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    service: 'Pupil Snapshots Daily Maintenance',
    description: 'Automatically creates snapshots for recently ended terms (within 7 days)',
    usage: 'Send POST request to this endpoint daily',
    recommendation: 'Set up a cron job to call this endpoint every day at midnight'
  });
} 