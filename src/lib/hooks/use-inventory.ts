import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InventoryService } from '../services/inventory.service';
import { ItemCatalogService } from '../services/item-catalog.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import { auth } from '@/lib/firebase';
import type {
    InventoryItem,
    CreateInventoryItemData,
    UpdateInventoryItemData,
    InventoryTransaction,
    CreateInventoryTransactionData,
    IssuedItem,
    StockLevel,
    InventorySummary,
    InventoryFilters,
    TransactionFilters,
    AcademicYear,
    Term,
    ItemCondition,
    ProcessInventoryReturnData
} from '@/types';
import type { CreateCatalogLinkedInventoryItemData, CreateNewCatalogInventoryItemData } from '@/types';

// Query Keys
export const inventoryKeys = {
    all: ['inventory'] as const,
    items: () => [...inventoryKeys.all, 'items'] as const,
    itemsFiltered: (filters?: InventoryFilters) => [...inventoryKeys.items(), filters] as const,
    item: (id: string) => [...inventoryKeys.items(), id] as const,
    transactions: () => [...inventoryKeys.all, 'transactions'] as const,
    transactionsFiltered: (filters?: TransactionFilters) => [...inventoryKeys.transactions(), filters] as const,
    transactionsByItem: (itemId: string) => [...inventoryKeys.transactions(), 'item', itemId] as const,
    issuedItems: () => [...inventoryKeys.all, 'issued'] as const,
    overdueItems: () => [...inventoryKeys.all, 'overdue'] as const,
    stockLevels: () => [...inventoryKeys.all, 'stockLevels'] as const,
    lowStockItems: () => [...inventoryKeys.all, 'lowStock'] as const,
    summary: () => [...inventoryKeys.all, 'summary'] as const,
    usageReport: (itemId: string, startDate: string, endDate: string) =>
        [...inventoryKeys.all, 'usageReport', itemId, startDate, endDate] as const,
    valueReport: () => [...inventoryKeys.all, 'valueReport'] as const,
};

// ===== ITEM HOOKS =====

export function useInventoryItems(filters?: InventoryFilters) {
    return useQuery({
        queryKey: inventoryKeys.itemsFiltered(filters),
        queryFn: () => InventoryService.getItems(filters),
    });
}

export function useInventoryItem(id: string) {
    return useQuery({
        queryKey: inventoryKeys.item(id),
        queryFn: () => InventoryService.getItemById(id),
        enabled: !!id,
    });
}

export function useActiveInventoryItems() {
    return useQuery({
        queryKey: inventoryKeys.itemsFiltered({ isActive: true }),
        queryFn: () => InventoryService.getActiveItems(),
    });
}

export function useLowStockItems() {
    return useQuery({
        queryKey: inventoryKeys.lowStockItems(),
        queryFn: () => InventoryService.getLowStockItems(),
    });
}

export function useCreateInventoryItem() {
    const queryClient = useQueryClient();
    const { signAction } = useDigitalSignatureHelpers();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: CreateInventoryItemData) => {
            const itemId = await InventoryService.createItem(data);

            // Create digital signature for inventory item creation
            if (user) {
                await signAction(
                    'inventory',
                    itemId,
                    'item_created',
                    {
                        itemName: data.name,
                        category: data.category,
                        quantity: data.quantity,
                        unit: data.unit,
                        location: data.location,
                        condition: data.condition,
                        unitValue: data.unitValue,
                        assetTag: data.assetTag
                    }
                );
            }

            return itemId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.summary() });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() });
        },
    });
}

/**
 * Creates new Inventory records through the shared catalogue. A single
 * transaction either saves both records or saves neither one.
 */
export function useCreateCatalogBackedInventoryItem() {
    const queryClient = useQueryClient();
    const { signAction } = useDigitalSignatureHelpers();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: CreateNewCatalogInventoryItemData | CreateCatalogLinkedInventoryItemData) => {
            const result = 'catalogItemId' in data
                ? await ItemCatalogService.createCatalogLinkedInventoryItem(data)
                : await ItemCatalogService.createNewInventoryItem(data);

            if (user) {
                await signAction('inventory', result.inventoryItemId, 'item_created', {
                    itemName: data.item.name,
                    category: data.item.category,
                    quantity: data.item.quantity,
                    unit: data.item.unit,
                    location: data.item.location,
                    condition: data.item.condition,
                    unitValue: data.item.unitValue,
                    assetTag: data.item.assetTag,
                    catalogItemId: result.catalogItemId,
                });
            }
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.summary() });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() });
            queryClient.invalidateQueries({ queryKey: ['school-item-catalog'] });
        },
    });
}

export function useUpdateInventoryItem() {
    const queryClient = useQueryClient();
    const { signAction } = useDigitalSignatureHelpers();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateInventoryItemData }) => {
            await InventoryService.updateItem(id, data);

            // Create digital signature for inventory item modification
            if (user) {
                await signAction(
                    'inventory',
                    id,
                    'item_modified',
                    {
                        updatedFields: Object.keys(data),
                        quantityChanged: data.quantity !== undefined,
                        conditionChanged: data.condition !== undefined,
                        locationChanged: data.location !== undefined,
                        valueChanged: data.unitValue !== undefined
                    }
                );
            }

            return id;
        },
        onSuccess: (id) => {
            queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.item(id) });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.summary() });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() });
        },
    });
}

export function useDeleteInventoryItem() {
    const queryClient = useQueryClient();
    const { signAction } = useDigitalSignatureHelpers();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (id: string) => {
            await InventoryService.deleteItem(id);

            // Create digital signature for inventory item deletion
            if (user) {
                await signAction(
                    'inventory',
                    id,
                    'item_deleted',
                    {
                        deletedBy: user.username,
                        deletedAt: new Date().toISOString()
                    }
                );
            }

            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.summary() });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() });
        },
    });
}

// ===== TRANSACTION HOOKS =====

export function useInventoryTransactions(filters?: TransactionFilters) {
    return useQuery({
        queryKey: inventoryKeys.transactionsFiltered(filters),
        queryFn: () => InventoryService.getTransactions(filters),
    });
}

export function useInventoryTransactionsByItem(itemId: string) {
    return useQuery({
        queryKey: inventoryKeys.transactionsByItem(itemId),
        queryFn: () => InventoryService.getTransactionsByItem(itemId),
        enabled: !!itemId,
    });
}

export function useRecentTransactions(limit: number = 10) {
    return useQuery({
        queryKey: [...inventoryKeys.transactions(), 'recent', limit],
        queryFn: () => InventoryService.getRecentTransactions(limit),
    });
}

export function useRecordTransaction() {
    const queryClient = useQueryClient();
    const { signAction } = useDigitalSignatureHelpers();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({
            data,
            academicYear,
            term
        }: {
            data: CreateInventoryTransactionData;
            academicYear: AcademicYear;
            term: Term;
        }) => {
            const transactionId = await InventoryService.recordTransaction(data, academicYear, term);

            // A purchase receipt can make one or more staff requests ready for
            // release. This is deliberately secondary: stock has already been
            // committed and must never be rolled back because notification work
            // is temporarily unavailable.
            if (data.type === 'purchase') {
                try {
                    const token = await auth.currentUser?.getIdToken();
                    if (token) {
                        const response = await fetch('/api/item-requests/restock-received', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ inventoryItemId: data.itemId, inventoryTransactionId: transactionId }),
                        });
                        if (!response.ok) console.warn('Stock was received, but pending item requests could not be refreshed.');
                    }
                } catch (error) {
                    console.warn('Stock was received, but pending item requests could not be refreshed:', error);
                }
            }

            // A committed stock transaction must remain successful even if the
            // secondary signature service is temporarily unavailable.
            if (user) {
                try {
                    await signAction(
                        'inventory',
                        transactionId,
                        `transaction_${data.type}`,
                        {
                            itemId: data.itemId,
                            type: data.type,
                            quantity: data.quantity,
                            fromLocation: data.fromLocation,
                            toLocation: data.toLocation,
                            issuedTo: data.issuedTo,
                            purpose: data.purpose,
                            processedBy: data.processedBy,
                            transactionDate: data.transactionDate,
                            academicYear: academicYear.name,
                            term: term.name
                        }
                    );
                } catch (error) {
                    console.error('Inventory transaction was saved but could not be signed:', error);
                }
            }

            return transactionId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
        },
    });
}

// ===== ISSUED ITEMS HOOKS =====

export function useIssuedItems() {
    return useQuery({
        queryKey: inventoryKeys.issuedItems(),
        queryFn: () => InventoryService.getIssuedItems(),
    });
}

export function useOverdueItems() {
    return useQuery({
        queryKey: inventoryKeys.overdueItems(),
        queryFn: () => InventoryService.getOverdueItems(),
    });
}

export function useProcessInventoryReturn() {
    const queryClient = useQueryClient();
    const { signAction } = useDigitalSignatureHelpers();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: ProcessInventoryReturnData) => {
            const transactionId = await InventoryService.processReturn(data);

            if (user) {
                try {
                    await signAction(
                        'inventory',
                        transactionId,
                        'item_returned',
                        {
                            issuedItemId: data.issuedItemId,
                            returnedQuantity: data.returnedQuantity,
                            returnCondition: data.returnCondition,
                            returnDate: data.actualReturnDate,
                            processedBy: user.username
                        }
                    );
                } catch (error) {
                    console.error('Inventory return was saved but could not be signed:', error);
                }
            }

            return transactionId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
        },
    });
}

// ===== STOCK LEVELS HOOKS =====

export function useStockLevels() {
    return useQuery({
        queryKey: inventoryKeys.stockLevels(),
        queryFn: () => InventoryService.getStockLevels(),
    });
}

// ===== REPORTS & ANALYTICS HOOKS =====

export function useInventorySummary() {
    return useQuery({
        queryKey: inventoryKeys.summary(),
        queryFn: () => InventoryService.getInventorySummary(),
    });
}

export function useUsageReport(itemId: string, startDate: string, endDate: string) {
    return useQuery({
        queryKey: inventoryKeys.usageReport(itemId, startDate, endDate),
        queryFn: () => InventoryService.getUsageReport(itemId, startDate, endDate),
        enabled: !!itemId && !!startDate && !!endDate,
    });
}

export function useValueReport() {
    return useQuery({
        queryKey: inventoryKeys.valueReport(),
        queryFn: () => InventoryService.getValueReport(),
    });
}
