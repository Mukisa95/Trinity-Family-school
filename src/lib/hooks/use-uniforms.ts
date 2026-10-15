import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSchoolCatalogue } from './use-school-catalogue';
import { readUniformsCatalogue } from '@/lib/cache/school-catalogue-queries';
import { filterSchoolCatalogue } from '@/lib/selectors/school-catalogue-selectors';
import { UniformsService } from '../services/uniforms.service';
import type { UniformItem, CreateUniformData, UpdateUniformData, UniformGender, UniformSection } from '@/types';

const UNIFORMS_QUERY_KEY = 'uniforms';

export function useUniforms() {
  return useSchoolCatalogue<UniformItem>('uniforms', readUniformsCatalogue);
}

export function useActiveUniforms() {
  const query = useUniforms();
  return { ...query, data: query.data?.filter(item => item.isActive) };
}

export function useUniformsByFilter(filters: {
  gender?: UniformGender; classId?: string; section?: UniformSection;
}, enabled = true) {
  const query = useSchoolCatalogue<UniformItem>('uniforms', readUniformsCatalogue, enabled);
  return { ...query, data: query.data === undefined ? undefined : filterSchoolCatalogue(query.data, filters) };
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
    mutationKey: ["uniforms","create"],
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
    mutationKey: ["uniforms","update"],
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
    mutationKey: ["uniforms","delete"],
    mutationFn: (id: string) => UniformsService.deleteUniform(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [UNIFORMS_QUERY_KEY] });
    },
  });
}

export function useToggleUniformStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ["uniforms","toggle-status"],
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      UniformsService.toggleUniformStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [UNIFORMS_QUERY_KEY] });
    },
  });
}
