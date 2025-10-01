import React from 'react';
import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'destructive' | 'secondary';
  className?: string;
  showZero?: boolean;
  maxCount?: number;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  size = 'md',
  variant = 'default',
  className,
  showZero = false,
  maxCount = 99
}) => {
  // Don't render if count is 0 and showZero is false
  if (count === 0 && !showZero) {
    return null;
  }

  // Format count (e.g., 99+ for counts over maxCount)
  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  const sizeClasses = {
    sm: 'h-4 w-4 text-xs min-w-[1rem]',
    md: 'h-5 w-5 text-xs min-w-[1.25rem]',
    lg: 'h-6 w-6 text-sm min-w-[1.5rem]'
  };

  const variantClasses = {
    default: 'bg-red-500 text-white',
    destructive: 'bg-red-600 text-white',
    secondary: 'bg-gray-500 text-white'
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium leading-none',
        sizeClasses[size],
        variantClasses[variant],
        'animate-in fade-in-0 zoom-in-95 duration-200',
        className
      )}
      role="status"
      aria-label={`${count} unread notifications`}
    >
      {displayCount}
    </div>
  );
};

// Animated notification badge with pulse effect
export const AnimatedNotificationBadge: React.FC<NotificationBadgeProps & {
  animate?: boolean;
}> = ({ 
  count, 
  size = 'md', 
  variant = 'default', 
  className, 
  showZero = false, 
  maxCount = 99,
  animate = true 
}) => {
  if (count === 0 && !showZero) {
    return null;
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  const sizeClasses = {
    sm: 'h-4 w-4 text-xs min-w-[1rem]',
    md: 'h-5 w-5 text-xs min-w-[1.25rem]',
    lg: 'h-6 w-6 text-sm min-w-[1.5rem]'
  };

  const variantClasses = {
    default: 'bg-red-500 text-white',
    destructive: 'bg-red-600 text-white',
    secondary: 'bg-gray-500 text-white'
  };

  return (
    <div className="relative">
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full font-medium leading-none',
          sizeClasses[size],
          variantClasses[variant],
          'animate-in fade-in-0 zoom-in-95 duration-200',
          className
        )}
        role="status"
        aria-label={`${count} unread notifications`}
      >
        {displayCount}
      </div>
      
      {/* Pulse animation ring */}
      {animate && count > 0 && (
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            variantClasses[variant],
            'animate-ping opacity-75'
          )}
        />
      )}
    </div>
  );
};

// Floating notification badge for sidebar
export const FloatingNotificationBadge: React.FC<NotificationBadgeProps & {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  offset?: number;
}> = ({ 
  count, 
  size = 'md', 
  variant = 'default', 
  className, 
  showZero = false, 
  maxCount = 99,
  position = 'top-right',
  offset = 8
}) => {
  if (count === 0 && !showZero) {
    return null;
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  const sizeClasses = {
    sm: 'h-4 w-4 text-xs min-w-[1rem]',
    md: 'h-5 w-5 text-xs min-w-[1.25rem]',
    lg: 'h-6 w-6 text-sm min-w-[1.5rem]'
  };

  const variantClasses = {
    default: 'bg-red-500 text-white',
    destructive: 'bg-red-600 text-white',
    secondary: 'bg-gray-500 text-white'
  };

  const positionClasses = {
    'top-right': `top-[-${offset}px] right-[-${offset}px]`,
    'top-left': `top-[-${offset}px] left-[-${offset}px]`,
    'bottom-right': `bottom-[-${offset}px] right-[-${offset}px]`,
    'bottom-left': `bottom-[-${offset}px] left-[-${offset}px]`
  };

  return (
    <div
      className={cn(
        'absolute inline-flex items-center justify-center rounded-full font-medium leading-none',
        sizeClasses[size],
        variantClasses[variant],
        positionClasses[position],
        'animate-in fade-in-0 zoom-in-95 duration-200',
        'shadow-lg border-2 border-white',
        className
      )}
      role="status"
      aria-label={`${count} unread notifications`}
    >
      {displayCount}
    </div>
  );
};

// Notification badge with loading state
export const LoadingNotificationBadge: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'destructive' | 'secondary';
  className?: string;
}> = ({ size = 'md', variant = 'default', className }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const variantClasses = {
    default: 'bg-red-500',
    destructive: 'bg-red-600',
    secondary: 'bg-gray-500'
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        sizeClasses[size],
        variantClasses[variant],
        'animate-pulse',
        className
      )}
      role="status"
      aria-label="Loading notifications"
    >
      <div className="w-2 h-2 bg-white rounded-full animate-ping" />
    </div>
  );
};
