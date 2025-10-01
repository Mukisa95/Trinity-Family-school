"use client";

import React from 'react';
import { useRecordSignatures } from '@/lib/hooks/use-digital-signature';
import { DigitalSignatureDisplay } from '@/components/common/digital-signature-display';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Loader2 } from 'lucide-react';
import type { Exam } from '@/types';

interface ExamSignatureDisplayProps {
  exam: Exam;
  variant?: 'inline' | 'badge' | 'detailed';
  className?: string;
}

export function ExamSignatureDisplay({ 
  exam, 
  variant = 'inline',
  className = '' 
}: ExamSignatureDisplayProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('exam_creation', exam.id);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
        <span className="text-xs text-gray-400">Loading signature...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-1 text-xs text-red-500 ${className}`}>
        <GraduationCap className="w-3 h-3" />
        <span>Signature error</span>
      </div>
    );
  }

  if (!signatures || signatures.length === 0) {
    return (
      <div className={`flex items-center gap-1 text-xs text-gray-500 ${className}`}>
        <GraduationCap className="w-3 h-3" />
        <span>No signature available</span>
      </div>
    );
  }

  // Get the creation signature
  const creationSignature = signatures.find(sig => 
    sig.action === 'created' || sig.action === 'exam_created'
  ) || signatures[0];

  if (!creationSignature) {
    return (
      <div className={`flex items-center gap-1 text-xs text-yellow-600 ${className}`}>
        <GraduationCap className="w-3 h-3" />
        <span>No creation signature found</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <GraduationCap className="w-3 h-3 text-blue-600" />
      <DigitalSignatureDisplay
        signature={creationSignature.signature}
        action="Created"
        variant={variant}
        className="text-xs"
      />
    </div>
  );
}

export default ExamSignatureDisplay; 