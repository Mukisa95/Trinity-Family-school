import { useQuery } from '@tanstack/react-query';
import { ClassesService } from '../services/classes.service';
import type { Class } from '@/types';

export function useClassDetail(id: string) {
  return useQuery({
    queryKey: ['class', 'detail', id],
    queryFn: () => ClassesService.getById(id),
    enabled: !!id,
  });
}
