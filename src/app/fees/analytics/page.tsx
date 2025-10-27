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
import { ClassBreakdownTable } from '@/components/analytics/class-breakdown-table';
import { useCollectionAnalytics } from '@/lib/hooks/use-collection-analytics';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  // Auto-select first term if not manually selected
  const autoTermId = useMemo(() => {
    if (manualTermId) return manualTermId;
    if (selectedYear?.currentTermId) return selectedYear.currentTermId;
    if (selectedYear?.terms && selectedYear.terms.length > 0) {
      return selectedYear.terms[0].id;
    }
    return '';
  }, [selectedYear, manualTermId]);

  const {
    analytics,
    isLoading,
    isFetching,
    error,
    refetch,
    activeYear,
    termDates
  } = useCollectionAnalytics({
    academicYearId: selectedYear?.id,
    termId: autoTermId
  });

  // Debug logging
  console.log('🔍 ANALYTICS PAGE: State', {
    hasAnalytics: !!analytics,
    isLoading,
    isFetching,
    hasError: !!error,
    error: error?.message,
    activeYear: activeYear?.year,
    termDates
  });

  console.log('🔍 ANALYTICS PAGE: Selected year details', {
    allYears: allYears.length,
    yearsLoading,
    selectedYear: selectedYear?.year,
    selectedYearId: selectedYear?.id,
    autoTermId,
    manualYearId,
    manualTermId
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

  const getTimePeriodData = () => {
    if (!analytics) return null;
    return analytics.timeBased[selectedPeriod];
  };

  const timePeriodData = getTimePeriodData();

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-900 mb-2">Failed to Load Analytics</h2>
            <p className="text-red-600 mb-4">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <Button onClick={() => refetch()} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Collection Analytics...</h2>
            <p className="text-gray-600">
              Fetching data and calculating statistics. This may take a few seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show no data state
  if (!analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-yellow-900 mb-2">No Analytics Data Available</h2>
            <p className="text-yellow-600 mb-4">
              Please ensure you have an active academic year and term configured.
            </p>
            <Button onClick={() => refetch()} variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-50">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
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
                  onClick={() => refetch()}
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Overall Collection Progress</h3>
                  <p className="text-sm text-gray-600">
                    {formatCurrency(analytics.overview.totalCollected)} of {formatCurrency(analytics.overview.totalExpected)} collected
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

        {/* Time-Based Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-indigo-900">
                    <Calendar className="w-5 h-5" />
                    Collection Period Analysis
                  </CardTitle>
                  <p className="text-sm text-indigo-600 mt-1">Track collections by time period</p>
                </div>

                <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="thisWeek">This Week</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="thisTerm">This Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {timePeriodData ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      <h4 className="text-sm font-medium text-gray-600">Total Collected</h4>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatCurrency(timePeriodData.totalCollected)}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-green-600" />
                      <h4 className="text-sm font-medium text-gray-600">Payment Count</h4>
                    </div>
                    <p className="text-2xl font-bold text-green-900">
                      {timePeriodData.paymentCount}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                      <h4 className="text-sm font-medium text-gray-600">Average Payment</h4>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">
                      {formatShortCurrency(timePeriodData.averagePayment)}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-orange-600" />
                      <h4 className="text-sm font-medium text-gray-600">Unique Payers</h4>
                    </div>
                    <p className="text-2xl font-bold text-orange-900">
                      {timePeriodData.uniquePayers}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Loading time-based data...
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Class Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <ClassBreakdownTable 
            data={analytics?.byClass || []}
            isLoading={isLoading}
          />
        </motion.div>

        {/* Payment Methods (if available) */}
        {analytics && analytics.paymentMethods.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                <CardTitle className="text-green-900">Payment Methods Breakdown</CardTitle>
                <p className="text-sm text-green-600 mt-1">How fees are being paid</p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analytics.paymentMethods.map((method) => (
                    <div key={method.method} className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-2">{method.method}</h4>
                      <p className="text-xl font-bold text-gray-900 mb-1">
                        {formatCurrency(method.amount)}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{method.count} payments</span>
                        <span className="text-indigo-600 font-medium">{method.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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

