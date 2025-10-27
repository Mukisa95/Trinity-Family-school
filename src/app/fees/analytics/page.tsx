"use client";

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  Users,
  Calendar,
  Download,
  RefreshCw,
  BarChart3,
  Clock
} from 'lucide-react';
import { StatCard } from '@/components/analytics/stat-card';
import { CollectionRateBar } from '@/components/analytics/collection-rate-bar';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useProgressiveFees } from '@/lib/hooks/use-progressive-fees';
import { usePupils } from '@/lib/hooks/use-pupils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ClassCollectionStats } from '@/lib/services/collection-analytics.service';

type TimePeriod = 'today' | 'thisWeek' | 'thisMonth' | 'thisTerm';

export default function CollectionAnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('today');
  
  // Get all academic years for manual selection
  const { data: allYears = [], isLoading: yearsLoading } = useAcademicYears();
  
  // Manual year/term selection (fallback if no active year)
  const [manualYearId, setManualYearId] = useState<string>('');
  const [manualTermId, setManualTermId] = useState<string>('');
  
  // Get selected year's terms
  const selectedYear = useMemo(() => {
    if (manualYearId) {
      return allYears.find(y => y.id === manualYearId);
    }
    // Find the year with isActive flag or the most recent one
    return allYears.find(y => y.isActive) || allYears[0];
  }, [allYears, manualYearId]);

  // Auto-select current term (not first term!)
  const autoTermId = useMemo(() => {
    if (manualTermId) {
      console.log('📅 Using manually selected term:', manualTermId);
      return manualTermId;
    }
    if (selectedYear?.currentTermId) {
      console.log('✅ Using CURRENT term from academic year:', selectedYear.currentTermId);
      return selectedYear.currentTermId; // ← Use CURRENT term!
    }
    // Fallback to last term (most recent) instead of first
    if (selectedYear?.terms && selectedYear.terms.length > 0) {
      const lastTerm = selectedYear.terms[selectedYear.terms.length - 1].id;
      console.log('⚠️ No currentTermId, using last term:', lastTerm);
      return lastTerm;
    }
    return '';
  }, [selectedYear, manualTermId]);

  // 🚀 USE SAME LOGIC AS FEES COLLECTION PAGE
  // This ensures the numbers match exactly!
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  
  const progressiveFeesData = useProgressiveFees({
    pupils: allPupils,
    selectedYear,
    selectedTermId: autoTermId,
    allFeeStructures: [], // Will be loaded by the hook
    allAcademicYears: allYears
  });

  const {
    pupilFeesInfo,
    totals,
    isLoading: feesLoading,
    isProcessing,
    progressPercentage
  } = progressiveFeesData;

  // Calculate term dates
  const termDates = useMemo(() => {
    if (!selectedYear || !autoTermId) return null;
    const term = selectedYear.terms?.find(t => t.id === autoTermId);
    if (!term) return null;
    return {
      startDate: term.startDate instanceof Date ? term.startDate : new Date(term.startDate),
      endDate: term.endDate instanceof Date ? term.endDate : new Date(term.endDate)
    };
  }, [selectedYear, autoTermId]);

  const isLoading = yearsLoading || pupilsLoading || feesLoading;

  // Debug logging
  console.log('🔍 ANALYTICS PAGE: Using EXACT same calculation as Fees Collection', {
    pupils: allPupils.length,
    selectedYear: selectedYear?.year,
    selectedTerm: autoTermId,
    totals,
    pupilsProcessed: pupilFeesInfo.size,
    isProcessing,
    progressPercentage
  });

  // Show helpful message if no academic years exist
  if (!yearsLoading && allYears.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
            <Calendar className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-blue-900 mb-2">No Academic Years Found</h2>
            <p className="text-blue-600 mb-4">
              You need to create at least one academic year before viewing collection analytics.
            </p>
            <Button 
              onClick={() => window.location.href = '/academic-years'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Setup Academic Years
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show helpful message if year exists but missing term configuration
  if (!yearsLoading && selectedYear && !autoTermId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-yellow-900 mb-2 text-center">Academic Year Needs Configuration</h2>
            <p className="text-yellow-600 mb-6 text-center">
              Year <strong>{selectedYear.year}</strong> exists but is missing term information.
            </p>
            
            <div className="bg-white rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">What's Missing:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>❌ <strong>currentTermId</strong>: Not set</li>
                <li>❌ <strong>terms</strong> array: {selectedYear.terms?.length || 0} terms found (need at least 1)</li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-3">How to Fix:</h3>
              <ol className="list-decimal ml-5 space-y-2 text-sm text-blue-800">
                <li>Go to Firebase Console</li>
                <li>Open document ID: <code className="bg-blue-100 px-2 py-1 rounded">{selectedYear.id}</code></li>
                <li>Add field <strong>currentTermId</strong> (string): e.g., "t3-2025"</li>
                <li>Add field <strong>terms</strong> (array) with term objects containing:
                  <ul className="ml-5 mt-2 space-y-1">
                    <li>• id: "t1-2025"</li>
                    <li>• name: "Term 1"</li>
                    <li>• startDate: "2025-01-01"</li>
                    <li>• endDate: "2025-04-15"</li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="flex gap-3 justify-center">
              <Button 
                onClick={() => window.open('https://console.firebase.google.com/project/trinity-family-ganda/firestore/databases/-default-/data/~2FacademicYears~2F' + selectedYear.id, '_blank')}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                <Database className="w-4 h-4 mr-2" />
                Open in Firebase Console
              </Button>
              <Button 
                onClick={() => refetch()}
                variant="outline"
                className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh After Fixing
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `UGX ${amount.toLocaleString()}`;
  };

  const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `UGX ${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `UGX ${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  // Calculate analytics from progressive fees data
  const analytics = useMemo(() => {
    if (!totals) return null;

    // pupilFeesInfo is a Record (object), not a Map
    const pupilFeesArray = Object.values(pupilFeesInfo || {});
    
    if (pupilFeesArray.length === 0) return null;

    const paidPupils = pupilFeesArray.filter(p => p.balance <= 0).length;
    const unpaidPupils = pupilFeesArray.filter(p => p.totalPaid === 0).length;
    const partiallyPaidPupils = pupilFeesArray.filter(p => p.totalPaid > 0 && p.balance > 0).length;

    // Calculate class breakdown from pupilFeesInfo
    const classSummary = new Map<string, any>();
    
    Object.entries(pupilFeesInfo || {}).forEach(([pupilId, feesInfo]) => {
      const pupil = allPupils.find(p => p.id === pupilId);
      if (!pupil || !pupil.classId) return;

      if (!classSummary.has(pupil.classId)) {
        classSummary.set(pupil.classId, {
          classId: pupil.classId,
          className: pupil.className || 'Unknown',
          classCode: pupil.classCode || '',
          pupils: [],
          expectedAmount: 0,
          collectedAmount: 0,
          paidPupils: 0,
          unpaidPupils: 0,
          partiallyPaidPupils: 0
        });
      }

      const classData = classSummary.get(pupil.classId)!;
      classData.pupils.push(pupil);
      classData.expectedAmount += feesInfo.totalFees;
      classData.collectedAmount += feesInfo.totalPaid;

      if (feesInfo.balance <= 0) {
        classData.paidPupils++;
      } else if (feesInfo.totalPaid > 0) {
        classData.partiallyPaidPupils++;
      } else {
        classData.unpaidPupils++;
      }
    });

    const byClass: ClassCollectionStats[] = Array.from(classSummary.values()).map(c => ({
      classId: c.classId,
      className: c.className,
      classCode: c.classCode,
      pupilCount: c.pupils.length,
      expectedAmount: c.expectedAmount,
      collectedAmount: c.collectedAmount,
      outstandingAmount: c.expectedAmount - c.collectedAmount,
      collectionRate: c.expectedAmount > 0 ? (c.collectedAmount / c.expectedAmount) * 100 : 0,
      paidPupils: c.paidPupils,
      unpaidPupils: c.unpaidPupils,
      partiallyPaidPupils: c.partiallyPaidPupils
    })).sort((a, b) => a.className.localeCompare(b.className));

    console.log('📊 ANALYTICS: Calculated from progressive fees', {
      totalExpected: totals.totalFees,
      totalCollected: totals.totalPaid,
      outstanding: totals.balance,
      collectionRate: totals.totalFees > 0 ? (totals.totalPaid / totals.totalFees) * 100 : 0,
      totalPupils: pupilFeesArray.length,
      paidPupils,
      unpaidPupils,
      partiallyPaidPupils,
      classesWithData: byClass.length,
      byClassPreview: byClass.slice(0, 3)
    });

    return {
      overview: {
        totalExpected: totals.totalFees,
        totalCollected: totals.totalPaid,
        outstanding: totals.balance,
        collectionRate: totals.totalFees > 0 ? (totals.totalPaid / totals.totalFees) * 100 : 0,
        totalPupils: pupilFeesArray.length,
        paidPupils,
        unpaidPupils,
        partiallyPaidPupils
      },
      byClass: byClass
    };
  }, [totals, pupilFeesInfo, allPupils]);

  console.log('🔍 ANALYTICS RENDER:', {
    hasAnalytics: !!analytics,
    hasByClass: !!analytics?.byClass,
    byClassLength: analytics?.byClass?.length || 0
  });

  // Show loading state
  if (isLoading || isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Calculating Collection Analytics...</h2>
            <p className="text-gray-600 mb-4">
              Using the exact same calculation logic as Fees Collection page
            </p>
            {isProcessing && progressPercentage > 0 && (
              <div className="max-w-md mx-auto">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500">{progressPercentage.toFixed(0)}% complete</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
      {/* Header */}
      <div className="bg-white/80 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100 -mx-6 px-6 py-4 mb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-indigo-900 flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 text-indigo-600" />
                  Collection Analytics
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Comprehensive fee collection insights and trends
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                  disabled
                >
                  <Download className="w-4 h-4" />
                  Export Report
                </Button>
              </div>
            </div>

            {/* Year and Term Selectors */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Academic Year:</label>
                <Select 
                  value={selectedYear?.id || ''} 
                  onValueChange={setManualYearId}
                  disabled={yearsLoading}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {allYears.map(year => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedYear && selectedYear.terms && selectedYear.terms.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Term:</label>
                  <Select 
                    value={autoTermId} 
                    onValueChange={setManualTermId}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedYear.terms.map(term => (
                        <SelectItem key={term.id} value={term.id}>
                          Term {term.id.replace('t', '').replace('-2025', '').replace('-2024', '')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedYear && autoTermId && (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium">
                    📊 Analyzing: {selectedYear.year} • Term {autoTermId.replace('t', '').replace('-2025', '').replace('-2024', '')}
                  </div>
                  {termDates && (
                    <div className="text-xs text-gray-500">
                      ({termDates.startDate.toLocaleDateString()} - {termDates.endDate.toLocaleDateString()})
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Term Info Banner */}
        {selectedYear && autoTermId && termDates && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6" />
                <div>
                  <div className="font-bold text-lg">
                    {selectedYear.year} • Term {autoTermId.replace('t', '').replace('-2025', '').replace('-2024', '')}
                  </div>
                  <div className="text-sm text-indigo-100">
                    {termDates.startDate.toLocaleDateString()} - {termDates.endDate.toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-indigo-100">Showing data for</div>
                <div className="font-semibold">THIS TERM ONLY</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Expected"
            value={analytics ? formatShortCurrency(analytics.overview.totalExpected) : 'Loading...'}
            subtitle={analytics ? `From ${analytics.overview.totalPupils} pupils` : ''}
            icon={DollarSign}
            color="blue"
            isLoading={isLoading}
          />

          <StatCard
            title="Total Collected"
            value={analytics ? formatShortCurrency(analytics.overview.totalCollected) : 'Loading...'}
            subtitle={analytics ? `${analytics.overview.paidPupils} fully paid` : ''}
            icon={TrendingUp}
            color="green"
            isLoading={isLoading}
          />

          <StatCard
            title="Outstanding Fees"
            value={analytics ? formatShortCurrency(analytics.overview.outstanding) : 'Loading...'}
            subtitle={analytics ? `${analytics.overview.unpaidPupils} unpaid` : ''}
            icon={AlertCircle}
            color="red"
            isLoading={isLoading}
          />

          <StatCard
            title="Collection Rate"
            value={analytics ? `${analytics.overview.collectionRate.toFixed(1)}%` : 'Loading...'}
            subtitle={analytics ? `${analytics.overview.partiallyPaidPupils} partial` : ''}
            icon={Users}
            color="purple"
            isLoading={isLoading}
          />
        </div>

        {/* Collection Rate Visual */}
        {analytics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Overall Collection Progress (This Term)</h3>
                  <p className="text-sm text-gray-600">
                    {formatCurrency(analytics.overview.totalCollected)} of {formatCurrency(analytics.overview.totalExpected)} collected
                  </p>
                  <p className="text-xs text-indigo-600 mt-1">
                    ✅ Calculated using exact same logic as Fees Collection page
                  </p>
                </div>
                <CollectionRateBar 
                  rate={analytics.overview.collectionRate}
                  showPercentage={true}
                  height="lg"
                  animated={true}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Time-Based Daily Analysis */}
        {analytics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
                <CardTitle className="text-blue-900 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Collection Activity Summary
                </CardTitle>
                <p className="text-sm text-blue-600 mt-1">Quick overview of collection status</p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h4 className="text-sm font-medium text-gray-600">Fully Paid</h4>
                    </div>
                    <p className="text-2xl font-bold text-green-900">{analytics.overview.paidPupils}</p>
                    <p className="text-xs text-green-600 mt-1">pupils completed payment</p>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <h4 className="text-sm font-medium text-gray-600">Partially Paid</h4>
                    </div>
                    <p className="text-2xl font-bold text-yellow-900">{analytics.overview.partiallyPaidPupils}</p>
                    <p className="text-xs text-yellow-600 mt-1">pupils with partial payment</p>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <h4 className="text-sm font-medium text-gray-600">Not Paid</h4>
                    </div>
                    <p className="text-2xl font-bold text-red-900">{analytics.overview.unpaidPupils}</p>
                    <p className="text-xs text-red-600 mt-1">pupils not yet paid</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Class Breakdown Table */}
        {analytics && analytics.byClass && analytics.byClass.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-indigo-100">
                <h3 className="text-lg font-bold text-indigo-900">Collection by Class</h3>
                <p className="text-sm text-indigo-600 mt-1">Detailed breakdown per class for this term</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pupils</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expected</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Collected</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analytics.byClass.map((classData) => (
                      <tr key={classData.classId} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{classData.className}</div>
                          <div className="text-xs text-gray-500">{classData.classCode}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-sm font-medium text-gray-900">{classData.pupilCount}</div>
                          <div className="flex items-center justify-center gap-2 mt-1 text-xs">
                            <span className="text-green-600">✓{classData.paidPupils}</span>
                            <span className="text-yellow-600">◐{classData.partiallyPaidPupils}</span>
                            <span className="text-red-600">✗{classData.unpaidPupils}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-900">{formatCurrency(classData.expectedAmount)}</td>
                        <td className="px-6 py-4 text-right text-sm text-green-600 font-medium">{formatCurrency(classData.collectedAmount)}</td>
                        <td className="px-6 py-4 text-right text-sm text-red-600">{formatCurrency(classData.outstandingAmount)}</td>
                        <td className="px-6 py-4">
                          <div className="w-32">
                            <CollectionRateBar rate={classData.collectionRate} showPercentage={true} height="sm" animated={false} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer Info */}
        <div className="bg-white/80 rounded-xl p-4 text-center text-sm text-gray-600">
          <p>
            Data as of {new Date().toLocaleString()} • 
            {termDates && ` Term Period: ${termDates.startDate.toLocaleDateString()} - ${termDates.endDate.toLocaleDateString()}`}
          </p>
        </div>
      </div>
    </div>
  );
}

