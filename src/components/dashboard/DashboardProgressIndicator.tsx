import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface DashboardProgressIndicatorProps {
  isProcessing: boolean;
  currentStage: number;
  totalStages: number;
  progressPercentage: number;
  processedStages: string[];
  error: string | null;
  onRetry?: () => void;
  stageProgress: {
    pupils: boolean;
    staff: boolean;
    classes: boolean;
    subjects: boolean;
  };
}

export function DashboardProgressIndicator({
  isProcessing,
  currentStage,
  totalStages,
  progressPercentage,
  processedStages,
  error,
  onRetry,
  stageProgress
}: DashboardProgressIndicatorProps) {
  if (!isProcessing && !error && currentStage === totalStages) {
    return null; // Don't show when complete and no errors
  }

  const stageNames = [
    { key: 'classes', name: 'Classes', icon: '📚' },
    { key: 'subjects', name: 'Subjects', icon: '📖' },
    { key: 'staff', name: 'Staff', icon: '👥' },
    { key: 'pupils', name: 'Pupils', icon: '🎓' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-6"
    >
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              {error ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : isProcessing ? (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <span className="font-medium text-gray-900">
                {error ? 'Loading Error' : isProcessing ? 'Loading Dashboard Data...' : 'Dashboard Loaded'}
              </span>
            </div>
            
            {error && onRetry && (
              <Button
                onClick={onRetry}
                size="sm"
                variant="outline"
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
          </div>

          {error ? (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-200">
              {error}
            </div>
          ) : (
            <>
              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <AnimatedCounter value={progressPercentage} suffix="%" />
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {stageNames.map((stage, index) => {
                  const isCompleted = stageProgress[stage.key as keyof typeof stageProgress];
                  const isCurrent = currentStage === index + 1 && isProcessing;
                  
                  return (
                    <div
                      key={stage.key}
                      className={`
                        flex items-center space-x-2 p-2 rounded-md text-sm transition-colors
                        ${isCompleted 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : isCurrent 
                            ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }
                      `}
                    >
                      <span className="text-base">{stage.icon}</span>
                      <span className="font-medium">{stage.name}</span>
                      {isCompleted && (
                        <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />
                      )}
                      {isCurrent && (
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin ml-auto" />
                      )}
                    </div>
                  );
                })}
              </div>

              {processedStages.length > 0 && (
                <div className="mt-3 text-xs text-gray-500">
                  Current: {processedStages[processedStages.length - 1]}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
} 