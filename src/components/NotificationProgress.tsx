'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, Users } from 'lucide-react';

interface NotificationProgressProps {
  notificationId: string;
  totalRecipients: number;
  onComplete?: () => void;
}

interface ProgressStatus {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  stats: {
    total: number;
    sent: number;
    failed: number;
    remaining: number;
  };
  processingTime?: number;
}

export function NotificationProgress({ 
  notificationId, 
  totalRecipients, 
  onComplete 
}: NotificationProgressProps) {
  const [status, setStatus] = useState<ProgressStatus>({
    id: notificationId,
    status: 'processing',
    progress: 0,
    stats: {
      total: totalRecipients,
      sent: 0,
      failed: 0,
      remaining: totalRecipients
    }
  });

  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (status.status === 'completed' || status.status === 'failed') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 5000); // Auto-hide after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [status.status, onComplete]);

  useEffect(() => {
    // Poll for status updates
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/notifications/send-batch?id=${notificationId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.status) {
            setStatus(data.status);
          }
        }
      } catch (error) {
        console.error('Error polling notification status:', error);
      }
    };

    // Poll every 2 seconds while processing
    const interval = setInterval(pollStatus, 2000);
    
    // Initial poll
    pollStatus();

    return () => clearInterval(interval);
  }, [notificationId]);

  if (!isVisible) return null;

  const getStatusIcon = () => {
    switch (status.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Processing';
    }
  };

  return (
    <Card className={`mb-4 transition-all duration-300 ${getStatusColor()}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {getStatusIcon()}
          <span>Notification Progress</span>
          <Badge variant="outline" className="ml-auto">
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{status.progress}%</span>
            </div>
            <Progress value={status.progress} className="h-2" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span>Total: {status.stats.total}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Sent: {status.stats.sent}</span>
            </div>
            {status.stats.failed > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span>Failed: {status.stats.failed}</span>
              </div>
            )}
            {status.stats.remaining > 0 && status.status === 'processing' && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>Remaining: {status.stats.remaining}</span>
              </div>
            )}
          </div>

          {/* Processing Time */}
          {status.processingTime && (
            <div className="text-xs text-gray-500">
              Processing time: {status.processingTime}ms
            </div>
          )}

          {/* Status Message */}
          {status.status === 'completed' && (
            <div className="text-sm text-green-600 font-medium">
              ✅ All notifications sent successfully!
            </div>
          )}
          
          {status.status === 'failed' && (
            <div className="text-sm text-red-600 font-medium">
              ❌ Some notifications failed to send
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
