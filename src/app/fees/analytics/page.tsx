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
import { PaymentsService } from '@/lib/services/payments.service';

export default function CollectionAnalyticsPage() {
  const router = useRouter();
  
  // Ref to prevent duplicate fetches
  const fetchingRef = React.useRef(false);
  
  // Get all data
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: allYears = [], isLoading: yearsLoading } = useAcademicYears();
  const { data: allFeeStructures = [] } = useFeeStructures();
  
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

  // Calculate date-filtered collection stats with pupil details
  const dateFilteredStats = useMemo(() => {
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
      
      // Look up fee structure name
      const feeStructure = allFeeStructures.find(f => f.id === payment.feeStructureId);
      const feeName = feeStructure?.name || payment.feeName || 'Unknown Fee';
      
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
  }, [datePayments, analysisView, selectedDate, selectedWeekStart, termDates, allPupils, allFeeStructures]);

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

  // Loading state
  if (isLoading || isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-12 text-center max-w-md">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Calculating Analytics...</h2>
          {progressPercentage > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
              <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progressPercentage}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // No data state
  if (!stats || !activeYear) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
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
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Year:</label>
            <select
              value={activeYearId || ''}
              onChange={(e) => {
                setManualYearId(e.target.value);
                setManualTermId(undefined);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
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
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Term:</label>
            <select
              value={effectiveTermId}
              onChange={(e) => setManualTermId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
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
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                <h3 className="text-xs md:text-sm font-medium text-gray-600">Total Expected</h3>
              </div>
              <p className="text-lg md:text-2xl font-bold text-blue-900">{formatCurrency(stats.totalExpected)}</p>
              <p className="text-[10px] md:text-xs text-blue-600 mt-1">From {stats.totalPupils} pupils</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
                <h3 className="text-xs md:text-sm font-medium text-gray-600">Total Collected</h3>
              </div>
              <p className="text-lg md:text-2xl font-bold text-green-900">{formatCurrency(stats.totalCollected)}</p>
              <p className="text-[10px] md:text-xs text-green-600 mt-1">{stats.paidPupils} fully paid</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
                <h3 className="text-xs md:text-sm font-medium text-gray-600">Outstanding</h3>
              </div>
              <p className="text-lg md:text-2xl font-bold text-red-900">{formatCurrency(stats.outstanding)}</p>
              <p className="text-[10px] md:text-xs text-red-600 mt-1">{stats.unpaidPupils} not paid</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <Users className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
                <h3 className="text-xs md:text-sm font-medium text-gray-600">Collection Rate</h3>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg md:text-2xl font-bold text-purple-900">{stats.collectionRate.toFixed(1)}%</p>
                <p className="text-[10px] md:text-xs text-purple-600">• {stats.partiallyPaidPupils} partial</p>
              </div>
              
              {/* Compact Progress Bar */}
              <div className="mt-2">
                <p className="text-[9px] md:text-[10px] text-gray-600 mb-1">
                  {formatCurrency(stats.totalCollected)} of {formatCurrency(stats.totalExpected)}
                </p>
                <div className="w-full h-1.5 bg-purple-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-1.5 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.collectionRate}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date-Based Analysis Section */}
        <Card className="border-0 shadow-lg">
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-3 border-b border-blue-100">
            <div className="flex flex-wrap items-center gap-3">
              {/* Title */}
              <h3 className="text-lg font-bold text-blue-900">Collection by Date</h3>
              
              {/* Divider */}
              <div className="hidden md:block h-6 w-px bg-blue-300"></div>
              
              {/* View Selector */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setAnalysisView('daily')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    analysisView === 'daily'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setAnalysisView('weekly')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    analysisView === 'weekly'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setAnalysisView('term')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    analysisView === 'term'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Term
                </button>
              </div>
              
              {/* Date/Week Selector */}
              {analysisView === 'daily' && (
                <>
                  <div className="hidden md:block h-6 w-px bg-blue-300"></div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-blue-700 whitespace-nowrap">Date:</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={termDates?.startDate.toISOString().split('T')[0]}
                      max={termDates?.endDate.toISOString().split('T')[0]}
                      className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>
                </>
              )}
              
              {analysisView === 'weekly' && (
                <>
                  <div className="hidden md:block h-6 w-px bg-blue-300"></div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-blue-700 whitespace-nowrap">Week Start:</label>
                    <input
                      type="date"
                      value={selectedWeekStart}
                      onChange={(e) => setSelectedWeekStart(e.target.value)}
                      min={termDates?.startDate.toISOString().split('T')[0]}
                      max={termDates?.endDate.toISOString().split('T')[0]}
                      className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          
          <CardContent className="p-6">

            {/* Stats Display */}
            {loadingDatePayments ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Loading payment data...
              </div>
            ) : dateFilteredStats && (
              <>
                <button
                  onClick={() => setExpandedDatePayments(!expandedDatePayments)}
                  className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg hover:shadow-md transition-shadow text-left w-full"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Total Collected */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-1">Total Collected</h4>
                      <p className="text-2xl font-bold text-green-900">{formatCurrency(dateFilteredStats.totalCollected)}</p>
                      <p className="text-xs text-green-600 mt-1">{dateFilteredStats.paymentsCount} fee items paid • Click to expand</p>
                    </div>
                    
                    {/* Period Info */}
                    <div className="text-right">
                      <h4 className="text-sm font-medium text-gray-600 mb-1">Period</h4>
                      <p className="text-lg font-bold text-blue-900">
                        {analysisView === 'daily' ? 'Single Day' : analysisView === 'weekly' ? 'Week' : 'Full Term'}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">{dateFilteredStats.dateRange}</p>
                    </div>
                    
                    {/* Percentage of Term */}
                    <div className="text-right">
                      <h4 className="text-sm font-medium text-gray-600 mb-1">Percentage of Term</h4>
                      <p className="text-2xl font-bold text-purple-900">
                        {stats ? ((dateFilteredStats.totalCollected / stats.totalCollected) * 100).toFixed(1) : 0}%
                      </p>
                      <p className="text-xs text-purple-600 mt-1">of term collection</p>
                    </div>
                  </div>
                </button>
                
                {/* Expandable Payment Details */}
                {expandedDatePayments && (
                  <div className="mt-6 border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h4>
                    <div className="overflow-x-auto">
                       <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pupil</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Term Total / Balance</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Paid in {analysisView === 'daily' ? 'Day' : analysisView === 'weekly' ? 'Week' : 'Term'} (Click to expand)
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
                                  <td className="px-4 py-4">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/fees/collect/${pupilPayment.pupilId}`);
                                      }}
                                      className="text-left hover:underline"
                                    >
                                      <div className="text-sm font-medium text-blue-600 hover:text-blue-800">{pupilPayment.pupilName}</div>
                                      <div className="text-xs text-gray-500">{pupilPayment.section}</div>
                                    </button>
                                  </td>
                                  <td className="px-4 py-4 text-sm text-gray-600">{pupilPayment.classCode}</td>
                                  <td className="px-4 py-4 text-sm text-right">
                                    <div className="text-green-600 font-medium">{formatCurrency(pupilFeesData?.totalPaid || 0)} paid</div>
                                    <div className="text-red-600 text-xs">{formatCurrency(pupilFeesData?.balance || 0)} bal.</div>
                                  </td>
                                  <td 
                                    className="px-4 py-4 text-sm font-medium text-blue-600 text-right cursor-pointer hover:bg-blue-50"
                                    onClick={() => setExpandedPupilPayments(prev => ({ ...prev, [pupilPayment.pupilId]: !prev[pupilPayment.pupilId] }))}
                                  >
                                    <div className="flex items-center justify-end gap-2">
                                      <span>{formatCurrency(pupilPayment.totalPaid)}</span>
                                      <span className={`text-xs transition-transform ${isPaymentExpanded ? 'rotate-90' : ''}`}>▶</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">{pupilPayment.payments.length} payment{pupilPayment.payments.length !== 1 ? 's' : ''}</div>
                                  </td>
                                </tr>
                                
                                {/* Expanded payment details */}
                                {isPaymentExpanded && (
                                  <tr className="bg-blue-50">
                                    <td colSpan={3}></td>
                                    <td className="px-4 py-3">
                                      <div className="space-y-1">
                                        {pupilPayment.payments.map((payment: any) => {
                                          const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
                                          // Get current balance for this fee from pupilFeesData
                                          const feeInfo = pupilFeesData?.applicableFees?.find(f => f.feeStructureId === payment.feeStructureId);
                                          const currentBalance = feeInfo?.balance || 0;
                                          
                                          return (
                                            <div key={payment.id} className="bg-white rounded p-2 border border-gray-200 text-xs">
                                              <div className="flex justify-between items-center mb-1">
                                                <span className="font-medium text-gray-900">{payment.feeName}</span>
                                                <span className="font-bold text-green-600">{formatCurrency(payment.amount)}</span>
                                              </div>
                                              <div className="text-[10px] text-gray-500">
                                                {paymentDate.toLocaleDateString()} • {payment.paymentMethod}
                                              </div>
                                              <div className="text-[10px] text-red-600 mt-1">
                                                Bal: {formatCurrency(currentBalance)}
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Class Breakdown Table */}
        {stats.byClass && stats.byClass.length > 0 && (
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
                    <th className="px-3 md:px-6 py-2 md:py-3 text-center text-[10px] md:text-xs font-medium text-gray-500 uppercase">Pupils</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Expected</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Collected</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-center text-[10px] md:text-xs font-medium text-gray-500 uppercase">Rate</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.byClass.map((classData: any) => {
                    const isExpanded = expandedClassData[classData.classId];
                    
                    // Get pupils for this class
                    const classPupils = allPupils.filter(p => p.classId === classData.classId).map(p => {
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
                    });
                    
                    return (
                      <React.Fragment key={classData.classId}>
                        <tr 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedClassData(prev => ({ ...prev, [classData.classId]: !prev[classData.classId] }))}
                        >
                          <td className="px-2 md:px-6 py-3 md:py-4">
                            <div className="flex items-center gap-1 md:gap-2">
                              <span className={`text-sm md:text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                              <div>
                                <div className="text-xs md:text-sm font-medium text-gray-900">{classData.className}</div>
                                <div className="text-[10px] md:text-xs text-gray-500">{classData.classCode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 md:px-6 py-3 md:py-4">
                            <div className="text-xs md:text-sm font-medium text-gray-900 text-center">{classData.pupilCount}</div>
                            <div className="flex items-center justify-center gap-1 md:gap-2 mt-1 text-[10px] md:text-xs">
                              <span className="text-green-600" title="Fully Paid">✓{classData.paidPupils}</span>
                              <span className="text-yellow-600" title="Partially Paid">◐{classData.partiallyPaidPupils}</span>
                              <span className="text-red-600" title="Not Paid">✗{classData.unpaidPupils}</span>
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
                          <td className="px-2 md:px-6 py-3 md:py-4">
                            <div className="flex flex-col items-center">
                              <div className="w-16 md:w-24 h-1.5 md:h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                                <div 
                                  className={`h-1.5 md:h-2 rounded-full ${
                                    classData.collectionRate >= 80 ? 'bg-green-500' :
                                    classData.collectionRate >= 60 ? 'bg-blue-500' :
                                    classData.collectionRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${classData.collectionRate}%` }}
                                />
                              </div>
                              <span className="text-[10px] md:text-xs font-medium text-gray-600">{classData.collectionRate.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded pupil details */}
                        {isExpanded && (
                          <tr className="bg-blue-50">
                            <td colSpan={6} className="px-2 md:px-6 py-3 md:py-4">
                              <div className="space-y-2">
                                <h5 className="text-sm md:text-base font-semibold text-gray-900 mb-2 md:mb-3">Pupils in {classData.className}</h5>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs md:text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-[10px] md:text-xs font-medium text-gray-600">Name</th>
                                        <th className="px-2 md:px-3 py-1.5 md:py-2 text-right text-[10px] md:text-xs font-medium text-gray-600">Expected</th>
                                        <th className="px-2 md:px-3 py-1.5 md:py-2 text-right text-[10px] md:text-xs font-medium text-gray-600">Paid</th>
                                        <th className="px-2 md:px-3 py-1.5 md:py-2 text-right text-[10px] md:text-xs font-medium text-gray-600">Balance</th>
                                        <th className="px-2 md:px-3 py-1.5 md:py-2 text-center text-[10px] md:text-xs font-medium text-gray-600">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {classPupils.map(pupil => {
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
                                                  className="text-xs md:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
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
                                              <tr className="bg-green-50">
                                                <td colSpan={5} className="px-2 md:px-3 py-2">
                                                  <div className="text-xs">
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
                                                                <div className="border-t border-gray-200 p-2 bg-gray-50 space-y-1">
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
                    <td className="px-2 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-900">Total</td>
                    <td className="px-2 md:px-6 py-3 md:py-4 text-center text-xs md:text-sm text-gray-900">{stats.totalPupils}</td>
                    <td className="px-2 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm text-gray-900">{formatCurrency(stats.totalExpected)}</td>
                    <td className="px-2 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm text-green-600">{formatCurrency(stats.totalCollected)}</td>
                    <td className="px-2 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm text-red-600">{formatCurrency(stats.outstanding)}</td>
                    <td className="px-2 md:px-6 py-3 md:py-4 text-center text-xs md:text-sm text-gray-900">{stats.collectionRate.toFixed(1)}%</td>
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

