"use client";

import React, { useEffect, useState } from 'react';
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
  slow?: boolean;
  timedOut?: boolean;
  onRetry?: () => void;
}

export function LoadingOverlay({ 
  isLoading, 
  message = 'Loading page...',
  destination,
  slow = false,
  timedOut = false,
  onRetry,
}: LoadingOverlayProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!isLoading) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, [isLoading]);
  if (!isLoading || !visible) return null;

  return (
    <div className="sticky top-14 sm:top-[60px] z-10 h-0 flex items-start justify-center pointer-events-none print:hidden" data-navigation-loading>
      <div role="status" aria-live="polite" aria-atomic="true" className="bg-card text-card-foreground border rounded-xl p-5 sm:p-6 shadow-lg flex flex-col items-center gap-4 w-full max-w-md mx-2 pointer-events-auto">
        {/* Animated loading icon */}
        <div className="relative">
          <div aria-hidden="true" className="h-12 w-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin motion-reduce:animate-none dark:border-brand-800/60" />
        </div>
        
        {/* Main message */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {destination ? `Opening ${destination}…` : message}
          </h3>
          {destination && (
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Getting the next page ready
            </p>
          )}
        </div>
        
        {/* Informative text */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timedOut ? 'The page has not finished opening.' : slow ? 'This is taking longer than usual.' : 'Your next page is being prepared.'}</span>
          </div>
          <div className="text-xs text-muted-foreground/70 max-w-sm space-y-1">
            <p>Records and live updates load on the page once it opens.</p>
          </div>
        </div>

        {timedOut && onRetry && <button type="button" onClick={onRetry}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Retry opening page
        </button>}
        
        {/* Progress dots */}
        <div className="flex space-x-1">
          <div className="h-2 w-2 bg-brand-surface-500 rounded-full animate-pulse motion-reduce:animate-none" />
          <div className="h-2 w-2 bg-brand-secondary-surface-500 rounded-full animate-pulse motion-reduce:animate-none" style={{ animationDelay: '0.2s' }} />
          <div className="h-2 w-2 bg-pink-500 rounded-full animate-pulse motion-reduce:animate-none" style={{ animationDelay: '0.4s' }} />
        </div>
        
        {/* Additional reassurance */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground/60">
            You can still use the top bar and menu to choose another page.
          </p>
        </div>
      </div>
    </div>
  );
}
