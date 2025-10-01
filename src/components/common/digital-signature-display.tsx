"use client";

import React from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, User, Clock, Info } from 'lucide-react';
import type { DigitalSignature } from '@/types/digital-signature';
import { cn } from '@/lib/utils';

interface DigitalSignatureDisplayProps {
  signature: DigitalSignature;
  action: string;
  showFullDetails?: boolean;
  className?: string;
  variant?: 'inline' | 'badge' | 'detailed';
}

export function DigitalSignatureDisplay({
  signature,
  action,
  showFullDetails = false,
  className,
  variant = 'inline'
}: DigitalSignatureDisplayProps) {
  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
    } catch {
      return timestamp;
    }
  };

  const getActionColor = (userRole: string) => {
    switch (userRole.toLowerCase()) {
      case 'admin':
        return 'text-red-600 bg-red-50';
      case 'staff':
        return 'text-blue-600 bg-blue-50';
      case 'parent':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn("cursor-help", getActionColor(signature.userRole), className)}
            >
              <Shield className="w-3 h-3 mr-1" />
              {action} by {signature.userName}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-medium">{signature.userName} ({signature.userRole})</div>
              <div>{formatTimestamp(signature.timestamp)}</div>
              {signature.sessionId && (
                <div className="text-muted-foreground">Session: {signature.sessionId.slice(-8)}</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={cn("border rounded-lg p-3 bg-muted/20", className)}>
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-full bg-primary/10">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">{action}</div>
              <Badge variant="outline" className={getActionColor(signature.userRole)}>
                {signature.userRole}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{signature.userName}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatTimestamp(signature.timestamp)}</span>
              </div>
            </div>

            {showFullDetails && (
              <div className="mt-2 pt-2 border-t space-y-1 text-xs text-muted-foreground">
                {signature.ipAddress && signature.ipAddress !== 'client-side' && (
                  <div>IP: {signature.ipAddress}</div>
                )}
                {signature.sessionId && (
                  <div>Session: {signature.sessionId}</div>
                )}
                {signature.userAgent && (
                  <div className="truncate">User Agent: {signature.userAgent}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default inline variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-help hover:text-foreground transition-colors",
            className
          )}>
            <Shield className="w-3 h-3" />
            <span className="font-medium">{action} by {signature.userName}</span>
            <span>•</span>
            <span>{formatTimestamp(signature.timestamp)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-medium flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Digital Signature
            </div>
            <div><strong>User:</strong> {signature.userName} ({signature.userRole})</div>
            <div><strong>Action:</strong> {action}</div>
            <div><strong>Time:</strong> {formatTimestamp(signature.timestamp)}</div>
            {signature.sessionId && (
              <div><strong>Session:</strong> {signature.sessionId.slice(-8)}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact version for tables and lists
export function CompactSignature({ 
  signature, 
  action, 
  className 
}: Pick<DigitalSignatureDisplayProps, 'signature' | 'action' | 'className'>) {
  return (
    <DigitalSignatureDisplay
      signature={signature}
      action={action}
      variant="badge"
      className={className}
    />
  );
}

// Detailed version for forms and detailed views
export function DetailedSignature({ 
  signature, 
  action, 
  showFullDetails = true,
  className 
}: Pick<DigitalSignatureDisplayProps, 'signature' | 'action' | 'showFullDetails' | 'className'>) {
  return (
    <DigitalSignatureDisplay
      signature={signature}
      action={action}
      variant="detailed"
      showFullDetails={showFullDetails}
      className={className}
    />
  );
} 