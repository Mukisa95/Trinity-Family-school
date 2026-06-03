"use client";

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TOAST_DURATIONS } from '@/lib/utils/toast-utils';

interface SubmissionOptions {
  onSuccess?: (result?: any) => void;
  onError?: (error: any) => void;
  successTitle?: string;
  successMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
  preventDuplicateSubmission?: boolean;
  duplicateSubmissionTimeWindow?: number; // in milliseconds
}

interface UseSubmissionStateReturn {
  isSubmitting: boolean;
  submitWithState: <T = any>(
    submitFunction: () => Promise<T>,
    options?: SubmissionOptions
  ) => Promise<T | void>;
  resetSubmissionState: () => void;
}

export function useSubmissionState(): UseSubmissionStateReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const lastSubmissionTimeRef = useRef<number>(0);
  const pendingSubmissionRef = useRef<Promise<any> | null>(null);

  const submitWithState = useCallback(
    async <T = any>(
      submitFunction: () => Promise<T>,
      options: SubmissionOptions = {}
    ): Promise<T | void> => {
      const {
        onSuccess,
        onError,
        successTitle = "Success",
        successMessage = "Operation completed successfully",
        errorTitle = "Error",
        errorMessage = "An error occurred. Please try again.",
        preventDuplicateSubmission = true,
        duplicateSubmissionTimeWindow = 2000, // 2 seconds
      } = options;

      // Prevent duplicate submissions
      if (preventDuplicateSubmission) {
        const now = Date.now();
        const timeSinceLastSubmission = now - lastSubmissionTimeRef.current;

        // If currently submitting, return the pending promise
        if (isSubmitting && pendingSubmissionRef.current) {
          console.log('🚫 Duplicate submission prevented - already submitting');
          return pendingSubmissionRef.current;
        }

        // If submitted too recently, prevent duplicate submission
        if (timeSinceLastSubmission < duplicateSubmissionTimeWindow) {
          console.log(
            `🚫 Duplicate submission prevented - submitted ${timeSinceLastSubmission}ms ago, minimum gap is ${duplicateSubmissionTimeWindow}ms`
          );
          toast({
            variant: "destructive",
            title: "Please wait",
            description: "Please wait before submitting again.",
            duration: TOAST_DURATIONS.RATE_LIMIT,
          });
          return;
        }

        lastSubmissionTimeRef.current = now;
      }

      setIsSubmitting(true);
      
      try {
        // Create and store the submission promise
        const submissionPromise = submitFunction();
        pendingSubmissionRef.current = submissionPromise;
        
        const result = await submissionPromise;
        
        // Show success toast
        toast({
          title: successTitle,
          description: successMessage,
          duration: TOAST_DURATIONS.SUCCESS,
        });

        // Call success callback
        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error: any) {
        console.error('Submission error:', error);
        
        // Show error toast with more details if available
        const displayErrorMessage = error?.message || errorMessage;
        toast({
          variant: "destructive",
          title: errorTitle,
          description: displayErrorMessage,
          duration: TOAST_DURATIONS.ERROR,
        });

        // Call error callback
        if (onError) {
          onError(error);
        }

        throw error; // Re-throw so caller can handle if needed
      } finally {
        setIsSubmitting(false);
        pendingSubmissionRef.current = null;
      }
    },
    [isSubmitting, toast]
  );

  const resetSubmissionState = useCallback(() => {
    setIsSubmitting(false);
    pendingSubmissionRef.current = null;
    lastSubmissionTimeRef.current = 0;
  }, []);

  return {
    isSubmitting,
    submitWithState,
    resetSubmissionState,
  };
} 