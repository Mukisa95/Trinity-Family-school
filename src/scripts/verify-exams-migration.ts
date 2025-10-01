import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { ExamsService } from '../lib/services/exams.service';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCMFVoGNdrBAuPoDjaNpsgionEnkq45JSA",
  authDomain: "trinity-family-schools.firebaseapp.com",
  projectId: "trinity-family-schools",
  storageBucket: "trinity-family-schools.firebasestorage.app",
  messagingSenderId: "148171496339",
  appId: "1:148171496339:web:c441b0e1e3116f129ba666",
  measurementId: "G-Z3G3D3EXRW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifyExamsMigration() {
  console.log('🔍 Verifying exams migration...');
  try {
    const exams = await ExamsService.getAllExams();
    
    console.log(`✅ Found ${exams.length} exams in Firebase`);
    
    if (exams.length > 0) {
      console.log('\n📋 Sample exams:');
      exams.slice(0, 5).forEach((exam, index) => {
        console.log(`${index + 1}. ${exam.name} (${exam.classId}) - ${exam.status}`);
        console.log(`   📅 ${exam.startDate} to ${exam.endDate}`);
        console.log(`   📊 Max: ${exam.maxMarks}, Pass: ${exam.passingMarks}`);
        console.log(`   🏫 Academic Year: ${exam.academicYearId}, Term: ${exam.termId}`);
        if (exam.batchId) {
          console.log(`   📦 Batch: ${exam.batchId}`);
        }
        console.log('');
      });
      
      // Check exam results
      console.log('🔍 Checking exam results...');
      const examResults = await ExamsService.getAllExamResults();
      console.log(`✅ Found ${examResults.length} exam results in Firebase`);
      
      if (examResults.length > 0) {
        console.log('\n📋 Sample exam results:');
        examResults.slice(0, 3).forEach((result, index) => {
          console.log(`${index + 1}. Result for exam ${result.examId} (Class: ${result.classId})`);
          console.log(`   👥 ${result.pupilSnapshots.length} pupils, 📚 ${result.subjectSnapshots.length} subjects`);
          console.log(`   📊 Published: ${result.isPublished ? 'Yes' : 'No'}`);
          console.log('');
        });
      }
      
      // Group by status
      const statusCounts = exams.reduce((acc, exam) => {
        acc[exam.status] = (acc[exam.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📊 Exams by status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      
    } else {
      console.log('❌ No exams found in Firebase');
    }
    
  } catch (error) {
    console.error('❌ Error verifying exams migration:', error);
  }
}

verifyExamsMigration(); 