"use client"

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface LoadingAvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  className?: string;
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  borderColor?: string;
}

export function LoadingAvatar({
  src,
  alt = '',
  fallback = '',
  className,
  isLoading = false,
  size = 'md',
  borderColor
}: LoadingAvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  const borderStyle = borderColor ? { borderColor } : undefined;

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <Avatar 
        className={cn(
          sizeClasses[size],
          'border-2 transition-all duration-300',
          isLoading && 'animate-pulse',
          className
        )}
        style={borderStyle}
      >
        {src && src.trim() !== '' ? (
          <>
            <AvatarImage 
              src={src} 
              alt={alt}
              className={cn(
                'transition-opacity duration-500',
                isLoading ? 'opacity-30 animate-pulse' : 'opacity-100'
              )}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-full w-full rounded-full bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 animate-pulse opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-blue-400 animate-ping" />
                </div>
              </div>
            )}
          </>
        ) : null}
        <AvatarFallback 
          className={cn(
            'transition-all duration-300',
            isLoading 
              ? 'bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 animate-pulse text-gray-400' 
              : 'bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 text-gray-600'
          )}
        >
          {fallback || '?'}
        </AvatarFallback>
      </Avatar>
      {isLoading && (
        <div className="absolute -inset-1 rounded-full border-2 border-blue-400 border-dashed animate-spin opacity-50" 
             style={{ animationDuration: '2s' }} />
      )}
    </div>
  );
}
























