// Uniform Inventory Types
// Tracks stock levels per size for each uniform item

/**
 * Configuration of sizes for a uniform item
 */
export interface UniformSizeConfig {
    id: string;
    uniformId: string;       // Reference to the uniform item from uniforms collection
    uniformName: string;     // Cached for display
    uniformGroup: string;    // Cached for display (e.g., "Shirts", "Trousers")
    sizes: string[];         // Array of size names (e.g., ["16", "18", "20", "22"])
    createdAt: string;
    updatedAt?: string;
}

/**
 * Stock level for a specific size of a uniform item
 */
export interface UniformSizeStock {
    size: string;            // Size name (e.g., "18", "M", "Large")
    quantity: number;        // Number of pieces in stock
    reorderLevel?: number;   // Optional: alert when stock falls below this
}

/**
 * Complete uniform inventory item with sizes and stock
 */
export interface UniformInventoryItem {
    id: string;
    uniformId: string;
    uniformName: string;
    uniformGroup: string;
    uniformPrice: number;
    uniformGender: string;
    sizes: string[];
    stock: UniformSizeStock[];
    totalStock: number;      // Sum of all size quantities
    totalValue: number;      // totalStock * uniformPrice
    createdAt: string;
    updatedAt?: string;
}

/**
 * Data for creating/updating size configuration
 */
export interface CreateUniformSizeConfigData {
    uniformId: string;
    uniformName: string;
    uniformGroup: string;
    sizes: string[];
}

/**
 * Data for updating stock for a uniform item
 */
export interface UpdateUniformStockData {
    uniformId: string;
    stock: UniformSizeStock[];
}

/**
 * Summary statistics for uniform inventory
 */
export interface UniformInventorySummary {
    totalItems: number;
    totalStock: number;
    totalValue: number;
    lowStockItems: number;
    byGroup: Record<string, { itemCount: number; totalStock: number; totalValue: number }>;
}
