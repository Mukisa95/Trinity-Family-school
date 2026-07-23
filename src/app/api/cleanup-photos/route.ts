import { NextRequest, NextResponse } from 'next/server';
import { cleanupLocalPhotoRecords } from '@/scripts/cleanup-local-photo-records';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

export async function POST(request: NextRequest) {
  try {
    await ensureServerFirestoreAuth();
    console.log('🧹 Starting photo database cleanup...');
    
    const result = await cleanupLocalPhotoRecords();
    
    console.log('✅ Photo database cleanup completed:', result);
    
    return NextResponse.json({
      success: true,
      result,
      message: 'Photo database cleanup completed successfully'
    });

  } catch (error: any) {
    console.error('❌ Photo database cleanup failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error?.message || 'Photo database cleanup failed',
      details: error?.stack || error
    }, { status: 500 });
  }
}
