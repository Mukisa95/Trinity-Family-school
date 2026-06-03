import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
    UniformInventoryItem,
    UniformSizeStock,
    CreateUniformSizeConfigData,
    UpdateUniformStockData,
    UniformInventorySummary
} from '@/types';

const UNIFORM_INVENTORY_COLLECTION = 'uniformInventory';

export class UniformInventoryService {
    /**
     * Get all uniform inventory items with their sizes and stock
     */
    static async getUniformInventory(): Promise<UniformInventoryItem[]> {
        try {
            const inventoryRef = collection(db, UNIFORM_INVENTORY_COLLECTION);
            // Don't use composite orderBy to avoid index requirement
            const snapshot = await getDocs(inventoryRef);

            const items = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate().toISOString()
                        : data.createdAt || new Date().toISOString(),
                    updatedAt: data.updatedAt instanceof Timestamp
                        ? data.updatedAt.toDate().toISOString()
                        : data.updatedAt
                } as UniformInventoryItem;
            });

            // Sort client-side by group then name
            return items.sort((a, b) => {
                const groupCompare = (a.uniformGroup || '').localeCompare(b.uniformGroup || '');
                if (groupCompare !== 0) return groupCompare;
                return (a.uniformName || '').localeCompare(b.uniformName || '');
            });
        } catch (error) {
            console.error('Error getting uniform inventory:', error);
            return [];
        }
    }

    /**
     * Get a single uniform inventory item
     */
    static async getUniformInventoryItem(uniformId: string): Promise<UniformInventoryItem | null> {
        try {
            const docRef = doc(db, UNIFORM_INVENTORY_COLLECTION, uniformId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) return null;

            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt instanceof Timestamp
                    ? data.createdAt.toDate().toISOString()
                    : data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt instanceof Timestamp
                    ? data.updatedAt.toDate().toISOString()
                    : data.updatedAt
            } as UniformInventoryItem;
        } catch (error) {
            console.error('Error getting uniform inventory item:', error);
            return null;
        }
    }

    /**
     * Set/update size configuration for a uniform item
     */
    static async setSizesForUniform(data: CreateUniformSizeConfigData, uniformPrice: number, uniformGender: string): Promise<void> {
        try {
            const docRef = doc(db, UNIFORM_INVENTORY_COLLECTION, data.uniformId);
            const existingDoc = await getDoc(docRef);

            // Preserve existing stock if updating
            let stock: UniformSizeStock[] = [];
            if (existingDoc.exists()) {
                const existingData = existingDoc.data();
                // Keep stock for sizes that still exist
                stock = data.sizes.map(size => {
                    const existingStock = existingData.stock?.find((s: UniformSizeStock) => s.size === size);
                    return existingStock || { size, quantity: 0 };
                });
            } else {
                // Initialize stock for new sizes
                stock = data.sizes.map(size => ({ size, quantity: 0 }));
            }

            const totalStock = stock.reduce((sum, s) => sum + s.quantity, 0);

            const inventoryData = {
                uniformId: data.uniformId,
                uniformName: data.uniformName,
                uniformGroup: data.uniformGroup,
                uniformPrice,
                uniformGender,
                sizes: data.sizes,
                stock,
                totalStock,
                totalValue: totalStock * uniformPrice,
                createdAt: existingDoc.exists() ? existingDoc.data().createdAt : Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await setDoc(docRef, inventoryData);
        } catch (error) {
            console.error('Error setting sizes for uniform:', error);
            throw error;
        }
    }

    /**
     * Update stock levels for a uniform item
     */
    static async updateStock(data: UpdateUniformStockData, uniformPrice: number): Promise<void> {
        try {
            const docRef = doc(db, UNIFORM_INVENTORY_COLLECTION, data.uniformId);

            const totalStock = data.stock.reduce((sum, s) => sum + s.quantity, 0);

            await updateDoc(docRef, {
                stock: data.stock,
                totalStock,
                totalValue: totalStock * uniformPrice,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error updating uniform stock:', error);
            throw error;
        }
    }

    /**
     * Update stock for a single size
     */
    static async updateSizeStock(uniformId: string, size: string, quantity: number): Promise<void> {
        try {
            const docRef = doc(db, UNIFORM_INVENTORY_COLLECTION, uniformId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                throw new Error('Uniform inventory item not found');
            }

            const data = docSnap.data();
            const stock: UniformSizeStock[] = data.stock || [];
            const uniformPrice = data.uniformPrice || 0;

            // Update the specific size
            const updatedStock = stock.map(s =>
                s.size === size ? { ...s, quantity } : s
            );

            const totalStock = updatedStock.reduce((sum, s) => sum + s.quantity, 0);

            await updateDoc(docRef, {
                stock: updatedStock,
                totalStock,
                totalValue: totalStock * uniformPrice,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error updating size stock:', error);
            throw error;
        }
    }

    /**
     * Get inventory summary statistics
     */
    static async getInventorySummary(): Promise<UniformInventorySummary> {
        try {
            const items = await this.getUniformInventory();

            const byGroup: Record<string, { itemCount: number; totalStock: number; totalValue: number }> = {};
            let lowStockItems = 0;

            items.forEach(item => {
                // Group stats
                if (!byGroup[item.uniformGroup]) {
                    byGroup[item.uniformGroup] = { itemCount: 0, totalStock: 0, totalValue: 0 };
                }
                byGroup[item.uniformGroup].itemCount++;
                byGroup[item.uniformGroup].totalStock += item.totalStock;
                byGroup[item.uniformGroup].totalValue += item.totalValue;

                // Low stock check (if any size has 0 or very low stock)
                const hasLowStock = item.stock.some(s => s.quantity <= (s.reorderLevel || 5));
                if (hasLowStock) lowStockItems++;
            });

            return {
                totalItems: items.length,
                totalStock: items.reduce((sum, i) => sum + i.totalStock, 0),
                totalValue: items.reduce((sum, i) => sum + i.totalValue, 0),
                lowStockItems,
                byGroup
            };
        } catch (error) {
            console.error('Error getting inventory summary:', error);
            return {
                totalItems: 0,
                totalStock: 0,
                totalValue: 0,
                lowStockItems: 0,
                byGroup: {}
            };
        }
    }

    /**
     * Delete a uniform inventory item
     */
    static async deleteUniformInventory(uniformId: string): Promise<void> {
        try {
            const docRef = doc(db, UNIFORM_INVENTORY_COLLECTION, uniformId);
            const batch = writeBatch(db);
            batch.delete(docRef);
            await batch.commit();
        } catch (error) {
            console.error('Error deleting uniform inventory:', error);
            throw error;
        }
    }

    /**
     * Reduce stock for a specific size (used when uniform is collected)
     */
    static async reduceStock(uniformId: string, size: string, quantity: number = 1): Promise<void> {
        try {
            const docRef = doc(db, UNIFORM_INVENTORY_COLLECTION, uniformId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                console.warn(`Uniform inventory item not found: ${uniformId}`);
                return; // Silently fail if item not in inventory
            }

            const data = docSnap.data();
            const stock: UniformSizeStock[] = data.stock || [];
            const uniformPrice = data.uniformPrice || 0;

            // Find and reduce the specific size
            const updatedStock = stock.map(s => {
                if (s.size === size) {
                    const newQuantity = Math.max(0, s.quantity - quantity);
                    return { ...s, quantity: newQuantity };
                }
                return s;
            });

            const totalStock = updatedStock.reduce((sum, s) => sum + s.quantity, 0);

            await updateDoc(docRef, {
                stock: updatedStock,
                totalStock,
                totalValue: totalStock * uniformPrice,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error reducing stock:', error);
            throw error;
        }
    }

    /**
     * Increment stock for a specific size (used for returns or corrections)
     */
    static async incrementStock(uniformId: string, size: string, quantity: number = 1): Promise<void> {
        try {
            const docRef = doc(db, UNIFORM_INVENTORY_COLLECTION, uniformId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                console.warn(`Uniform inventory item not found: ${uniformId}`);
                return; // Silently fail if item not in inventory
            }

            const data = docSnap.data();
            const stock: UniformSizeStock[] = data.stock || [];
            const uniformPrice = data.uniformPrice || 0;

            // Find and increment the specific size
            const updatedStock = stock.map(s => {
                if (s.size === size) {
                    return { ...s, quantity: s.quantity + quantity };
                }
                return s;
            });

            const totalStock = updatedStock.reduce((sum, s) => sum + s.quantity, 0);

            await updateDoc(docRef, {
                stock: updatedStock,
                totalStock,
                totalValue: totalStock * uniformPrice,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error incrementing stock:', error);
            throw error;
        }
    }

    /**
     * Reduce stock for multiple items at once (batch operation)
     */
    static async reduceStockBatch(items: Array<{ uniformId: string; size: string; quantity?: number }>): Promise<void> {
        for (const item of items) {
            await this.reduceStock(item.uniformId, item.size, item.quantity || 1);
        }
    }

    /**
     * Increment stock for multiple items at once (batch operation)
     */
    static async incrementStockBatch(items: Array<{ uniformId: string; size: string; quantity?: number }>): Promise<void> {
        for (const item of items) {
            await this.incrementStock(item.uniformId, item.size, item.quantity || 1);
        }
    }
}
