"use client";

import React from 'react';
import { Loader2, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingIndicatorProps {
  isLoading: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function LoadingIndicator({ 
  isLoading, 
  className,
  size = 'md',
  text = 'Loading...'
}: LoadingIndicatorProps) {
  if (!isLoading) return null;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div className={cn(
      "flex items-center justify-center gap-2 text-muted-foreground",
      className
    )}>
      <Loader2 className={cn(
        "animate-spin",
        sizeClasses[size]
      )} />
      {text && (
        <span className="text-sm font-medium">{text}</span>
      )}
    </div>
  );
}

// Enhanced loading overlay component with better messaging
interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  destination?: string;
}

export function LoadingOverlay({ 
  isLoading, 
  message = 'Loading page...',
  destination
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-lg z-50 flex items-center justify-center">
      <div className="bg-card border rounded-xl p-8 shadow-2xl flex flex-col items-center gap-6 max-w-md mx-4">
        {/* Animated loading icon */}
        <div className="relative">
          <div className="h-16 w-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <div className="absolute inset-0 h-16 w-16 border-4 border-transparent border-t-purple-600 rounded-full animate-spin" style={{ animationDelay: '0.5s' }} />
        </div>
        
        {/* Main message */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {message}
          </h3>
          {destination && (
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Navigating to {destination}
            </p>
          )}
        </div>
        
        {/* Informative text */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Please wait while we prepare your content...</span>
          </div>
          <div className="text-xs text-muted-foreground/70 max-w-sm space-y-1">
            <div>✓ Loading page data</div>
            <div>✓ Checking permissions</div>
            <div>✓ Preparing interface</div>
            <div>⏳ Ensuring everything is ready...</div>
          </div>
        </div>
        
        {/* Progress dots */}
        <div className="flex space-x-1">
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
          <div className="h-2 w-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="h-2 w-2 bg-pink-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
        
        {/* Additional reassurance */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground/60">
            This ensures a smooth experience for you
          </p>
        </div>
      </div>
    </div>
  );
}
