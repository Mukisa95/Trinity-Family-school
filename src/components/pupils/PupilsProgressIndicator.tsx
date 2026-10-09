import React from 'react';
import { Loader2, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface PupilsProgressIndicatorProps {
  isProcessing: boolean;
  currentBatch: number;
  totalBatches: number;
  processedCount: number;
  totalCount: number;
  progressPercentage: number;
  error: string | null;
  onRetry: () => void;
}

export function PupilsProgressIndicator({
  isProcessing,
  currentBatch,
  totalBatches,
  processedCount,
  totalCount,
  progressPercentage,
  error,
  onRetry
}: PupilsProgressIndicatorProps) {
  if (!isProcessing && !error) return null;

  return (
    <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:border-blue-800/60 dark:from-blue-950/40 dark:to-indigo-950/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {error ? (
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-950/40">
                  <RefreshCw className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-950/40">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin dark:text-blue-400" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                  {error ? 'Loading Error' : 'Loading Pupils'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-300">
                  {error 
                    ? 'Failed to load pupils data'
                    : `Processing batch ${currentBatch} of ${totalBatches}`
                  }
                </p>
              </div>
            </div>
          </div>
          
          {error && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          )}
        </div>

        {!error && (
          <>
            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1 dark:text-slate-300">
                <span>Progress</span>
                <AnimatedCounter value={progressPercentage} suffix="%" />
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-600 dark:text-slate-300">Loaded:</span>
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  <AnimatedCounter value={processedCount} /> / <AnimatedCounter value={totalCount} />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-indigo-100 flex items-center justify-center dark:bg-indigo-950/40">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <AnimatedCounter value={currentBatch} />
                  </span>
                </div>
                <span className="text-gray-600 dark:text-slate-300">Batch:</span>
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  <AnimatedCounter value={currentBatch} /> of <AnimatedCounter value={totalBatches} />
                </span>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/40 dark:border-red-800/60">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 