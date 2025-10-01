"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { DigitalSignatureDisplay } from './digital-signature-display';
import { useRecordSignatures } from '@/lib/hooks/use-digital-signature';
import { Loader2, FileCheck, Package, CreditCard } from 'lucide-react';
import type { AuditTrailEntry } from '@/types/digital-signature';

interface RequirementSignatureDisplayProps {
  recordId: string;
  className?: string;
  showActions?: ('created' | 'updated' | 'payment' | 'collection')[];
}

export function RequirementSignatureDisplay({ 
  recordId, 
  className = '',
  showActions = ['created', 'updated']
}: RequirementSignatureDisplayProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('requirement_collection', recordId);

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }

  if (error) {
    return (
      <div className="text-xs text-red-500">
        Signature error
      </div>
    );
  }

  if (!signatures || signatures.length === 0) {
    return null;
  }

  const getActionIcon = (action: string) => {
    if (action.includes('created')) return <FileCheck className="w-3 h-3" />;
    if (action.includes('payment') || action.includes('paid')) return <CreditCard className="w-3 h-3" />;
    if (action.includes('collect') || action.includes('received')) return <Package className="w-3 h-3" />;
    return null;
  };

  const getActionLabel = (action: string) => {
    if (action.includes('created')) return 'assigned by';
    if (action.includes('payment') || action.includes('paid')) return 'payment by';
    if (action.includes('collect') || action.includes('received')) return 'collected by';
    if (action.includes('updated')) return 'updated by';
    return 'processed by';
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {signatures
        .filter((sig: AuditTrailEntry) => showActions.some(action => sig.action.includes(action)))
        .map((signature: AuditTrailEntry) => (
          <div key={signature.id} className="flex items-center gap-2">
            {getActionIcon(signature.action)}
            <DigitalSignatureDisplay
              signature={signature.signature}
              action={getActionLabel(signature.action)}
              variant="inline"
              className="text-xs"
            />
          </div>
        ))}
    </div>
  );
}

interface RequirementCollectionSignatureProps {
  recordId: string;
  variant?: 'inline' | 'badge' | 'detailed';
  className?: string;
}

export function RequirementCollectionSignature({ 
  recordId, 
  variant = 'inline',
  className = ''
}: RequirementCollectionSignatureProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('requirement_collection', recordId);

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }

  if (error) {
    return (
      <div className="text-xs text-red-500">
        Signature error
      </div>
    );
  }

  const latestSignature = signatures?.[0];
  
  if (!latestSignature) {
    return null;
  }

  return (
    <DigitalSignatureDisplay
      signature={latestSignature.signature}
      action="collected by"
      variant={variant}
      className={className}
    />
  );
} 