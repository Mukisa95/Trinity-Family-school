"use client";

import { useState } from 'react';
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
  
  const {
    analytics,
    isLoading,
    isFetching,
    refetch,
    activeYear,
    termDates
  } = useCollectionAnalytics();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-6">
      {/* Header */}
      <div className="bg-white/80 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100 -mx-6 px-6 py-4 mb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-indigo-900 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-indigo-600" />
                Collection Analytics
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive fee collection insights and trends
                {activeYear && ` • ${activeYear.year} - Term ${activeYear.currentTermId?.replace('t', '').replace('-2025', '')}`}
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
              >
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
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

