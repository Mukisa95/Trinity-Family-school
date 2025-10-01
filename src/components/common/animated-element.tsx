import React from 'react';
import { useScrollAnimation } from '@/hooks/use-scroll-animation';

interface AnimatedElementProps {
  children: React.ReactNode;
  className?: string;
  animationType?: 'slide-up' | 'fade-in' | 'scale-in' | 'slide-left' | 'slide-right' | 'bounce-in' | 'rotate-in';
  delay?: number;
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  style?: React.CSSProperties;
}

export function AnimatedElement({
  children,
  className = '',
  animationType = 'slide-up',
  delay = 0,
  threshold = 0.1,
  rootMargin = '0px 0px -50px 0px',
  triggerOnce = true,
  style = {}
}: AnimatedElementProps) {
  const { elementRef, isVisible } = useScrollAnimation({
    threshold,
    rootMargin,
    triggerOnce
  });

  const getAnimationClasses = () => {
    const baseClasses = 'animate-on-scroll';
    const typeClasses = {
      'slide-up': '',
      'fade-in': 'fade-in',
      'scale-in': 'scale-in',
      'slide-left': 'slide-left',
      'slide-right': 'slide-right',
      'bounce-in': 'bounce-in',
      'rotate-in': 'rotate-in'
    };
    
    const delayClasses = {
      0: '',
      100: 'delay-100',
      200: 'delay-200',
      300: 'delay-300',
      400: 'delay-400',
      500: 'delay-500'
    };

    return [
      baseClasses,
      typeClasses[animationType],
      delayClasses[delay as keyof typeof delayClasses],
      isVisible ? 'animate-in' : ''
    ].filter(Boolean).join(' ');
  };

  return (
    <div
      ref={elementRef}
      className={`${getAnimationClasses()} ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        ...style
      }}
    >
      {children}
    </div>
  );
}

// Convenience components for different animation types
export function SlideUpElement(props: Omit<AnimatedElementProps, 'animationType'>) {
  return <AnimatedElement {...props} animationType="slide-up" />;
}

export function FadeInElement(props: Omit<AnimatedElementProps, 'animationType'>) {
  return <AnimatedElement {...props} animationType="fade-in" />;
}

export function ScaleInElement(props: Omit<AnimatedElementProps, 'animationType'>) {
  return <AnimatedElement {...props} animationType="scale-in" />;
}

export function SlideLeftElement(props: Omit<AnimatedElementProps, 'animationType'>) {
  return <AnimatedElement {...props} animationType="slide-left" />;
}

export function SlideRightElement(props: Omit<AnimatedElementProps, 'animationType'>) {
  return <AnimatedElement {...props} animationType="slide-right" />;
}

export function BounceInElement(props: Omit<AnimatedElementProps, 'animationType'>) {
  return <AnimatedElement {...props} animationType="bounce-in" />;
}

export function RotateInElement(props: Omit<AnimatedElementProps, 'animationType'>) {
  return <AnimatedElement {...props} animationType="rotate-in" />;
}
