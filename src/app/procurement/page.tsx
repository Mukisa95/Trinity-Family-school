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
  if (academicYearsLoading) {
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
    <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen pb-12">
      {/* Sticky Header */}
      <div className="bg-white/90 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h1 className="text-lg sm:text-xl font-bold text-indigo-900 truncate">Procurement</h1>

            <div className="flex items-center gap-2">
              {/* Period Selector Group */}
              <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1 h-10">
                {/* View Period Select */}
                <select
                  value={viewPeriod}
                  onChange={(e) => {
                    const newPeriod = e.target.value as ViewPeriodType;
                    setViewPeriod(newPeriod);

                    // Smart defaults when switching views
                    if (newPeriod === 'Week' && currentWeek === 0) {
                      setCurrentWeek(getCurrentWeekNumber());
                    } else if (newPeriod === 'Month' && currentMonth === 0) {
                      setCurrentMonth(getCurrentMonthNumber());
                    } else if (newPeriod === 'Term' && !currentTerm && availableTerms.length > 0) {
                      // Use the first available term (already initialized by getEffectiveTermForDataDisplay)
                      setCurrentTerm(availableTerms[0].id);
                    }
                  }}
                  className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full"
                >
                  <option value="Week">Week</option>
                  <option value="Month">Month</option>
                  <option value="Term">Term</option>
                  <option value="Year">Year</option>
                </select>

                <div className="w-px h-5 bg-gray-300"></div>

                {/* Year Select */}
                {academicYears.length > 0 && (
                  <select
                    value={currentAcademicYear}
                    onChange={(e) => setCurrentAcademicYear(e.target.value)}
                    className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full"
                    style={{ maxWidth: '100px' }}
                  >
                    {academicYears.map(year => {
                      const isCurrent = year.id === currentAcademicYearId;
                      const today = new Date();
                      const yearEnd = new Date(year.endDate);
                      const hasEnded = today > yearEnd;

                      let label = '';
                      if (isCurrent) {
                        label = ' (Current)';
                      } else if (year.isLocked) {
                        label = ' (Locked)';
                      } else if (!hasEnded) {
                        label = ' (Upcoming)';
                      }

                      return (
                        <option key={year.id} value={year.id}>{year.name}{label}</option>
                      );
                    })}
                  </select>
                )}

                {/* Dynamic Selector based on View Period */}
                {viewPeriod === 'Term' && availableTerms.length > 0 && (
                  <>
                    <div className="w-px h-5 bg-gray-300"></div>
                    <select
                      value={currentTerm}
                      onChange={(e) => setCurrentTerm(e.target.value)}
                      className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full"
                      style={{ maxWidth: '120px' }}
                    >
                      {availableTerms.map(term => {
                        // Calculate total spend for this term
                        const termTotal = purchases
                          .filter(p => p.termId === term.id || (p.termName && p.termName === term.name))
                          .reduce((sum, p) => sum + (p.totalCost || 0), 0);

                        return (
                          <option key={term.id} value={term.id}>
                            {term.name} - {formatCurrency(termTotal)}
                          </option>
                        );
                      })}
                    </select>
                  </>
                )}

                {viewPeriod === 'Month' && (
                  <>
                    <div className="w-px h-5 bg-gray-300"></div>
                    <select
                      value={currentMonth}
                      onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                      className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full"
                      style={{ maxWidth: '120px' }}
                    >
                      {getMonthsInYear(currentAcademicYear).map(month => (
                        <option key={month.value} value={month.value}>{month.label.split(' - ')[0]} - {month.label.split(' - ')[1]}</option>
                      ))}
                    </select>
                  </>
                )}

                {viewPeriod === 'Week' && (
                  <>
                    <div className="w-px h-5 bg-gray-300"></div>
                    <select
                      value={currentWeek}
                      onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
                      className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full"
                      style={{ maxWidth: '140px' }}
                    >
                      {/* Group weeks by month */}
                      {(() => {
                        const weeks = getWeeksInYear(currentAcademicYear);
                        const months: { [key: string]: typeof weeks } = {};

                        weeks.forEach(week => {
                          // Extract month from label e.g., "Week 1 (Jan 1 - Jan 7)" -> "Jan"
                          const match = week.label.match(/\(([A-Za-z]+)/);
                          const month = match ? match[1] : 'Other';
                          if (!months[month]) months[month] = [];
                          months[month].push(week);
                        });

                        return Object.entries(months).map(([month, monthWeeks]) => (
                          <optgroup key={month} label={month}>
                            {monthWeeks.map(week => (
                              <option key={week.value} value={week.value}>
                                {week.label.split(')')[0] + ')'} {week.label.split(')')[1]}
                              </option>
                            ))}
                          </optgroup>
                        ));
                      })()}
                    </select>
                  </>
                )}
              </div>

              {/* Navigation Dropdown */}
              <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm h-10 flex items-center">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className="bg-white rounded-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-gray-700 font-medium hover:border-gray-300 transition-colors text-[10px] shadow-sm w-auto min-w-0 h-full uppercase tracking-wider"
                >
                  <option value="overview">OVERVIEW</option>
                  <option value="purchases">PURCHASES</option>
                  <option value="budgets">BUDGETS</option>
                  <option value="reports">REPORTS</option>
                  <option value="items">ITEMS</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">

        {/* Global Search & Actions Toolbar */}
        {(activeTab === 'overview' || activeTab === 'items') && (
          <div className="bg-white/80 backdrop-blur-sm border border-blue-100/50 rounded-xl p-3 sm:p-4 shadow-sm relative z-0">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search procurement items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-white"
                />
              </div>

              {/* Filters & Actions */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                <Button
                  variant="outline"
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className={`gap-2 h-10 ${hasActiveFilters ? 'text-blue-600 border-blue-200 bg-blue-50' : 'bg-white'}`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {(categoryFilter !== 'all' || statusFilter !== 'all') && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-blue-100 text-blue-700">
                      {categoryFilter !== 'all' && statusFilter !== 'all' ? 2 : 1}
                    </Badge>
                  )}
                </Button>

                {activeTab === 'overview' && (
                  <div className="flex items-center bg-gray-100 rounded-lg p-1 h-10">
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                      className={`h-8 w-8 p-0 ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className={`h-8 w-8 p-0 ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Filters Section */}
            {filtersExpanded && (
              <div className="pt-4 mt-4 border-t border-gray-100 grid sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="bg-white">
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
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-white">
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
                    <Button variant="ghost" onClick={clearFilters} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                      <X className="w-4 h-4 mr-2" /> Clear All Filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Statistics Cards */}
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
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

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-emerald-600 font-medium">Utilization</p>
                  <p className="text-lg sm:text-2xl font-bold text-emerald-700">
                    {stats.totalBudgetedAmount > 0
                      ? Math.round((stats.totalSpent / stats.totalBudgetedAmount) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {
          selectedItemId && activeTab === 'itemDetail' ? (
            <ItemDetailView itemId={selectedItemId} onBack={handleBackFromItemDetail} />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              {/* TabsList hidden - replaced by header dropdown */}

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