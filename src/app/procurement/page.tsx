'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Package, ShoppingCart, Calculator, TrendingUp, Filter, Download, Search, Edit, Trash2, Eye, Loader2, X, Grid3X3, List, Users, DollarSign, AlertTriangle, Calendar, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { ProcurementService } from '@/lib/services/procurement.service';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import type { 
  ProcurementItem, 
  ProcurementPurchase, 
  ProcurementBudget,
  ProcurementSummary,
  ViewPeriodType,
  ProcurementCategory,
  BudgetComparison,
  AcademicYear,
  Term
} from '@/types';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/common/page-header';

// Import sub-components (we'll create these next)
import { ItemManagement } from '@/components/procurement/ItemManagement';
import { PurchaseManagement } from '@/components/procurement/PurchaseManagement';
import { BudgetManagement } from '@/components/procurement/BudgetManagement';
import { ReportsAndAnalytics } from '@/components/procurement/ReportsAndAnalytics';
import { ItemDetailView } from '@/components/procurement/ItemDetailView';

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [viewPeriod, setViewPeriod] = useState<ViewPeriodType>('Term');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [purchases, setPurchases] = useState<ProcurementPurchase[]>([]);
  const [budgets, setBudgets] = useState<ProcurementBudget[]>([]);
  const [summary, setSummary] = useState<ProcurementSummary | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // View and filter states
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Academic Year and Term state using proper hooks
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: activeAcademicYear, isLoading: activeYearLoading } = useActiveAcademicYear();
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string>('');
  const [currentTerm, setCurrentTerm] = useState<string>('');
  const [availableTerms, setAvailableTerms] = useState<Term[]>([]);

  // Additional state for week and month filtering
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [currentMonth, setCurrentMonth] = useState<number>(0);

  // Purchase view mode state
  const [purchaseViewMode, setPurchaseViewMode] = useState<'list' | 'stacked'>('list');

  // Check mobile on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('cards');
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Helper function to get current term based on date
  const getCurrentTermFromAcademicYear = (academicYear: AcademicYear): Term | null => {
    const now = new Date();
    
    for (const term of academicYear.terms) {
      const termStart = new Date(term.startDate);
      const termEnd = new Date(term.endDate);
      
      if (now >= termStart && now <= termEnd) {
        return term;
      }
    }
    
    return null;
  };

  // Helper function to get current week number (1-52/53)
  const getCurrentWeekNumber = (): number => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  };

  // Helper function to get current month number (1-12)
  const getCurrentMonthNumber = (): number => {
    return new Date().getMonth() + 1;
  };

  // Stats calculations
  const stats = React.useMemo(() => {
    const totalItems = items.length;
    const activeItems = items.filter((item: ProcurementItem) => item.isActive).length;
    const totalPurchases = purchases.length;
    const totalSpent = purchases.reduce((sum: number, purchase: ProcurementPurchase) => sum + (purchase.totalCost || 0), 0);
    const totalBudgets = budgets.length;
    const activeBudgets = budgets.filter((budget: ProcurementBudget) => budget.status === 'Active').length;
    
    return { 
      totalItems, 
      activeItems, 
      totalPurchases, 
      totalSpent, 
      totalBudgets, 
      activeBudgets 
    };
  }, [items, purchases, budgets]);

  // Filter data based on search and filters
  const filteredItems = React.useMemo(() => {
    return items.filter((item: ProcurementItem) => {
      const matchesSearch = searchTerm === '' || 
        `${item.name} ${item.description} ${item.category}`.toLowerCase()
          .includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? item.isActive : !item.isActive);
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchTerm, categoryFilter, statusFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchTerm || categoryFilter !== 'all' || statusFilter !== 'all';

  // Helper function to get weeks in the current academic year
  const getWeeksInYear = (year: string): Array<{value: number, label: string}> => {
    const yearNumber = parseInt(year);
    const weeks = [];
    const startOfYear = new Date(yearNumber, 0, 1);
    const endOfYear = new Date(yearNumber, 11, 31);
    
    let currentDate = new Date(startOfYear);
    let weekNumber = 1;
    
    while (currentDate <= endOfYear) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      weeks.push({
        value: weekNumber,
        label: `Week ${weekNumber} (${weekStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${weekEnd.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})`
      });
      
      currentDate.setDate(currentDate.getDate() + 7);
      weekNumber++;
    }
    
    return weeks;
  };

  // Helper function to get months in the current academic year
  const getMonthsInYear = (year: string): Array<{value: number, label: string}> => {
    const months = [];
    for (let i = 1; i <= 12; i++) {
      const monthName = new Date(parseInt(year), i - 1, 1).toLocaleDateString('en-US', {month: 'long'});
      months.push({
        value: i,
        label: `${monthName} ${year}`
      });
    }
    return months;
  };

  // Helper function to filter purchases based on view period
  const getFilteredPurchasesByPeriod = (allPurchases: ProcurementPurchase[]) => {
    const selectedYear = academicYears.find(year => year.id === currentAcademicYear);
    if (!selectedYear) return [];

    return allPurchases.filter(purchase => {
      // First filter by academic year
      const matchesYear = purchase.academicYearId === currentAcademicYear || 
                         purchase.academicYearName === selectedYear.name;
      
      if (!matchesYear) return false;

      const purchaseDate = new Date(purchase.purchaseDate);
      const yearNumber = parseInt(selectedYear.name);

      switch (viewPeriod) {
        case 'Year':
          // Show all purchases for the selected academic year
          return true;

        case 'Term':
          // Show purchases for the selected term
          return purchase.termId === currentTerm ||
                 purchase.termName?.toLowerCase().includes(currentTerm.toLowerCase());

        case 'Month':
          // Show purchases for the selected month in the academic year
          return purchaseDate.getFullYear() === yearNumber && 
                 (purchaseDate.getMonth() + 1) === currentMonth;

        case 'Week':
          // Show purchases for the selected week in the academic year
          if (purchaseDate.getFullYear() !== yearNumber) return false;
          
          const startOfYear = new Date(yearNumber, 0, 1);
          const daysSinceStartOfYear = Math.floor((purchaseDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
          const weekNumber = Math.ceil((daysSinceStartOfYear + startOfYear.getDay() + 1) / 7);
          
          return weekNumber === currentWeek;

        default:
          return true;
      }
    });
  };

  // Set initial academic year and term when data loads
  useEffect(() => {
    if (activeAcademicYear && !currentAcademicYear) {
      console.log('Setting initial academic year:', activeAcademicYear);
      setCurrentAcademicYear(activeAcademicYear.id);
      
      // Use local function to get current term more reliably
      const currentTermData = getCurrentTermFromAcademicYear(activeAcademicYear);
      if (currentTermData) {
        console.log('Setting current term using date-based detection:', currentTermData);
        setCurrentTerm(currentTermData.id);
      } else {
        // If no current term by date, check for term marked as current
        const markedCurrentTerm = activeAcademicYear.terms.find(term => term.isCurrent);
        if (markedCurrentTerm) {
          console.log('Setting current term using isCurrent flag:', markedCurrentTerm);
          setCurrentTerm(markedCurrentTerm.id);
        } else if (activeAcademicYear.terms.length > 0) {
          // Fallback to first term if no current term
          console.log('No current term found, setting first term:', activeAcademicYear.terms[0]);
          setCurrentTerm(activeAcademicYear.terms[0].id);
        }
      }

      // Set current week and month defaults
      const currentWeekNum = getCurrentWeekNumber();
      const currentMonthNum = getCurrentMonthNumber();
      
      console.log('Setting current week:', currentWeekNum);
      console.log('Setting current month:', currentMonthNum);
      
      setCurrentWeek(currentWeekNum);
      setCurrentMonth(currentMonthNum);
    }
  }, [activeAcademicYear, currentAcademicYear]);

  // Update available terms when academic year changes, and reset week/month if needed
  useEffect(() => {
    if (currentAcademicYear && academicYears.length > 0) {
      const selectedYear = academicYears.find(year => year.id === currentAcademicYear);
      if (selectedYear) {
        console.log('Updating available terms for year:', selectedYear.name, selectedYear.terms);
        setAvailableTerms(selectedYear.terms);
        
        // Reset term selection if current term is not available in new year
        const isCurrentTermValid = selectedYear.terms.some(term => term.id === currentTerm);
        if (!isCurrentTermValid && selectedYear.terms.length > 0) {
          console.log('Resetting term selection to first available term');
          setCurrentTerm(selectedYear.terms[0].id);
        }

        // Update week and month based on the new year
        if (selectedYear.name === new Date().getFullYear().toString()) {
          // If it's the current year, set current week and month
          setCurrentWeek(getCurrentWeekNumber());
          setCurrentMonth(getCurrentMonthNumber());
        } else {
          // If it's a different year, default to week 1 and month 1
          setCurrentWeek(1);
          setCurrentMonth(1);
        }
      }
    }
  }, [currentAcademicYear, academicYears, currentTerm]);

  // Set default view period to Term
  useEffect(() => {
    setViewPeriod('Term');
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all data
        const [itemsData, purchasesData, budgetsData] = await Promise.all([
          ProcurementService.getItems(),
          ProcurementService.getPurchases(),
          ProcurementService.getBudgets()
        ]);
        
        setItems(itemsData);
        setPurchases(purchasesData);
        setBudgets(budgetsData);
        
        // Generate summary
        const summaryData = await ProcurementService.getSummary(viewPeriod);
        setSummary(summaryData);
        
      } catch (error) {
        console.error('Error loading procurement data:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load procurement data. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [viewPeriod]);

  // When view period changes, update summary
  useEffect(() => {
    const updateSummary = async () => {
      try {
        const summaryData = await ProcurementService.getSummary(viewPeriod);
        setSummary(summaryData);
      } catch (error) {
        console.error('Error updating summary:', error);
      }
    };
    
    updateSummary();
  }, [viewPeriod]);
  
  const handleViewItemDetail = (itemId: string) => {
    setSelectedItemId(itemId);
    setActiveTab('itemDetail');
  };
  
  const handleBackFromItemDetail = () => {
    setSelectedItemId(null);
    setActiveTab('reports');
  };
  
  if (loading && (items.length === 0 || purchases.length === 0)) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title="Procurement Management" 
          description="Manage school procurement: items, purchases, budgets, and reports"
        />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading procurement data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading if academic years are still loading
  if (academicYearsLoading || activeYearLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title="Procurement Management" 
          description="Manage school procurement: items, purchases, budgets, and reports"
        />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Setting up academic periods...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <PageHeader
        title="Procurement Management"
        description="Manage school procurement: items, purchases, budgets, and reports"
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Period Controls - Mobile Responsive */}
            <div className="flex items-center gap-2">
              <Select value={viewPeriod} onValueChange={(value) => setViewPeriod(value as ViewPeriodType)}>
                <SelectTrigger className="w-24 sm:w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Week">Week</SelectItem>
                  <SelectItem value="Month">Month</SelectItem>
                  <SelectItem value="Term">Term</SelectItem>
                  <SelectItem value="Year">Year</SelectItem>
                </SelectContent>
              </Select>
              
              {viewPeriod === 'Term' && availableTerms.length > 0 && (
                <Select value={currentTerm} onValueChange={setCurrentTerm}>
                  <SelectTrigger className="w-32 sm:w-40 h-9">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTerms.map(term => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        }
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-blue-600 font-medium">Total Items</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-700">{stats.totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-green-600 font-medium">Purchases</p>
                <p className="text-lg sm:text-2xl font-bold text-green-700">{stats.totalPurchases}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-600 font-medium">Total Spent</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-700">
                  ${stats.totalSpent.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-orange-600 font-medium">Budgets</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-700">{stats.totalBudgets}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-indigo-600 font-medium">Active Items</p>
                <p className="text-lg sm:text-2xl font-bold text-indigo-700">{stats.activeItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-pink-500 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-pink-600 font-medium">Active Budgets</p>
                <p className="text-lg sm:text-2xl font-bold text-pink-700">{stats.activeBudgets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedItemId && activeTab === 'itemDetail' ? (
        <ItemDetailView itemId={selectedItemId} onBack={handleBackFromItemDetail} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 lg:w-auto">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="purchases" className="text-xs sm:text-sm">Purchases</TabsTrigger>
              <TabsTrigger value="budgets" className="text-xs sm:text-sm">Budgets</TabsTrigger>
              <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
              <TabsTrigger value="items" className="text-xs sm:text-sm">Items</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="overview" className="space-y-4">
            <OverviewTab 
              summary={summary}
              stats={stats}
              filteredItems={filteredItems}
              purchases={getFilteredPurchasesByPeriod(purchases)}
              budgets={budgets}
              viewPeriod={viewPeriod}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              filtersExpanded={filtersExpanded}
              setFiltersExpanded={setFiltersExpanded}
              hasActiveFilters={hasActiveFilters}
              clearFilters={clearFilters}
              viewMode={viewMode}
              setViewMode={setViewMode}
              isMobile={isMobile}
            />
          </TabsContent>
          
          <TabsContent value="purchases" className="space-y-4">
            <PurchaseManagement 
              purchases={getFilteredPurchasesByPeriod(purchases)} 
              setPurchases={setPurchases} 
              items={items} 
              viewPeriod={viewPeriod}
              currentAcademicYear={currentAcademicYear}
              currentTerm={currentTerm}
              purchaseViewMode={purchaseViewMode}
              setPurchaseViewMode={setPurchaseViewMode}
              academicYears={academicYears}
              availableTerms={availableTerms}
              currentWeek={currentWeek}
              currentMonth={currentMonth}
            />
          </TabsContent>
          
          <TabsContent value="budgets" className="space-y-4">
            <BudgetManagement 
              budgets={budgets} 
              setBudgets={setBudgets} 
              items={items}
            />
          </TabsContent>
          
          <TabsContent value="reports" className="space-y-4">
            <ReportsAndAnalytics 
              summary={summary} 
              viewPeriod={viewPeriod} 
              setViewPeriod={setViewPeriod} 
              budgets={budgets}
              onViewItemDetail={handleViewItemDetail}
            />
          </TabsContent>
          
          <TabsContent value="items" className="space-y-4">
            <ItemManagement 
              items={items} 
              setItems={setItems} 
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  summary,
  stats,
  filteredItems,
  purchases,
  budgets,
  viewPeriod,
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  filtersExpanded,
  setFiltersExpanded,
  hasActiveFilters,
  clearFilters,
  viewMode,
  setViewMode,
  isMobile
}: {
  summary: ProcurementSummary | null;
  stats: any;
  filteredItems: ProcurementItem[];
  purchases: ProcurementPurchase[];
  budgets: ProcurementBudget[];
  viewPeriod: ViewPeriodType;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  filtersExpanded: boolean;
  setFiltersExpanded: (expanded: boolean) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  viewMode: 'cards' | 'table';
  setViewMode: (mode: 'cards' | 'table') => void;
  isMobile: boolean;
}) {
  const categories = ['all', 'Stationery', 'Equipment', 'Maintenance', 'Technology', 'Food', 'Other'];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Recent Purchases</p>
                <p className="text-2xl font-bold text-amber-700">{purchases.slice(0, 5).length}</p>
                <p className="text-xs text-amber-500">Last 5 purchases</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Budget Utilization</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {budgets.length > 0 ? Math.round((stats.totalSpent / budgets.reduce((sum: number, b: ProcurementBudget) => sum + b.totalEstimatedCost, 0)) * 100) : 0}%
                </p>
                <p className="text-xs text-emerald-500">Of total budget</p>
              </div>
              <Calculator className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyan-600 font-medium">Active Items</p>
                <p className="text-2xl font-bold text-cyan-700">{stats.activeItems}</p>
                <p className="text-xs text-cyan-500">Available for purchase</p>
              </div>
              <Package className="w-8 h-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-white/80 backdrop-blur-sm border-blue-100/50">
        <CardContent className="p-3 sm:p-4">
          {/* Top Row: Search and View Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search procurement items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 h-9 sm:h-10 text-sm"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className={cn(
                "h-9 sm:h-10 px-3",
                hasActiveFilters && "bg-blue-50 border-blue-200 text-blue-700"
              )}
            >
              <Filter className="h-4 w-4 mr-1.5" />
              Filter
            </Button>

            {!isMobile && (
              <div className="flex border rounded-md overflow-hidden">
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  className="h-9 px-3 rounded-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-9 px-3 rounded-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Expandable Filters */}
          <AnimatePresence>
            {filtersExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-3 border-t border-gray-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Category</Label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>
                              {cat === 'all' ? 'All Categories' : cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8 text-xs"
                        disabled={!hasActiveFilters}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Purchases */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Recent Purchases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {purchases.slice(0, 5).length > 0 ? (
              <div className="space-y-3">
                {purchases.slice(0, 5).map((purchase: ProcurementPurchase, index: number) => (
                  <div key={purchase.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{purchase.itemName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(purchase.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">${purchase.totalCost?.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Qty: {purchase.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No recent purchases</p>
            )}
          </CardContent>
        </Card>

        {/* Budget Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Budget Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budgets.length > 0 ? (
              <div className="space-y-3">
                {budgets.slice(0, 3).map((budget: ProcurementBudget, index: number) => (
                  <div key={budget.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{budget.name}</p>
                      <Badge variant={budget.status === 'Active' ? 'default' : 'secondary'}>
                        {budget.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        $0.00 / ${budget.totalEstimatedCost.toFixed(2)}
                      </p>
                      <p className="text-xs font-medium">
                        0%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No budget data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 