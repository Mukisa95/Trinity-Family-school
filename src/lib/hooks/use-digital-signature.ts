import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context';
import { DigitalSignatureService } from '../services/digital-signature.service';
import type { 
  DigitalSignature, 
  CreateSignatureData, 
  RecordType, 
  AuditTrailEntry 
} from '@/types/digital-signature';
import { toast } from '@/hooks/use-toast';

// Query keys
const DIGITAL_SIGNATURE_KEYS = {
  all: ['digital-signatures'] as const,
  signatures: () => [...DIGITAL_SIGNATURE_KEYS.all, 'signatures'] as const,
  auditTrail: () => [...DIGITAL_SIGNATURE_KEYS.all, 'audit-trail'] as const,
  userAuditTrail: (userId: string) => [...DIGITAL_SIGNATURE_KEYS.auditTrail(), userId] as const,
  recordSignatures: (recordType: RecordType, recordId: string) => 
    [...DIGITAL_SIGNATURE_KEYS.signatures(), recordType, recordId] as const,
  userStats: (userId: string) => [...DIGITAL_SIGNATURE_KEYS.all, 'stats', userId] as const,
  recentAuditTrail: () => [...DIGITAL_SIGNATURE_KEYS.auditTrail(), 'recent'] as const,
};

/**
 * Hook to create a digital signature
 */
export function useCreateDigitalSignature() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, additionalMetadata }: {
      data: CreateSignatureData;
      additionalMetadata?: Record<string, any>;
    }) => {
      if (!user) {
        throw new Error('User must be authenticated to create signatures');
      }
      return DigitalSignatureService.createSignature(user, data, additionalMetadata);
    },
    onSuccess: (signature, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: DIGITAL_SIGNATURE_KEYS.recordSignatures(
          variables.data.recordType, 
          variables.data.recordId
        ) 
      });
      queryClient.invalidateQueries({ 
        queryKey: DIGITAL_SIGNATURE_KEYS.userAuditTrail(signature.userId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: DIGITAL_SIGNATURE_KEYS.recentAuditTrail() 
      });
      queryClient.invalidateQueries({ 
        queryKey: DIGITAL_SIGNATURE_KEYS.userStats(signature.userId) 
      });
    },
    onError: (error) => {
      console.error('Failed to create digital signature:', error);
      toast({
        title: "Signature Error",
        description: "Failed to create digital signature. Please try again.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to get signatures for a specific record
 */
export function useRecordSignatures(recordType: RecordType, recordId: string) {
  return useQuery({
    queryKey: DIGITAL_SIGNATURE_KEYS.recordSignatures(recordType, recordId),
    queryFn: () => DigitalSignatureService.getSignaturesForRecord(recordType, recordId),
    enabled: !!recordType && !!recordId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get audit trail for a user
 */
export function useUserAuditTrail(userId: string, limit?: number) {
  return useQuery({
    queryKey: DIGITAL_SIGNATURE_KEYS.userAuditTrail(userId),
    queryFn: () => DigitalSignatureService.getUserAuditTrail(userId, limit),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to get recent audit trail entries
 */
export function useRecentAuditTrail(limit?: number) {
  return useQuery({
    queryKey: DIGITAL_SIGNATURE_KEYS.recentAuditTrail(),
    queryFn: () => DigitalSignatureService.getRecentAuditTrail(limit),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to verify a digital signature
 */
export function useVerifySignature() {
  return useMutation({
    mutationFn: (signatureId: string) => DigitalSignatureService.verifySignature(signatureId),
    onError: (error) => {
      console.error('Failed to verify signature:', error);
      toast({
        title: "Verification Error",
        description: "Failed to verify digital signature.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to get signature statistics for a user
 */
export function useUserSignatureStats(userId: string) {
  return useQuery({
    queryKey: DIGITAL_SIGNATURE_KEYS.userStats(userId),
    queryFn: () => DigitalSignatureService.getUserSignatureStats(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to get current user's audit trail
 */
export function useCurrentUserAuditTrail(limit?: number) {
  const { user } = useAuth();
  return useUserAuditTrail(user?.id || '', limit);
}

/**
 * Hook to get current user's signature stats
 */
export function useCurrentUserSignatureStats() {
  const { user } = useAuth();
  return useUserSignatureStats(user?.id || '');
}

/**
 * Utility hook that provides easy signature creation with common patterns
 */
export function useDigitalSignatureHelpers() {
  const createSignature = useCreateDigitalSignature();
  const { user } = useAuth();

  const signAction = async (
    recordType: RecordType,
    recordId: string,
    action: string,
    metadata?: Record<string, any>
  ) => {
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const description = DigitalSignatureService.formatActionDescription(recordType, action, metadata);
    
    return createSignature.mutateAsync({
      data: {
        recordType,
        recordId,
        action,
        description,
        metadata,
      },
    });
  };

  return {
    signAction,
    isCreating: createSignature.isPending,
    error: createSignature.error,
    formatActionDescription: DigitalSignatureService.formatActionDescription,
  };
} 