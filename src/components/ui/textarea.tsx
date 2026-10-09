import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 invalid:border-red-600 invalid:bg-red-50/70 invalid:ring-2 invalid:ring-red-200 dark:invalid:border-red-400 dark:invalid:bg-red-950/70 dark:invalid:text-red-100 dark:invalid:ring-red-900 aria-[invalid=true]:border-red-600 aria-[invalid=true]:bg-red-50/70 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-200 dark:aria-[invalid=true]:border-red-400 dark:aria-[invalid=true]:bg-red-950/70 dark:aria-[invalid=true]:text-red-100 dark:aria-[invalid=true]:ring-red-900 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
