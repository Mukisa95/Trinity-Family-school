import { NextRequest, NextResponse } from 'next/server';
import { ExamsService } from '@/lib/services/exams.service';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    await ensureServerFirestoreAuth();
    const { examId } = await params;
    console.log('🔍 API: Fetching exam results for exam ID:', examId);
    
    if (!examId) {
      console.error('🔍 API: No exam ID provided');
      return NextResponse.json(
        { error: 'Exam ID is required' },
        { status: 400 }
      );
    }

    const examResult = await ExamsService.getExamResultByExamId(examId);
    console.log('🔍 API: ExamResult found:', examResult ? 'YES' : 'NO');
    
    if (!examResult) {
      console.error('🔍 API: Exam result not found for exam ID:', examId);
      return NextResponse.json(
        { error: 'Exam result not found' },
        { status: 404 }
      );
    }

    console.log('🔍 API: Returning exam result data');
    return NextResponse.json(examResult);
  } catch (error) {
    console.error('🔍 API: Error fetching exam result:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exam result data' },
      { status: 500 }
    );
  }
}
