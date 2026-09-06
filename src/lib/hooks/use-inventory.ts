import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InventoryService } from '../services/inventory.service';
import { ItemCatalogService } from '../services/item-catalog.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import { auth } from '@/lib/firebase';
import { useRevisionedDomainQuery } from './use-revisioned-domain-query';
import type {
    InventoryItem,
    CreateInventoryItemData,
    UpdateInventoryItemData,
    InventoryTransaction,
    CreateInventoryTransactionData,
    IssuedItem,
    StockLevel,
    InventorySummary,
    UsageReport,
    ValueReport,
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

function toStockLevel(item: InventoryItem): StockLevel {
    return {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        location: item.location,
        currentQuantity: item.quantity,
        reorderLevel: item.reorderLevel,
        isLowStock: item.reorderLevel !== undefined && item.quantity <= item.reorderLevel,
        totalValue: item.totalValue,
    };
}

function buildInventorySummary(
    items: InventoryItem[],
    transactions: InventoryTransaction[],
    issuedItems: IssuedItem[],
): InventorySummary {
    const byCategory: InventorySummary['byCategory'] = {} as InventorySummary['byCategory'];
    const byCondition: InventorySummary['byCondition'] = {} as InventorySummary['byCondition'];
    const byLocation: InventorySummary['byLocation'] = {};
    let totalQuantity = 0;
    let totalValue = 0;

    items.forEach(item => {
        byCategory[item.category] ||= { itemCount: 0, totalQuantity: 0, totalValue: 0 };
        byCategory[item.category].itemCount += 1;
        byCategory[item.category].totalQuantity += item.quantity;
        byCategory[item.category].totalValue += item.totalValue || 0;
        byCondition[item.condition] = (byCondition[item.condition] || 0) + 1;
        byLocation[item.location] ||= { itemCount: 0, totalQuantity: 0 };
        byLocation[item.location].itemCount += 1;
        byLocation[item.location].totalQuantity += item.quantity;
        totalQuantity += item.quantity;
        totalValue += item.totalValue || 0;
    });

    const lowStockItems = items
        .filter(item => item.isActive && item.reorderLevel !== undefined && item.quantity <= item.reorderLevel)
        .map(toStockLevel);
    const now = new Date().toISOString();
    const overdueItems = issuedItems.filter(item =>
        item.status === 'overdue' || Boolean(item.expectedReturnDate && item.expectedReturnDate < now && !item.actualReturnDate));

    return {
        totalItems: items.length,
        totalQuantity,
        totalValue,
        lowStockCount: lowStockItems.length,
        byCategory,
        byCondition,
        byLocation,
        recentTransactions: transactions.slice(0, 10),
        lowStockItems,
        overdueItems,
    };
}

function buildUsageReport(
    items: InventoryItem[],
    transactions: InventoryTransaction[],
    itemId: string,
    startDate: string,
    endDate: string,
): UsageReport | null {
    const item = items.find(entry => entry.id === itemId);
    if (!item || !startDate || !endDate) return null;
    const periodTransactions = transactions.filter(transaction =>
        transaction.itemId === itemId
        && transaction.transactionDate >= startDate
        && transaction.transactionDate <= endDate);
    const issuedByDepartment: Record<string, number> = {};
    const issuedByPersonMap: Record<string, number> = {};
    let totalIssued = 0;
    let totalReturned = 0;
    periodTransactions.forEach(transaction => {
        if (transaction.type === 'issue') {
            totalIssued += transaction.quantity;
            if (transaction.toLocation) issuedByDepartment[transaction.toLocation] = (issuedByDepartment[transaction.toLocation] || 0) + transaction.quantity;
            if (transaction.issuedTo) issuedByPersonMap[transaction.issuedTo] = (issuedByPersonMap[transaction.issuedTo] || 0) + transaction.quantity;
        } else if (transaction.type === 'return') {
            totalReturned += transaction.quantity;
        }
    });
    return {
        itemId,
        itemName: item.name,
        category: item.category,
        period: { startDate, endDate },
        totalIssued,
        totalReturned,
        netUsage: totalIssued - totalReturned,
        issuedByDepartment,
        issuedByPerson: Object.entries(issuedByPersonMap)
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((left, right) => right.quantity - left.quantity),
    };
}

function buildValueReport(items: InventoryItem[]): ValueReport {
    const valueByCategory: ValueReport['valueByCategory'] = {} as ValueReport['valueByCategory'];
    let totalAssetValue = 0;
    const topValueItems = items.map(item => {
        const totalValue = item.totalValue || 0;
        totalAssetValue += totalValue;
        valueByCategory[item.category] = (valueByCategory[item.category] || 0) + totalValue;
        return {
            itemId: item.id,
            itemName: item.name,
            quantity: item.quantity,
            unitValue: item.unitValue || 0,
            totalValue,
        };
    }).sort((left, right) => right.totalValue - left.totalValue).slice(0, 10);
    return { asOfDate: new Date().toISOString(), totalAssetValue, totalItemCount: items.length, valueByCategory, topValueItems };
}

// ===== ITEM HOOKS =====

function useAllInventoryItems(enabled = true) {
    return useRevisionedDomainQuery({
        queryKey: inventoryKeys.items(),
        cacheName: 'inventory-items',
        revisionKeys: ['inventoryItems'],
        queryFn: () => InventoryService.getItems(),
        enabled,
    });
}

function filterInventoryItems(items: InventoryItem[], filters?: InventoryFilters) {
    if (!filters) return items;
    return items.filter(item => {
        if (filters.categories?.length && !filters.categories.includes(item.category)) return false;
        if (filters.conditions?.length && !filters.conditions.includes(item.condition)) return false;
        if (filters.locations?.length && !filters.locations.includes(item.location)) return false;
        if (filters.isActive !== undefined && item.isActive !== filters.isActive) return false;
        if (filters.isLowStock && !(item.reorderLevel !== undefined && item.quantity <= item.reorderLevel)) return false;
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            if (![item.name, item.description, item.assetTag, item.serialNumber]
                .some(value => value?.toLowerCase().includes(term))) return false;
        }
        return true;
    });
}

export function useInventoryItems(filters?: InventoryFilters, options?: { enabled?: boolean }) {
    const query = useAllInventoryItems(options?.enabled ?? true);
    const data = useMemo(() => filterInventoryItems(query.data || [], filters), [filters, query.data]);
    return { ...query, data };
}

export function useInventoryItem(id: string) {
    const query = useAllInventoryItems();
    const data = useMemo(() => query.data?.find(item => item.id === id) ?? null, [id, query.data]);
    return { ...query, data };
}

export function useActiveInventoryItems() {
    const query = useAllInventoryItems();
    const data = useMemo(() => (query.data || []).filter(item => item.isActive), [query.data]);
    return { ...query, data };
}

export function useLowStockItems(options?: { enabled?: boolean }) {
    const query = useAllInventoryItems(options?.enabled ?? true);
    const data = useMemo(() => (query.data || []).filter(item => item.isActive && item.reorderLevel !== undefined && item.quantity <= item.reorderLevel), [query.data]);
    return { ...query, data };
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
            queryClient.invalidateQueries({ queryKey: inventoryKeys.items(), refetchType: 'none' });
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
            queryClient.invalidateQueries({ queryKey: inventoryKeys.items(), refetchType: 'none' });
            queryClient.invalidateQueries({ queryKey: ['school-item-catalog'], refetchType: 'none' });
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
            queryClient.invalidateQueries({ queryKey: inventoryKeys.items(), refetchType: 'none' });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.item(id), refetchType: 'none' });
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
            queryClient.invalidateQueries({ queryKey: inventoryKeys.items(), refetchType: 'none' });
        },
    });
}

// ===== TRANSACTION HOOKS =====

function useAllInventoryTransactions(enabled = true) {
    return useRevisionedDomainQuery({
        queryKey: inventoryKeys.transactions(),
        cacheName: 'inventory-transactions',
        revisionKeys: ['inventoryTransactions'],
        queryFn: () => InventoryService.getTransactions(),
        enabled,
    });
}

function filterInventoryTransactions(transactions: InventoryTransaction[], filters?: TransactionFilters) {
    if (!filters) return transactions;
    return transactions.filter(transaction => {
        if (filters.types?.length && !filters.types.includes(transaction.type)) return false;
        if (filters.itemIds?.length && !filters.itemIds.includes(transaction.itemId)) return false;
        if (filters.categories?.length && (!transaction.itemCategory || !filters.categories.includes(transaction.itemCategory))) return false;
        if (filters.locations?.length && (!transaction.toLocation || !filters.locations.includes(transaction.toLocation))) return false;
        if (filters.issuedTo?.length && (!transaction.issuedTo || !filters.issuedTo.includes(transaction.issuedTo))) return false;
        if (filters.processedBy?.length && !filters.processedBy.includes(transaction.processedBy)) return false;
        if (filters.dateRange && (transaction.transactionDate < filters.dateRange.startDate || transaction.transactionDate > filters.dateRange.endDate)) return false;
        if (filters.academicYearId && transaction.academicYearId !== filters.academicYearId) return false;
        if (filters.termId && transaction.termId !== filters.termId) return false;
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            if (![transaction.itemName, transaction.issuedTo, transaction.notes]
                .some(value => value?.toLowerCase().includes(term))) return false;
        }
        return true;
    });
}

export function useInventoryTransactions(filters?: TransactionFilters) {
    const query = useAllInventoryTransactions();
    const data = useMemo(() => filterInventoryTransactions(query.data || [], filters), [filters, query.data]);
    return { ...query, data };
}

export function useInventoryTransactionsByItem(itemId: string) {
    const query = useAllInventoryTransactions();
    const data = useMemo(() => (query.data || []).filter(transaction => transaction.itemId === itemId), [itemId, query.data]);
    return { ...query, data };
}

export function useRecentTransactions(limit: number = 10, options?: { enabled?: boolean }) {
    const query = useAllInventoryTransactions(options?.enabled ?? true);
    const data = useMemo(() => (query.data || []).slice(0, limit), [limit, query.data]);
    return { ...query, data };
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
            queryClient.invalidateQueries({ queryKey: inventoryKeys.all, refetchType: 'none' });
        },
    });
}

// ===== ISSUED ITEMS HOOKS =====

function useAllIssuedItems(enabled = true) {
    return useRevisionedDomainQuery({
        queryKey: inventoryKeys.issuedItems(),
        cacheName: 'inventory-issued-items',
        revisionKeys: ['issuedItems'],
        queryFn: () => InventoryService.getIssuedItems(),
        enabled,
    });
}

export function useIssuedItems(options?: { enabled?: boolean }) {
    return useAllIssuedItems(options?.enabled ?? true);
}

export function useOverdueItems() {
    const query = useAllIssuedItems();
    const now = new Date().toISOString();
    const data = useMemo(() => (query.data || []).filter(item => item.status === 'overdue' || (item.expectedReturnDate && item.expectedReturnDate < now && !item.actualReturnDate)), [now, query.data]);
    return { ...query, data };
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
            queryClient.invalidateQueries({ queryKey: inventoryKeys.all, refetchType: 'none' });
        },
    });
}

// ===== STOCK LEVELS HOOKS =====

export function useStockLevels() {
    const query = useActiveInventoryItems();
    const data = useMemo<StockLevel[]>(() => (query.data || []).map(item => ({
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        location: item.location,
        currentQuantity: item.quantity,
        reorderLevel: item.reorderLevel,
        isLowStock: item.reorderLevel !== undefined && item.quantity <= item.reorderLevel,
        totalValue: item.totalValue,
    })), [query.data]);
    return { ...query, data };
}

// ===== REPORTS & ANALYTICS HOOKS =====

export function useInventorySummary(options?: { enabled?: boolean }) {
    const enabled = options?.enabled ?? true;
    const itemsQuery = useAllInventoryItems(enabled);
    const transactionsQuery = useAllInventoryTransactions(enabled);
    const issuedQuery = useAllIssuedItems(enabled);
    const data = useMemo<InventorySummary>(() => buildInventorySummary(
        itemsQuery.data || [],
        transactionsQuery.data || [],
        issuedQuery.data || [],
    ), [issuedQuery.data, itemsQuery.data, transactionsQuery.data]);
    return {
        ...itemsQuery,
        data,
        isLoading: itemsQuery.isLoading || transactionsQuery.isLoading || issuedQuery.isLoading,
        isFetching: itemsQuery.isFetching || transactionsQuery.isFetching || issuedQuery.isFetching,
    };
}

export function useUsageReport(itemId: string, startDate: string, endDate: string) {
    const itemsQuery = useAllInventoryItems();
    const transactionsQuery = useAllInventoryTransactions();
    const data = useMemo(() => buildUsageReport(
        itemsQuery.data || [],
        transactionsQuery.data || [],
        itemId,
        startDate,
        endDate,
    ), [endDate, itemId, itemsQuery.data, startDate, transactionsQuery.data]);
    return { ...transactionsQuery, data, isLoading: itemsQuery.isLoading || transactionsQuery.isLoading };
}

export function useValueReport() {
    const query = useActiveInventoryItems();
    const data = useMemo(() => buildValueReport(query.data || []), [query.data]);
    return { ...query, data };
}
