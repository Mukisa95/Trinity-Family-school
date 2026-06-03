'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import React from 'react';

export interface SmartBackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fallbackHref?: string;
  label?: string;
  iconClassName?: string;
}

export function SmartBackButton({ 
  fallbackHref = '/', 
  label = "Back",
  iconClassName = "w-4 h-4 mr-2",
  className,
  children,
  onClick,
  ...props
}: SmartBackButtonProps) {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Call any user-provided onClick first
    if (onClick) {
      onClick(e);
      if (e.defaultPrevented) return;
    }
    
    e.preventDefault();
    
    // Simple heuristic: if we have more than a couple of history entries, 
    // it's likely we navigated here within the SPA.
    // If not, we fall back to a sensible default route to prevent users from
    // getting stuck on a blank page or closing the app/tab entirely.
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  // Default transparent/minimalist styling typical of standard back links
  const defaultClassName = "inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors";
  
  return (
    <button 
      onClick={handleBack} 
      className={className || defaultClassName}
      {...props}
    >
      {children || (
        <>
          <ArrowLeft className={iconClassName} />
          {label}
        </>
      )}
    </button>
  );
}
