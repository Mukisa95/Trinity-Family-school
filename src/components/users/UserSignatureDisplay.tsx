"use client";

import React from 'react';
import { useRecordSignatures } from '@/lib/hooks/use-digital-signature';
import { DigitalSignatureDisplay } from '@/components/common/digital-signature-display';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Loader2 } from 'lucide-react';
import type { SystemUser } from '@/types';

interface UserSignatureDisplayProps {
  user: SystemUser;
  variant?: 'inline' | 'badge' | 'detailed';
  className?: string;
}

export function UserSignatureDisplay({ 
  user, 
  variant = 'inline',
  className = '' 
}: UserSignatureDisplayProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('user_creation', user.id);

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
        <UserPlus className="h-3 w-3" />
        <span>Signature error</span>
      </div>
    );
  }

  if (!signatures || signatures.length === 0) {
    return (
      <div className={`flex items-center gap-1 text-xs text-gray-400 ${className}`}>
        <UserPlus className="h-3 w-3" />
        <span>No signature recorded</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <DigitalSignatureDisplay 
        signature={signatures[0].signature} 
        variant={variant}
        action="Created"
        className="text-xs text-gray-500"
      />
    </div>
  );
} 