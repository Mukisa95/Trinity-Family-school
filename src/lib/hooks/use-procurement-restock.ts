import { ProcurementRestockService } from '@/lib/services/procurement-restock.service';
import { useRevisionedDomainQuery } from '@/lib/hooks/use-revisioned-domain-query';

export const procurementRestockKeys = {
  all: ['procurement', 'restock-queue'] as const,
};

export function useProcurementRestockQueue(enabled = true) {
  return useRevisionedDomainQuery({
    queryKey: procurementRestockKeys.all,
    cacheName: 'procurement-restock-queue',
    revisionKeys: ['procurementRestocks', 'procurementPurchases'],
    queryFn: () => ProcurementRestockService.getQueue().then(result => result.requests),
    enabled,
  });
}
