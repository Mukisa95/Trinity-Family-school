"use client";

import React from 'react';
import { useRecordSignatures } from '@/lib/hooks/use-digital-signature';
import { CompactSignature, DetailedSignature } from '@/components/common/digital-signature-display';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Package, DollarSign, Edit3, Trash2 } from 'lucide-react';
import type { ProcurementPurchase, ProcurementItem } from '@/types';

interface ProcurementSignatureDisplayProps {
  purchase: ProcurementPurchase;
  variant?: 'compact' | 'detailed' | 'badge';
  showAllActions?: boolean;
  className?: string;
}

export function ProcurementSignatureDisplay({ 
  purchase, 
  variant = 'compact',
  showAllActions = false,
  className 
}: ProcurementSignatureDisplayProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('procurement', purchase.id);

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
    return (
      <div className="text-xs text-muted-foreground">
        No signature information available
      </div>
    );
  }

  // Get the creation signature (purchase_created)
  const creationSignature = signatures.find(sig => 
    sig.action === 'purchase_created'
  );

  // Get modification signatures
  const modificationSignatures = signatures.filter(sig => 
    sig.action === 'purchase_modified'
  );

  // Get deletion signature
  const deletionSignature = signatures.find(sig => 
    sig.action === 'purchase_deleted'
  );

  if (variant === 'badge') {
    return (
      <Badge variant="secondary" className={className}>
        <ShoppingCart className="w-3 h-3 mr-1" />
        {creationSignature ? 
          `Purchased by ${creationSignature.signature.userName}` : 
          'Purchase recorded'
        }
      </Badge>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`space-y-2 ${className}`}>
        {creationSignature && (
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-green-600" />
            <DetailedSignature
              signature={creationSignature.signature}
              action="Purchased"
              showFullDetails={true}
            />
          </div>
        )}
        
        {modificationSignatures.map((modSig, index) => (
          <div key={modSig.id} className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-blue-600" />
            <DetailedSignature
              signature={modSig.signature}
              action="Modified"
              showFullDetails={showAllActions}
            />
          </div>
        ))}
        
        {deletionSignature && (
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-600" />
            <DetailedSignature
              signature={deletionSignature.signature}
              action="Deleted"
              showFullDetails={true}
            />
          </div>
        )}
      </div>
    );
  }

  // Default compact variant
  if (creationSignature) {
    return (
      <CompactSignature
        signature={creationSignature.signature}
        action="Purchased"
        className={className}
      />
    );
  }

  return (
    <div className="text-xs text-muted-foreground">
      Purchase signature not found
    </div>
  );
}

interface ItemSignatureDisplayProps {
  item: ProcurementItem;
  variant?: 'compact' | 'detailed' | 'badge';
  className?: string;
}

export function ItemSignatureDisplay({ 
  item, 
  variant = 'compact',
  className 
}: ItemSignatureDisplayProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('procurement', item.id);

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
    return (
      <div className="text-xs text-muted-foreground">
        No signature information available
      </div>
    );
  }

  // Get the creation signature (item_created)
  const creationSignature = signatures.find(sig => 
    sig.action === 'item_created'
  );

  // Get the latest modification signature
  const latestModification = signatures
    .filter(sig => sig.action === 'item_modified')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  if (variant === 'badge') {
    return (
      <Badge variant="outline" className={className}>
        <Package className="w-3 h-3 mr-1" />
        {creationSignature ? 
          `Created by ${creationSignature.signature.userName}` : 
          'Item created'
        }
      </Badge>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`space-y-2 ${className}`}>
        {creationSignature && (
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-green-600" />
            <DetailedSignature
              signature={creationSignature.signature}
              action="Created"
              showFullDetails={true}
            />
          </div>
        )}
        
        {latestModification && (
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-blue-600" />
            <DetailedSignature
              signature={latestModification.signature}
              action="Last Modified"
              showFullDetails={true}
            />
          </div>
        )}
      </div>
    );
  }

  // Default compact variant
  const displaySignature = latestModification || creationSignature;
  const action = latestModification ? 'Modified' : 'Created';

  if (displaySignature) {
    return (
      <CompactSignature
        signature={displaySignature.signature}
        action={action}
        className={className}
      />
    );
  }

  return (
    <div className="text-xs text-muted-foreground">
      Item signature not found
    </div>
  );
}

interface ProcurementAuditTrailProps {
  recordId: string;
  recordType: 'purchase' | 'item' | 'budget';
  className?: string;
}

export function ProcurementAuditTrail({ 
  recordId, 
  recordType,
  className 
}: ProcurementAuditTrailProps) {
  const { data: signatures, isLoading, error } = useRecordSignatures('procurement', recordId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        Signature error
      </div>
    );
  }

  if (!signatures || signatures.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No audit trail available for this {recordType}
      </div>
    );
  }

  // Sort signatures by timestamp (newest first)
  const sortedSignatures = signatures.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'purchase_created':
      case 'item_created':
      case 'budget_created':
        return <ShoppingCart className="w-4 h-4 text-green-600" />;
      case 'purchase_modified':
      case 'item_modified':
      case 'budget_modified':
        return <Edit3 className="w-4 h-4 text-blue-600" />;
      case 'purchase_deleted':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      default:
        return <Package className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'purchase_created':
        return 'Purchase Created';
      case 'purchase_modified':
        return 'Purchase Modified';
      case 'purchase_deleted':
        return 'Purchase Deleted';
      case 'item_created':
        return 'Item Created';
      case 'item_modified':
        return 'Item Modified';
      case 'budget_created':
        return 'Budget Created';
      case 'budget_modified':
        return 'Budget Modified';
      default:
        return action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-medium text-foreground">Audit Trail</h4>
      <div className="space-y-2">
        {sortedSignatures.map((auditEntry) => (
          <div key={auditEntry.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
            {getActionIcon(auditEntry.action)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {getActionLabel(auditEntry.action)}
                </span>
                <span className="text-muted-foreground">by</span>
                <span className="font-medium text-primary">
                  {auditEntry.signature.userName}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(auditEntry.signature.timestamp).toLocaleString()}
              </div>
              {auditEntry.metadata && Object.keys(auditEntry.metadata).length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {auditEntry.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}