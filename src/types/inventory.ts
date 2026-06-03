// ===== INVENTORY MANAGEMENT SYSTEM TYPES =====

// Item Categories for school property
export type InventoryCategory =
    | 'Furniture'
    | 'Electronics'
    | 'Laboratory'
    | 'Sports'
    | 'Library'
    | 'Kitchen'
    | 'Classroom'
    | 'Office'
    | 'Transport'
    | 'Medical'
    | 'Cleaning'
    | 'Other';

// Item condition tracking
export type ItemCondition =
    | 'New'
    | 'Good'
    | 'Fair'
    | 'Poor'
    | 'Damaged'
    | 'Under Repair'
    | 'Disposed';

// Units of measurement
export type InventoryUnit =
    | 'Pieces'
    | 'Sets'
    | 'Pairs'
    | 'Boxes'
    | 'Cartons'
    | 'Rolls'
    | 'Litres'
    | 'Kg'
    | 'Other';

// Transaction types for inventory movements
export type InventoryTransactionType =
    | 'purchase'      // New item added via purchase
    | 'issue'         // Item given to department/person
    | 'return'        // Item returned from department/person
    | 'transfer'      // Move between locations
    | 'repair'        // Sent for repair
    | 'dispose'       // Item disposed/written off
    | 'adjustment'    // Stock correction
    | 'stocktake'     // Physical count verification
    | 'damage'        // Item damaged
    | 'loss';         // Item lost/missing

// Locations where items can be stored/assigned
export type InventoryLocation =
    | 'Main Store'
    | 'Classroom'
    | 'Laboratory'
    | 'Library'
    | 'Kitchen'
    | 'Office'
    | 'Sports Ground'
    | 'Medical Room'
    | 'Staff Room'
    | 'Assembly Hall'
    | 'Dormitory'
    | 'Other';

// ===== MAIN INVENTORY ITEM =====
export interface InventoryItem {
    id: string;
    name: string;
    category: InventoryCategory;
    description?: string;

    // Identification
    serialNumber?: string;         // Manufacturer serial number
    assetTag?: string;             // School-assigned asset ID
    barcode?: string;              // For barcode scanning

    // Stock levels
    quantity: number;              // Current stock level
    unit: InventoryUnit;
    customUnit?: string;           // For 'Other' unit type
    reorderLevel?: number;         // Alert when stock falls below this

    // Condition and status
    condition: ItemCondition;
    isActive: boolean;

    // Location tracking
    location: InventoryLocation;
    customLocation?: string;       // Specific room/area
    assignedTo?: string;           // Department/person responsible

    // Financial tracking
    unitValue?: number;            // Value per unit (for asset tracking)
    totalValue?: number;           // Calculated: quantity * unitValue

    // Purchase/warranty info
    purchaseDate?: string;
    purchasePrice?: number;
    supplierName?: string;
    warrantyExpiry?: string;

    // Photo/documentation
    photoUrl?: string;

    // Statistics (denormalized for performance)
    totalIssued?: number;          // Lifetime total issued
    totalReturned?: number;        // Lifetime total returned
    currentlyIssued?: number;      // Currently out on issue

    // Audit fields
    createdAt: string;
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
}

// ===== INVENTORY TRANSACTION/MOVEMENT =====
export interface InventoryTransaction {
    id: string;
    itemId: string;
    itemName?: string;             // Denormalized for display
    itemCategory?: InventoryCategory; // Denormalized

    // Transaction details
    type: InventoryTransactionType;
    quantity: number;
    previousQuantity?: number;     // Stock before transaction
    newQuantity?: number;          // Stock after transaction

    // Location tracking
    fromLocation?: InventoryLocation;
    toLocation?: InventoryLocation;
    customFromLocation?: string;
    customToLocation?: string;

    // Issue/Return specific
    issuedTo?: string;             // Person/department receiving
    issuedToRole?: string;         // Role of person (Teacher, Staff, etc.)
    purpose?: string;              // Why the item was issued
    expectedReturnDate?: string;   // When should be returned
    actualReturnDate?: string;     // When actually returned
    returnCondition?: ItemCondition; // Condition when returned

    // Condition and notes
    conditionBefore?: ItemCondition;
    conditionAfter?: ItemCondition;
    notes?: string;

    // Financial (for purchases, disposals)
    unitCost?: number;
    totalCost?: number;

    // Academic context
    academicYearId: string;
    academicYearName?: string;
    termId: string;
    termName?: string;

    // Audit trail - WHO did this
    processedBy: string;
    processedByUserId?: string;
    processedByUsername?: string;

    // Approval (optional)
    approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;

    // Timestamps
    transactionDate: string;       // When the physical action happened
    createdAt: string;             // When record was created
    updatedAt?: string;
}

// ===== ISSUED ITEM TRACKING =====
export interface IssuedItem {
    id: string;
    itemId: string;
    itemName?: string;
    transactionId: string;         // Reference to issue transaction

    quantity: number;
    issuedTo: string;
    issuedToRole?: string;
    purpose?: string;
    location?: InventoryLocation;

    issueDate: string;
    expectedReturnDate?: string;
    actualReturnDate?: string;

    status: 'issued' | 'returned' | 'partial' | 'overdue' | 'lost';
    returnedQuantity?: number;

    // Academic context
    academicYearId: string;
    termId: string;

    createdAt: string;
    updatedAt?: string;
}

// ===== STOCK LEVEL SUMMARY =====
export interface StockLevel {
    itemId: string;
    itemName: string;
    category: InventoryCategory;
    location: InventoryLocation;

    currentQuantity: number;
    reorderLevel?: number;
    isLowStock: boolean;

    totalValue?: number;

    lastRestocked?: string;
    lastIssued?: string;
}

// ===== INVENTORY REPORTS =====
export interface InventorySummary {
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
    lowStockCount: number;

    byCategory: Record<InventoryCategory, {
        itemCount: number;
        totalQuantity: number;
        totalValue: number;
    }>;

    byCondition: Record<ItemCondition, number>;

    byLocation: Record<string, {
        itemCount: number;
        totalQuantity: number;
    }>;

    recentTransactions: InventoryTransaction[];
    lowStockItems: StockLevel[];
    overdueItems: IssuedItem[];
}

export interface UsageReport {
    itemId: string;
    itemName: string;
    category: InventoryCategory;

    period: {
        startDate: string;
        endDate: string;
    };

    totalIssued: number;
    totalReturned: number;
    netUsage: number;

    issuedByDepartment: Record<string, number>;
    issuedByPerson: Array<{
        name: string;
        quantity: number;
    }>;

    averageUsagePerDay?: number;
    projectedNeedForNextPeriod?: number;
}

export interface ValueReport {
    asOfDate: string;

    totalAssetValue: number;
    totalItemCount: number;

    valueByCategory: Record<InventoryCategory, number>;

    topValueItems: Array<{
        itemId: string;
        itemName: string;
        quantity: number;
        unitValue: number;
        totalValue: number;
    }>;

    depreciationEstimate?: number;
}

// ===== FORM DATA TYPES =====
export type CreateInventoryItemData = Omit<InventoryItem,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'totalValue'
    | 'totalIssued'
    | 'totalReturned'
    | 'currentlyIssued'
>;

export type UpdateInventoryItemData = Partial<Omit<InventoryItem,
    | 'id'
    | 'createdAt'
>>;

export type CreateInventoryTransactionData = Omit<InventoryTransaction,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'itemName'
    | 'itemCategory'
    | 'previousQuantity'
    | 'newQuantity'
>;

// ===== FILTER TYPES =====
export interface InventoryFilters {
    categories?: InventoryCategory[];
    conditions?: ItemCondition[];
    locations?: InventoryLocation[];
    isActive?: boolean;
    isLowStock?: boolean;
    searchTerm?: string;
}

export interface TransactionFilters {
    types?: InventoryTransactionType[];
    itemIds?: string[];
    categories?: InventoryCategory[];
    locations?: InventoryLocation[];
    issuedTo?: string[];
    processedBy?: string[];
    dateRange?: {
        startDate: string;
        endDate: string;
    };
    academicYearId?: string;
    termId?: string;
    searchTerm?: string;
}
