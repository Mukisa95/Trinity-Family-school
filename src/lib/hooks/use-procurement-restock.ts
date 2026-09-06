import { useQuery } from '@tanstack/react-query';

import { ProcurementRestockService } from '@/lib/services/procurement-restock.service';

export const procurementRestockKeys = {
  all: ['procurement', 'restock-queue'] as const,
};

export function useProcurementRestockQueue(enabled = true) {
  return useQuery({
    queryKey: procurementRestockKeys.all,
    queryFn: () => ProcurementRestockService.getQueue().then(result => result.requests),
    enabled,
    staleTime: 20_000,
  });
}
