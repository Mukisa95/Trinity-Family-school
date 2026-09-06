'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Package, ShoppingCart, Calculator, TrendingUp, Filter, Download, Search, Edit, Trash2, Eye, Loader2, X, Grid3X3, List, Users, DollarSign, AlertTriangle, Calendar, Building2, PieChart, LayoutGrid } from 'lucide-react';
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
import { buildProcurementSummary, selectPurchasesForPeriod } from '@/lib/utils/procurement-selectors';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { getEffectiveTermForDataDisplay } from "@/lib/utils/term-status-utils";
import type {
  ProcurementItem,
  ProcurementPurchase,
  ProcurementBudget,
  ProcurementSummary,
  ViewPeriodType,
  ProcurementCategory,
  BudgetComparison,
  AcademicYear,
  Term,
  ProcurementRestockRequest
} from '@/types';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
import { GlassPageRouteSkeleton } from "@/components/common/glass-page-loading";

// Import sub-components (we'll create these next)
import { ItemManagement } from '@/components/procurement/ItemManagement';
import { PurchaseManagement } from '@/components/procurement/PurchaseManagement';
import { BudgetManagement } from '@/components/procurement/BudgetManagement';
import { ReportsAndAnalytics } from '@/components/procurement/ReportsAndAnalytics';
import { ItemDetailView } from '@/components/procurement/ItemDetailView';
import { CatalogAuditPanel } from '@/components/procurement/CatalogAuditPanel';
import { RestockRequestPanel } from '@/components/procurement/RestockRequestPanel';

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [viewPeriod, setViewPeriod] = useState<ViewPeriodType>('Term');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [purchases, setPurchases] = useState<ProcurementPurchase[]>([]);
  const [budgets, setBudgets] = useState<ProcurementBudget[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [restockPurchase, setRestockPurchase] = useState<ProcurementRestockRequest | null>(null);

  // View and filter states
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Academic Year and Term state using proper hooks
  // Academic Year and Term state using proper hooks
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  // const { data: activeAcademicYear, isLoading: activeYearLoading } = useActiveAcademicYear(); // Removed in favor of dynamic detection
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string>('');
  const [currentTerm, setCurrentTerm] = useState<string>('');
  const [availableTerms, setAvailableTerms] = useState<Term[]>([]);

  // 🚀 DYNAMIC YEAR LABELS
  const currentAcademicYearId = React.useMemo(() => {
    if (academicYears.length === 0) return null;
    const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
    return effectiveTerm?.academicYear?.id || null;
  }, [academicYears]);

  // Initialize with effective term
  useEffect(() => {
    if (academicYears.length > 0 && !currentAcademicYear) {
      const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
      if (effectiveTerm?.academicYear) {
        setCurrentAcademicYear(effectiveTerm.academicYear.id);
        if (effectiveTerm.term) {
          setCurrentTerm(effectiveTerm.term.id);
        }
      }
    }
  }, [academicYears, currentAcademicYear]);

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
    // Filter by academic year if selected
    const yearFilteredPurchases = currentAcademicYear
      ? purchases.filter(p => p.academicYearId === currentAcademicYear)
      : purchases;

    const yearFilteredBudgets = currentAcademicYear
      ? budgets.filter(b => b.academicYearId === currentAcademicYear)
      : budgets;

    const totalItems = items.length;
    const activeItems = items.filter((item: ProcurementItem) => item.isActive).length;

    // Calculate stats based on YEAR FILTERED data
    const totalPurchases = yearFilteredPurchases.length;
    const totalSpent = yearFilteredPurchases.reduce((sum: number, purchase: ProcurementPurchase) => sum + (purchase.totalCost || 0), 0);
    const totalBudgets = yearFilteredBudgets.length;
    const activeBudgets = yearFilteredBudgets.filter((budget: ProcurementBudget) => budget.status === 'Active').length;
    const totalBudgetedAmount = yearFilteredBudgets.reduce((sum: number, budget: ProcurementBudget) => sum + (budget.totalEstimatedCost || 0), 0);

    return {
      totalItems,
      activeItems,
      totalPurchases,
      totalSpent,
      totalBudgets,
      activeBudgets,
      totalBudgetedAmount
    };
  }, [items, purchases, budgets, currentAcademicYear]);

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

  const hasActiveFilters = !!(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all');

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Helper to format ordinal date (1st, 2nd, 3rd, 4th)
  const getOrdinalDate = (d: number) => {
    if (d > 3 && d < 21) return d + 'th';
    switch (d % 10) {
      case 1: return d + "st";
      case 2: return d + "nd";
      case 3: return d + "rd";
      default: return d + "th";
    }
  };

  // Helper function to get weeks in the current academic year
  const getWeeksInYear = (yearId: string): Array<{ value: number, label: string }> => {
    const selectedYear = academicYears.find(y => y.id === yearId);
    // Fallback to current year if not found or if parsing fails
    const yearNumber = selectedYear ? parseInt(selectedYear.name) : new Date().getFullYear();

    if (isNaN(yearNumber)) return [];

    const weeks = [];
    const startOfYear = new Date(yearNumber, 0, 1);
    const endOfYear = new Date(yearNumber, 11, 31);

    let currentDate = new Date(startOfYear);
    let weekNumber = 1;

    // Adjust to start on the first actual week
    while (currentDate.getDay() !== 1 && currentDate <= endOfYear) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    while (currentDate <= endOfYear) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Only add if the week starts within the year
      if (weekStart.getFullYear() === yearNumber) {
        // Calculate total spend for this week
        const weekTotal = purchases.filter(p => {
          // Must match academic year
          if (p.academicYearId !== yearId && p.academicYearName !== selectedYear?.name) return false;

          const pDate = new Date(p.purchaseDate);
          if (pDate.getFullYear() !== yearNumber) return false;

          const days = Math.floor((pDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
          const pWeekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
          return pWeekNum === weekNumber;
        }).reduce((sum, p) => sum + (p.totalCost || 0), 0);

        weeks.push({
          value: weekNumber,
          label: `wk ${weekNumber} (${getOrdinalDate(weekStart.getDate())} - ${getOrdinalDate(weekEnd.getDate())}) - ${formatCurrency(weekTotal)}`
        });
      }

      currentDate.setDate(currentDate.getDate() + 7);
      weekNumber++;
    }

    return weeks;
  };

  // Helper function to get months in the current academic year
  const getMonthsInYear = (yearId: string): Array<{ value: number, label: string }> => {
    const selectedYear = academicYears.find(y => y.id === yearId);
    const yearNumber = selectedYear ? parseInt(selectedYear.name) : new Date().getFullYear();

    if (isNaN(yearNumber)) return [];

    const months = [];
    for (let i = 1; i <= 12; i++) {
      const monthName = new Date(yearNumber, i - 1, 1).toLocaleDateString('en-US', { month: 'long' });

      // Calculate total spend for this month
      const monthTotal = purchases.filter(p => {
        if (p.academicYearId !== yearId && p.academicYearName !== selectedYear?.name) return false;
        const pDate = new Date(p.purchaseDate);
        return pDate.getFullYear() === yearNumber && (pDate.getMonth() + 1) === i;
      }).reduce((sum, p) => sum + (p.totalCost || 0), 0);

      months.push({
        value: i,
        label: `${monthName} ${yearNumber} - ${formatCurrency(monthTotal)}`
      });
    }
    return months;
  };

  const periodPurchases = React.useMemo(
    () => selectPurchasesForPeriod(purchases, {
      academicYear: academicYears.find((year) => year.id === currentAcademicYear),
      termId: currentTerm,
      month: currentMonth,
      week: currentWeek,
      viewPeriod,
    }),
    [academicYears, currentAcademicYear, currentMonth, currentTerm, currentWeek, purchases, viewPeriod]
  );

  // The summary is derived from the same period list shown on screen. This
  // avoids a second Firestore read and keeps the overview and purchase tab aligned.
  const summary = React.useMemo(
    () => buildProcurementSummary(periodPurchases),
    [periodPurchases]
  );

  // Initialize current week and month when academic year is set
  useEffect(() => {
    if (currentAcademicYear) {
      const selectedYear = academicYears.find(year => year.id === currentAcademicYear);
      if (selectedYear) {
        // Set current week and month defaults
        const currentWeekNum = getCurrentWeekNumber();
        const currentMonthNum = getCurrentMonthNumber();

        console.log('Setting current week:', currentWeekNum);
        console.log('Setting current month:', currentMonthNum);

        setCurrentWeek(currentWeekNum);
        setCurrentMonth(currentMonthNum);
      }
    }
  }, [currentAcademicYear, academicYears]);

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

  const refreshPurchases = React.useCallback(async () => {
    const purchasesData = await ProcurementService.getPurchases();
    setPurchases(purchasesData);
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
  }, []);

  const handleViewItemDetail = (itemId: string) => {
    setSelectedItemId(itemId);
    setActiveTab('itemDetail');
  };

  const handleBackFromItemDetail = () => {
    setSelectedItemId(null);
    setActiveTab('reports');
  };

  const periodFilterBar = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Inline search */}
      {(activeTab === 'overview' || activeTab === 'items') && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3 pointer-events-none" />
          <input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 pr-2 h-[28px] w-28 focus:w-40 transition-all duration-200 rounded-full border border-blue-200/60 bg-white/90 text-[10px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 placeholder:text-gray-400"
          />
        </div>
      )}
      <select
        value={viewPeriod}
        onChange={(e) => {
          const newPeriod = e.target.value as ViewPeriodType;
          setViewPeriod(newPeriod);
          if (newPeriod === 'Week' && currentWeek === 0) setCurrentWeek(getCurrentWeekNumber());
          else if (newPeriod === 'Month' && currentMonth === 0) setCurrentMonth(getCurrentMonthNumber());
          else if (newPeriod === 'Term' && !currentTerm && availableTerms.length > 0) setCurrentTerm(availableTerms[0].id);
        }}
        className="h-[30px] rounded-full border border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
      >
        <option value="Week">Week</option>
        <option value="Month">Month</option>
        <option value="Term">Term</option>
        <option value="Year">Year</option>
      </select>
      {academicYears.length > 0 && (
        <select
          value={currentAcademicYear}
          onChange={(e) => setCurrentAcademicYear(e.target.value)}
          className="h-[30px] rounded-full border border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          style={{ maxWidth: '110px' }}
        >
          {academicYears.map(year => {
            const isCurrent = year.id === currentAcademicYearId;
            const today = new Date();
            const yearEnd = new Date(year.endDate);
            const hasEnded = today > yearEnd;
            const label = isCurrent ? ' (Current)' : year.isLocked ? ' (Locked)' : !hasEnded ? ' (Upcoming)' : '';
            return <option key={year.id} value={year.id}>{year.name}{label}</option>;
          })}
        </select>
      )}
      {viewPeriod === 'Term' && availableTerms.length > 0 && (
        <select
          value={currentTerm}
          onChange={(e) => setCurrentTerm(e.target.value)}
          className="h-[30px] rounded-full border border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          style={{ maxWidth: '130px' }}
        >
          {availableTerms.map(term => {
            const termTotal = purchases.filter(p => p.termId === term.id || (p.termName && p.termName === term.name)).reduce((sum, p) => sum + (p.totalCost || 0), 0);
            return <option key={term.id} value={term.id}>{term.name} - {formatCurrency(termTotal)}</option>;
          })}
        </select>
      )}
      {viewPeriod === 'Month' && (
        <select
          value={currentMonth}
          onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
          className="h-[30px] rounded-full border border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          style={{ maxWidth: '130px' }}
        >
          {getMonthsInYear(currentAcademicYear).map(month => (
            <option key={month.value} value={month.value}>{month.label.split(' - ')[0]} - {month.label.split(' - ')[1]}</option>
          ))}
        </select>
      )}
      {viewPeriod === 'Week' && (
        <select
          value={currentWeek}
          onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
          className="h-[30px] rounded-full border border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          style={{ maxWidth: '150px' }}
        >
          {(() => {
            const weeks = getWeeksInYear(currentAcademicYear);
            const months: { [key: string]: typeof weeks } = {};
            weeks.forEach(week => {
              const match = week.label.match(/\(([A-Za-z]+)/);
              const month = match ? match[1] : 'Other';
              if (!months[month]) months[month] = [];
              months[month].push(week);
            });
            return Object.entries(months).map(([month, monthWeeks]) => (
              <optgroup key={month} label={month}>
                {monthWeeks.map(week => (
                  <option key={week.value} value={week.value}>{week.label.split(')')[0] + ')'} {week.label.split(')')[1]}</option>
                ))}
              </optgroup>
            ));
          })()}
        </select>
      )}
      <select
        value={activeTab}
        onChange={(e) => setActiveTab(e.target.value)}
        className="h-[30px] rounded-full border border-indigo-200/60 bg-white/90 px-2 text-[10px] font-bold text-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 uppercase tracking-wider"
      >
        <option value="overview">OVERVIEW</option>
        <option value="purchases">PURCHASES</option>
        <option value="restock">RESTOCK QUEUE</option>
        <option value="budgets">BUDGETS</option>
        <option value="reports">REPORTS</option>
        <option value="items">ITEMS</option>
      </select>

      {/* Separator */}
      {(activeTab === 'overview' || activeTab === 'items') && (
        <>
          <div className="w-px h-5 bg-white/40 mx-0.5" />

          {/* Filter toggle */}
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className={`h-[30px] flex items-center gap-1 px-2.5 rounded-full border text-[10px] font-bold shadow-sm transition-all duration-200 ${
              hasActiveFilters
                ? 'bg-blue-100 border-blue-400 text-blue-700 ring-2 ring-blue-300/40'
                : filtersExpanded
                ? 'bg-white/90 border-blue-300 text-blue-600'
                : 'bg-white/80 border-white/60 text-gray-600 hover:bg-white hover:text-blue-600'
            }`}
            title={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
          >
            <Filter className="w-3 h-3" />
            <span>Filters</span>
            {(categoryFilter !== 'all' || statusFilter !== 'all') && (
              <span className="ml-0.5 bg-blue-500 text-white rounded-full w-3.5 h-3.5 text-[8px] flex items-center justify-center font-extrabold">
                {(categoryFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>

          {/* View mode toggle (overview only) */}
          {activeTab === 'overview' && (
            <div className="flex items-center bg-white/60 border border-white/50 rounded-full p-0.5 h-[30px] shadow-sm">
              <button
                onClick={() => setViewMode('cards')}
                className={`w-6 h-full rounded-full flex items-center justify-center transition-all duration-150 ${
                  viewMode === 'cards' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-700'
                }`}
                title="Card view"
              >
                <LayoutGrid className="w-3 h-3" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`w-6 h-full rounded-full flex items-center justify-center transition-all duration-150 ${
                  viewMode === 'table' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-700'
                }`}
                title="Table view"
              >
                <List className="w-3 h-3" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (loading && (items.length === 0 || purchases.length === 0)) {
    return <GlassPageRouteSkeleton />;
  }

  if (academicYearsLoading) {
    return <GlassPageRouteSkeleton />;
  }

  return (
    <div className="min-h-screen pb-12">
      <GlassPageTopBar
        title="Procurement Management"
        subtitle="Manage school procurement: items, purchases, budgets, and reports"
        backHref="/dashboard"
        backLabel="Back"
        meta={periodFilterBar}
        className="mb-1.5"
        actions={
          (activeTab === 'overview' || activeTab === 'items') ? (
            <GlassActionDock>
              <GlassActionButton
                label="Filters"
                icon={<Filter className="h-4 w-4" />}
                tone="blue"
                badge={hasActiveFilters ? (categoryFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) : undefined}
                onClick={() => setFiltersExpanded(!filtersExpanded)}
              />
              {activeTab === 'overview' && (
                <GlassActionButton
                  label={viewMode === 'cards' ? 'Table' : 'Cards'}
                  icon={viewMode === 'cards' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                  tone="violet"
                  onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                />
              )}
            </GlassActionDock>
          ) : null
        }
      />

      <GlassSummaryBar
        left={
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-indigo-500" />
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
              Procurement Overview
            </span>
          </div>
        }
        right={
          <>
            <div className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="text-green-700/85 dark:text-green-300 font-medium">Purchases:</span>
              <span className="font-bold text-green-700 dark:text-green-400">{summary.totalPurchases}</span>
            </div>
            <div className="flex items-center gap-1 bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="text-purple-700/85 dark:text-purple-300 font-medium">Total Spent:</span>
              <span className="font-bold text-purple-700 dark:text-purple-400 font-tabular-nums">{formatCurrency(summary.totalAmountSpent)}</span>
            </div>
            <div className="flex items-center gap-1 bg-orange-50/80 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="text-orange-700/85 dark:text-orange-300 font-medium">Budgets:</span>
              <span className="font-bold text-orange-700 dark:text-orange-400">{stats.totalBudgets}</span>
            </div>
            <div className="flex items-center gap-1 bg-pink-50/80 dark:bg-pink-950/20 border border-pink-100/50 dark:border-pink-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="text-pink-700/85 dark:text-pink-300 font-medium">Active Budgets:</span>
              <span className="font-bold text-pink-700 dark:text-pink-400">{stats.activeBudgets}</span>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="text-emerald-700/85 dark:text-emerald-350 font-medium">Utilization:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-tabular-nums">
                {stats.totalBudgetedAmount > 0
                  ? Math.round((stats.totalSpent / stats.totalBudgetedAmount) * 100)
                  : 0}%
              </span>
            </div>
          </>
        }
      />

      <div className="max-w-none px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">

        {/* Expanded Filters Panel (when filter open from topbar) */}
        {(activeTab === 'overview' || activeTab === 'items') && filtersExpanded && (
          <div className="bg-white/80 backdrop-blur-sm border border-blue-100/50 rounded-xl px-4 py-3 shadow-sm animate-in slide-in-from-top-2 duration-200">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="bg-white h-9">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {['Stationery', 'Equipment', 'Maintenance', 'Technology', 'Food', 'Other'].map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-white h-9">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <div className="sm:col-span-2 flex justify-end">
                  <Button variant="ghost" onClick={clearFilters} className="text-red-600 hover:bg-red-50 hover:text-red-700 h-8 text-sm">
                    <X className="w-3.5 h-3.5 mr-1.5" /> Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats moved to GlassSummaryBar above */}

        {
          selectedItemId && activeTab === 'itemDetail' ? (
            <ItemDetailView
              itemId={selectedItemId}
              item={items.find((item) => item.id === selectedItemId) || null}
              purchases={purchases}
              onBack={handleBackFromItemDetail}
            />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              {/* TabsList hidden - replaced by header dropdown */}

              <TabsContent value="overview" className="space-y-4">
                <OverviewTab
                  summary={summary}
                  stats={stats}
                  filteredItems={filteredItems}
                  purchases={periodPurchases}
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
                  purchases={periodPurchases}
                  onPurchasesChanged={refreshPurchases}
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
                  restockRequest={restockPurchase}
                  onRestockPurchaseLinked={() => setRestockPurchase(null)}
                />
              </TabsContent>

              <TabsContent value="restock" className="space-y-4">
                <RestockRequestPanel
                  onRecordPurchase={(request) => {
                    setRestockPurchase(request);
                    setActiveTab('purchases');
                  }}
                />
              </TabsContent>

              <TabsContent value="budgets" className="space-y-4">
                <BudgetManagement
                  budgets={budgets}
                  setBudgets={setBudgets}
                  items={items}
                  purchases={purchases}
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
                <CatalogAuditPanel
                  procurementItems={items}
                  onProcurementItemsLinked={(linkedItemIds, catalogItemId) => {
                    const linkedIds = new Set(linkedItemIds);
                    setItems((currentItems) => currentItems.map((item) => (
                      linkedIds.has(item.id) ? { ...item, catalogItemId } : item
                    )));
                  }}
                />
                <ItemManagement
                  items={items}
                  setItems={setItems}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  categoryFilter={categoryFilter}
                  statusFilter={statusFilter}
                />
              </TabsContent>
            </Tabs>
          )
        }
      </div>
    </div>
  );
}

// Overview Tab Component
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
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search and Filters moved to global toolbar */}

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
                      <p className="font-bold text-sm">{formatCurrency(purchase.totalCost || 0)}</p>
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
                        {formatCurrency(0)} / {formatCurrency(budget.totalEstimatedCost)}
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
