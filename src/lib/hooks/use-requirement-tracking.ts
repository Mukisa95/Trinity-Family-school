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

// Fetch requirement tracking records for a specific class
export function useRequirementTrackingByClass(classId: string) {
  return useQuery({
    queryKey: ['requirementTracking', 'class', classId],
    queryFn: () => RequirementTrackingService.getByClass(classId),
    enabled: !!classId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
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
      queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'pupil', newRecord.pupilId] });
      
      // Invalidate pupil-term specific queries for real-time updates
      queryClient.invalidateQueries({ 
        queryKey: ['requirementTracking', 'pupil', newRecord.pupilId, 'term', newRecord.academicYearId, newRecord.termId] 
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
      queryClient.invalidateQueries({ queryKey: ['requirementTracking', 'pupil', updatedRecord.pupilId] });
      
      // Invalidate pupil-term specific queries for real-time updates
      queryClient.invalidateQueries({ 
        queryKey: ['requirementTracking', 'pupil', updatedRecord.pupilId, 'term', updatedRecord.academicYearId, updatedRecord.termId] 
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
export function useRequirementTrackingByPupilAndTerm(pupilId: string, academicYearId: string, termId: string) {
  return useQuery({
    queryKey: ['requirementTracking', 'pupil', pupilId, 'term', academicYearId, termId],
    queryFn: () => RequirementTrackingService.getTrackingRecordsByPupilAndTerm(pupilId, academicYearId, termId),
    enabled: !!pupilId && !!academicYearId && !!termId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch requirement tracking records for a specific pupil and academic year
export function useRequirementTrackingByPupilAndAcademicYear(pupilId: string, academicYearId: string) {
  return useQuery({
    queryKey: ['requirementTracking', 'pupil', pupilId, 'academicYear', academicYearId],
    queryFn: () => RequirementTrackingService.getTrackingRecordsByPupilAndAcademicYear(pupilId, academicYearId),
    enabled: !!pupilId && !!academicYearId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
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