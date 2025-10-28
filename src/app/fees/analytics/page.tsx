"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  Users,
  Calendar,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useProgressiveFees } from '@/lib/hooks/use-progressive-fees';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useFeeStructures } from '@/lib/hooks/use-fee-structures';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedCurrency, AnimatedNumber, AnimatedPercentage } from '@/components/ui/animated-number';
import { PaymentsService } from '@/lib/services/payments.service';

export default function CollectionAnalyticsPage() {
  const router = useRouter();
  
  // Ref to prevent duplicate fetches
  const fetchingRef = React.useRef(false);
  
  // Get all data
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: allYears = [], isLoading: yearsLoading } = useAcademicYears();
  const { data: allFeeStructures = [], isLoading: feeStructuresLoading } = useFeeStructures();
  
  // Debug fee structures
  useEffect(() => {
    if (allFeeStructures.length > 0) {
      console.log('💰 Fee Structures loaded:', allFeeStructures.length, 
        'Sample IDs:', allFeeStructures.slice(0, 3).map(f => ({ id: f.id, name: f.name })));
    }
  }, [allFeeStructures.length]);
  
  // Get default year (active or first) - MEMOIZED to prevent re-creation
  const defaultYear = useMemo(() => 
    allYears.find(y => y.isActive) || allYears[0], 
    [allYears]
  );
  
  // Allow manual selection
  const [manualYearId, setManualYearId] = useState<string | undefined>(undefined);
  const [manualTermId, setManualTermId] = useState<string | undefined>(undefined);
  
  // Date-based analysis state
  const [analysisView, setAnalysisView] = useState<'daily' | 'weekly' | 'term'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => {
    // Get start of current week (Monday)
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  });
  
  // Determine which year to use - STABLE
  const activeYearId = manualYearId || defaultYear?.id;
  const activeYear = useMemo(() => 
    allYears.find(y => y.id === activeYearId), 
    [allYears, activeYearId]
  );
  
  // Update selected term ID to use manual or default (auto-detect based on current date)
  const effectiveTermId = useMemo(() => {
    if (manualTermId) return manualTermId;
    
    // Auto-detect current term based on today's date
    if (activeYear?.terms && activeYear.terms.length > 0) {
      const today = new Date();
      const currentTerm = activeYear.terms.find(term => {
        const startDate = term.startDate instanceof Date ? term.startDate : new Date(term.startDate);
        const endDate = term.endDate instanceof Date ? term.endDate : new Date(term.endDate);
        return today >= startDate && today <= endDate;
      });
      
      if (currentTerm) return currentTerm.id;
      
      // Fallback to currentTermId from database
      if (activeYear.currentTermId) return activeYear.currentTermId;
      
      // Last fallback: first term
      return activeYear.terms[0].id;
    }
    
    return '';
  }, [manualTermId, activeYear?.id, activeYear?.terms]); // More stable dependencies
  
  // Get term dates - STABLE
  const termDates = useMemo(() => {
    if (!activeYear || !effectiveTermId) return null;
    const term = activeYear.terms?.find(t => t.id === effectiveTermId);
    if (!term) return null;
    return {
      startDate: term.startDate instanceof Date ? term.startDate : new Date(term.startDate),
      endDate: term.endDate instanceof Date ? term.endDate : new Date(term.endDate)
    };
  }, [activeYear?.id, effectiveTermId]); // Use ID instead of whole object

  // Use EXACT same logic as Fees Collection page
  const {
    pupilFeesInfo,
    totals,
    isLoading: feesLoading,
    isProcessing,
    progressPercentage
  } = useProgressiveFees({
    pupils: allPupils,
    selectedYear: activeYear || null,
    selectedTermId: effectiveTermId || '',
    academicYears: allYears
  });

  // Debug logging removed
  
  // State for date-filtered payments
  const [datePayments, setDatePayments] = useState<any[]>([]);
  const [loadingDatePayments, setLoadingDatePayments] = useState(false);
  const [allTermPayments, setAllTermPayments] = useState<any[]>([]);
  
  // UI state for expandable sections
  const [expandedDatePayments, setExpandedDatePayments] = useState(false);
  const [expandedClassData, setExpandedClassData] = useState<Record<string, boolean>>({});
  const [expandedPupilPayments, setExpandedPupilPayments] = useState<Record<string, boolean>>({});
  const [expandedClassPupilPayments, setExpandedClassPupilPayments] = useState<Record<string, boolean>>({});
  const [expandedFeePayments, setExpandedFeePayments] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Sorting state for class breakdown table
  const [sortField, setSortField] = useState<'name' | 'expected' | 'paid' | 'balance'>('balance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Search state for filtering pupils
  const [pupilSearchTerm, setPupilSearchTerm] = useState<Record<string, string>>({});

  // Fetch ALL term payments once for the class breakdown
  useEffect(() => {
    const fetchAllTermPayments = async () => {
      const yearId = activeYear?.id;
      if (!yearId || !effectiveTermId) return;
      
      // Prevent duplicate fetches
      if (fetchingRef.current) {
        console.log('⏭️ Skipping duplicate payment fetch');
        return;
      }
      
      fetchingRef.current = true;
      try {
        console.log('📥 Fetching all term payments for', { yearId, termId: effectiveTermId });
        const payments = await PaymentsService.getAllPaymentsByTerm(yearId, effectiveTermId);
        setAllTermPayments(payments);
        console.log('✅ Fetched', payments.length, 'payments');
      } catch (error) {
        console.error('Error fetching all term payments:', error);
        setAllTermPayments([]);
      } finally {
        fetchingRef.current = false;
      }
    };
    
    fetchAllTermPayments();
  }, [activeYear?.id, effectiveTermId]); // Use stable ID instead of object

  // Filter payments by date range (client-side only, no fetching)
  useEffect(() => {
    if (allTermPayments.length === 0) {
      setDatePayments([]);
      setLoadingDatePayments(false);
      return;
    }
    
    setLoadingDatePayments(true);
    try {
      // Get date range based on view
      let startDate: Date, endDate: Date;
      
      if (analysisView === 'daily') {
        startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (analysisView === 'weekly') {
        startDate = new Date(selectedWeekStart);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(selectedWeekStart);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Term view - use all payments
        setDatePayments(allTermPayments);
        setLoadingDatePayments(false);
        return;
      }
      
      // Filter all term payments by date range (fast, client-side)
      const filteredPayments = allTermPayments.filter(payment => {
        const paymentDate = payment.paymentDate instanceof Date 
          ? payment.paymentDate 
          : new Date(payment.paymentDate);
        return paymentDate >= startDate && paymentDate <= endDate;
      });
      
      setDatePayments(filteredPayments);
    } catch (error) {
      console.error('Error filtering date payments:', error);
      setDatePayments([]);
    } finally {
      setLoadingDatePayments(false);
    }
  }, [allTermPayments, analysisView, selectedDate, selectedWeekStart]);

  // Refresh handler
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const yearId = activeYear?.id;
      if (!yearId || !effectiveTermId) return;
      
      console.log('🔄 Refreshing data...');
      
      // Refetch all term payments
      const payments = await PaymentsService.getAllPaymentsByTerm(yearId, effectiveTermId);
      setAllTermPayments(payments);
      
      console.log('✅ Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sort handler for class breakdown table
  const handleSort = (field: 'name' | 'expected' | 'paid' | 'balance') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Calculate date-filtered collection stats with pupil details
  const dateFilteredStats = useMemo(() => {
    // Wait for fee structures to load
    if (feeStructuresLoading || allFeeStructures.length === 0) {
      console.log('⏳ Waiting for fee structures to load...');
      return null;
    }
    
    // Get date range for display
    let startDate: Date, endDate: Date;
    
    if (analysisView === 'daily') {
      startDate = new Date(selectedDate);
      endDate = new Date(selectedDate);
    } else if (analysisView === 'weekly') {
      startDate = new Date(selectedWeekStart);
      endDate = new Date(selectedWeekStart);
      endDate.setDate(endDate.getDate() + 6);
    } else {
      if (!termDates) return null;
      startDate = termDates.startDate;
      endDate = termDates.endDate;
    }
    
    // Calculate total from filtered payments
    const totalCollected = datePayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const paymentsCount = datePayments.length;
    
    // Group payments by pupil for detailed view
    const paymentsByPupil = new Map<string, any>();
    const pupilPayments: any[] = [];
    
    datePayments.forEach(payment => {
      const pupilId = payment.pupilId;
      if (!paymentsByPupil.has(pupilId)) {
        const pupil = allPupils.find(p => p.id === pupilId);
        
        // Try different name fields
        const pupilName = pupil?.fullName || 
                         (pupil?.firstName && pupil?.lastName ? `${pupil.firstName} ${pupil.lastName}` : '') ||
                         pupil?.firstName || 
                         pupil?.lastName || 
                         'Unknown';
        
        paymentsByPupil.set(pupilId, {
          pupilId,
          pupilName,
          className: pupil?.className || 'Unknown',
          classCode: pupil?.classCode || '',
          section: pupil?.section || '',
          totalPaid: 0,
          payments: []
        });
      }
      
      const pupilData = paymentsByPupil.get(pupilId)!;
      pupilData.totalPaid += payment.amount || 0;
      
      // Look up fee structure name - Handle carry-forward payments
      let feeName = 'Unknown Fee';
      
      // Special case: Carry-forward payments with descriptive name
      if (payment.isCarryForwardPayment && payment.carryForwardItemName) {
        const itemName = payment.carryForwardItemName;
        const fromTerm = payment.originalTerm || '';
        
        // Extract term number from format like 't2-2025'
        let termLabel = 'Previous Term';
        if (fromTerm) {
          const termMatch = fromTerm.match(/t(\d+)/);
          if (termMatch) {
            termLabel = `Term ${termMatch[1]}`;
          }
        }
        
        feeName = `${itemName} (Carry Forward from ${termLabel})`;
      }
      // Normal case: match by fee structure ID
      else {
        const feeStructure = allFeeStructures.find(f => f.id === payment.feeStructureId);
        if (feeStructure) {
          feeName = feeStructure.name;
        } 
        // Fallback: fee name directly on payment
        else if (payment.feeName) {
          feeName = payment.feeName;
        }
        // Fallback: fee structure name field
        else if (payment.feeStructureName) {
          feeName = payment.feeStructureName;
        }
      }
      
      pupilData.payments.push({
        id: payment.id,
        amount: payment.amount,
        date: payment.paymentDate,
        feeName,
        feeStructureId: payment.feeStructureId,
        paymentMethod: payment.paymentMethod || 'Cash'
      });
    });
    
    return {
      totalCollected,
      paymentsCount,
      startDate,
      endDate,
      dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      pupilsWithPayments: Array.from(paymentsByPupil.values())
    };
  }, [datePayments, analysisView, selectedDate, selectedWeekStart, termDates, allPupils, allFeeStructures, feeStructuresLoading]);

  const isLoading = yearsLoading || pupilsLoading || feesLoading;

  // Calculate statistics
  const stats = useMemo(() => {
    if (!totals || isProcessing) return null;

    const pupilFeesArray = Object.values(pupilFeesInfo || {});
    
    // Debug logging removed
    const paidPupils = pupilFeesArray.filter(p => p.balance <= 0).length;
    const unpaidPupils = pupilFeesArray.filter(p => p.totalPaid === 0).length;
    const partiallyPaidPupils = pupilFeesArray.filter(p => p.totalPaid > 0 && p.balance > 0).length;

    // Group by class
    const classSummary = new Map();
    Object.entries(pupilFeesInfo || {}).forEach(([pupilId, feesInfo]) => {
      const pupil = allPupils.find(p => p.id === pupilId);
      if (!pupil?.classId) return;

      if (!classSummary.has(pupil.classId)) {
        classSummary.set(pupil.classId, {
          classId: pupil.classId,
          className: pupil.className || 'Unknown',
          classCode: pupil.classCode || '',
          pupilCount: 0,
          expectedAmount: 0,
          collectedAmount: 0,
          paidPupils: 0,
          unpaidPupils: 0,
          partiallyPaidPupils: 0
        });
      }

      const classData = classSummary.get(pupil.classId);
      classData.pupilCount++;
      classData.expectedAmount += feesInfo.totalFees;
      classData.collectedAmount += feesInfo.totalPaid;

      if (feesInfo.balance <= 0) classData.paidPupils++;
      else if (feesInfo.totalPaid > 0) classData.partiallyPaidPupils++;
      else classData.unpaidPupils++;
    });

    const byClass = Array.from(classSummary.values())
      .map(c => ({
        ...c,
        outstandingAmount: c.expectedAmount - c.collectedAmount,
        collectionRate: c.expectedAmount > 0 ? (c.collectedAmount / c.expectedAmount) * 100 : 0
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    const result = {
      totalExpected: totals.totalFees,
      totalCollected: totals.totalPaid,
      outstanding: totals.balance,
      collectionRate: totals.totalFees > 0 ? (totals.totalPaid / totals.totalFees) * 100 : 0,
      totalPupils: pupilFeesArray.length,
      paidPupils,
      unpaidPupils,
      partiallyPaidPupils,
      byClass
    };

    console.log('📊 STATS CALCULATED:', {
      totalPupils: result.totalPupils,
      byClassCount: byClass.length,
      byClassSample: byClass.slice(0, 2),
      hasStats: !!result,
      hasByClass: !!result.byClass,
      byClassLength: result.byClass?.length || 0
    });

    return result;
  }, [totals, pupilFeesInfo, allPupils]);

  // Organize all term payments by pupil and fee for easy lookup
  const paymentsByPupilAndFee = useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {};
    
    allTermPayments.forEach(payment => {
      if (!payment.pupilId || !payment.feeStructureId) return;
      
      if (!map[payment.pupilId]) {
        map[payment.pupilId] = {};
      }
      
      if (!map[payment.pupilId][payment.feeStructureId]) {
        map[payment.pupilId][payment.feeStructureId] = [];
      }
      
      map[payment.pupilId][payment.feeStructureId].push(payment);
    });
    
    return map;
  }, [allTermPayments]);

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;
  const formatShort = (amount: number) => {
    if (amount >= 1000000) return `UGX ${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `UGX ${(amount / 1000).toFixed(1)}K`;
    return formatCurrency(amount);
  };

  // Show setup required if no years
  if (!yearsLoading && allYears.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6 flex items-center justify-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-yellow-900 mb-2">Setup Required</h2>
          <p className="text-yellow-600">Please configure academic years and terms first.</p>
        </div>
      </div>
    );
  }

  // Data is ready when we have stats (but animations will start from 0)
  const isDataReady = !isLoading && !isProcessing && stats && activeYear;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
      {/* Non-blocking Loading Indicator */}
      {(isLoading || isProcessing) && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="bg-indigo-600 text-white py-2 px-4 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span className="text-sm font-medium">
                  {isProcessing ? `Calculating analytics... ${progressPercentage.toFixed(0)}%` : 'Loading data...'}
                </span>
              </div>
              {progressPercentage > 0 && (
                <div className="w-48 bg-indigo-700 rounded-full h-2">
                  <div 
                    className="bg-white h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progressPercentage}%` }} 
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compact Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-wrap items-center gap-4 bg-white rounded-lg shadow-sm p-4">
          {/* Title */}
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-indigo-900">Collection Analytics</h1>
          </div>
          
          {/* Divider */}
          <div className="hidden md:block h-8 w-px bg-gray-300"></div>
          
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <select
              value={activeYearId || ''}
              onChange={(e) => {
                setManualYearId(e.target.value);
                setManualTermId(undefined);
              }}
              className="appearance-none px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white cursor-pointer"
            >
              {allYears.map(year => (
                <option key={year.id} value={year.id} className="text-gray-900 bg-white">
                  {year.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Term Selector */}
          <div className="flex items-center gap-2">
            <select
              value={effectiveTermId}
              onChange={(e) => setManualTermId(e.target.value)}
              className="appearance-none px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white cursor-pointer"
            >
              {activeYear?.terms?.map(term => (
                <option key={term.id} value={term.id} className="text-gray-900 bg-white">
                  {term.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Date Range */}
          {termDates && (
            <>
              <div className="hidden md:block h-8 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">
                  {termDates.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {termDates.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            </>
          )}
          
          {/* Refresh Button */}
          <div className="ml-auto">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={isRefreshing ? 'Refreshing...' : 'Refresh'}
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Overview Cards - Load instantly with counting animations */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                <h3 className="text-[11px] md:text-xs font-medium text-gray-600">Total Expected</h3>
              </div>
              <p className="text-base md:text-xl font-bold text-blue-900">
                {isDataReady ? (
                  <AnimatedCurrency amount={stats.totalExpected} duration={2000} />
                ) : (
                  <span className="animate-pulse">Loading...</span>
                )}
              </p>
              <p className="text-[9px] md:text-[10px] text-blue-600">
                From{' '}
                {isDataReady ? (
                  <AnimatedNumber value={stats.totalPupils} duration={2000} />
                ) : (
                  '...'
                )}{' '}
                pupils
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                <h3 className="text-[11px] md:text-xs font-medium text-gray-600">Total Collected</h3>
              </div>
              <p className="text-base md:text-xl font-bold text-green-900">
                {isDataReady ? (
                  <AnimatedCurrency amount={stats.totalCollected} duration={2000} />
                ) : (
                  <span className="animate-pulse">Loading...</span>
                )}
              </p>
              <p className="text-[9px] md:text-[10px] text-green-600">
                {isDataReady ? (
                  <AnimatedNumber value={stats.paidPupils} duration={2000} />
                ) : (
                  '...'
                )}{' '}
                fully paid
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                <h3 className="text-[11px] md:text-xs font-medium text-gray-600">Outstanding</h3>
              </div>
              <p className="text-base md:text-xl font-bold text-red-900">
                {isDataReady ? (
                  <AnimatedCurrency amount={stats.outstanding} duration={2000} />
                ) : (
                  <span className="animate-pulse">Loading...</span>
                )}
              </p>
              <p className="text-[9px] md:text-[10px] text-red-600">
                {isDataReady ? (
                  <AnimatedNumber value={stats.unpaidPupils} duration={2000} />
                ) : (
                  '...'
                )}{' '}
                not paid
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                <h3 className="text-[11px] md:text-xs font-medium text-gray-600">Collection Rate</h3>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-base md:text-xl font-bold text-purple-900">
                  {isDataReady ? (
                    <AnimatedPercentage value={stats.collectionRate} duration={2000} decimals={1} />
                  ) : (
                    <span className="animate-pulse">...</span>
                  )}
                </p>
                <p className="text-[9px] md:text-[10px] text-purple-600">
                  •{' '}
                  {isDataReady ? (
                    <AnimatedNumber value={stats.partiallyPaidPupils} duration={2000} />
                  ) : (
                    '...'
                  )}{' '}
                  partial
                </p>
              </div>
              
              {/* Compact Progress Bar */}
              <div className="mt-1.5">
                <p className="text-[8px] md:text-[9px] text-gray-600 mb-0.5">
                  {isDataReady ? (
                    <>
                      <AnimatedCurrency amount={stats.totalCollected} duration={2000} /> of{' '}
                      <AnimatedCurrency amount={stats.totalExpected} duration={2000} />
                    </>
                  ) : (
                    <span className="animate-pulse">Loading...</span>
                  )}
                </p>
                <div className="w-full h-1 bg-purple-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-1 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: isDataReady ? `${stats.collectionRate}%` : '0%' }}
                    transition={{ duration: 2, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date-Based Analysis Section - Redesigned */}
        <Card className="border-0 shadow-lg overflow-hidden">
          {/* Integrated Header */}
          <div 
            onClick={() => !loadingDatePayments && dateFilteredStats && setExpandedDatePayments(!expandedDatePayments)}
            className={`bg-gradient-to-br from-green-50 via-blue-50 to-cyan-50 p-4 md:p-6 cursor-pointer hover:shadow-inner transition-all ${
              !loadingDatePayments && dateFilteredStats ? 'cursor-pointer' : ''
            }`}
          >
            {/* Top Row: Title + Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                <h3 className="text-base md:text-lg font-bold text-blue-900">Collection by Date</h3>
              </div>
              
              <div className="flex items-center gap-2">
                {/* View Selector */}
                <select
                  value={analysisView}
                  onChange={(e) => {
                    e.stopPropagation();
                    setAnalysisView(e.target.value as 'daily' | 'weekly' | 'term');
                  }}
                  className="appearance-none px-2 md:px-3 py-1 md:py-1.5 border-2 border-blue-300 rounded-md text-xs md:text-sm font-medium text-blue-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-400 cursor-pointer shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="term">Term</option>
                </select>
                
                {/* Date/Week Selector */}
                {analysisView === 'daily' && (
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedDate(e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    min={termDates?.startDate.toISOString().split('T')[0]}
                    max={termDates?.endDate.toISOString().split('T')[0]}
                    className="px-2 py-1 border-2 border-blue-300 rounded-md text-xs md:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 bg-white shadow-sm"
                  />
                )}
                
                {analysisView === 'weekly' && (
                  <div className="flex items-center gap-1 bg-white rounded-md border-2 border-blue-300 shadow-sm px-2 py-1">
                    <span className="text-[10px] md:text-xs text-gray-500">Week:</span>
                    <input
                      type="date"
                      value={selectedWeekStart}
                      onChange={(e) => {
                        e.stopPropagation();
                        // Ensure it's a Monday
                        const selectedDate = new Date(e.target.value);
                        const day = selectedDate.getDay();
                        const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1);
                        const monday = new Date(selectedDate);
                        monday.setDate(diff);
                        setSelectedWeekStart(monday.toISOString().split('T')[0]);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      min={termDates?.startDate.toISOString().split('T')[0]}
                      max={termDates?.endDate.toISOString().split('T')[0]}
                      className="border-0 focus:ring-0 focus:outline-none text-xs md:text-sm bg-transparent w-[140px]"
                      title="Click to select week"
                    />
                    <span className="text-[10px] md:text-xs text-blue-600 font-medium">
                      {selectedWeekStart && (() => {
                        const monday = new Date(selectedWeekStart);
                        const sunday = new Date(monday);
                        sunday.setDate(sunday.getDate() + 6);
                        return `${monday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${sunday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Display - Compact */}
            {loadingDatePayments ? (
              <div className="text-center py-6 text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-xs">Loading...</p>
              </div>
            ) : dateFilteredStats && (
              <div className="bg-white/80 backdrop-blur rounded-lg p-3 md:p-4 border-2 border-green-200 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Total */}
                  <div className="flex-1">
                    <p className="text-[10px] md:text-xs font-semibold text-gray-600 uppercase mb-1">
                      {analysisView === 'daily' 
                        ? new Date(selectedDate).toLocaleDateString() === new Date().toLocaleDateString() 
                          ? "Today's Collection" 
                          : "Collection"
                        : analysisView === 'weekly' 
                        ? "Week Collection"
                        : "Term Collection"}
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-green-700">
                      <AnimatedCurrency amount={dateFilteredStats.totalCollected} duration={1500} />
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs mt-1">
                      <span className="text-blue-600">📅 {dateFilteredStats.dateRange}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-green-600">
                        <AnimatedNumber value={dateFilteredStats.paymentsCount} duration={1500} /> pmts
                      </span>
                    </div>
                  </div>
                  
                  {/* Right: Percentage */}
                  <div className="text-right">
                    <p className="text-xl md:text-2xl font-bold text-purple-900">
                      {isDataReady && stats ? (
                        <AnimatedPercentage 
                          value={(dateFilteredStats.totalCollected / stats.totalCollected) * 100} 
                          duration={1500}
                          decimals={1}
                        />
                      ) : (
                        '0.0%'
                      )}
                    </p>
                    <p className="text-[10px] md:text-xs text-purple-600 mt-1">of term</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Expandable Payment Details */}
            {!loadingDatePayments && dateFilteredStats && expandedDatePayments && (
                  <div 
                    className="mt-4 md:mt-6 pt-4 md:pt-6 border-t-2 border-dashed border-blue-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 mb-3 md:mb-4">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {dateFilteredStats.pupilsWithPayments.length}
                      </div>
                      <h4 className="text-sm md:text-base font-bold text-blue-900">Payment Details</h4>
                    </div>
                    {/* Mobile scroll hint */}
                    <div className="md:hidden px-3 py-2 bg-blue-50 border-b border-blue-100 rounded-t-lg">
                      <p className="text-[10px] text-blue-600 text-center">← Scroll to view all columns →</p>
                    </div>
                    
                    <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                       <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
                          <tr>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-gray-700 uppercase">Pupil</th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-semibold text-gray-700 uppercase">Term Total</th>
                            <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-semibold text-gray-700 uppercase">
                              Paid in {analysisView === 'daily' ? 'Day' : analysisView === 'weekly' ? 'Week' : 'Term'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {dateFilteredStats.pupilsWithPayments.map((pupilPayment) => {
                            const pupilFeesData = pupilFeesInfo[pupilPayment.pupilId];
                            const isPaymentExpanded = expandedPupilPayments[pupilPayment.pupilId];
                            
                            return (
                              <React.Fragment key={pupilPayment.pupilId}>
                                <tr className="hover:bg-gray-50">
                                  <td className="px-2 md:px-4 py-2 md:py-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/fees/collect/${pupilPayment.pupilId}`);
                                      }}
                                      className="text-left hover:underline"
                                    >
                                      <div className="text-[9px] md:text-[10px] font-bold text-gray-700 uppercase mb-0.5">{pupilPayment.classCode}</div>
                                      <div className="text-xs md:text-sm font-medium text-blue-600 hover:text-blue-800">{pupilPayment.pupilName}</div>
                                      <div className="text-[10px] md:text-xs text-gray-500">{pupilPayment.section}</div>
                                    </button>
                                  </td>
                                  <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                    <div className="text-green-600 font-medium">{formatCurrency(pupilFeesData?.totalPaid || 0)}</div>
                                    <div className="text-red-600 text-[10px] md:text-xs">{formatCurrency(pupilFeesData?.balance || 0)}</div>
                                  </td>
                                  <td 
                                    className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium text-blue-600 text-right cursor-pointer hover:bg-blue-50"
                                    onClick={() => setExpandedPupilPayments(prev => ({ ...prev, [pupilPayment.pupilId]: !prev[pupilPayment.pupilId] }))}
                                  >
                                    <div className="text-blue-600 font-bold">{formatCurrency(pupilPayment.totalPaid)}</div>
                                    <div className="text-[10px] md:text-xs text-gray-500 mt-0.5">{pupilPayment.payments.length} {pupilPayment.payments.length !== 1 ? 'pmts' : 'pmt'}</div>
                                  </td>
                                </tr>
                                
                                {/* Expanded payment details - Compact */}
                                {isPaymentExpanded && (
                                  <tr className="bg-gradient-to-r from-blue-50 to-indigo-50" onClick={(e) => e.stopPropagation()}>
                                    <td colSpan={3} className="px-2 md:px-4 py-2 md:py-3" onClick={(e) => e.stopPropagation()}>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2" onClick={(e) => e.stopPropagation()}>
                                        {pupilPayment.payments.map((payment: any) => {
                                          const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
                                          // Get current balance for this fee from pupilFeesData
                                          const feeInfo = pupilFeesData?.applicableFees?.find(f => f.feeStructureId === payment.feeStructureId);
                                          const currentBalance = feeInfo?.balance || 0;
                                          
                                          return (
                                            <div key={payment.id} className="bg-white rounded-md p-2 border border-indigo-200 shadow-sm">
                                              <div className="flex justify-between items-start gap-2 mb-1">
                                                <span className="font-semibold text-gray-900 text-[10px] leading-tight">{payment.feeName}</span>
                                                <span className="font-bold text-green-600 text-xs whitespace-nowrap">{formatCurrency(payment.amount)}</span>
                                              </div>
                                              <div className="flex justify-between items-center text-[9px]">
                                                <span className="text-gray-500">{paymentDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</span>
                                                <span className="text-red-600 font-medium">Bal: {formatCurrency(currentBalance)}</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
            )}
          </div>
        </Card>

        {/* Class Breakdown Table */}
        {isDataReady && stats?.byClass && stats.byClass.length > 0 && (
          <Card className="border-0 shadow-lg">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 md:px-6 py-3 md:py-4 border-b border-indigo-100">
              <h3 className="text-base md:text-lg font-bold text-indigo-900">Collection by Class</h3>
              <p className="text-xs md:text-sm text-indigo-600">Breakdown for {activeYear?.name} - Term {effectiveTermId.replace('t', '').replace('-2025', '').replace('-2024', '')}</p>
            </div>
            
            {/* Mobile scroll hint */}
            <div className="md:hidden px-4 py-2 bg-blue-50 border-b border-blue-100">
              <p className="text-xs text-blue-600 text-center">← Scroll horizontally to view all columns →</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Expected</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Collected</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.byClass.map((classData: any) => {
                    const isExpanded = expandedClassData[classData.classId];
                    
                    // Get pupils for this class and apply sorting
                    const classPupils = allPupils
                      .filter(p => p.classId === classData.classId)
                      .map(p => {
                        const feesInfo = pupilFeesInfo[p.id];
                        const pupilName = p.fullName || 
                                         (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : '') ||
                                         p.firstName || 
                                         p.lastName || 
                                         'Unknown';
                        return {
                          ...p,
                          displayName: pupilName,
                          expectedFees: feesInfo?.totalFees || 0,
                          paid: feesInfo?.totalPaid || 0,
                          balance: feesInfo?.balance || 0
                        };
                      })
                      .sort((a, b) => {
                        let comparison = 0;
                        
                        switch (sortField) {
                          case 'name':
                            comparison = a.displayName.localeCompare(b.displayName);
                            break;
                          case 'expected':
                            comparison = a.expectedFees - b.expectedFees;
                            break;
                          case 'paid':
                            comparison = a.paid - b.paid;
                            break;
                          case 'balance':
                            comparison = a.balance - b.balance;
                            break;
                        }
                        
                        return sortDirection === 'asc' ? comparison : -comparison;
                      });
                    
                    // Filter pupils based on search term
                    const searchTerm = pupilSearchTerm[classData.classId] || '';
                    const filteredPupils = searchTerm 
                      ? classPupils.filter(pupil => pupil.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
                      : classPupils;
                    
                    return (
                      <React.Fragment key={classData.classId}>
                        <tr 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedClassData(prev => ({ ...prev, [classData.classId]: !prev[classData.classId] }))}
                        >
                          <td className="px-2 md:px-6 py-3 md:py-4">
                            <div>
                              <div className="text-xs md:text-sm font-bold text-gray-900">{classData.classCode}</div>
                              <div className="flex items-center gap-1 text-[10px] mt-0.5">
                                <span className="text-gray-600 font-medium">{classData.pupilCount}</span>
                                <span className="text-green-600" title="Fully Paid">✓{classData.paidPupils}</span>
                                <span className="text-yellow-600" title="Partially Paid">◐{classData.partiallyPaidPupils}</span>
                                <span className="text-red-600" title="Not Paid">✗{classData.unpaidPupils}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm font-medium text-gray-900">
                            {formatCurrency(classData.expectedAmount)}
                          </td>
                          <td className="px-2 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm font-medium text-green-600">
                            {formatCurrency(classData.collectedAmount)}
                          </td>
                          <td className="px-2 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm font-medium text-red-600">
                            {formatCurrency(classData.outstandingAmount)}
                          </td>
                        </tr>
                        
                        {/* Expanded pupil details */}
                        {isExpanded && (
                          <tr className="bg-blue-50" onClick={(e) => e.stopPropagation()}>
                            <td colSpan={4} className="px-2 md:px-6 py-3 md:py-4" onClick={(e) => e.stopPropagation()}>
                              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                {/* Heading with search bar - Beautiful & Dynamic */}
                                <div className="flex items-center justify-between gap-3 mb-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-indigo-100 shadow-sm">
                                  <div className="flex items-center gap-2">
                                    <motion.div 
                                      key={filteredPupils.length}
                                      initial={{ scale: 0.8 }}
                                      animate={{ scale: 1 }}
                                      className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md"
                                    >
                                      {filteredPupils.length}
                                    </motion.div>
                                    <div>
                                      <h5 className="text-xs md:text-sm font-bold text-indigo-900 whitespace-nowrap">
                                        {classData.className}
                                      </h5>
                                      {pupilSearchTerm[classData.classId] && filteredPupils.length !== classPupils.length && (
                                        <p className="text-[10px] text-indigo-600">
                                          {filteredPupils.length} of {classPupils.length} pupils
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="relative flex-1 max-w-xs">
                                    <input
                                      type="text"
                                      placeholder="Search pupils..."
                                      value={pupilSearchTerm[classData.classId] || ''}
                                      onChange={(e) => setPupilSearchTerm(prev => ({ ...prev, [classData.classId]: e.target.value }))}
                                      className="px-3 py-1.5 pr-8 border-2 border-indigo-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 w-full bg-white shadow-sm transition-all duration-200 hover:shadow-md"
                                    />
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute right-2.5 top-1/2 transform -translate-y-1/2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    {pupilSearchTerm[classData.classId] && (
                                      <button
                                        onClick={() => setPupilSearchTerm(prev => ({ ...prev, [classData.classId]: '' }))}
                                        className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                      >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs md:text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th 
                                          className="px-2 md:px-3 py-1.5 md:py-2 text-left text-[10px] md:text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200 select-none"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSort('name');
                                          }}
                                        >
                                          <div className="flex items-center gap-1">
                                            <span>Name</span>
                                            {sortField === 'name' && (
                                              <span className="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                          </div>
                                        </th>
                                        <th 
                                          className="px-2 md:px-3 py-1.5 md:py-2 text-right text-[10px] md:text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200 select-none"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSort('expected');
                                          }}
                                        >
                                          <div className="flex items-center justify-end gap-1">
                                            <span>Expected</span>
                                            {sortField === 'expected' && (
                                              <span className="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                          </div>
                                        </th>
                                        <th 
                                          className="px-2 md:px-3 py-1.5 md:py-2 text-right text-[10px] md:text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200 select-none"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSort('paid');
                                          }}
                                        >
                                          <div className="flex items-center justify-end gap-1">
                                            <span>Paid</span>
                                            {sortField === 'paid' && (
                                              <span className="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                          </div>
                                        </th>
                                        <th 
                                          className="px-2 md:px-3 py-1.5 md:py-2 text-right text-[10px] md:text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200 select-none"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSort('balance');
                                          }}
                                        >
                                          <div className="flex items-center justify-end gap-1">
                                            <span>Balance</span>
                                            {sortField === 'balance' && (
                                              <span className="text-indigo-600 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                          </div>
                                        </th>
                                        <th className="px-2 md:px-3 py-1.5 md:py-2 text-center text-[10px] md:text-xs font-medium text-gray-600">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {filteredPupils.map(pupil => {
                                        const isPaid = pupil.balance <= 0;
                                        const isPartial = pupil.paid > 0 && pupil.balance > 0;
                                        const isPupilPaymentExpanded = expandedClassPupilPayments[pupil.id];
                                        const pupilFeesData = pupilFeesInfo[pupil.id];
                                        
                                        return (
                                          <React.Fragment key={pupil.id}>
                                            <tr className="hover:bg-gray-100">
                                              <td className="px-2 md:px-3 py-1.5 md:py-2">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/fees/collect/${pupil.id}`);
                                                  }}
                                                  className={`text-xs md:text-sm font-medium hover:underline text-left ${
                                                    isPaid 
                                                      ? 'text-green-600 hover:text-green-800' 
                                                      : isPartial 
                                                      ? 'text-yellow-600 hover:text-yellow-800' 
                                                      : 'text-red-600 hover:text-red-800'
                                                  }`}
                                                >
                                                  {pupil.displayName}
                                                </button>
                                              </td>
                                              <td className="px-2 md:px-3 py-1.5 md:py-2 text-right text-gray-700 text-xs md:text-sm">{formatCurrency(pupil.expectedFees)}</td>
                                              <td 
                                                className="px-2 md:px-3 py-1.5 md:py-2 text-right text-green-600 font-medium cursor-pointer hover:bg-green-50 text-xs md:text-sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setExpandedClassPupilPayments(prev => ({ ...prev, [pupil.id]: !prev[pupil.id] }));
                                                }}
                                              >
                                                <div className="flex items-center justify-end gap-1">
                                                  {formatCurrency(pupil.paid)}
                                                  <span className={`text-[10px] md:text-xs transition-transform ${isPupilPaymentExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                </div>
                                              </td>
                                              <td className="px-2 md:px-3 py-1.5 md:py-2 text-right text-red-600 font-medium text-xs md:text-sm">{formatCurrency(pupil.balance)}</td>
                                              <td className="px-2 md:px-3 py-1.5 md:py-2 text-center">
                                                {isPaid ? (
                                                  <span className="text-[10px] md:text-xs bg-green-100 text-green-800 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full">Paid</span>
                                                ) : isPartial ? (
                                                  <span className="text-[10px] md:text-xs bg-yellow-100 text-yellow-800 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full">Partial</span>
                                                ) : (
                                                  <span className="text-[10px] md:text-xs bg-red-100 text-red-800 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full">Unpaid</span>
                                                )}
                                              </td>
                                            </tr>
                                            
                                            {/* Expanded payment history for this pupil */}
                                            {isPupilPaymentExpanded && (
                                              <tr className="bg-green-50" onClick={(e) => e.stopPropagation()}>
                                                <td colSpan={5} className="px-2 md:px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                  <div className="text-xs" onClick={(e) => e.stopPropagation()}>
                                                    <div className="font-semibold text-gray-900 mb-2">Payment History</div>
                                                    {pupilFeesData?.applicableFees && pupilFeesData.applicableFees.length > 0 ? (
                                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {pupilFeesData.applicableFees.map((fee: any) => {
                                                          const feeKey = `${pupil.id}-${fee.feeStructureId}`;
                                                          const isFeeExpanded = expandedFeePayments[feeKey];
                                                          // Get actual payment records for this pupil and fee
                                                          const feePayments = paymentsByPupilAndFee[pupil.id]?.[fee.feeStructureId] || [];
                                                          
                                                          return (
                                                            <div key={fee.feeStructureId} className="bg-white rounded border border-gray-200">
                                                              <div 
                                                                className="flex justify-between items-center p-2 cursor-pointer hover:bg-gray-50"
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setExpandedFeePayments(prev => ({ ...prev, [feeKey]: !prev[feeKey] }));
                                                                }}
                                                              >
                                                                <div className="flex items-center gap-1">
                                                                  <span className={`text-[10px] transition-transform ${isFeeExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                                  <span className="font-medium text-gray-900">{fee.name}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                  <div className="text-green-600 font-bold text-xs">Paid: {formatCurrency(fee.paid)}</div>
                                                                  <div className="text-[10px] text-red-600">Bal: {formatCurrency(fee.balance)}</div>
                                                                </div>
                                                              </div>
                                                              
                                                              {/* Expanded payment transactions for this fee */}
                                                              {isFeeExpanded && (
                                                                <div className="border-t border-gray-200 p-2 bg-gray-50 space-y-1" onClick={(e) => e.stopPropagation()}>
                                                                  {feePayments.length > 0 ? (
                                                                    feePayments.map((payment: any, idx: number) => {
                                                                      // Handle different date formats
                                                                      let displayDate = 'No date';
                                                                      if (payment.paymentDate) {
                                                                        if (payment.paymentDate instanceof Date) {
                                                                          displayDate = payment.paymentDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                                                        } else if (payment.paymentDate.seconds) {
                                                                          displayDate = new Date(payment.paymentDate.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                                                        } else if (payment.paymentDate.toDate) {
                                                                          displayDate = payment.paymentDate.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                                                        } else {
                                                                          displayDate = new Date(payment.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                                                        }
                                                                      }
                                                                      
                                                                      return (
                                                                        <div key={idx} className="flex justify-between items-center text-[10px] text-gray-700 bg-white p-1.5 rounded">
                                                                          <span className="text-gray-600">{displayDate}</span>
                                                                          <span className="font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                                                                        </div>
                                                                      );
                                                                    })
                                                                  ) : (
                                                                    <div className="text-gray-500 text-center py-1">No payments yet</div>
                                                                  )}
                                                                </div>
                                                              )}
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    ) : (
                                                      <div className="text-gray-500 text-center py-2">No payment data available</div>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  
                                  {/* No results message - Animated */}
                                  {filteredPupils.length === 0 && (
                                    <motion.div 
                                      initial={{ opacity: 0, y: -10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border-2 border-dashed border-gray-300"
                                    >
                                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                      </svg>
                                      <p className="text-sm font-medium text-gray-900 mb-1">No pupils found</p>
                                      <p className="text-xs text-gray-500">No matches for "{pupilSearchTerm[classData.classId]}"</p>
                                    </motion.div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-medium">
                  <tr>
                    <td className="px-2 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-900">
                      <div className="font-bold">Total</div>
                      <div className="flex items-center gap-1 text-[10px] mt-0.5 font-normal">
                        <span className="text-gray-600 font-medium">{isDataReady ? stats.totalPupils : 0}</span>
                        <span className="text-green-600" title="Fully Paid">✓{isDataReady ? stats.paidPupils : 0}</span>
                        <span className="text-yellow-600" title="Partially Paid">◐{isDataReady ? stats.partiallyPaidPupils : 0}</span>
                        <span className="text-red-600" title="Not Paid">✗{isDataReady ? stats.unpaidPupils : 0}</span>
                      </div>
                    </td>
                    <td className="px-2 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm text-gray-900">{isDataReady ? formatCurrency(stats.totalExpected) : 'UGX 0'}</td>
                    <td className="px-2 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm text-green-600">{isDataReady ? formatCurrency(stats.totalCollected) : 'UGX 0'}</td>
                    <td className="px-2 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm text-red-600">{isDataReady ? formatCurrency(stats.outstanding) : 'UGX 0'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          Data as of {new Date().toLocaleString()} • Calculated using exact Fees Collection logic
        </div>
      </div>
    </div>
  );
}

