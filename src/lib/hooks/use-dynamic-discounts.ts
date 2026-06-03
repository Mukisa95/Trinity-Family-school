import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DynamicDiscountsService } from '../services/dynamic-discounts.service';
import type { DynamicDiscount } from '@/types';

const DYNAMIC_DISCOUNTS_QUERY_KEY = 'dynamicDiscounts';

export function useAllDynamicDiscounts() {
  return useQuery({
    queryKey: [DYNAMIC_DISCOUNTS_QUERY_KEY, 'all'],
    queryFn: DynamicDiscountsService.getAllDiscounts,
  });
}

export function useActiveDynamicDiscounts() {
  return useQuery({
    queryKey: [DYNAMIC_DISCOUNTS_QUERY_KEY, 'active'],
    queryFn: DynamicDiscountsService.getActiveDiscounts,
  });
}

export function useDynamicDiscount(id: string) {
  return useQuery({
    queryKey: [DYNAMIC_DISCOUNTS_QUERY_KEY, id],
    queryFn: () => DynamicDiscountsService.getDiscountById(id),
    enabled: !!id,
  });
}

export function useApplicableDiscounts(criteria: {
  uniformId: string | string[];
  selectionMode: string;
  classId?: string;
  section?: string;
  gender?: string;
  createdAfter?: string;
}) {
  return useQuery({
    queryKey: [DYNAMIC_DISCOUNTS_QUERY_KEY, 'applicable', criteria],
    queryFn: () => DynamicDiscountsService.getApplicableDiscounts(criteria),
    enabled: !!(criteria.uniformId && criteria.selectionMode),
  });
}

export function useCreateDynamicDiscount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (discountData: Omit<DynamicDiscount, 'id' | 'createdAt' | 'updatedAt'>) =>
      DynamicDiscountsService.createDiscount(discountData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DYNAMIC_DISCOUNTS_QUERY_KEY] });
    },
  });
}

export function useUpdateDynamicDiscount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<DynamicDiscount, 'id' | 'createdAt'>> }) =>
      DynamicDiscountsService.updateDiscount(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [DYNAMIC_DISCOUNTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DYNAMIC_DISCOUNTS_QUERY_KEY, variables.id] });
    },
  });
}

export function useDeleteDynamicDiscount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => DynamicDiscountsService.deleteDiscount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DYNAMIC_DISCOUNTS_QUERY_KEY] });
    },
  });
}

export function useToggleDynamicDiscount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive 
        ? DynamicDiscountsService.activateDiscount(id)
        : DynamicDiscountsService.deactivateDiscount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DYNAMIC_DISCOUNTS_QUERY_KEY] });
    },
  });
} 