'use client';

import { ArrowLeft } from 'lucide-react';
import React from 'react';
import { useNavigation } from '@/lib/contexts/navigation-context';

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
  type = 'button',
  ...props
}: SmartBackButtonProps) {
  const { goBack } = useNavigation();

  const handleBack = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Call any user-provided onClick first
    if (onClick) {
      onClick(e);
      if (e.defaultPrevented) return;
    }
    
    e.preventDefault();
    
    goBack(fallbackHref);
  };

  // Default transparent/minimalist styling typical of standard back links
  const defaultClassName = "inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors";
  
  return (
    <button 
      onClick={handleBack} 
      type={type}
      aria-label={props['aria-label'] || label}
      title={props.title || label}
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
