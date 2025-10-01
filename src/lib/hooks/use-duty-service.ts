import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DutyServiceService } from '../services/duty-service.service';
import { useToast } from '@/hooks/use-toast';
import { useDigitalSignature } from '../services/digital-signature.service';
import { useAuth } from '@/lib/contexts/auth-context';
import type { 
  PrefectoralPost,
  PostAssignment,
  DutyRota,
  DutyAssignment,
  Poll,
  PerformanceRanking,
  CreatePrefectoralPostData,
  UpdatePrefectoralPostData,
  CreatePostAssignmentData,
  CreateDutyRotaData,
  UpdateDutyRotaData,
  CreateDutyAssignmentData,
  CreatePollData,
  CreatePerformanceRankingData,
  DutyServiceStats,
  PrefectoralPostWithAssignments,
  DutyRotaWithAssignments
} from '@/types/duty-service';

// ===== PREFECTORAL MANAGEMENT HOOKS =====

export function usePrefectoralPosts(academicYearId?: string) {
  return useQuery({
    queryKey: ['prefectoral-posts', academicYearId],
    queryFn: () => DutyServiceService.getPrefectoralPosts(academicYearId),
  });
}

export function usePrefectoralPost(id: string) {
  return useQuery({
    queryKey: ['prefectoral-post', id],
    queryFn: () => DutyServiceService.getPrefectoralPostById(id),
    enabled: !!id,
  });
}

export function usePrefectoralPostWithAssignments(id: string) {
  return useQuery({
    queryKey: ['prefectoral-post-with-assignments', id],
    queryFn: () => DutyServiceService.getPrefectoralPostWithAssignments(id),
    enabled: !!id,
  });
}

export function useCreatePrefectoralPost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreatePrefectoralPostData) => {
      const postId = await DutyServiceService.createPrefectoralPost({
        ...data,
        createdBy: user?.id || 'unknown'
      });
      
      // Create digital signature
      await createSignature({
        recordType: 'prefectoral_post_creation',
        recordId: postId,
        action: 'create_prefectoral_post',
        description: `Created prefectoral post: ${data.postName}`,
        metadata: { postName: data.postName, positionOfHonour: data.positionOfHonour }
      });
      
      return postId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prefectoral-posts'] });
      toast({
        title: "Success",
        description: "Prefectoral post created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating prefectoral post:', error);
      toast({
        title: "Error",
        description: "Failed to create prefectoral post",
        variant: "destructive",
      });
    },
  });
}

export function useUpdatePrefectoralPost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePrefectoralPostData }) => {
      await DutyServiceService.updatePrefectoralPost(id, data);
      
      // Create digital signature
      await createSignature({
        recordType: 'prefectoral_post_update',
        recordId: id,
        action: 'update_prefectoral_post',
        description: `Updated prefectoral post: ${data.postName || 'ID: ' + id}`,
        metadata: { postName: data.postName, positionOfHonour: data.positionOfHonour }
      });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['prefectoral-posts'] });
      queryClient.invalidateQueries({ queryKey: ['prefectoral-post', id] });
      queryClient.invalidateQueries({ queryKey: ['prefectoral-post-with-assignments', id] });
      toast({
        title: "Success",
        description: "Prefectoral post updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating prefectoral post:', error);
      toast({
        title: "Error",
        description: "Failed to update prefectoral post",
        variant: "destructive",
      });
    },
  });
}

export function useDeletePrefectoralPost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();

  return useMutation({
    mutationFn: async (id: string) => {
      await DutyServiceService.deletePrefectoralPost(id);
      
      // Create digital signature
      await createSignature({
        recordType: 'prefectoral_post_deletion',
        recordId: id,
        action: 'delete_prefectoral_post',
        description: `Deleted prefectoral post: ID ${id}`,
        metadata: { postId: id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prefectoral-posts'] });
      toast({
        title: "Success",
        description: "Prefectoral post deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting prefectoral post:', error);
      toast({
        title: "Error",
        description: "Failed to delete prefectoral post",
        variant: "destructive",
      });
    },
  });
}

export function useAssignPupilToPost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreatePostAssignmentData) => {
      const assignmentId = await DutyServiceService.assignPupilToPost({
        ...data,
        createdBy: user?.id || 'unknown'
      });
      
      // Create digital signature
      await createSignature({
        recordType: 'post_assignment_creation',
        recordId: assignmentId,
        action: 'assign_pupil_to_post',
        description: `Assigned pupil to post: ${data.postId}`,
        metadata: { postId: data.postId, pupilId: data.pupilId }
      });
      
      return assignmentId;
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['post-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['prefectoral-post-with-assignments', data.postId] });
      toast({
        title: "Success",
        description: "Pupil assigned to post successfully",
      });
    },
    onError: (error) => {
      console.error('Error assigning pupil to post:', error);
      toast({
        title: "Error",
        description: "Failed to assign pupil to post",
        variant: "destructive",
      });
    },
  });
}

export function usePostAssignments(postId?: string) {
  return useQuery({
    queryKey: ['post-assignments', postId],
    queryFn: () => DutyServiceService.getPostAssignments(postId),
    enabled: postId === undefined || !!postId, // Allow fetching all assignments when no postId is provided
  });
}

// ===== DUTY MANAGEMENT HOOKS =====

export function useDutyRotas(academicYearId?: string) {
  return useQuery({
    queryKey: ['duty-rotas', academicYearId],
    queryFn: () => DutyServiceService.getDutyRotas(academicYearId),
  });
}

export function useDutyRota(id: string) {
  return useQuery({
    queryKey: ['duty-rota', id],
    queryFn: () => DutyServiceService.getDutyRotaById(id),
    enabled: !!id,
  });
}

export function useDutyRotaWithAssignments(id: string) {
  return useQuery({
    queryKey: ['duty-rota-with-assignments', id],
    queryFn: () => DutyServiceService.getDutyRotaWithAssignments(id),
    enabled: !!id,
  });
}

export function useCreateDutyRota() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateDutyRotaData) => {
      const rotaId = await DutyServiceService.createDutyRota({
        ...data,
        createdBy: user?.id || 'unknown'
      });
      
      // Create digital signature
      await createSignature({
        recordType: 'duty_rota_creation',
        recordId: rotaId,
        action: 'create_duty_rota',
        description: `Created duty rota: ${data.dutyName}`,
        metadata: { dutyName: data.dutyName, frequency: data.frequency }
      });
      
      return rotaId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duty-rotas'] });
      toast({
        title: "Success",
        description: "Duty rota created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating duty rota:', error);
      toast({
        title: "Error",
        description: "Failed to create duty rota",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateDutyRota() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDutyRotaData }) => {
      await DutyServiceService.updateDutyRota(id, data);
      
      // Create digital signature
      await createSignature({
        recordType: 'duty_rota_update',
        recordId: id,
        action: 'update_duty_rota',
        description: `Updated duty rota: ${data.dutyName || 'ID: ' + id}`,
        metadata: { dutyName: data.dutyName, frequency: data.frequency }
      });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['duty-rotas'] });
      queryClient.invalidateQueries({ queryKey: ['duty-rota', id] });
      queryClient.invalidateQueries({ queryKey: ['duty-rota-with-assignments', id] });
      toast({
        title: "Success",
        description: "Duty rota updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating duty rota:', error);
      toast({
        title: "Error",
        description: "Failed to update duty rota",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteDutyRota() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();

  return useMutation({
    mutationFn: async (id: string) => {
      await DutyServiceService.deleteDutyRota(id);
      
      // Create digital signature
      await createSignature({
        recordType: 'duty_rota_deletion',
        recordId: id,
        action: 'delete_duty_rota',
        description: `Deleted duty rota: ID ${id}`,
        metadata: { rotaId: id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duty-rotas'] });
      toast({
        title: "Success",
        description: "Duty rota deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting duty rota:', error);
      toast({
        title: "Error",
        description: "Failed to delete duty rota",
        variant: "destructive",
      });
    },
  });
}

// ===== DUTY ASSESSMENT HOOKS =====

export function useAssignMemberToDuty() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateDutyAssignmentData) => {
      const assignmentId = await DutyServiceService.assignMemberToDuty({
        ...data,
        createdBy: user?.id || 'unknown'
      });
      
      // Create digital signature
      await createSignature({
        recordType: 'duty_assignment_creation',
        recordId: assignmentId,
        action: 'assign_member_to_duty',
        description: `Assigned member to duty: ${data.rotaId}`,
        metadata: { rotaId: data.rotaId, memberId: data.memberId, memberType: data.memberType }
      });
      
      return assignmentId;
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['duty-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['duty-rota-with-assignments', data.rotaId] });
      toast({
        title: "Success",
        description: "Member assigned to duty successfully",
      });
    },
    onError: (error) => {
      console.error('Error assigning member to duty:', error);
      toast({
        title: "Error",
        description: "Failed to assign member to duty",
        variant: "destructive",
      });
    },
  });
}

export function useDutyAssignments(rotaId?: string) {
  return useQuery({
    queryKey: ['duty-assignments', rotaId],
    queryFn: () => DutyServiceService.getDutyAssignments(rotaId),
  });
}

export function useUpdateDutyAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DutyAssignment> }) => {
      await DutyServiceService.updateDutyAssignment(id, data);
      
      // Create digital signature
      await createSignature({
        recordType: 'duty_assignment_update',
        recordId: id,
        action: 'update_duty_assignment',
        description: `Updated duty assignment: ID ${id}`,
        metadata: { assignmentId: id, updates: data }
      });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['duty-assignments'] });
      toast({
        title: "Success",
        description: "Duty assignment updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating duty assignment:', error);
      toast({
        title: "Error",
        description: "Failed to update duty assignment",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteDutyAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();

  return useMutation({
    mutationFn: async (id: string) => {
      await DutyServiceService.deleteDutyAssignment(id);
      
      // Create digital signature
      await createSignature({
        recordType: 'duty_assignment_deletion',
        recordId: id,
        action: 'delete_duty_assignment',
        description: `Deleted duty assignment: ID ${id}`,
        metadata: { assignmentId: id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duty-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['duty-timeline'] });
      toast({
        title: "Success",
        description: "Duty assignment deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting duty assignment:', error);
      toast({
        title: "Error",
        description: "Failed to delete duty assignment",
        variant: "destructive",
      });
    },
  });
}

export function useDeletePostAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();

  return useMutation({
    mutationFn: async (id: string) => {
      await DutyServiceService.deletePostAssignment(id);
      
      // Create digital signature
      await createSignature({
        recordType: 'post_assignment_deletion',
        recordId: id,
        action: 'delete_post_assignment',
        description: `Deleted post assignment: ID ${id}`,
        metadata: { assignmentId: id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['prefectoral-posts-with-assignments'] });
      toast({
        title: "Success",
        description: "Post assignment deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting post assignment:', error);
      toast({
        title: "Error",
        description: "Failed to delete post assignment",
        variant: "destructive",
      });
    },
  });
}

// ===== OPERATIONS HOOKS =====

export function usePolls(academicYearId?: string) {
  return useQuery({
    queryKey: ['polls', academicYearId],
    queryFn: () => DutyServiceService.getPolls(academicYearId),
  });
}

export function useCreatePoll() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreatePollData) => {
      const pollId = await DutyServiceService.createPoll({
        ...data,
        createdBy: user?.id || 'unknown'
      });
      
      // Create digital signature
      await createSignature({
        recordType: 'poll_creation',
        recordId: pollId,
        action: 'create_poll',
        description: `Created poll: ${data.title}`,
        metadata: { title: data.title, pollType: data.pollType }
      });
      
      return pollId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      toast({
        title: "Success",
        description: "Poll created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating poll:', error);
      toast({
        title: "Error",
        description: "Failed to create poll",
        variant: "destructive",
      });
    },
  });
}

export function useVoteInPoll() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ pollId, votedFor }: { pollId: string; votedFor: string }) => {
      await DutyServiceService.voteInPoll(
        pollId, 
        user?.id || 'unknown', 
        user?.role || 'unknown', 
        votedFor
      );
      
      // Create digital signature
      await createSignature({
        recordType: 'poll_vote',
        recordId: pollId,
        action: 'vote_in_poll',
        description: `Voted in poll: ${pollId}`,
        metadata: { pollId, votedFor, voterId: user?.id }
      });
    },
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      toast({
        title: "Success",
        description: "Vote recorded successfully",
      });
    },
    onError: (error) => {
      console.error('Error voting in poll:', error);
      toast({
        title: "Error",
        description: "Failed to record vote",
        variant: "destructive",
      });
    },
  });
}

// ===== COLLAGE HOOKS =====

export function usePerformanceRankings(period?: string) {
  return useQuery({
    queryKey: ['performance-rankings', period],
    queryFn: () => DutyServiceService.getPerformanceRankings(period),
  });
}

export function useCreatePerformanceRanking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createSignature } = useDigitalSignature();

  return useMutation({
    mutationFn: async (data: CreatePerformanceRankingData) => {
      const rankingId = await DutyServiceService.createPerformanceRanking(data);
      
      // Create digital signature
      await createSignature({
        recordType: 'performance_ranking_creation',
        recordId: rankingId,
        action: 'create_performance_ranking',
        description: `Created performance ranking: ${data.rankingPeriod}`,
        metadata: { rankingPeriod: data.rankingPeriod, startDate: data.startDate, endDate: data.endDate }
      });
      
      return rankingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-rankings'] });
      toast({
        title: "Success",
        description: "Performance ranking created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating performance ranking:', error);
      toast({
        title: "Error",
        description: "Failed to create performance ranking",
        variant: "destructive",
      });
    },
  });
}

// ===== UTILITY HOOKS =====

export function useDutyServiceStats(academicYearId?: string) {
  return useQuery({
    queryKey: ['duty-service-stats', academicYearId],
    queryFn: () => DutyServiceService.getDutyServiceStats(academicYearId),
  });
}

// ===== TIMELINE HOOKS =====

export function useDutyTimeline(rotaId: string) {
  return useQuery({
    queryKey: ['duty-timeline', rotaId],
    queryFn: () => DutyServiceService.getDutyTimeline(rotaId),
    enabled: !!rotaId,
  });
}

export function useCreateBulkDutyAssignment() {
  const queryClient = useQueryClient();
  const { createSignature } = useDigitalSignature();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateBulkDutyAssignmentData) => {
      const assignmentIds = await DutyServiceService.createBulkDutyAssignment({
        ...data,
      });
      
      // Create digital signature for each assignment
      for (const assignmentId of assignmentIds) {
        await createSignature({
          recordType: 'bulk_duty_assignment',
          recordId: assignmentId,
          action: 'create_bulk_duty_assignment',
          description: `Bulk assigned ${data.assignments.length} members to duty period ${data.periodNumber}`,
          metadata: { 
            rotaId: data.rotaId, 
            periodNumber: data.periodNumber, 
            assignmentsCount: data.assignments.length 
          }
        });
      }
      
      return assignmentIds;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['duty-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['duty-timeline', variables.rotaId] });
      queryClient.invalidateQueries({ queryKey: ['duty-service-stats'] });
      
      toast({
        title: "Success",
        description: `Successfully assigned ${variables.assignments.length} members to duty period`,
      });
    },
    onError: (error) => {
      console.error('Error creating bulk duty assignment:', error);
      toast({
        title: "Error",
        description: "Failed to assign members to duty period",
        variant: "destructive",
      });
    },
  });
}
