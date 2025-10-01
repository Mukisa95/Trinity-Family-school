import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResultsReleaseService } from '@/lib/services/results-release.service';
import { ExamsService } from '@/lib/services/exams.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import type { ResultReleaseInfo } from '@/types';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to get release information for an exam
 */
export function useReleaseInfo(examId: string, classId: string) {
  return useQuery({
    queryKey: ['releaseInfo', examId, classId],
    queryFn: () => ResultsReleaseService.getReleaseInfo(examId, classId),
    enabled: !!examId && !!classId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to get released results for a pupil (for parent dashboard)
 */
export function useReleasedResultsForPupil(pupilId: string) {
  return useQuery({
    queryKey: ['releasedResults', pupilId],
    queryFn: () => ResultsReleaseService.getReleasedResultsForPupil(pupilId),
    enabled: !!pupilId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to check if a specific result is released
 */
export function useIsResultReleased(examId: string, classId: string, pupilId: string) {
  return useQuery({
    queryKey: ['isResultReleased', examId, classId, pupilId],
    queryFn: () => ResultsReleaseService.isResultReleased(examId, classId, pupilId),
    enabled: !!examId && !!classId && !!pupilId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to release results for selected pupils
 */
export function useReleaseResults() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      examId,
      classId,
      pupilIds,
      adminUserId,
      adminPassword,
      releaseNotes,
    }: {
      examId: string;
      classId: string;
      pupilIds: string[];
      adminUserId: string;
      adminPassword: string;
      releaseNotes?: string;
    }) => {
      return await ResultsReleaseService.releaseResults(
        examId,
        classId,
        pupilIds,
        adminUserId,
        adminPassword,
        releaseNotes
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['releaseInfo', variables.examId, variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['releasedResults'] });
      queryClient.invalidateQueries({ queryKey: ['isResultReleased'] });
      
      toast({
        title: "Results Released Successfully",
        description: `Results for ${variables.pupilIds.length} student(s) have been released to parents.`,
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Release Results",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to revoke released results
 */
export function useRevokeResults() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      examId,
      classId,
      pupilIds,
      adminUserId,
      adminPassword,
    }: {
      examId: string;
      classId: string;
      pupilIds: string[];
      adminUserId: string;
      adminPassword: string;
    }) => {
      return await ResultsReleaseService.revokeResults(
        examId,
        classId,
        pupilIds,
        adminUserId,
        adminPassword
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['releaseInfo', variables.examId, variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['releasedResults'] });
      queryClient.invalidateQueries({ queryKey: ['isResultReleased'] });
      
      toast({
        title: "Results Revoked Successfully",
        description: `Results for ${variables.pupilIds.length} student(s) have been revoked from parents.`,
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Revoke Results",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to bulk release all results for an exam
 */
export function useReleaseAllResults() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      examId,
      classId,
      adminUserId,
      adminPassword,
      releaseNotes,
    }: {
      examId: string;
      classId: string;
      adminUserId: string;
      adminPassword: string;
      releaseNotes?: string;
    }) => {
      return await ResultsReleaseService.releaseAllResults(
        examId,
        classId,
        adminUserId,
        adminPassword,
        releaseNotes
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['releaseInfo', variables.examId, variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['releasedResults'] });
      queryClient.invalidateQueries({ queryKey: ['isResultReleased'] });
      
      toast({
        title: "All Results Released Successfully",
        description: "All exam results have been released to parents.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Release All Results",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to check if a pupil has any released exam results
 * This is a lightweight check used for conditional UI rendering
 */
export function useHasReleasedResults(pupilId: string) {
  return useQuery({
    queryKey: ['hasReleasedResults', pupilId],
    queryFn: async () => {
      const releasedExamIds = await ResultsReleaseService.getReleasedResultsForPupil(pupilId);
      return releasedExamIds.length > 0;
    },
    enabled: !!pupilId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch full exam results data for released exams of a pupil
 * This provides complete exam result information including scores, subjects, etc.
 */
export function useReleasedExamResultsForPupil(pupilId: string) {
  return useQuery({
    queryKey: ['releasedExamResults', 'pupil', pupilId],
    queryFn: async () => {
      // First get the list of released exam IDs for this pupil
      const releasedExamIds = await ResultsReleaseService.getReleasedResultsForPupil(pupilId);
      
      if (releasedExamIds.length === 0) {
        return [];
      }
      
      // Fetch full exam results for each released exam
      const examResultsPromises = releasedExamIds.map(async (examId) => {
        try {
          // Get the exam result document
          const examResult = await ExamsService.getExamResultByExamId(examId);
          if (!examResult) return null;
          
          // Get the exam details for additional metadata
          const examDetails = await ExamsService.getExamById(examId);
          
          // Get academic year details for proper display name
          let academicYearName = 'Unknown Year';
          let termName = 'Unknown Term';
          
          if (examDetails?.academicYearId) {
            try {
              const academicYear = await AcademicYearsService.getAcademicYearById(examDetails.academicYearId);
              if (academicYear) {
                academicYearName = academicYear.name;
                
                // Find the term name from the academic year's terms
                if (examDetails.termId && academicYear.terms) {
                  const term = academicYear.terms.find(t => t.id === examDetails.termId);
                  if (term) {
                    termName = term.name;
                  }
                }
              }
            } catch (error) {
              console.warn('Failed to fetch academic year details:', error);
            }
          }
          
          // Extract this pupil's results from the exam result
          const pupilResults = examResult.results[pupilId];
          if (!pupilResults) return null;
          
          // Find pupil info from snapshots
          const pupilInfo = examResult.pupilSnapshots.find(p => p.pupilId === pupilId);
          if (!pupilInfo) return null;
          
          // Calculate total marks and aggregates
          let totalMarks = 0;
          let totalAggregates = 0;
          let subjectCount = 0;
          
          const subjectResults: Array<{
            subject: string;
            subjectCode: string;
            score: number;
            totalMarks: number;
            grade: string;
            aggregates: number;
            comment?: string;
          }> = [];
          
          // Process each subject result
          Object.entries(pupilResults).forEach(([subjectId, result]) => {
            const subjectInfo = examResult.subjectSnapshots.find(s => s.subjectId === subjectId);
            if (subjectInfo && result.marks !== undefined) {
              const score = result.marks;
              const maxMarks = subjectInfo.maxMarks;
              
              totalMarks += score;
              if (result.aggregates !== undefined) {
                totalAggregates += result.aggregates;
              }
              subjectCount++;
              
              subjectResults.push({
                subject: subjectInfo.name,
                subjectCode: subjectInfo.code,
                score,
                totalMarks: maxMarks,
                grade: result.grade || '-',
                aggregates: result.aggregates || 0,
                comment: result.comment
              });
            }
          });
          
          // Calculate percentage
          const maxPossibleMarks = examResult.subjectSnapshots.reduce((sum, subject) => sum + subject.maxMarks, 0);
          const percentage = maxPossibleMarks > 0 ? Math.round((totalMarks / maxPossibleMarks) * 100) : 0;
          
          return {
            id: examResult.id,
            examId: examId,
            examName: examDetails?.name || 'Unknown Exam',
            examDate: examDetails?.startDate || examResult.recordedAt,
            academicYear: academicYearName,
            term: termName,
            className: pupilInfo.classNameAtExam,
            classCode: pupilInfo.classCodeAtExam,
            totalScore: percentage,
            totalMarks,
            totalAggregates,
            maxPossibleMarks,
            subjectResults,
            grade: totalAggregates <= 12 ? 'I' : totalAggregates <= 24 ? 'II' : totalAggregates <= 28 ? 'III' : totalAggregates <= 32 ? 'IV' : 'U',
            division: totalAggregates <= 12 ? 'I' : totalAggregates <= 24 ? 'II' : totalAggregates <= 28 ? 'III' : totalAggregates <= 32 ? 'IV' : 'U',
            remarks: totalAggregates <= 12 ? 'Excellent' : totalAggregates <= 24 ? 'Good' : totalAggregates <= 28 ? 'Fair' : 'Needs Improvement',
            recordedAt: examResult.recordedAt,
            releasedAt: examResult.releasedAt,
            pupilInfo: {
              name: pupilInfo.name,
              admissionNumber: pupilInfo.admissionNumber,
              classNameAtExam: pupilInfo.classNameAtExam
            }
          };
        } catch (error) {
          console.error(`Error fetching exam result for exam ${examId}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(examResultsPromises);
      return results.filter(result => result !== null);
    },
    enabled: !!pupilId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}