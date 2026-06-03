import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET(request: Request) {
  try {
    // Get the class ID from the URL query parameter
    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');
    
    if (!classId) {
      return NextResponse.json({ error: 'Missing classId parameter' }, { status: 400 });
    }
    
    // Log the class ID for debugging
    console.log('Debug API: Fetching exams for class ID:', classId);
    
    // Manually fetch exams from Firebase
    const examsRef = collection(db, 'exams');
    const q = query(
      examsRef, 
      where('classId', '==', classId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    console.log('Debug API: Found', snapshot.docs.length, 'exams');
    
    // Map the results to a simpler format for debugging
    const exams = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }));
    
    // Also log all exams to check if there are any exams in the database
    const allExamsQuery = query(examsRef);
    const allExamsSnapshot = await getDocs(allExamsQuery);
    console.log('Debug API: Total exams in database:', allExamsSnapshot.docs.length);
    
    // Log some sample exams for debugging
    if (allExamsSnapshot.docs.length > 0) {
      const sampleExams = allExamsSnapshot.docs.slice(0, 3).map(doc => ({
        id: doc.id,
        classId: doc.data().classId,
        name: doc.data().name,
      }));
      console.log('Debug API: Sample exams:', sampleExams);
    }
    
    return NextResponse.json(exams);
  } catch (error) {
    console.error('Debug API: Error fetching exams:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
} 