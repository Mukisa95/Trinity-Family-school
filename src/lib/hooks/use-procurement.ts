import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProcurementService } from '../services/procurement.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { 
  ProcurementItem, 
  ProcurementPurchase,
  ProcurementBudget,
  CreateProcurementItemData,
  CreateProcurementPurchaseData,
  CreateProcurementBudgetData,
  AcademicYear,
  Term
} from '@/types';

// Query Keys
export const procurementKeys = {
  all: ['procurement'] as const,
  items: () => [...procurementKeys.all, 'items'] as const,
  purchases: () => [...procurementKeys.all, 'purchases'] as const,
  budgets: () => [...procurementKeys.all, 'budgets'] as const,
  purchasesByPeriod: (startDate: string, endDate: string, filters?: any) => 
    [...procurementKeys.purchases(), 'period', startDate, endDate, filters] as const,
  purchasesByItem: (itemId: string) => [...procurementKeys.purchases(), 'item', itemId] as const,
};

// Item Hooks
export function useProcurementItems() {
  return useQuery({
    queryKey: procurementKeys.items(),
    queryFn: ProcurementService.getItems,
  });
}

export function useCreateProcurementItem() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateProcurementItemData) => {
      const itemId = await ProcurementService.createItem(data);
      
      // Create digital signature for procurement item creation
      if (user) {
        await signAction(
          'procurement',
          itemId,
          'item_created',
          {
            itemName: data.name,
            category: data.category,
            unit: data.unit,
            useCase: data.useCase,
            isActive: data.isActive
          }
        );
      }
      
      return itemId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.items() });
    },
  });
}

export function useUpdateProcurementItem() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProcurementItem> }) => {
      await ProcurementService.updateItem(id, data);
      
      // Create digital signature for procurement item modification
      if (user) {
        await signAction(
          'procurement',
          id,
          'item_modified',
          {
            updatedFields: Object.keys(data),
            nameChanged: !!data.name,
            categoryChanged: !!data.category,
            statusChanged: data.isActive !== undefined
          }
        );
      }
      
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.items() });
    },
  });
}

// Purchase Hooks
export function useProcurementPurchases() {
  return useQuery({
    queryKey: procurementKeys.purchases(),
    queryFn: ProcurementService.getPurchases,
  });
}

export function useProcurementPurchasesByPeriod(
  startDate: string, 
  endDate: string, 
  filters?: any
) {
  return useQuery({
    queryKey: procurementKeys.purchasesByPeriod(startDate, endDate, filters),
    queryFn: () => ProcurementService.getPurchasesByPeriod(startDate, endDate, filters),
    enabled: !!startDate && !!endDate,
  });
}

export function useProcurementPurchasesByItem(itemId: string) {
  return useQuery({
    queryKey: procurementKeys.purchasesByItem(itemId),
    queryFn: () => ProcurementService.getPurchasesByItem(itemId),
    enabled: !!itemId,
  });
}

export function useCreateProcurementPurchase() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      data, 
      academicYear, 
      term 
    }: { 
      data: CreateProcurementPurchaseData; 
      academicYear: AcademicYear; 
      term: Term; 
    }) => {
      const purchaseId = await ProcurementService.createPurchase(data, academicYear, term);
      
      // Create digital signature for procurement purchase
      if (user) {
        await signAction(
          'procurement',
          purchaseId,
          'purchase_created',
          {
            itemId: data.itemId,
            quantity: data.quantity,
            unitCost: data.unitCost,
            totalCost: data.quantity * data.unitCost,
            supplierName: data.supplierName,
            paymentMethod: data.paymentMethod,
            procuredBy: data.procuredBy,
            purchaseDate: data.purchaseDate,
            academicYear: academicYear.name,
            term: term.name
          }
        );
      }
      
      return purchaseId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.purchases() });
      queryClient.invalidateQueries({ queryKey: procurementKeys.items() });
    },
  });
}

export function useUpdateProcurementPurchase() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProcurementPurchase> }) => {
      await ProcurementService.updatePurchase(id, data);
      
      // Create digital signature for procurement purchase modification
      if (user) {
        await signAction(
          'procurement',
          id,
          'purchase_modified',
          {
            updatedFields: Object.keys(data),
            quantityChanged: !!data.quantity,
            costChanged: !!data.unitCost,
            supplierChanged: !!data.supplierName,
            paymentMethodChanged: !!data.paymentMethod,
            modifiedBy: data.modifiedBy || user.username
          }
        );
      }
      
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.purchases() });
      queryClient.invalidateQueries({ queryKey: procurementKeys.items() });
    },
  });
}

export function useDeleteProcurementPurchase() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      await ProcurementService.deletePurchase(id);
      
      // Create digital signature for procurement purchase deletion
      if (user) {
        await signAction(
          'procurement',
          id,
          'purchase_deleted',
          {
            deletedBy: user.username,
            deletedAt: new Date().toISOString()
          }
        );
      }
      
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.purchases() });
      queryClient.invalidateQueries({ queryKey: procurementKeys.items() });
    },
  });
}

// Budget Hooks
export function useProcurementBudgets() {
  return useQuery({
    queryKey: procurementKeys.budgets(),
    queryFn: ProcurementService.getBudgets,
  });
}

export function useCreateProcurementBudget() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      data, 
      academicYear, 
      term 
    }: { 
      data: CreateProcurementBudgetData; 
      academicYear: AcademicYear; 
      term: Term; 
    }) => {
      const budgetId = await ProcurementService.createBudget(data, academicYear, term);
      
      // Create digital signature for procurement budget creation
      if (user) {
        await signAction(
          'procurement',
          budgetId,
          'budget_created',
          {
            budgetName: data.name,
            startDate: data.startDate,
            endDate: data.endDate,
            itemCount: data.items.length,
            totalEstimatedCost: data.items.reduce((sum, item) => sum + item.estimatedTotalCost, 0),
            academicYear: academicYear.name,
            term: term.name
          }
        );
      }
      
      return budgetId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.budgets() });
    },
  });
}

export function useUpdateProcurementBudget() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProcurementBudget> }) => {
      await ProcurementService.updateBudget(id, data);
      
      // Create digital signature for procurement budget modification
      if (user) {
        await signAction(
          'procurement',
          id,
          'budget_modified',
          {
            updatedFields: Object.keys(data),
            nameChanged: !!data.name,
            datesChanged: !!(data.startDate || data.endDate),
            itemsChanged: !!data.items,
            statusChanged: !!data.status
          }
        );
      }
      
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.budgets() });
    },
  });
} 