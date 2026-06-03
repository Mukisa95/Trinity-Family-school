'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
}

/**
 * Pull-to-Refresh Component for Android App
 * 
 * Features:
 * - Pull down beyond scroll limit to reveal refresh button
 * - Beautiful modern UI with animation
 * - Manual refresh (requires button click)
 * - Only works in Capacitor Android app
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const PULL_THRESHOLD = 120; // Distance to pull before showing button
  const MAX_PULL = 180; // Maximum pull distance

  // Only enable on Capacitor Android
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) return;

    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    let currentY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only activate if at top of scroll
      const scrollTop = container.scrollTop || window.scrollY || document.documentElement.scrollTop;
      
      if (scrollTop <= 0 && !isRefreshing) {
        startY = e.touches[0].clientY;
        touchStartY.current = startY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      currentY = e.touches[0].clientY;
      const distance = currentY - startY;

      // Only pull down (positive distance)
      if (distance > 0) {
        // Prevent default scrolling when pulling
        e.preventDefault();
        
        // Apply rubber band effect (diminishing returns)
        const rubberBandDistance = Math.min(
          distance * 0.5, // 50% resistance
          MAX_PULL
        );
        
        setPullDistance(rubberBandDistance);

        // Show button when threshold reached
        if (rubberBandDistance >= PULL_THRESHOLD) {
          setShowButton(true);
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling) return;

      isPulling = false;

      // Animate back to 0
      setPullDistance(0);
    };

    // Attach listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isNative, isRefreshing]);

  const handleRefreshClick = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      // Hide button and reset
      setTimeout(() => {
        setShowButton(false);
        setIsRefreshing(false);
        setPullDistance(0);
      }, 500);
    }
  };

  const handleDismiss = () => {
    setShowButton(false);
    setPullDistance(0);
  };

  // Don't render pull-to-refresh on web
  if (!isNative) {
    return <>{children}</>;
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-auto"
      style={{
        touchAction: 'pan-y',
      }}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center"
        style={{
          transform: `translateY(${pullDistance - PULL_THRESHOLD}px)`,
          transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'none',
          opacity: pullDistance / PULL_THRESHOLD,
          pointerEvents: showButton ? 'auto' : 'none',
        }}
      >
        {/* Modern refresh button card */}
        <div className="mx-4 mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 min-w-[280px]">
          <div className="flex items-center gap-3">
            {/* Animated refresh icon */}
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            >
              <RefreshCw className="w-6 h-6 text-white" />
            </div>

            {/* Text */}
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {isRefreshing ? 'Refreshing...' : 'Pull to Refresh'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isRefreshing ? 'Updating data' : 'Tap to refresh all data'}
              </p>
            </div>

            {/* Buttons */}
            {!isRefreshing && showButton && (
              <div className="flex gap-2">
                <button
                  onClick={handleRefreshClick}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="w-full h-full">
        {children}
      </div>
    </div>
  );
}

