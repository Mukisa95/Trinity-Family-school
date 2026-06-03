"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RequirementTrackingService } from '@/lib/services/requirement-tracking.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { RequirementTracking, CreateRequirementTrackingData, UpdateRequirementTrackingData, Pupil, AcademicYear, EnhancedRequirementTracking } from '@/types';

// Fetch all requirement tracking records
export function useRequirementTracking() {
  return useQuery({
    queryKey: ['requirementTracking'],
    queryFn: () => RequirementTrackingService.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Fetch requirement tracking records for a specific pupil
export function useRequirementTrackingByPupil(pupilId: string) {
  return useQuery({
    queryKey: ['requirementTracking', 'pupil', pupilId],
    queryFn: () => RequirementTrackingService.getByPupil(pupilId),
    enabled: !!pupilId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch requirement tracking records for a specific class, academic year, and term
// 🚀 OPTIMIZED: Fetches ALL pupils' tracking data at once for the class
export function useRequirementTrackingByClass(
  classId: string,
  academicYearId?: string,
  termId?: string
) {
  const queryClient = useQueryClient();
  const isEnabled = !!classId && !!academicYearId && !!termId;
  
  // 🚀 CRITICAL: Get cached tracking data immediately to avoid loading state
  const cachedData = queryClient.getQueryData<RequirementTracking[]>(
    ['requirementTracking', 'class', classId, academicYearId, termId]
  );
  
  // 🚀 CRITICAL: Get cached pupils data to filter tracking records by class
  const cachedPupils = queryClient.getQueryData<Pupil[]>(['pupils', 'list']);
  
  return useQuery({
    queryKey: ['requirementTracking', 'class', classId, academicYearId, termId],
    queryFn: async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useRequirementTrackingByClass: Fetching ALL tracking records for class at once...', {
          classId,
          academicYearId,
          termId
        });
      }
      // 🚀 CRITICAL: Fetch ALL tracking records for the class/term at once (not one pupil at a time)
      const allRecords = await RequirementTrackingService.getTrackingRecordsByClass(classId, academicYearId, termId);
      
      // Filter by pupils in this class (using cached pupils data if available)
      if (cachedPupils && cachedPupils.length > 0) {
        const pupilIdsInClass = cachedPupils
          .filter(pupil => pupil.classId === classId)
          .map(pupil => pupil.id);
        
        const filteredRecords = allRecords.filter(record => 
          pupilIdsInClass.includes(record.pupilId)
        );
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ Filtered ${filteredRecords.length} records for ${pupilIdsInClass.length} pupils in class`);
        }
        
        return filteredRecords;
      }
      
      // If no cached pupils, return all records (component will filter)
      return allRecords;
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: cachedData && cachedData.length > 0 ? cachedData : undefined,
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached data, use it immediately
      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

// Fetch requirement tracking records for a specific requirement
export function useRequirementTrackingByRequirement(requirementId: string) {
  return useQuery({
    queryKey: ['requirementTracking', 'requirement', requirementId],
    queryFn: () => RequirementTrackingService.getByRequirement(requirementId),
    enabled: !!requirementId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Create a new requirement tracking record
export function useCreateRequirementTracking() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<RequirementTracking, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newRecord = await RequirementTrackingService.create(data);
      
      // Create digital signature for requirement tracking creation
      if (user) {
        await signAction(
          'requirement_collection',
          newRecord.id,
          'created',
          {
            pupilId: data.pupilId,
            requirementId: data.requirementId,
            academicYearId: data.academicYearId,
            termId: data.termId,
            paymentStatus: data.paymentStatus,
            paidAmount: data.paidAmount,
            coverageMode: data.coverageMode,
            selectionMode: data.selectionMode
          }
        );
      }
      
      return newRecord;
    },
    onSuccess: (newRecord) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['requirementTracking'] });
      queryClient.invalidateQueries({ queryKey: ['enhancedRequirementTracking'] });
      queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'pupil', newRecord.pupilId] });
      
      // Invalidate pupil-term specific queries for real-time updates
      queryClient.invalidateQueries({ 
        queryKey: ['requirementTracking', 'pupil', newRecord.pupilId, 'term', newRecord.academicYearId, newRecord.termId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['enhancedRequirementTracking', 'pupil', newRecord.pupilId, 'term', newRecord.termId, newRecord.academicYearId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['requirementTracking', 'pupil', newRecord.pupilId, 'academicYear', newRecord.academicYearId] 
      });
      
      // If requirementId is an array, invalidate for each requirement
      if (Array.isArray(newRecord.requirementId)) {
        newRecord.requirementId.forEach(reqId => {
          queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'requirement', reqId] });
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'requirement', newRecord.requirementId] });
      }
    },
  });
}

// Update an existing requirement tracking record
export function useUpdateRequirementTracking() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RequirementTracking> }) => {
      const updatedRecord = await RequirementTrackingService.update(id, data);
      
      // Create digital signature for requirement tracking update
      if (user) {
        // Filter out undefined values from metadata
        const metadata: Record<string, any> = {
          updatedFields: Object.keys(data),
          paymentStatusChanged: !!data.paymentStatus,
          amountChanged: !!data.paidAmount,
          releaseStatusChanged: !!data.releaseStatus,
          itemsReceivedChanged: !!data.itemQuantityReceived,
        };

        // Only add these fields if they have values
        if (data.receivedBy || data.lastClassReceivedBy) {
          metadata.receivedBy = data.receivedBy || data.lastClassReceivedBy;
        }
        if (data.releasedBy) {
          metadata.releasedBy = data.releasedBy;
        }

        await signAction(
          'requirement_collection',
          id,
          'updated',
          metadata
        );
      }
      
      return updatedRecord;
    },
    onSuccess: (updatedRecord) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['requirementTracking'] });
      queryClient.invalidateQueries({ queryKey: ['enhancedRequirementTracking'] });
      queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'pupil', updatedRecord.pupilId] });
      
      // Invalidate pupil-term specific queries for real-time updates
      queryClient.invalidateQueries({ 
        queryKey: ['requirementTracking', 'pupil', updatedRecord.pupilId, 'term', updatedRecord.academicYearId, updatedRecord.termId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['enhancedRequirementTracking', 'pupil', updatedRecord.pupilId, 'term', updatedRecord.termId, updatedRecord.academicYearId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['requirementTracking', 'pupil', updatedRecord.pupilId, 'academicYear', updatedRecord.academicYearId] 
      });
      
      // If requirementId is an array, invalidate for each requirement
      if (Array.isArray(updatedRecord.requirementId)) {
        updatedRecord.requirementId.forEach(reqId => {
          queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'requirement', reqId] });
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'requirement', updatedRecord.requirementId] });
      }

      // Update the specific record in the cache
      queryClient.setQueryData(['requirementTracking', updatedRecord.id], updatedRecord);
    },
  });
}

// Delete a requirement tracking record
export function useDeleteRequirementTracking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => RequirementTrackingService.delete(id),
    onSuccess: (_, deletedId) => {
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: ['requirementTracking'] });
      
      // Remove the specific record from the cache
      queryClient.removeQueries({ queryKey: ['requirementTracking', deletedId] });
    },
  });
}

// Bulk update requirement tracking records
export function useBulkUpdateRequirementTracking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: { id: string; data: Partial<RequirementTracking> }[]) =>
      RequirementTrackingService.bulkUpdate(updates),
    onSuccess: () => {
      // Invalidate all requirement tracking queries
      queryClient.invalidateQueries({ queryKey: ['requirementTracking'] });
    },
  });
}

// Get requirement tracking statistics for a class
export function useRequirementTrackingStats(classId: string) {
  return useQuery({
    queryKey: ['requirementTracking', 'stats', classId],
    queryFn: () => RequirementTrackingService.getClassStats(classId),
    enabled: !!classId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get requirement progress for a pupil
export function usePupilRequirementProgress(pupilId: string) {
  return useQuery({
    queryKey: ['requirementTracking', 'progress', pupilId],
    queryFn: () => RequirementTrackingService.getPupilProgress(pupilId),
    enabled: !!pupilId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch requirement tracking records for a specific pupil and term
export function useRequirementTrackingByPupilAndTerm(
  pupilId: string, 
  academicYearId: string, 
  termId: string,
  options?: { refetchOnMount?: boolean; staleTime?: number }
) {
  const queryClient = useQueryClient();
  const isEnabled = !!pupilId && !!academicYearId && !!termId;
  
  // 🚀 CRITICAL: Get cached tracking data immediately to avoid loading state
  const cachedData = queryClient.getQueryData<RequirementTracking[]>(
    ['requirementTracking', 'pupil', pupilId, 'term', academicYearId, termId]
  );
  
  // Debug logging
  if (isEnabled && process.env.NODE_ENV === 'development') {
    console.log('🔍 useRequirementTrackingByPupilAndTerm called:', {
      pupilId,
      academicYearId,
      termId,
      enabled: isEnabled,
      hasCachedData: !!cachedData && cachedData.length > 0,
      refetchOnMount: options?.refetchOnMount ?? false,
      staleTime: options?.staleTime ?? 5 * 60 * 1000
    });
  }
  
  return useQuery({
    queryKey: ['requirementTracking', 'pupil', pupilId, 'term', academicYearId, termId],
    queryFn: async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Fetching requirement tracking records...', { pupilId, academicYearId, termId });
      }
      const result = await RequirementTrackingService.getTrackingRecordsByPupilAndTerm(pupilId, academicYearId, termId);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Fetched records:', result.length);
      }
      return result;
    },
    enabled: isEnabled,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes default - increased for better caching
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    // 🚀 CRITICAL: Only refetch on mount if explicitly requested AND no cached data
    // Otherwise use cached data for instant loading
    refetchOnMount: options?.refetchOnMount && !cachedData ? true : false,
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: cachedData && cachedData.length > 0 ? cachedData : undefined,
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached data, use it immediately
      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

// Fetch requirement tracking records for a specific pupil and academic year
export function useRequirementTrackingByPupilAndAcademicYear(pupilId: string, academicYearId: string) {
  const queryClient = useQueryClient();
  
  // 🚀 CRITICAL: Get cached tracking data immediately to avoid loading state
  const cachedData = queryClient.getQueryData<RequirementTracking[]>(
    ['requirementTracking', 'pupil', pupilId, 'academicYear', academicYearId]
  );
  
  return useQuery({
    queryKey: ['requirementTracking', 'pupil', pupilId, 'academicYear', academicYearId],
    queryFn: async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Fetching requirement tracking records by academic year...', { pupilId, academicYearId });
      }
      return RequirementTrackingService.getTrackingRecordsByPupilAndAcademicYear(pupilId, academicYearId);
    },
    enabled: !!pupilId && !!academicYearId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: cachedData && cachedData.length > 0 ? cachedData : undefined,
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached data, use it immediately
      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

// Enhanced hooks with data integrity

// Fetch requirement tracking records with enhanced data integrity for a specific pupil and term
export function useEnhancedRequirementTrackingByPupilAndTerm(
  pupil: Pupil | null,
  termId: string,
  academicYear: AcademicYear | null
) {
  return useQuery<EnhancedRequirementTracking[]>({
    queryKey: ['enhancedRequirementTracking', 'pupil', pupil?.id, 'term', termId, academicYear?.id],
    queryFn: () => {
      if (!pupil || !academicYear) {
        throw new Error('Pupil and academic year are required for enhanced tracking');
      }
      return RequirementTrackingService.getEnhancedTrackingRecordsByPupilAndTerm(pupil, termId, academicYear);
    },
    enabled: !!pupil && !!academicYear && !!termId,
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true, // Always refetch when component mounts
  });
}

// Create a requirement tracking record with enhanced data integrity
export function useCreateEnhancedRequirementTracking() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      pupil,
      termId,
      academicYear,
      requirementId,
      trackingData
    }: {
      pupil: Pupil;
      termId: string;
      academicYear: AcademicYear;
      requirementId: string | string[];
      trackingData: Omit<CreateRequirementTrackingData, 'pupilId' | 'requirementId' | 'academicYearId' | 'termId'>;
    }) => {
      const newRecordId = await RequirementTrackingService.createEnhancedTrackingRecord(
        pupil,
        termId,
        academicYear,
        requirementId,
        trackingData
      );
      
      // Get the created record
      const newRecord = await RequirementTrackingService.getTrackingRecordById(newRecordId);
      if (!newRecord) {
        throw new Error('Failed to retrieve created tracking record');
      }
      
      // Create digital signature for requirement tracking creation
      if (user) {
        await signAction(
          'requirement_collection',
          newRecord.id,
          'created',
          {
            pupilId: newRecord.pupilId,
            requirementId: newRecord.requirementId,
            academicYearId: newRecord.academicYearId,
            termId: newRecord.termId,
            paymentStatus: newRecord.paymentStatus,
            paidAmount: newRecord.paidAmount,
            coverageMode: newRecord.coverageMode,
            selectionMode: newRecord.selectionMode,
            historicalData: (newRecord as EnhancedRequirementTracking).pupilSnapshotData
          }
        );
      }
      
      return newRecord as EnhancedRequirementTracking;
    },
    onSuccess: (newRecord) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['requirementTracking'] });
      queryClient.invalidateQueries({ queryKey: ['enhancedRequirementTracking'] });
      queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'pupil', newRecord.pupilId] });
      
      // Invalidate pupil-term specific queries for real-time updates
      queryClient.invalidateQueries({ 
        queryKey: ['requirementTracking', 'pupil', newRecord.pupilId, 'term', newRecord.academicYearId, newRecord.termId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['enhancedRequirementTracking', 'pupil', newRecord.pupilId, 'term', newRecord.termId, newRecord.academicYearId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['requirementTracking', 'pupil', newRecord.pupilId, 'academicYear', newRecord.academicYearId] 
      });
      
      // If requirementId is an array, invalidate for each requirement
      if (Array.isArray(newRecord.requirementId)) {
        newRecord.requirementId.forEach(reqId => {
          queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'requirement', reqId] });
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'requirement', newRecord.requirementId] });
      }
    },
  });
}