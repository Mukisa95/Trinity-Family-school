import { useCallback, useMemo, useRef, useEffect } from 'react';

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTiming(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const end = performance.now();
      const duration = end - start;
      
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      
      this.metrics.get(label)!.push(duration);
      
      // Log slow operations in development
      if (process.env.NODE_ENV === 'development' && duration > 100) {
        console.warn(`Slow operation detected: ${label} took ${duration.toFixed(2)}ms`);
      }
    };
  }

  getMetrics(label: string): { avg: number; min: number; max: number; count: number } | null {
    const times = this.metrics.get(label);
    if (!times || times.length === 0) return null;

    return {
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      count: times.length
    };
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    for (const [label, times] of this.metrics.entries()) {
      if (times.length > 0) {
        result[label] = {
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length
        };
      }
    }
    
    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Hook for performance monitoring
export const usePerformanceMonitor = () => {
  const monitor = PerformanceMonitor.getInstance();
  
  const measureOperation = useCallback((label: string, operation: () => void | Promise<void>) => {
    const endTiming = monitor.startTiming(label);
    
    try {
      const result = operation();
      
      if (result instanceof Promise) {
        return result.finally(endTiming);
      } else {
        endTiming();
        return result;
      }
    } catch (error) {
      endTiming();
      throw error;
    }
  }, [monitor]);

  return {
    measureOperation,
    getMetrics: monitor.getMetrics.bind(monitor),
    getAllMetrics: monitor.getAllMetrics.bind(monitor),
    clearMetrics: monitor.clearMetrics.bind(monitor)
  };
};

// Memory usage monitoring
export const useMemoryMonitor = () => {
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024)
      };
    }
    return null;
  }, []);

  const logMemoryUsage = useCallback((label: string) => {
    const usage = getMemoryUsage();
    if (usage && process.env.NODE_ENV === 'development') {
      console.log(`Memory usage at ${label}:`, `${usage.usedMB}MB / ${usage.totalMB}MB`);
    }
  }, [getMemoryUsage]);

  return { getMemoryUsage, logMemoryUsage };
};

// Debounced function utility
export const useDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
};

// Throttled function utility
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastCallRef = useRef<number>(0);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      return callback(...args);
    }
  }, [callback, delay]) as T;
};

// Memoized calculations for fee processing
export const useMemoizedFeeCalculations = (fees: any[]) => {
  return useMemo(() => {
    const calculations = {
      totalFees: 0,
      totalPaid: 0,
      totalBalance: 0,
      paidCount: 0,
      partialCount: 0,
      unpaidCount: 0,
      feesByCategory: {} as Record<string, any[]>,
      feesByStatus: {
        paid: [] as any[],
        partial: [] as any[],
        unpaid: [] as any[]
      }
    };

    fees.forEach(fee => {
      const amount = fee.amount || 0;
      const paid = fee.paid || 0;
      const balance = fee.balance || 0;

      calculations.totalFees += amount;
      calculations.totalPaid += paid;
      calculations.totalBalance += balance;

      // Categorize by payment status
      if (balance === 0 && paid > 0) {
        calculations.paidCount++;
        calculations.feesByStatus.paid.push(fee);
      } else if (paid > 0 && balance > 0) {
        calculations.partialCount++;
        calculations.feesByStatus.partial.push(fee);
      } else {
        calculations.unpaidCount++;
        calculations.feesByStatus.unpaid.push(fee);
      }

      // Group by category
      const category = fee.category || 'Other';
      if (!calculations.feesByCategory[category]) {
        calculations.feesByCategory[category] = [];
      }
      calculations.feesByCategory[category].push(fee);
    });

    return calculations;
  }, [fees]);
};

// Virtualization helper for large lists
export const useVirtualization = (
  items: any[],
  itemHeight: number,
  containerHeight: number
) => {
  return useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
    const totalHeight = items.length * itemHeight;
    
    return {
      visibleCount,
      totalHeight,
      getVisibleItems: (scrollTop: number) => {
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(startIndex + visibleCount, items.length);
        
        return {
          startIndex,
          endIndex,
          items: items.slice(startIndex, endIndex),
          offsetY: startIndex * itemHeight
        };
      }
    };
  }, [items, itemHeight, containerHeight]);
};

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
) => {
  const targetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(callback, options);
    observer.observe(target);

    return () => {
      observer.unobserve(target);
      observer.disconnect();
    };
  }, [callback, options]);

  return targetRef;
};

// Performance optimization recommendations
export const getPerformanceRecommendations = (metrics: Record<string, any>) => {
  const recommendations: string[] = [];

  Object.entries(metrics).forEach(([operation, data]) => {
    if (data.avg > 1000) {
      recommendations.push(`${operation} is taking too long (${data.avg.toFixed(2)}ms avg). Consider optimization.`);
    }
    
    if (data.max > 5000) {
      recommendations.push(`${operation} had a very slow execution (${data.max.toFixed(2)}ms max). Check for blocking operations.`);
    }
  });

  return recommendations;
};

// Bundle size analyzer (development only)
export const analyzeBundleSize = () => {
  if (process.env.NODE_ENV !== 'development') return;

  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const totalSize = scripts.reduce((total, script) => {
    const src = (script as HTMLScriptElement).src;
    if (src.includes('/_next/')) {
      // Estimate size based on typical Next.js bundle patterns
      return total + 1; // Placeholder - in real implementation, you'd fetch actual sizes
    }
    return total;
  }, 0);

  console.log('Estimated bundle size:', totalSize, 'chunks');
};

// Component render tracking
export const useRenderTracker = (componentName: string) => {
  const renderCount = useRef(0);
  const lastRender = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRender.current;
    lastRender.current = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} rendered ${renderCount.current} times. Time since last render: ${timeSinceLastRender}ms`);
    }
  });

  return {
    renderCount: renderCount.current,
    getStats: () => ({
      renderCount: renderCount.current,
      lastRender: lastRender.current
    })
  };
}; 