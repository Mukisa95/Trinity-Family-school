import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { generateBatchPupilReportsPDF } from './PupilReportCardBatchPDF';

// Define API constants directly since we're having import issues
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create API instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface FetcherProps {
  examId: string;
  classId: string;
  onGenerateComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

const PupilBatchReportFetcher: React.FC<FetcherProps> = ({
  examId,
  classId,
  onGenerateComplete,
  onError
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch batch report data
  const { data, isLoading, error } = useQuery({
    queryKey: ['batchReportData', examId, classId],
    queryFn: async () => {
      const endpoint = `/reports/exam/${examId}/class/${classId}`;
      console.log(`Fetching data from: ${endpoint}`);
      const response = await api.get(endpoint);
      
      // Debug: Log the structure of the API response
      console.log('API Response Structure:', {
        hasData: !!response.data,
        topLevelKeys: Object.keys(response.data || {}),
        hasPupils: !!(response.data && response.data.pupils),
        pupilsIsArray: !!(response.data && response.data.pupils && Array.isArray(response.data.pupils)),
        pupilCount: response.data && response.data.pupils && Array.isArray(response.data.pupils) ? response.data.pupils.length : 0
      });
      
      // If we have pupils, log the structure of the first pupil
      if (response.data && response.data.pupils && Array.isArray(response.data.pupils) && response.data.pupils.length > 0) {
        const samplePupil = response.data.pupils[0];
        console.log('Sample Pupil Structure:', {
          pupilKeys: Object.keys(samplePupil || {}),
          hasSubjects: !!samplePupil.subjects,
          subjectsIsArray: !!(samplePupil.subjects && Array.isArray(samplePupil.subjects)),
          subjectCount: samplePupil.subjects && Array.isArray(samplePupil.subjects) ? samplePupil.subjects.length : 0,
          hasResults: !!samplePupil.results, // Check if results property exists instead
          resultsIsArray: !!(samplePupil.results && Array.isArray(samplePupil.results)),
          resultsCount: samplePupil.results && Array.isArray(samplePupil.results) ? samplePupil.results.length : 0
        });
        
        // Log all top level keys for deeper inspection
        console.log('Full API response:', response.data);
      }
      
      return response.data;
    },
    enabled: !!examId && !!classId,
  });

  // Process data and generate PDF when data is available
  useEffect(() => {
    if (data && !isLoading && !isGenerating) {
      generateBatchReport();
    }
  }, [data, isLoading]);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error as Error);
    }
  }, [error, onError]);

  const generateBatchReport = async () => {
    try {
      setIsGenerating(true);
      
      // Check if we have valid data structure
      if (!data || !Array.isArray(data.pupils) || data.pupils.length === 0) {
        throw new Error('No pupil data available in the API response');
      }
      
      console.log(`Formatting ${data.pupils.length} pupils for report`);
      
      // Process and format the data for the PDF
      const formattedPupils = data.pupils.map((pupil: any) => {
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
          totalPupils: data.pupils.length,
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
      });

      console.log('Formatted data:', formattedPupils);
      
      // Generate the PDF
      const pdfBlob = await generateBatchPupilReportsPDF(
        formattedPupils, 
        `${data.school?.name || 'School'} - ${data.exam?.title || 'Exam'} Reports`
      );
      
      // Call the completion handler
      if (onGenerateComplete) {
        onGenerateComplete(pdfBlob);
      }
    } catch (err) {
      console.error('Error generating batch report:', err);
      if (onError) {
        onError(err as Error);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="batch-report-fetcher">
      {isLoading && <p>Loading report data...</p>}
      {isGenerating && <p>Generating PDF reports...</p>}
      {error && <p>Error loading report data: {(error as Error).message}</p>}
    </div>
  );
};

export default PupilBatchReportFetcher; 