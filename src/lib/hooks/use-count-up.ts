import { useEffect, useState } from 'react';

interface UseCountUpOptions {
  end: number;
  duration?: number;
  start?: number;
  decimals?: number;
  enabled?: boolean;
}

/**
 * Custom hook to animate counting from start to end value
 * @param end - The target number to count to
 * @param duration - Duration of animation in milliseconds (default: 2000ms)
 * @param start - Starting number (default: 0)
 * @param decimals - Number of decimal places (default: 0)
 * @param enabled - Whether animation is enabled (default: true)
 */
export function useCountUp({ 
  end, 
  duration = 2000, 
  start = 0, 
  decimals = 0,
  enabled = true 
}: UseCountUpOptions): number {
  const [count, setCount] = useState(start);

  useEffect(() => {
    // If animation is disabled or end value is 0, set immediately
    if (!enabled || end === 0) {
      setCount(end);
      return;
    }

    const startTime = Date.now();
    const startValue = start;
    const endValue = end;
    const change = endValue - startValue;

    // Easing function for smooth animation (easeOutExpo)
    const easeOutExpo = (t: number): number => {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    };

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easedProgress = easeOutExpo(progress);
      const currentValue = startValue + change * easedProgress;

      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(endValue); // Ensure we end at exact value
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration, start, decimals, enabled]);

  // Round to specified decimal places
  return decimals > 0 
    ? Math.round(count * Math.pow(10, decimals)) / Math.pow(10, decimals)
    : Math.round(count);
}

