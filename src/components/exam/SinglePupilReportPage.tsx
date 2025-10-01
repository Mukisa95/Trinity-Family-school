import { useState, useEffect } from 'react';
import { usePupilReportData } from './PupilReportCardBatchPDF';
import { PupilReportCardPDFViewer } from './PupilReportCardBatchPDF';
import axios from 'axios';

// Define API constants directly since we're having import issues
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create API instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface SinglePupilReportPageProps {
  examId: string;
  classId: string;
  pupilId: string;
}

const SinglePupilReportPage: React.FC<SinglePupilReportPageProps> = ({
  examId,
  classId,
  pupilId
}) => {
  const [error, setError] = useState<Error | null>(null);

  // Fetch pupil report data
  const { data, isLoading, isError } = usePupilReportData(examId, classId, pupilId);

  // Debug the API response
  useEffect(() => {
    if (data) {
      console.log('Single Pupil API Response:', {
        hasData: !!data,
        topLevelKeys: Object.keys(data || {}),
        hasPupil: !!data.pupil,
      });
      
      if (data.pupil) {
        console.log('Pupil data structure:', {
          pupilKeys: Object.keys(data.pupil),
          hasSubjects: !!data.pupil.subjects,
          subjectsIsArray: !!(data.pupil.subjects && Array.isArray(data.pupil.subjects)),
          subjectCount: data.pupil.subjects && Array.isArray(data.pupil.subjects) ? data.pupil.subjects.length : 0,
          hasResults: !!data.pupil.results,
          resultsIsArray: !!(data.pupil.results && Array.isArray(data.pupil.results)),
          resultsCount: data.pupil.results && Array.isArray(data.pupil.results) ? data.pupil.results.length : 0
        });
        
        // Log the full pupil data for inspection
        console.log('Full pupil data:', data.pupil);
      }
    }
  }, [data]);

  // Format the data for the PDF viewer
  const formatPupilData = () => {
    if (!data || !data.pupil) {
      console.error('No pupil data available');
      return null;
    }

    const pupil = data.pupil;
    console.log(`Processing pupil ${pupil.name}: Looking for subject results`);
    
    // Try to find subjects data in different possible locations
    let pupilSubjects = [];
    
    // Check if the results might be in a different property called 'subjectResults'
    // This is based on the ViewResultsView.tsx logs showing "Found X subject results"
    if (pupil.subjectResults && Array.isArray(pupil.subjectResults) && pupil.subjectResults.length > 0) {
      console.log(`Found ${pupil.subjectResults.length} subjects in pupil.subjectResults`);
      pupilSubjects = pupil.subjectResults;
    }
    // Check standard subjects field
    else if (pupil.subjects && Array.isArray(pupil.subjects) && pupil.subjects.length > 0) {
      console.log(`Found ${pupil.subjects.length} subjects in pupil.subjects`);
      pupilSubjects = pupil.subjects;
    } 
    // Check results field as an alternative (based on ViewResultsView.tsx logs)
    else if (pupil.results && Array.isArray(pupil.results) && pupil.results.length > 0) {
      console.log(`Found ${pupil.results.length} subjects in pupil.results`);
      pupilSubjects = pupil.results;
    }
    // Check if there's an examResults field
    else if (pupil.examResults && Array.isArray(pupil.examResults) && pupil.examResults.length > 0) {
      console.log(`Found ${pupil.examResults.length} subjects in pupil.examResults`);
      pupilSubjects = pupil.examResults;
    }
    // Look for possible nested structures
    else {
      // Try to match the structure shown in the logs
      // The logs show "Processing pupil X: Found Y subject results"
      console.log('Checking pupil object keys:', Object.keys(pupil));
      
      // Check for any property that might contain subject results
      for (const key of Object.keys(pupil)) {
        const value = pupil[key];
        
        // Check if this is an array that might contain subjects
        if (Array.isArray(value) && value.length > 0) {
          // Look at the first item to see if it looks like a subject result
          const firstItem = value[0];
          if (firstItem && 
              (firstItem.name || firstItem.subject || firstItem.subjectName) && 
              (firstItem.marks !== undefined || firstItem.grade !== undefined)) {
            console.log(`Found potential subject results in pupil.${key}:`, value.length);
            pupilSubjects = value;
            break;
          }
        }
        
        // Check if this is an object with a results array
        if (value && typeof value === 'object') {
          for (const nestedKey of Object.keys(value)) {
            const nestedValue = value[nestedKey];
            if (Array.isArray(nestedValue) && nestedValue.length > 0) {
              // Check if these look like subject results
              const firstItem = nestedValue[0];
              if (firstItem && 
                  (firstItem.name || firstItem.subject || firstItem.subjectName) && 
                  (firstItem.marks !== undefined || firstItem.grade !== undefined)) {
                console.log(`Found potential subject results in pupil.${key}.${nestedKey}:`, nestedValue.length);
                pupilSubjects = nestedValue;
                break;
              }
            }
          }
        }
      }
    }

    if (pupilSubjects.length === 0) {
      console.warn(`⚠️ WARNING: No subjects found for pupil ${pupil.name || 'unknown'}`);
      console.log('Full pupil data:', pupil);
    } else {
      console.log(`✅ SUCCESS: Using ${pupilSubjects.length} subjects for ${pupil.name}`);
      // Log the structure of a sample subject
      console.log('Sample subject structure:', pupilSubjects[0]);
    }
    
    return {
      pupilName: pupil.name || 'Unknown',
      className: pupil.class?.name || 'Unknown Class',
      year: data.academicYear?.name || 'Unknown Year',
      term: data.term?.name || 'Unknown Term',
      age: pupil.age || 0,
      date: new Date().toLocaleDateString(),
      position: pupil.position || 0,
      totalPupils: data.totalPupils || 0,
      pupilIdentificationNumber: pupil.pin || 'N/A',
      subjects: pupilSubjects.map((subject: any) => {
        // Map the subject data based on the format seen in ViewResultsView.tsx logs
        // The logs show "Found result for subject NAME (ABBREV): Marks: X Grade: Y"
        const subjectName = subject.name || 
                           subject.subjectName || 
                           subject.subject_name || 
                           subject.subject ||
                           'Unknown Subject';
                           
        // Extract the marks from the subject based on logs showing "Marks: X"
        const marksGained = parseFloat(
          subject.marks || 
          subject.marksGained || 
          subject.marks_gained || 
          subject.score || 
          subject.scoreObtained || 
          subject.mark ||
          0
        );
        
        // Extract the grade based on logs showing "Grade: F9"
        const grade = subject.grade || 
                     subject.gradeObtained || 
                     subject.grade_obtained ||
                     '-';
                     
        return {
          name: subjectName,
          fullMarks: parseFloat(subject.fullMarks || subject.full_marks || subject.totalMarks || subject.total_marks || 100),
          marksGained: marksGained,
          grade: grade,
          aggregate: parseFloat(subject.aggregate || subject.aggregatePoints || subject.aggregate_points || 0),
          remarks: subject.remarks || subject.comment || '-',
          teacherInitials: subject.teacherInitials || subject.teacher_initials || subject.initials || '-',
          isMajorSubject: !!subject.isMajorSubject || !!subject.is_major_subject || !!subject.major || false
        };
      }),
      // Use the calculated values from logs showing "Using calculated totalMarks: X"
      totalMarks: parseFloat(pupil.totalMarks || pupil.total_marks || pupil.totalScore || pupil.total || 0),
      // Use the calculated values from logs showing "Using calculated totalAggregates: X"
      totalAggregates: parseFloat(pupil.totalAggregates || pupil.total_aggregates || pupil.aggregates || pupil.total_points || 0),
      // Use the calculated division from logs showing "Calculated division: U"
      division: pupil.division || '-',
      examTitle: data.exam?.title || data.exam?.name || 'Exam',
      classTeacherName: data.classTeacher?.name || data.class_teacher?.name || '',
      promotionStatus: pupil.promotionStatus || pupil.promotion_status || pupil.promotion || '-',
      classTeacherReport: pupil.classTeacherReport || pupil.class_teacher_report || pupil.classTeacherComment || 'No comment.',
      headTeacherReport: pupil.headTeacherReport || pupil.head_teacher_report || pupil.headTeacherComment || 'No comment.',
      nextTermBegins: data.nextTermBegins || data.next_term_begins || 'TBD',
      nextTermEnds: data.nextTermEnds || data.next_term_ends || 'TBD',
      pupilPhoto: pupil.photoUrl || pupil.photo_url || pupil.photo || '',
      schoolLogo: data.school?.logoUrl || data.school?.logo_url || data.school?.logo || '',
      schoolName: data.school?.name || 'School Name',
      schoolPhysicalAddress: data.school?.physicalAddress || data.school?.physical_address || '',
      schoolPostalAddress: data.school?.postalAddress || data.school?.postal_address || '',
      schoolPhone: data.school?.phone || '',
      schoolEmail: data.school?.email || '',
      schoolMotto: data.school?.motto || '',
      schoolCity: data.school?.city || '',
      schoolCountry: data.school?.country || '',
      gradingScale: Array.isArray(data.gradingScale) ? data.gradingScale : 
                   (Array.isArray(data.grading_scale) ? data.grading_scale : []),
      examSnapshot: {
        academicYearId: data.academicYear?.id || data.academic_year?.id || '',
        termId: data.term?.id || ''
      }
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-blue-800 font-semibold">Loading pupil report...</p>
        </div>
      </div>
    );
  }

  if (isError || error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-6 bg-red-50 rounded-lg max-w-lg">
          <h3 className="text-xl font-bold text-red-800 mb-2">Error Loading Report</h3>
          <p className="text-red-600">{error?.message || "Failed to load pupil report data"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pupilData = formatPupilData();

  if (!pupilData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-6 bg-yellow-50 rounded-lg max-w-lg">
          <h3 className="text-xl font-bold text-yellow-800 mb-2">No Data Available</h3>
          <p className="text-yellow-600">Could not find report data for this pupil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <PupilReportCardPDFViewer {...pupilData} />
    </div>
  );
};

export default SinglePupilReportPage; 