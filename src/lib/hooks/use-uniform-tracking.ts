"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UniformTrackingService } from '../services/uniform-tracking.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { UniformTracking, CreateUniformTrackingData, UpdateUniformTrackingData } from '@/types';

const UNIFORM_TRACKING_QUERY_KEY = 'uniformTracking';

export function useUniformTrackingByPupil(pupilId: string) {
  return useQuery({
    queryKey: [UNIFORM_TRACKING_QUERY_KEY, 'pupil', pupilId],
    queryFn: () => UniformTrackingService.getTrackingRecordsByPupil(pupilId),
    enabled: !!pupilId,
  });
}

export function useUniformTrackingRecord(id: string) {
  return useQuery({
    queryKey: [UNIFORM_TRACKING_QUERY_KEY, id],
    queryFn: () => UniformTrackingService.getTrackingRecordById(id),
    enabled: !!id,
  });
}

export function useAllUniformTracking() {
  return useQuery({
    queryKey: [UNIFORM_TRACKING_QUERY_KEY, 'all'],
    queryFn: UniformTrackingService.getAllTrackingRecords,
  });
}

export function useUniformTrackingByUniform(uniformId: string) {
  return useQuery({
    queryKey: [UNIFORM_TRACKING_QUERY_KEY, 'uniform', uniformId],
    queryFn: () => UniformTrackingService.getTrackingRecordsByUniform(uniformId),
    enabled: !!uniformId,
  });
}

export function useCreateUniformTracking() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: CreateUniformTrackingData) => {
      const recordId = await UniformTrackingService.createTrackingRecord(data);
      const newRecord = await UniformTrackingService.getTrackingRecordById(recordId);
      
      // Create digital signature for uniform tracking creation
      if (user && newRecord) {
        await signAction(
          'uniform_payment',
          recordId,
          'created',
          {
            pupilId: data.pupilId,
            uniformId: data.uniformId,
            academicYearId: data.academicYearId,
            termId: data.termId,
            selectionMode: data.selectionMode,
            originalAmount: data.originalAmount,
            finalAmount: data.finalAmount,
            paymentStatus: data.paymentStatus
          }
        );
      }
      
      return newRecord;
    },
    onSuccess: (newRecord) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['uniformTracking'] });
      if (newRecord) {
        queryClient.invalidateQueries({ queryKey: ['uniformTracking', 'pupil', newRecord.pupilId] });
      }
    },
  });
}

export function useUpdateUniformTracking() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUniformTrackingData }) => {
      await UniformTrackingService.updateTrackingRecord(id, data);
      const updatedRecord = await UniformTrackingService.getTrackingRecordById(id);
      
      // Create digital signature for uniform tracking update
      if (user) {
        // Filter out undefined values from metadata
        const metadata: Record<string, any> = {
          updatedFields: Object.keys(data),
          paymentStatusChanged: !!data.paymentStatus,
          collectionStatusChanged: !!data.collectionStatus,
          amountPaidChanged: !!data.paidAmount,
          itemsCollectedChanged: !!data.collectedItems,
        };

        // Only add these fields if they have values
        if (data.releasedBy) {
          metadata.releasedBy = data.releasedBy;
        }
        if (data.receivedBy) {
          metadata.receivedBy = data.receivedBy;
        }

        await signAction(
          'uniform_payment',
          id,
          'updated',
          metadata
        );
      }
      
      return updatedRecord;
    },
    onSuccess: (updatedRecord) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['uniformTracking'] });
      if (updatedRecord) {
        queryClient.invalidateQueries({ queryKey: ['uniformTracking', 'pupil', updatedRecord.pupilId] });
        
        // Update the specific record in the cache
        queryClient.setQueryData(['uniformTracking', updatedRecord.id], updatedRecord);
      }
    },
  });
}

export function useDeleteUniformTracking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => UniformTrackingService.deleteTrackingRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [UNIFORM_TRACKING_QUERY_KEY] });
    },
  });
} 