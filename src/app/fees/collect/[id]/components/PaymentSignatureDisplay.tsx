"use client";

import React from 'react';
import { useRecordSignatures } from '@/lib/hooks/use-digital-signature';
import { CompactSignature } from '@/components/common/digital-signature-display';
import { Skeleton } from '@/components/ui/skeleton';
import type { PaymentRecord } from '@/types';

interface PaymentSignatureDisplayProps {
  payment: PaymentRecord;
  className?: string;
}

export function PaymentSignatureDisplay({ payment, className }: PaymentSignatureDisplayProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('fee_payment', payment.id);

  if (isLoading) {
    return <Skeleton className="h-6 w-32" />;
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

  // Get the most recent signature (payment collection)
  const latestSignature = signatures.find(sig => 
    sig.action === 'collected' || sig.action === 'payment_collected'
  ) || signatures[0];

  if (!latestSignature) {
    return null;
  }

  return (
    <CompactSignature
      signature={latestSignature.signature}
      action="Collected"
      className={className}
    />
  );
}

interface PaymentHistorySignaturesProps {
  payment: PaymentRecord;
  showAllActions?: boolean;
}

export function PaymentHistorySignatures({ 
  payment, 
  showAllActions = false 
}: PaymentHistorySignaturesProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('fee_payment', payment.id);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-500">
        Signature error
      </div>
    );
  }

  if (!signatures || signatures.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No signature information available
      </div>
    );
  }

  const displaySignatures = showAllActions ? signatures : signatures.slice(0, 1);

  return (
    <div className="space-y-1">
      {displaySignatures.map((auditEntry, index) => (
        <div key={auditEntry.id} className="text-xs">
          <CompactSignature
            signature={auditEntry.signature}
            action={auditEntry.action === 'collected' ? 'Collected' : 
                   auditEntry.action === 'reverted' ? 'Reverted' : 
                   auditEntry.action}
          />
        </div>
      ))}
      {signatures.length > 1 && !showAllActions && (
        <div className="text-xs text-muted-foreground">
          +{signatures.length - 1} more action{signatures.length > 2 ? 's' : ''}
        </div>
      )}
    </div>
  );
} 