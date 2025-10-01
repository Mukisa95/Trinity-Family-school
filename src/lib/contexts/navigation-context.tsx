"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface NavigationContextType {
  isNavigating: boolean;
  startNavigation: (destination?: string) => void;
  stopNavigation: () => void;
  currentPath: string;
  destination: string | null;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const pathname = usePathname();
  const previousPathname = useRef<string>('');
  const navigationTimeout = useRef<NodeJS.Timeout | null>(null);

  const startNavigation = useCallback((dest?: string) => {
    setIsNavigating(true);
    setDestination(dest || null);
    previousPathname.current = pathname || '';
    
    // Clear any existing timeout
    if (navigationTimeout.current) {
      clearTimeout(navigationTimeout.current);
    }
  }, [pathname]);

  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setDestination(null);
    if (navigationTimeout.current) {
      clearTimeout(navigationTimeout.current);
      navigationTimeout.current = null;
    }
  }, []);

  // Stop navigation immediately when pathname changes (page has loaded)
  useEffect(() => {
    if (isNavigating && pathname && pathname !== previousPathname.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        // Add a minimal delay to ensure smooth transition (100ms)
        navigationTimeout.current = setTimeout(() => {
          setIsNavigating(false);
          setDestination(null);
          navigationTimeout.current = null;
        }, 100);
      });
      
      return () => {
        if (navigationTimeout.current) {
          clearTimeout(navigationTimeout.current);
        }
      };
    }
  }, [pathname, isNavigating]);

  // Fallback: stop navigation after 3 seconds maximum
  useEffect(() => {
    if (isNavigating) {
      const maxTimer = setTimeout(() => {
        console.warn('Navigation timeout reached, forcing stop');
        setIsNavigating(false);
        setDestination(null);
        if (navigationTimeout.current) {
          clearTimeout(navigationTimeout.current);
          navigationTimeout.current = null;
        }
      }, 3000);
      
      return () => clearTimeout(maxTimer);
    }
  }, [isNavigating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
      }
    };
  }, []);

  const value: NavigationContextType = {
    isNavigating,
    startNavigation,
    stopNavigation,
    currentPath: pathname || '',
    destination,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
