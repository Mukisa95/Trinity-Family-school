"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { DigitalSignatureDisplay } from './digital-signature-display';
import { useRecordSignatures } from '@/lib/hooks/use-digital-signature';
import { Loader2, FileCheck, Package, CreditCard, Shirt } from 'lucide-react';
import type { AuditTrailEntry } from '@/types/digital-signature';

interface UniformSignatureDisplayProps {
  recordId: string;
  className?: string;
  showActions?: ('created' | 'updated' | 'payment' | 'collection')[];
}

export function UniformSignatureDisplay({ 
  recordId, 
  className = '',
  showActions = ['created', 'updated', 'payment', 'collection']
}: UniformSignatureDisplayProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('uniform_payment', recordId);

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
    if (action.includes('created')) return <Shirt className="w-3 h-3" />;
    if (action.includes('payment') || action.includes('paid')) return <CreditCard className="w-3 h-3" />;
    if (action.includes('collect') || action.includes('received')) return <Package className="w-3 h-3" />;
    return <FileCheck className="w-3 h-3" />;
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

interface UniformPaymentSignatureProps {
  recordId: string;
  variant?: 'inline' | 'badge' | 'detailed';
  className?: string;
}

export function UniformPaymentSignature({ 
  recordId, 
  variant = 'inline',
  className = ''
}: UniformPaymentSignatureProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('uniform_payment', recordId);

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

  const paymentSignature = signatures?.find(sig => 
    sig.action.includes('payment') || sig.action.includes('paid')
  );
  
  if (!paymentSignature) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <CreditCard className="w-3 h-3 text-green-600" />
      <DigitalSignatureDisplay
        signature={paymentSignature.signature}
        action="paid by"
        variant={variant}
        className="text-xs"
      />
    </div>
  );
}

interface UniformCollectionSignatureProps {
  recordId: string;
  variant?: 'inline' | 'badge' | 'detailed';
  className?: string;
}

export function UniformCollectionSignature({ 
  recordId, 
  variant = 'inline',
  className = ''
}: UniformCollectionSignatureProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('uniform_payment', recordId);

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

  const collectionSignature = signatures?.find(sig => 
    sig.action.includes('collect') || sig.action.includes('received')
  );
  
  if (!collectionSignature) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Package className="w-3 h-3 text-blue-600" />
      <DigitalSignatureDisplay
        signature={collectionSignature.signature}
        action="collected by"
        variant={variant}
        className="text-xs"
      />
    </div>
  );
} 