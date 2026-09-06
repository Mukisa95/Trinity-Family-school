import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    limit,
    runTransaction
} from 'firebase/firestore';
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
    InventoryCategory,
    ItemCondition,
    InventoryLocation,
    AcademicYear,
    Term,
    ProcessInventoryReturnData
} from '@/types';
import { calculateInventoryQuantity, calculateReturnState } from '@/lib/utils/inventory-movement';

// Collection names
const INVENTORY_ITEMS_COLLECTION = 'inventoryItems';
const INVENTORY_TRANSACTIONS_COLLECTION = 'inventoryTransactions';
const ISSUED_ITEMS_COLLECTION = 'issuedItems';

export class InventoryService {
    // ===== ITEM MANAGEMENT =====

    static async createItem(data: CreateInventoryItemData): Promise<string> {
        try {
            const itemsRef = collection(db, INVENTORY_ITEMS_COLLECTION);

            const itemData = {
                ...data,
                totalValue: data.unitValue ? data.quantity * data.unitValue : 0,
                totalIssued: 0,
                totalReturned: 0,
                currentlyIssued: 0,
                isActive: data.isActive ?? true,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(itemsRef, itemData);
            return docRef.id;
        } catch (error) {
            console.error('Error creating inventory item:', error);
            throw error;
        }
    }

    static async getItems(filters?: InventoryFilters): Promise<InventoryItem[]> {
        try {
            const itemsRef = collection(db, INVENTORY_ITEMS_COLLECTION);
            let q = query(itemsRef, orderBy('name'));

            const snapshot = await getDocs(q);

            let items = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
                } as InventoryItem;
            });

            // Apply client-side filters
            if (filters) {
                if (filters.categories && filters.categories.length > 0) {
                    items = items.filter(item => filters.categories!.includes(item.category));
                }
                if (filters.conditions && filters.conditions.length > 0) {
                    items = items.filter(item => filters.conditions!.includes(item.condition));
                }
                if (filters.locations && filters.locations.length > 0) {
                    items = items.filter(item => filters.locations!.includes(item.location));
                }
                if (filters.isActive !== undefined) {
                    items = items.filter(item => item.isActive === filters.isActive);
                }
                if (filters.isLowStock) {
                    items = items.filter(item =>
                        item.reorderLevel !== undefined && item.quantity <= item.reorderLevel
                    );
                }
                if (filters.searchTerm) {
                    const term = filters.searchTerm.toLowerCase();
                    items = items.filter(item =>
                        item.name.toLowerCase().includes(term) ||
                        item.description?.toLowerCase().includes(term) ||
                        item.assetTag?.toLowerCase().includes(term) ||
                        item.serialNumber?.toLowerCase().includes(term)
                    );
                }
            }

            return items;
        } catch (error) {
            console.error('Error getting inventory items:', error);
            return [];
        }
    }

    static async getActiveItems(): Promise<InventoryItem[]> {
        return this.getItems({ isActive: true });
    }

    static async getItemById(id: string): Promise<InventoryItem | null> {
        try {
            const docRef = doc(db, INVENTORY_ITEMS_COLLECTION, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return null;
            }

            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
            } as InventoryItem;
        } catch (error) {
            console.error('Error getting inventory item by ID:', error);
            return null;
        }
    }

    static async updateItem(id: string, data: UpdateInventoryItemData): Promise<void> {
        try {
            const docRef = doc(db, INVENTORY_ITEMS_COLLECTION, id);

            // Recalculate total value if quantity or unit value changed
            let updateData: any = { ...data };

            if (data.quantity !== undefined || data.unitValue !== undefined) {
                const currentDoc = await getDoc(docRef);
                if (currentDoc.exists()) {
                    const currentData = currentDoc.data();
                    const newQuantity = data.quantity ?? currentData.quantity;
                    const newUnitValue = data.unitValue ?? currentData.unitValue ?? 0;
                    updateData.totalValue = newQuantity * newUnitValue;
                }
            }

            updateData.updatedAt = serverTimestamp();

            await updateDoc(docRef, updateData);
        } catch (error) {
            console.error('Error updating inventory item:', error);
            throw error;
        }
    }

    static async deleteItem(id: string): Promise<void> {
        try {
            const docRef = doc(db, INVENTORY_ITEMS_COLLECTION, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    }

    static async getLowStockItems(): Promise<InventoryItem[]> {
        return this.getItems({ isLowStock: true, isActive: true });
    }

    // ===== TRANSACTION MANAGEMENT =====

    static async recordTransaction(
        data: CreateInventoryTransactionData,
        academicYear: AcademicYear,
        term: Term
    ): Promise<string> {
        try {
            const itemRef = doc(db, INVENTORY_ITEMS_COLLECTION, data.itemId);
            if (data.type === 'return') {
                throw new Error('Returns must be recorded through the issued-item return workflow.');
            }
            if (data.type === 'issue' && !data.issuedTo?.trim()) {
                throw new Error('An issued item must identify the person or department receiving it.');
            }

            const transactionsRef = collection(db, INVENTORY_TRANSACTIONS_COLLECTION);
            const transactionRef = data.operationId
                ? doc(transactionsRef, data.operationId)
                : doc(transactionsRef);

            return await runTransaction(db, async (firestoreTransaction) => {
                const existingTransaction = await firestoreTransaction.get(transactionRef);
                if (existingTransaction.exists()) return transactionRef.id;

                const itemSnap = await firestoreTransaction.get(itemRef);
                if (!itemSnap.exists()) throw new Error('Item not found');

                const itemData = itemSnap.data() as InventoryItem;
                const previousQuantity = itemData.quantity;
                const newQuantity = calculateInventoryQuantity(previousQuantity, data.type, data.quantity);
                const transactionData = {
                    ...data,
                    itemName: itemData.name,
                    itemCategory: itemData.category,
                    previousQuantity,
                    newQuantity,
                    academicYearId: academicYear.id,
                    academicYearName: academicYear.name,
                    termId: term.id,
                    termName: term.name,
                    createdAt: serverTimestamp()
                };

                const itemUpdates: any = {
                    quantity: newQuantity,
                    totalValue: (itemData.unitValue || 0) * newQuantity,
                    updatedAt: serverTimestamp()
                };
                if (data.type === 'issue') {
                    itemUpdates.totalIssued = (itemData.totalIssued || 0) + data.quantity;
                    itemUpdates.currentlyIssued = (itemData.currentlyIssued || 0) + data.quantity;
                }
                if (data.conditionAfter) itemUpdates.condition = data.conditionAfter;

                firestoreTransaction.set(transactionRef, transactionData);
                firestoreTransaction.update(itemRef, itemUpdates);

                if (data.type === 'issue' && data.issuedTo) {
                    const issuedItemRef = data.operationId
                        ? doc(db, ISSUED_ITEMS_COLLECTION, data.operationId)
                        : doc(collection(db, ISSUED_ITEMS_COLLECTION));
                    firestoreTransaction.set(issuedItemRef, {
                        itemId: data.itemId,
                        itemName: itemData.name,
                        transactionId: transactionRef.id,
                        quantity: data.quantity,
                        issuedTo: data.issuedTo,
                        issuedToRole: data.issuedToRole,
                        purpose: data.purpose,
                        location: data.toLocation,
                        issueDate: data.transactionDate,
                        expectedReturnDate: data.expectedReturnDate,
                        status: 'issued',
                        academicYearId: academicYear.id,
                        termId: term.id,
                        createdAt: serverTimestamp()
                    });
                }

                return transactionRef.id;
            });
        } catch (error) {
            console.error('Error recording inventory transaction:', error);
            throw error;
        }
    }

    static async processReturn(data: ProcessInventoryReturnData): Promise<string> {
        try {
            const transactionRef = doc(db, INVENTORY_TRANSACTIONS_COLLECTION, data.operationId);
            const issuedRef = doc(db, ISSUED_ITEMS_COLLECTION, data.issuedItemId);

            return await runTransaction(db, async (firestoreTransaction) => {
                const existingTransaction = await firestoreTransaction.get(transactionRef);
                if (existingTransaction.exists()) return transactionRef.id;

                const issuedSnap = await firestoreTransaction.get(issuedRef);
                if (!issuedSnap.exists()) throw new Error('Issued item record not found');
                const issuedItem = { id: issuedSnap.id, ...issuedSnap.data() } as IssuedItem;

                const itemRef = doc(db, INVENTORY_ITEMS_COLLECTION, issuedItem.itemId);
                const itemSnap = await firestoreTransaction.get(itemRef);
                if (!itemSnap.exists()) throw new Error('Inventory item not found');
                const item = itemSnap.data() as InventoryItem;
                const returnState = calculateReturnState(issuedItem, data.returnedQuantity);
                const newQuantity = calculateInventoryQuantity(item.quantity, 'return', data.returnedQuantity);

                firestoreTransaction.set(transactionRef, {
                    itemId: issuedItem.itemId,
                    issuedItemId: issuedItem.id,
                    operationId: data.operationId,
                    itemName: item.name,
                    itemCategory: item.category,
                    type: 'return',
                    quantity: data.returnedQuantity,
                    previousQuantity: item.quantity,
                    newQuantity,
                    issuedTo: issuedItem.issuedTo,
                    conditionAfter: data.returnCondition,
                    notes: data.notes,
                    processedBy: data.processedBy,
                    processedByUserId: data.processedByUserId,
                    processedByUsername: data.processedByUsername,
                    transactionDate: data.transactionDate,
                    academicYearId: data.academicYear.id,
                    academicYearName: data.academicYear.name,
                    termId: data.term.id,
                    termName: data.term.name,
                    createdAt: serverTimestamp()
                });
                firestoreTransaction.update(itemRef, {
                    quantity: newQuantity,
                    totalValue: (item.unitValue || 0) * newQuantity,
                    totalReturned: (item.totalReturned || 0) + data.returnedQuantity,
                    currentlyIssued: Math.max(0, (item.currentlyIssued || 0) - data.returnedQuantity),
                    ...(data.returnCondition ? { condition: data.returnCondition } : {}),
                    updatedAt: serverTimestamp()
                });
                firestoreTransaction.update(issuedRef, {
                    returnedQuantity: returnState.totalReturned,
                    status: returnState.status,
                    actualReturnDate: returnState.isFullyReturned ? data.actualReturnDate : undefined,
                    lastReturnTransactionId: transactionRef.id,
                    updatedAt: serverTimestamp()
                });

                return transactionRef.id;
            });
        } catch (error) {
            console.error('Error processing inventory return:', error);
            throw error;
        }
    }

    static async getTransactions(filters?: TransactionFilters): Promise<InventoryTransaction[]> {
        try {
            const transactionsRef = collection(db, INVENTORY_TRANSACTIONS_COLLECTION);
            let q = query(transactionsRef, orderBy('createdAt', 'desc'));

            const snapshot = await getDocs(q);

            let transactions = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
                } as InventoryTransaction;
            });

            // Apply client-side filters
            if (filters) {
                if (filters.types && filters.types.length > 0) {
                    transactions = transactions.filter(t => filters.types!.includes(t.type));
                }
                if (filters.itemIds && filters.itemIds.length > 0) {
                    transactions = transactions.filter(t => filters.itemIds!.includes(t.itemId));
                }
                if (filters.categories && filters.categories.length > 0) {
                    transactions = transactions.filter(t =>
                        t.itemCategory && filters.categories!.includes(t.itemCategory)
                    );
                }
                if (filters.issuedTo && filters.issuedTo.length > 0) {
                    transactions = transactions.filter(t =>
                        t.issuedTo && filters.issuedTo!.includes(t.issuedTo)
                    );
                }
                if (filters.processedBy && filters.processedBy.length > 0) {
                    transactions = transactions.filter(t =>
                        filters.processedBy!.includes(t.processedBy)
                    );
                }
                if (filters.dateRange) {
                    transactions = transactions.filter(t =>
                        t.transactionDate >= filters.dateRange!.startDate &&
                        t.transactionDate <= filters.dateRange!.endDate
                    );
                }
                if (filters.academicYearId) {
                    transactions = transactions.filter(t => t.academicYearId === filters.academicYearId);
                }
                if (filters.termId) {
                    transactions = transactions.filter(t => t.termId === filters.termId);
                }
                if (filters.searchTerm) {
                    const term = filters.searchTerm.toLowerCase();
                    transactions = transactions.filter(t =>
                        t.itemName?.toLowerCase().includes(term) ||
                        t.issuedTo?.toLowerCase().includes(term) ||
                        t.notes?.toLowerCase().includes(term)
                    );
                }
            }

            return transactions;
        } catch (error) {
            console.error('Error getting inventory transactions:', error);
            return [];
        }
    }

    static async getTransactionsByItem(itemId: string): Promise<InventoryTransaction[]> {
        return this.getTransactions({ itemIds: [itemId] });
    }

    static async getRecentTransactions(lim: number = 10): Promise<InventoryTransaction[]> {
        try {
            const transactionsRef = collection(db, INVENTORY_TRANSACTIONS_COLLECTION);
            const q = query(transactionsRef, orderBy('createdAt', 'desc'), limit(lim));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
                } as InventoryTransaction;
            });
        } catch (error) {
            console.error('Error getting recent transactions:', error);
            return [];
        }
    }

    // ===== ISSUED ITEMS TRACKING =====

    static async getIssuedItems(status?: 'issued' | 'overdue'): Promise<IssuedItem[]> {
        try {
            const issuedRef = collection(db, ISSUED_ITEMS_COLLECTION);
            let q = query(issuedRef, where('status', 'in', ['issued', 'partial']), orderBy('issueDate', 'desc'));

            const snapshot = await getDocs(q);
            const now = new Date().toISOString();

            let items = snapshot.docs.map(doc => {
                const data = doc.data();
                const item = {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
                } as IssuedItem;

                // Check if overdue
                if (item.expectedReturnDate && item.expectedReturnDate < now && !item.actualReturnDate) {
                    item.status = 'overdue';
                }

                return item;
            });

            if (status === 'overdue') {
                items = items.filter(item => item.status === 'overdue');
            }

            return items;
        } catch (error) {
            console.error('Error getting issued items:', error);
            return [];
        }
    }

    static async getOverdueItems(): Promise<IssuedItem[]> {
        return this.getIssuedItems('overdue');
    }

    static async markItemReturned(
        issuedItemId: string,
        returnData: {
            actualReturnDate: string;
            returnedQuantity: number;
            returnCondition?: ItemCondition;
            notes?: string;
        }
    ): Promise<void> {
        void issuedItemId;
        void returnData;
        throw new Error('Use processReturn so the stock movement and issued record are saved together.');
    }

    // ===== STOCK LEVELS =====

    static async getStockLevels(): Promise<StockLevel[]> {
        try {
            const items = await this.getActiveItems();

            return items.map(item => ({
                itemId: item.id,
                itemName: item.name,
                category: item.category,
                location: item.location,
                currentQuantity: item.quantity,
                reorderLevel: item.reorderLevel,
                isLowStock: item.reorderLevel !== undefined && item.quantity <= item.reorderLevel,
                totalValue: item.totalValue,
                lastRestocked: undefined, // Would need to query transactions
                lastIssued: undefined
            }));
        } catch (error) {
            console.error('Error getting stock levels:', error);
            return [];
        }
    }

    // ===== REPORTS & ANALYTICS =====

    static async getInventorySummary(): Promise<InventorySummary> {
        try {
            const items = await this.getItems();
            const recentTransactions = await this.getRecentTransactions(10);
            const overdueItems = await this.getOverdueItems();

            // Calculate category summary
            const byCategory: InventorySummary['byCategory'] = {} as any;
            const byCondition: InventorySummary['byCondition'] = {} as any;
            const byLocation: InventorySummary['byLocation'] = {};

            let totalValue = 0;
            let totalQuantity = 0;
            let lowStockCount = 0;

            items.forEach(item => {
                // Category summary
                if (!byCategory[item.category]) {
                    byCategory[item.category] = { itemCount: 0, totalQuantity: 0, totalValue: 0 };
                }
                byCategory[item.category].itemCount++;
                byCategory[item.category].totalQuantity += item.quantity;
                byCategory[item.category].totalValue += item.totalValue || 0;

                // Condition summary
                byCondition[item.condition] = (byCondition[item.condition] || 0) + 1;

                // Location summary
                if (!byLocation[item.location]) {
                    byLocation[item.location] = { itemCount: 0, totalQuantity: 0 };
                }
                byLocation[item.location].itemCount++;
                byLocation[item.location].totalQuantity += item.quantity;

                // Totals
                totalValue += item.totalValue || 0;
                totalQuantity += item.quantity;

                // Low stock
                if (item.reorderLevel && item.quantity <= item.reorderLevel) {
                    lowStockCount++;
                }
            });

            // Low stock items
            const lowStockItems: StockLevel[] = items
                .filter(item => item.reorderLevel && item.quantity <= item.reorderLevel)
                .map(item => ({
                    itemId: item.id,
                    itemName: item.name,
                    category: item.category,
                    location: item.location,
                    currentQuantity: item.quantity,
                    reorderLevel: item.reorderLevel,
                    isLowStock: true,
                    totalValue: item.totalValue
                }));

            return {
                totalItems: items.length,
                totalQuantity,
                totalValue,
                lowStockCount,
                byCategory,
                byCondition,
                byLocation,
                recentTransactions,
                lowStockItems,
                overdueItems
            };
        } catch (error) {
            console.error('Error getting inventory summary:', error);
            throw error;
        }
    }

    static async getUsageReport(
        itemId: string,
        startDate: string,
        endDate: string
    ): Promise<UsageReport | null> {
        try {
            const item = await this.getItemById(itemId);
            if (!item) return null;

            const transactions = await this.getTransactions({
                itemIds: [itemId],
                dateRange: { startDate, endDate }
            });

            let totalIssued = 0;
            let totalReturned = 0;
            const issuedByDepartment: Record<string, number> = {};
            const issuedByPersonMap: Record<string, number> = {};

            transactions.forEach(t => {
                if (t.type === 'issue') {
                    totalIssued += t.quantity;
                    if (t.issuedTo) {
                        issuedByPersonMap[t.issuedTo] = (issuedByPersonMap[t.issuedTo] || 0) + t.quantity;
                    }
                    if (t.toLocation) {
                        issuedByDepartment[t.toLocation] = (issuedByDepartment[t.toLocation] || 0) + t.quantity;
                    }
                } else if (t.type === 'return') {
                    totalReturned += t.quantity;
                }
            });

            const issuedByPerson = Object.entries(issuedByPersonMap)
                .map(([name, quantity]) => ({ name, quantity }))
                .sort((a, b) => b.quantity - a.quantity);

            return {
                itemId,
                itemName: item.name,
                category: item.category,
                period: { startDate, endDate },
                totalIssued,
                totalReturned,
                netUsage: totalIssued - totalReturned,
                issuedByDepartment,
                issuedByPerson
            };
        } catch (error) {
            console.error('Error getting usage report:', error);
            return null;
        }
    }

    static async getValueReport(): Promise<ValueReport> {
        try {
            const items = await this.getActiveItems();
            const now = new Date().toISOString();

            let totalAssetValue = 0;
            const valueByCategory: Record<InventoryCategory, number> = {} as any;

            const topValueItems = items
                .filter(item => item.totalValue && item.totalValue > 0)
                .map(item => {
                    totalAssetValue += item.totalValue || 0;

                    if (!valueByCategory[item.category]) {
                        valueByCategory[item.category] = 0;
                    }
                    valueByCategory[item.category] += item.totalValue || 0;

                    return {
                        itemId: item.id,
                        itemName: item.name,
                        quantity: item.quantity,
                        unitValue: item.unitValue || 0,
                        totalValue: item.totalValue || 0
                    };
                })
                .sort((a, b) => b.totalValue - a.totalValue)
                .slice(0, 10);

            return {
                asOfDate: now,
                totalAssetValue,
                totalItemCount: items.length,
                valueByCategory,
                topValueItems
            };
        } catch (error) {
            console.error('Error getting value report:', error);
            throw error;
        }
    }
}
