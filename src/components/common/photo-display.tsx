"use client";

import React from 'react';
import { usePrimaryPhoto, useRandomPhotos, usePhotosByUsage } from '@/lib/hooks/use-photos';
import type { PhotoCategory, PhotoUsage } from '@/types';
import { cn } from '@/lib/utils';
import { sanitizePhotoUrl } from '@/lib/utils/photo-url-helper';

interface PhotoDisplayProps {
  category?: PhotoCategory;
  usage?: PhotoUsage;
  mode?: 'primary' | 'random' | 'all';
  count?: number;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  fallbackSrc?: string;
  alt?: string;
  children?: React.ReactNode;
}

export function PhotoDisplay({
  category,
  usage,
  mode = 'primary',
  count = 1,
  className,
  aspectRatio = 'auto',
  fallbackSrc,
  alt = 'School photo',
  children
}: PhotoDisplayProps) {
  // Always call all hooks to maintain consistent hook order
  const primaryQuery = usePrimaryPhoto(category || 'other');
  const randomQuery = useRandomPhotos(usage || 'general', count);
  const allQuery = usePhotosByUsage(usage || 'general');

  let photos: any[] = [];
  let isLoading = false;
  let error = null;

  // Determine which data to use based on props and availability
  if (mode === 'primary' && category && primaryQuery.data) {
    photos = [primaryQuery.data];
    isLoading = primaryQuery.isLoading;
    error = primaryQuery.error;
  } else if (mode === 'random' && usage) {
    photos = randomQuery.data || [];
    isLoading = randomQuery.isLoading;
    error = randomQuery.error;
  } else if (mode === 'all' && usage) {
    photos = (allQuery.data || []).slice(0, count);
    isLoading = allQuery.isLoading;
    error = allQuery.error;
  } else {
    // Fallback to empty state
    photos = [];
    isLoading = false;
    error = null;
  }

  // Check if error is a Firestore index error
  const isIndexError = error && 
    (error.message?.includes('index') || 
     error.message?.includes('composite') ||
     (error as any).code === 'failed-precondition');

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square':
        return 'aspect-square';
      case 'video':
        return 'aspect-video';
      case 'portrait':
        return 'aspect-[3/4]';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className={cn(
        'bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg',
        getAspectRatioClass(),
        className
      )}>
        {children}
      </div>
    );
  }

  if (error || photos.length === 0) {
    // For index errors, show a more subtle fallback
    if (isIndexError) {
      return (
        <div className={cn(
          'bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center relative overflow-hidden',
          getAspectRatioClass(),
          className
        )}>
          {fallbackSrc ? (
            <img
              src={fallbackSrc}
              alt={alt}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
          )}
          {children}
        </div>
      );
    }
    
    return (
      <div className={cn(
        'bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center relative overflow-hidden',
        getAspectRatioClass(),
        className
      )}>
        {fallbackSrc ? (
          <img
            src={fallbackSrc}
            alt={alt}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 text-center p-4">
            <svg
              className="w-12 h-12 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">No photo available</p>
          </div>
        )}
        {children}
      </div>
    );
  }

  if (count === 1) {
    const photo = photos[0];
    return (
      <div className={cn(
        'relative overflow-hidden rounded-lg',
        getAspectRatioClass(),
        className
      )}>
        <img
          src={sanitizePhotoUrl(photo.url)}
          alt={photo.title || alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            console.error('Error loading photo:', photo.title, photo.url);
            e.currentTarget.style.display = 'none';
          }}
        />
        {children}
      </div>
    );
  }

  // Multiple photos - create a grid or carousel
  return (
    <div className={cn('grid gap-2', className)}>
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className={cn(
            'relative overflow-hidden rounded-lg',
            getAspectRatioClass()
          )}
        >
          <img
            src={sanitizePhotoUrl(photo.url)}
            alt={photo.title || `${alt} ${index + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('Error loading photo:', photo.title, photo.url);
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ))}
      {children}
    </div>
  );
}

// Specialized components for common use cases
export function BackgroundPhoto({
  category,
  usage = 'background',
  className,
  children,
  overlay = true
}: {
  category?: PhotoCategory;
  usage?: PhotoUsage;
  className?: string;
  children?: React.ReactNode;
  overlay?: boolean;
}) {
  return (
    <PhotoDisplay
      category={category}
      usage={usage}
      mode={category ? 'primary' : 'random'}
      className={cn('relative', className)}
    >
      {overlay && (
        <div className="absolute inset-0 bg-black/20" />
      )}
      {children}
    </PhotoDisplay>
  );
}

export function BannerPhoto({
  category,
  usage = 'banner',
  className,
  children
}: {
  category?: PhotoCategory;
  usage?: PhotoUsage;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <PhotoDisplay
      category={category}
      usage={usage}
      mode={category ? 'primary' : 'random'}
      aspectRatio="video"
      className={cn('w-full', className)}
    >
      {children}
    </PhotoDisplay>
  );
}

export function GalleryPhotos({
  category,
  usage = 'gallery',
  count = 6,
  className
}: {
  category?: PhotoCategory;
  usage?: PhotoUsage;
  count?: number;
  className?: string;
}) {
  return (
    <PhotoDisplay
      category={category}
      usage={usage}
      mode="all"
      count={count}
      aspectRatio="square"
      className={cn('grid-cols-2 md:grid-cols-3', className)}
    />
  );
} 