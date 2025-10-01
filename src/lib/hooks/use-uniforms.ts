import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UniformsService } from '../services/uniforms.service';
import type { UniformItem, CreateUniformData, UpdateUniformData, UniformGender, UniformSection } from '@/types';

const UNIFORMS_QUERY_KEY = 'uniforms';

export function useUniforms() {
  return useQuery({
    queryKey: [UNIFORMS_QUERY_KEY],
    queryFn: UniformsService.getAllUniforms,
  });
}

export function useActiveUniforms() {
  return useQuery({
    queryKey: [UNIFORMS_QUERY_KEY, 'active'],
    queryFn: UniformsService.getActiveUniforms,
  });
}

export function useUniformsByFilter(filters: {
  gender?: UniformGender;
  classId?: string;
  section?: UniformSection;
}, enabled: boolean = true) {
  return useQuery({
    queryKey: [UNIFORMS_QUERY_KEY, 'filtered', filters],
    queryFn: () => UniformsService.getUniformsByFilter(filters),
    enabled: enabled,
  });
}

export function useUniform(id: string) {
  return useQuery({
    queryKey: [UNIFORMS_QUERY_KEY, id],
    queryFn: () => UniformsService.getUniformById(id),
    enabled: !!id,
  });
}

export function useCreateUniform() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (uniformData: CreateUniformData) =>
      UniformsService.createUniform(uniformData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [UNIFORMS_QUERY_KEY] });
    },
  });
}

export function useUpdateUniform() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUniformData }) =>
      UniformsService.updateUniform(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [UNIFORMS_QUERY_KEY] });
    },
  });
}

export function useDeleteUniform() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => UniformsService.deleteUniform(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [UNIFORMS_QUERY_KEY] });
    },
  });
}

export function useToggleUniformStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      UniformsService.toggleUniformStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [UNIFORMS_QUERY_KEY] });
    },
  });
} 