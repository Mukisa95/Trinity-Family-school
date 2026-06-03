"use client";

import React from 'react';
import { useRecordSignatures } from '@/lib/hooks/use-digital-signature';
import { DigitalSignatureDisplay } from '@/components/common/digital-signature-display';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Loader2 } from 'lucide-react';

interface AttendanceSignatureDisplayProps {
  recordId: string;
  date: string;
  variant?: 'inline' | 'badge' | 'detailed';
  className?: string;
}

export function AttendanceSignatureDisplay({ 
  recordId, 
  date,
  variant = 'inline',
  className = '' 
}: AttendanceSignatureDisplayProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('attendance_record', recordId);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-1 text-xs text-red-500 ${className}`}>
        <Clock className="h-3 w-3" />
        <span>Signature error</span>
      </div>
    );
  }

  if (!signatures || signatures.length === 0) {
    return (
      <div className={`flex items-center gap-1 text-xs text-gray-400 ${className}`}>
        <Clock className="h-3 w-3" />
        <span>No signature recorded</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <DigitalSignatureDisplay 
        signature={signatures[0].signature} 
        variant={variant}
        action="Recorded"
        className="text-xs text-gray-500"
      />
    </div>
  );
} 