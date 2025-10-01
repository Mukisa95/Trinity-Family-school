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
  Timestamp 
} from 'firebase/firestore';
import type { 
  ProcurementItem, 
  CreateProcurementItemData,
  ProcurementPurchase,
  CreateProcurementPurchaseData,
  ProcurementBudget,
  CreateProcurementBudgetData,
  ProcurementSummary,
  ViewPeriodType,
  BudgetComparison,
  AcademicYear,
  Term,
  ProcurementCategory
} from '@/types';

// Collection names
const PROCUREMENT_ITEMS_COLLECTION = 'procurementItems';
const PROCUREMENT_PURCHASES_COLLECTION = 'procurementPurchases';
const PROCUREMENT_BUDGETS_COLLECTION = 'procurementBudgets';

export class ProcurementService {
  // ===== ITEM MANAGEMENT =====
  static async createItem(data: CreateProcurementItemData): Promise<string> {
    try {
      const itemsRef = collection(db, PROCUREMENT_ITEMS_COLLECTION);
      
      const itemData = {
        ...data,
        isActive: true,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(itemsRef, itemData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating procurement item:', error);
      throw error;
    }
  }

  static async getItems(): Promise<ProcurementItem[]> {
    try {
      const itemsRef = collection(db, PROCUREMENT_ITEMS_COLLECTION);
      const q = query(itemsRef, orderBy('name'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as ProcurementItem;
      });
    } catch (error) {
      console.error('Error getting procurement items:', error);
      return [];
    }
  }
  
  static async getActiveItems(): Promise<ProcurementItem[]> {
    try {
      const itemsRef = collection(db, PROCUREMENT_ITEMS_COLLECTION);
      const q = query(itemsRef, where('isActive', '==', true), orderBy('name'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as ProcurementItem;
      });
    } catch (error) {
      console.error('Error getting active procurement items:', error);
      return [];
    }
  }
  
  static async getItemById(id: string): Promise<ProcurementItem | null> {
    try {
      const docRef = doc(db, PROCUREMENT_ITEMS_COLLECTION, id);
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
      } as ProcurementItem;
    } catch (error) {
      console.error('Error getting procurement item by ID:', error);
      return null;
    }
  }

  static async updateItem(id: string, data: Partial<ProcurementItem>): Promise<void> {
    try {
      const docRef = doc(db, PROCUREMENT_ITEMS_COLLECTION, id);
      
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating procurement item:', error);
      throw error;
    }
  }

  static async deleteItem(id: string): Promise<void> {
    try {
      const docRef = doc(db, PROCUREMENT_ITEMS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting procurement item:', error);
      throw error;
    }
  }

  // ===== PURCHASE MANAGEMENT =====
  static async createPurchase(data: CreateProcurementPurchaseData, academicYear: AcademicYear, term: Term): Promise<string> {
    try {
      // Get item details
      const itemRef = doc(db, PROCUREMENT_ITEMS_COLLECTION, data.itemId);
      const itemSnap = await getDoc(itemRef);
      
      if (!itemSnap.exists()) {
        throw new Error('Item not found');
      }
      
      const itemData = itemSnap.data();
      
      // Convert purchase date to Date
      const purchaseDate = new Date(data.purchaseDate);
      
      // Calculate week and month numbers
      const weekNumber = this.getWeekNumber(purchaseDate);
      const monthNumber = purchaseDate.getMonth() + 1;
      
      // Create purchase record
      const purchasesRef = collection(db, PROCUREMENT_PURCHASES_COLLECTION);
      
      const purchaseData = {
        ...data,
        totalCost: data.quantity * data.unitCost,
        itemName: itemData.name,
        itemCategory: itemData.category,
        weekNumber,
        monthNumber,
        academicYearId: academicYear.id,
        academicYearName: academicYear.name,
        termId: term.id,
        termName: term.name,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(purchasesRef, purchaseData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating procurement purchase:', error);
      throw error;
    }
  }

  static async getPurchases(): Promise<ProcurementPurchase[]> {
    try {
      const purchasesRef = collection(db, PROCUREMENT_PURCHASES_COLLECTION);
      const q = query(purchasesRef, orderBy('purchaseDate', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as ProcurementPurchase;
      });
    } catch (error) {
      console.error('Error getting procurement purchases:', error);
      return [];
    }
  }
  
  static async getPurchasesByPeriod(
    startDate: string, 
    endDate: string, 
    filters: any = {}
  ): Promise<ProcurementPurchase[]> {
    try {
      const purchasesRef = collection(db, PROCUREMENT_PURCHASES_COLLECTION);
      let q = query(
        purchasesRef,
        where('purchaseDate', '>=', startDate),
        where('purchaseDate', '<=', endDate),
        orderBy('purchaseDate', 'desc')
      );
      
      // Apply additional filters if provided
      // Note: In a real app, you'd need to create composite indexes for these queries
      // or use a more complex filtering mechanism
      
      const snapshot = await getDocs(q);
      const purchases = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as ProcurementPurchase;
      });
      
      // Apply client-side filtering for additional filters
      // This is not ideal for large datasets but works for demo purposes
      let filteredPurchases = purchases;
      
      if (filters.itemIds && filters.itemIds.length > 0) {
        filteredPurchases = filteredPurchases.filter(p => 
          filters.itemIds.includes(p.itemId)
        );
      }
      
      if (filters.categoryIds && filters.categoryIds.length > 0) {
        filteredPurchases = filteredPurchases.filter(p => 
          filters.categoryIds.includes(p.itemCategory)
        );
      }
      
      if (filters.supplierNames && filters.supplierNames.length > 0) {
        filteredPurchases = filteredPurchases.filter(p => 
          p.supplierName && filters.supplierNames.includes(p.supplierName)
        );
      }
      
      if (filters.procuredBy && filters.procuredBy.length > 0) {
        filteredPurchases = filteredPurchases.filter(p => 
          filters.procuredBy.includes(p.procuredBy)
        );
      }
      
      if (filters.academicYearIds && filters.academicYearIds.length > 0) {
        filteredPurchases = filteredPurchases.filter(p => 
          filters.academicYearIds.includes(p.academicYearId)
        );
      }
      
      if (filters.termIds && filters.termIds.length > 0) {
        filteredPurchases = filteredPurchases.filter(p => 
          filters.termIds.includes(p.termId)
        );
      }
      
      return filteredPurchases;
    } catch (error) {
      console.error('Error getting purchases by period:', error);
      return [];
    }
  }
  
  static async getPurchasesByItem(itemId: string): Promise<ProcurementPurchase[]> {
    try {
      const purchasesRef = collection(db, PROCUREMENT_PURCHASES_COLLECTION);
      const q = query(
        purchasesRef,
        where('itemId', '==', itemId),
        orderBy('purchaseDate', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      // Process purchases to add previous purchase price for trend analysis
      const purchases = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as ProcurementPurchase;
      });
      
      // Add price trend data
      const purchasesWithTrend = purchases.map((purchase, index) => {
        if (index < purchases.length - 1) {
          return {
            ...purchase,
            lastPurchasePrice: purchases[index + 1].unitCost
          };
        }
        return purchase;
      });
      
      return purchasesWithTrend;
    } catch (error) {
      console.error('Error getting purchases by item:', error);
      return [];
    }
  }

  static async updatePurchase(id: string, data: Partial<ProcurementPurchase>): Promise<void> {
    try {
      const docRef = doc(db, PROCUREMENT_PURCHASES_COLLECTION, id);
      
      // Update total cost if quantity or unit cost changed
      let updateData = { ...data };
      if (data.quantity !== undefined && data.unitCost !== undefined) {
        updateData.totalCost = data.quantity * data.unitCost;
      } else if (data.quantity !== undefined) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          updateData.totalCost = data.quantity * docSnap.data().unitCost;
        }
      } else if (data.unitCost !== undefined) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          updateData.totalCost = docSnap.data().quantity * data.unitCost;
        }
      }
      
      updateData.updatedAt = serverTimestamp();
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating procurement purchase:', error);
      throw error;
    }
  }

  static async deletePurchase(id: string): Promise<void> {
    try {
      const docRef = doc(db, PROCUREMENT_PURCHASES_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting procurement purchase:', error);
      throw error;
    }
  }

  // ===== BUDGET MANAGEMENT =====
  static async createBudget(data: CreateProcurementBudgetData, academicYear: AcademicYear, term: Term): Promise<string> {
    try {
      // Calculate total estimated cost
      const totalEstimatedCost = data.items.reduce((sum, item) => sum + item.estimatedTotalCost, 0);
      
      const budgetsRef = collection(db, PROCUREMENT_BUDGETS_COLLECTION);
      
      const budgetData = {
        ...data,
        status: 'Draft',
        totalEstimatedCost,
        academicYearId: academicYear.id,
        academicYearName: academicYear.name,
        termId: term.id,
        termName: term.name,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(budgetsRef, budgetData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating procurement budget:', error);
      throw error;
    }
  }

  static async getBudgets(): Promise<ProcurementBudget[]> {
    try {
      const budgetsRef = collection(db, PROCUREMENT_BUDGETS_COLLECTION);
      const q = query(budgetsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as ProcurementBudget;
      });
    } catch (error) {
      console.error('Error getting procurement budgets:', error);
      return [];
    }
  }

  static async updateBudget(id: string, data: Partial<ProcurementBudget>): Promise<void> {
    try {
      const docRef = doc(db, PROCUREMENT_BUDGETS_COLLECTION, id);
      
      // Update total estimated cost if items changed
      let updateData = { ...data };
      if (data.items) {
        updateData.totalEstimatedCost = data.items.reduce((sum, item) => sum + item.estimatedTotalCost, 0);
      }
      
      updateData.updatedAt = serverTimestamp();
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating procurement budget:', error);
      throw error;
    }
  }

  static async deleteBudget(id: string): Promise<void> {
    try {
      const docRef = doc(db, PROCUREMENT_BUDGETS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting procurement budget:', error);
      throw error;
    }
  }

  // ===== REPORTING & ANALYTICS =====
  static async getSummary(viewPeriod: ViewPeriodType): Promise<ProcurementSummary> {
    try {
      // Get date range based on view period
      const dateRange = this.getDateRangeForPeriod(viewPeriod);
      
      // Get purchases within date range
      const purchasesRef = collection(db, PROCUREMENT_PURCHASES_COLLECTION);
      const q = query(
        purchasesRef,
        where('purchaseDate', '>=', dateRange.startDate),
        where('purchaseDate', '<=', dateRange.endDate)
      );
      
      const snapshot = await getDocs(q);
      const purchases = snapshot.docs.map(doc => doc.data()) as ProcurementPurchase[];
      
      // Calculate summary statistics
      const totalPurchases = purchases.length;
      const totalAmountSpent = purchases.reduce((sum, purchase) => sum + purchase.totalCost, 0);
      
      // Get unique items
      const uniqueItemIds = [...new Set(purchases.map(purchase => purchase.itemId))];
      const totalItems = uniqueItemIds.length;
      
      // Group by category
      const categorySummary: Record<string, { 
        totalSpent: number;
        purchaseCount: number;
        itemCount: number;
        averagePrice: number;
      }> = {};
      
      const categoryItems = new Map<string, Set<string>>();
      
      purchases.forEach(purchase => {
        const category = purchase.itemCategory || 'Other';
        
        if (!categorySummary[category]) {
          categorySummary[category] = {
            totalSpent: 0,
            purchaseCount: 0,
            itemCount: 0,
            averagePrice: 0
          };
          categoryItems.set(category, new Set());
        }
        
        categorySummary[category].totalSpent += purchase.totalCost;
        categorySummary[category].purchaseCount += 1;
        categoryItems.get(category)?.add(purchase.itemId);
      });
      
      // Set item counts and calculate average prices
      Object.keys(categorySummary).forEach(category => {
        const items = categoryItems.get(category);
        if (items) {
          categorySummary[category].itemCount = items.size;
          categorySummary[category].averagePrice = categorySummary[category].totalSpent / categorySummary[category].purchaseCount;
        }
      });
      
      return {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        totalPurchases,
        totalAmountSpent,
        totalItems,
        categorySummary: categorySummary as any // Type casting to avoid complex typing issues
      };
    } catch (error) {
      console.error('Error generating summary:', error);
      
      // Return empty summary in case of error
      return {
        startDate: '',
        endDate: '',
        totalPurchases: 0,
        totalAmountSpent: 0,
        totalItems: 0,
        categorySummary: {} as any
      };
    }
  }

  static async generateBudgetComparison(budgetId: string): Promise<BudgetComparison> {
    try {
      // Get budget details
      const budgetRef = doc(db, PROCUREMENT_BUDGETS_COLLECTION, budgetId);
      const budgetSnap = await getDoc(budgetRef);
      
      if (!budgetSnap.exists()) {
        throw new Error('Budget not found');
      }
      
      const budgetData = budgetSnap.data() as ProcurementBudget;
      
      // Get purchases within budget date range
      const purchasesRef = collection(db, PROCUREMENT_PURCHASES_COLLECTION);
      const q = query(
        purchasesRef,
        where('purchaseDate', '>=', budgetData.startDate),
        where('purchaseDate', '<=', budgetData.endDate)
      );
      
      const snapshot = await getDocs(q);
      const purchases = snapshot.docs.map(doc => doc.data()) as ProcurementPurchase[];
      
      // Calculate total budgeted and actual amounts
      const totalBudgeted = budgetData.totalEstimatedCost;
      const totalActual = purchases.reduce((sum, purchase) => sum + purchase.totalCost, 0);
      
      // Calculate variance
      const varianceAmount = totalActual - totalBudgeted;
      const variancePercentage = totalBudgeted > 0 ? (varianceAmount / totalBudgeted) * 100 : 0;
      
      // Item-wise comparison
      const itemComparisons = budgetData.items.map(budgetItem => {
        // Find purchases for this item
        const itemPurchases = purchases.filter(purchase => purchase.itemId === budgetItem.itemId);
        
        const actualQuantity = itemPurchases.reduce((sum, purchase) => sum + purchase.quantity, 0);
        const actualCost = itemPurchases.reduce((sum, purchase) => sum + purchase.totalCost, 0);
        
        const itemVarianceAmount = actualCost - budgetItem.estimatedTotalCost;
        const itemVariancePercentage = budgetItem.estimatedTotalCost > 0 
          ? (itemVarianceAmount / budgetItem.estimatedTotalCost) * 100 
          : 0;
        
        return {
          itemId: budgetItem.itemId,
          itemName: budgetItem.itemName,
          budgetedQuantity: budgetItem.estimatedQuantity,
          actualQuantity,
          budgetedCost: budgetItem.estimatedTotalCost,
          actualCost,
          varianceAmount: itemVarianceAmount,
          variancePercentage: itemVariancePercentage
        };
      });
      
      return {
        budgetId,
        budgetName: budgetData.name,
        startDate: budgetData.startDate,
        endDate: budgetData.endDate,
        totalBudgeted,
        totalActual,
        varianceAmount,
        variancePercentage,
        itemComparisons
      };
    } catch (error) {
      console.error('Error generating budget comparison:', error);
      throw error;
    }
  }

  // ===== HELPER METHODS =====
  private static getWeekNumber(date: Date): number {
    const oneJan = new Date(date.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
  }
  
  private static getDateRangeForPeriod(viewPeriod: ViewPeriodType): { startDate: string, endDate: string } {
    const now = new Date();
    let startDate: Date, endDate: Date;
    
    switch (viewPeriod) {
      case 'Week':
        // Get current week (Sunday to Saturday)
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Go to Sunday
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Go to Saturday
        break;
        
      case 'Month':
        // Get current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
        
      case 'Term':
        // This would ideally come from your academic calendar
        // For demo purposes, we'll use a fixed term
        startDate = new Date(now.getFullYear(), 0, 1); // Jan 1
        endDate = new Date(now.getFullYear(), 3, 30); // Apr 30
        break;
        
      case 'Year':
        // Current calendar year
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
        
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }
} 