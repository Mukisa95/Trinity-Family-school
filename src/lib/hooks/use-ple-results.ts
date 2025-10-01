import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PLEResultsService } from '../services/ple-results.service';
import type { 
  PLERecord, 
  PLEPupilResult, 
  CreatePLERecordData, 
  UpdatePLERecordData 
} from '../services/ple-results.service';
import { useAuth } from '@/lib/contexts/auth-context';

// Query Keys
export const pleResultsKeys = {
  all: ['pleResults'] as const,
  records: () => [...pleResultsKeys.all, 'records'] as const,
  record: (id: string) => [...pleResultsKeys.all, 'record', id] as const,
  results: (recordId: string) => [...pleResultsKeys.all, 'results', recordId] as const,
  p7Pupils: () => [...pleResultsKeys.all, 'p7Pupils'] as const,
};

// PLE Records Query Hooks
export function usePLERecords() {
  return useQuery({
    queryKey: pleResultsKeys.records(),
    queryFn: () => PLEResultsService.getAllPLERecords(),
  });
}

export function usePLERecord(id: string) {
  return useQuery({
    queryKey: pleResultsKeys.record(id),
    queryFn: () => PLEResultsService.getPLERecordById(id),
    enabled: !!id,
  });
}

export function usePLEResults(recordId: string) {
  return useQuery({
    queryKey: pleResultsKeys.results(recordId),
    queryFn: () => PLEResultsService.getPLEResultsByRecordId(recordId),
    enabled: !!recordId,
  });
}

export function usePLEResultsWithCurrentData(recordId: string) {
  return useQuery({
    queryKey: [...pleResultsKeys.results(recordId), 'withCurrentData'],
    queryFn: () => PLEResultsService.getPLEResultsWithCurrentPupilData(recordId),
    enabled: !!recordId,
  });
}

export function useP7Pupils() {
  return useQuery({
    queryKey: pleResultsKeys.p7Pupils(),
    queryFn: () => PLEResultsService.getP7PupilsSnapshot(),
  });
}

// PLE Records Mutation Hooks
export function useCreatePLERecord() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: Omit<CreatePLERecordData, 'createdBy'>) => 
      PLEResultsService.createPLERecord({
        ...data,
        createdBy: user?.id || 'unknown'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pleResultsKeys.records() });
    },
  });
}

export function useUpdatePLERecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePLERecordData }) =>
      PLEResultsService.updatePLERecord(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: pleResultsKeys.record(id) });
      queryClient.invalidateQueries({ queryKey: pleResultsKeys.records() });
    },
  });
}

export function useDeletePLERecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => PLEResultsService.deletePLERecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pleResultsKeys.records() });
    },
  });
}

// PLE Results Mutation Hooks
export function useSavePLEResults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recordId, results }: { recordId: string; results: PLEPupilResult[] }) =>
      PLEResultsService.savePLEResults(recordId, results),
    onSuccess: (_, { recordId }) => {
      queryClient.invalidateQueries({ queryKey: pleResultsKeys.results(recordId) });
      queryClient.invalidateQueries({ queryKey: pleResultsKeys.record(recordId) });
    },
  });
}

// Hook to get PLE results for a specific pupil across all years
export function usePupilPLEResults(pupilId: string) {
  return useQuery({
    queryKey: ['pupil-ple-results', pupilId],
    queryFn: async () => {
      if (!pupilId) return [];
      
      try {
        // Get all PLE records
        const pleRecords = await PLEResultsService.getAllPLERecords();
        
        // Get PLE results for each record that includes this pupil
        const pupilPLEResults: Array<{
          pleRecord: PLERecord;
          pupilResult: PLEPupilResult;
        }> = [];
        
        for (const record of pleRecords) {
          // Check if pupil was in this PLE record
          const pupilInRecord = record.pupilsSnapshot.find(p => p.id === pupilId);
          if (pupilInRecord) {
            // Get the actual results for this pupil in this PLE record
            const results = await PLEResultsService.getPLEResultsByRecordId(record.id);
            const pupilResult = results.find((r: PLEPupilResult) => r.pupilId === pupilId);
            
            if (pupilResult) {
              pupilPLEResults.push({
                pleRecord: record,
                pupilResult: pupilResult
              });
            }
          }
        }
        
        // Sort by year (most recent first)
        return pupilPLEResults.sort((a, b) => b.pleRecord.year - a.pleRecord.year);
      } catch (error) {
        console.error('Error fetching pupil PLE results:', error);
        throw error;
      }
    },
    enabled: !!pupilId,
  });
}

// Hook to get PLE history for a class (P7 classes)
export function useClassPLEHistory(classId: string) {
  return useQuery({
    queryKey: ['class-ple-history', classId],
    queryFn: async () => {
      if (!classId) return [];
      
      try {
        // Get all PLE records
        const pleRecords = await PLEResultsService.getAllPLERecords();
        
        // Filter records that include pupils from this class
        const classPLEHistory: Array<{
          pleRecord: PLERecord;
          classStatistics: {
            totalCandidates: number;
            divisionI: number;
            divisionII: number;
            divisionIII: number;
            divisionIV: number;
            averageAggregate: number;
          };
          pupilsFromClass: number;
        }> = [];
        
        for (const record of pleRecords) {
          // Check if any pupils in this record were from the specified class
          const pupilsFromClass = record.pupilsSnapshot.filter(p => p.classId === classId);
          
          if (pupilsFromClass.length > 0) {
            // Get statistics for this class in this PLE record
            const allResults = await PLEResultsService.getPLEResultsByRecordId(record.id);
            const classResults = allResults.filter((r: PLEPupilResult) => 
              pupilsFromClass.some(p => p.id === r.pupilId)
            );
            
            // Calculate class statistics
            const totalCandidates = classResults.length;
            const divisionI = classResults.filter((r: PLEPupilResult) => r.division === 'I').length;
            const divisionII = classResults.filter((r: PLEPupilResult) => r.division === 'II').length;
            const divisionIII = classResults.filter((r: PLEPupilResult) => r.division === 'III').length;
            const divisionIV = classResults.filter((r: PLEPupilResult) => r.division === 'IV').length;
            
            const averageAggregate = classResults.length > 0 
              ? classResults.reduce((sum: number, r: PLEPupilResult) => sum + r.totalAggregate, 0) / classResults.length 
              : 0;
            
            classPLEHistory.push({
              pleRecord: record,
              classStatistics: {
                totalCandidates,
                divisionI,
                divisionII,
                divisionIII,
                divisionIV,
                averageAggregate: Math.round(averageAggregate * 10) / 10
              },
              pupilsFromClass: pupilsFromClass.length
            });
          }
        }
        
        // Sort by year (most recent first)
        return classPLEHistory.sort((a, b) => b.pleRecord.year - a.pleRecord.year);
      } catch (error) {
        console.error('Error fetching class PLE history:', error);
        throw error;
      }
    },
    enabled: !!classId,
  });
}

// Hook to get PLE records grouped by year
export function usePLERecordsByYear() {
  return useQuery({
    queryKey: ['ple-records-by-year'],
    queryFn: async () => {
      try {
        const pleRecords = await PLEResultsService.getAllPLERecords();
        
        // Group by year
        const recordsByYear = pleRecords.reduce((acc: Record<number, PLERecord[]>, record) => {
          const year = record.year;
          if (!acc[year]) {
            acc[year] = [];
          }
          acc[year].push(record);
          return acc;
        }, {});
        
        // Convert to array and sort by year (most recent first)
        return Object.entries(recordsByYear)
          .map(([year, records]) => ({
            year: parseInt(year),
            records: records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          }))
          .sort((a, b) => b.year - a.year);
      } catch (error) {
        console.error('Error fetching PLE records by year:', error);
        throw error;
      }
    },
  });
} 