import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Calculator, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface ProgressiveLoadingIndicatorProps {
  processedCount: number;
  totalCount: number;
  currentBatch: number;
  totalBatches: number;
  isProcessing: boolean;
  processingStatus: string;
  progressPercentage: number;
  error: string | null;
  totals: {
    totalFees: number;
    totalPaid: number;
    balance: number;
  };
  optimizationInfo?: {
    cacheHits: number;
    groupsCreated: number;
    speedupFactor: number;
    totalCalculationTime: number;
  };
  onRestart?: () => void;
}

export function ProgressiveLoadingIndicator({
  processedCount,
  totalCount,
  currentBatch,
  totalBatches,
  isProcessing,
  processingStatus,
  progressPercentage,
  error,
  totals,
  optimizationInfo,
  onRestart
}: ProgressiveLoadingIndicatorProps) {
  // Determine if the indicator should be visible
  const shouldShow = isProcessing || error || !(processedCount === totalCount && totalCount > 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', { 
      style: 'currency', 
      currency: 'UGX',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Get status color and icon
  const getStatusDisplay = () => {
    if (error) {
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: <AlertCircle className="h-5 w-5 text-red-600" />
      };
    }
    
    if (isProcessing) {
      return {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: <Calculator className="h-5 w-5 text-blue-600 animate-pulse" />
      };
    }
    
    if (processedCount === totalCount && totalCount > 0) {
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: <CheckCircle className="h-5 w-5 text-green-600" />
      };
    }
    
    return {
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      icon: <Users className="h-5 w-5 text-gray-600" />
    };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <AnimatePresence mode="wait">
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 'auto' }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ 
            opacity: 0, 
            y: -20, 
            height: 0,
            marginBottom: 0,
            transition: { 
              duration: 0.5, 
              ease: "easeInOut",
              height: { delay: 0.2, duration: 0.3 },
              marginBottom: { delay: 0.2, duration: 0.3 }
            }
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <Card className={`mb-6 ${statusDisplay.bgColor} ${statusDisplay.borderColor} border-2`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusDisplay.icon}
                  <span className={statusDisplay.color}>
                    {error ? 'Processing Failed' : 
                     isProcessing ? 'Processing Fees...' : 
                     processedCount === totalCount && totalCount > 0 ? 'Processing Complete' : 
                     'Ready to Process'}
                  </span>
                </div>
                
                {error && onRestart && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={onRestart}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              {totalCount > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Progress</span>
                    <span className={statusDisplay.color}>
                      <AnimatedCounter value={processedCount} /> of <AnimatedCounter value={totalCount} /> pupils (<AnimatedCounter value={progressPercentage} suffix="%" />)
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
              )}

              {/* Batch Information */}
              {isProcessing && totalBatches > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Current Batch:</span>
                  <Badge variant="outline" className="text-blue-600 border-blue-300">
                    <AnimatedCounter value={currentBatch} /> of <AnimatedCounter value={totalBatches} />
                  </Badge>
                </div>
              )}

              {/* Status Message */}
              <div className="text-sm">
                <span className="font-medium text-gray-700">Status: </span>
                <span className={error ? 'text-red-600' : 'text-gray-600'}>
                  {error || processingStatus}
                </span>
              </div>

              {/* Real-time Totals */}
              {processedCount > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <DollarSign className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm font-medium text-indigo-600">Total Fees</span>
                    </div>
                    <p className="text-lg font-bold text-indigo-900">
                      {formatCurrency(totals.totalFees)}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">Total Paid</span>
                    </div>
                    <p className="text-lg font-bold text-green-900">
                      {formatCurrency(totals.totalPaid)}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TrendingUp className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-600">Balance</span>
                    </div>
                    <p className="text-lg font-bold text-red-900">
                      {formatCurrency(totals.balance)}
                    </p>
                  </div>
                </div>
              )}

              {/* Optimization Metrics */}
              {optimizationInfo && (
                <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-3 w-3 text-emerald-600" />
                    </div>
                    <h4 className="font-semibold text-emerald-800">⚡ Optimization Performance</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-lg font-bold text-emerald-700">
                        {optimizationInfo.speedupFactor.toFixed(1)}x
                      </div>
                      <div className="text-xs text-emerald-600">Faster</div>
                    </div>
                    
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-lg font-bold text-blue-700">
                        {optimizationInfo.cacheHits}
                      </div>
                      <div className="text-xs text-blue-600">Cache Hits</div>
                    </div>
                    
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-lg font-bold text-purple-700">
                        {optimizationInfo.groupsCreated}
                      </div>
                      <div className="text-xs text-purple-600">Groups</div>
                    </div>
                    
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-lg font-bold text-orange-700">
                        {optimizationInfo.totalCalculationTime.toFixed(0)}ms
                      </div>
                      <div className="text-xs text-orange-600">Total Time</div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-emerald-700 text-center">
                    🚀 Fees grouped by class/section for {((optimizationInfo.cacheHits / processedCount) * 100).toFixed(0)}% cache efficiency
                  </div>
                </div>
              )}

              {/* Processing Stats */}
              {(isProcessing || processedCount > 0) && (
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span>Processed pupils: {processedCount}</span>
                    {isProcessing && (
                      <span className="animate-pulse">⚡ Processing in real-time...</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 