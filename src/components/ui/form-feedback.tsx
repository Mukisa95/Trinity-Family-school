"use client";

import * as React from 'react';
import { AlertCircle } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { FormFieldError } from '@/lib/utils/form-validation';

interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  error?: FormFieldError | string;
  fieldId?: string;
}

export function FieldError({ error, fieldId, className, ...props }: FieldErrorProps) {
  const message = typeof error === 'string' ? error : error?.message;
  if (!message) return null;

  const id = fieldId || (error && typeof error !== 'string' ? `${error.id}-error` : undefined);
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={cn('mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-red-700', className)}
      {...props}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

interface ValidatedFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  fieldId: string;
  label: React.ReactNode;
  required?: boolean;
  error?: FormFieldError | string;
  description?: React.ReactNode;
  labelClassName?: string;
}

export function ValidatedField({
  fieldId,
  label,
  required,
  error,
  description,
  className,
  labelClassName,
  children,
  ...props
}: ValidatedFieldProps) {
  const hasError = Boolean(error);
  return (
    <div
      data-validation-field={fieldId}
      data-invalid={hasError || undefined}
      className={cn('space-y-2', className)}
      {...props}
    >
      <Label
        htmlFor={fieldId}
        className={cn(hasError && 'font-semibold text-red-700', labelClassName)}
      >
        {label}
        {required ? (
          <span className="ml-1 text-red-600" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </Label>
      {children}
      {description && !hasError ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      <FieldError error={error} fieldId={`${fieldId}-error`} />
    </div>
  );
}

interface FormErrorSummaryProps extends React.HTMLAttributes<HTMLDivElement> {
  errors: FormFieldError[];
  submissionError?: string;
  onSelectError?: (fieldId: string) => void;
  title?: string;
}

export function FormErrorSummary({
  errors,
  submissionError,
  onSelectError,
  title = 'Please correct the highlighted fields',
  className,
  ...props
}: FormErrorSummaryProps) {
  if (errors.length === 0 && !submissionError) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'sticky top-0 z-20 mb-4 rounded-xl border-2 border-red-300 bg-red-50/95 p-4 text-red-950 shadow-lg backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
        <div className="min-w-0">
          <p className="font-bold">{submissionError ? 'Unable to save this form' : title}</p>
          {submissionError ? <p className="mt-1 text-sm font-medium">{submissionError}</p> : null}
          {errors.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm">
              {errors.map((error) => (
                <li key={error.id}>
                  <button
                    type="button"
                    className="min-h-8 rounded px-1 text-left font-semibold underline decoration-red-400 underline-offset-2 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    onClick={() => onSelectError?.(error.id)}
                  >
                    {error.label}: {error.message}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
