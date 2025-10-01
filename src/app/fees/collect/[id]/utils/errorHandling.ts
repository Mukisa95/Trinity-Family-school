import { toast } from '@/hooks/use-toast';

// Error types for better error handling
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  DATA_ERROR = 'DATA_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  code?: string;
  retryable?: boolean;
}

// Error classification utility
export const classifyError = (error: unknown): AppError => {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network connection error. Please check your internet connection.',
        details: error.message,
        retryable: true
      };
    }

    // Validation errors
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return {
        type: ErrorType.VALIDATION_ERROR,
        message: 'Invalid data provided. Please check your input.',
        details: error.message,
        retryable: false
      };
    }

    // Permission errors
    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return {
        type: ErrorType.PERMISSION_ERROR,
        message: 'You do not have permission to perform this action.',
        details: error.message,
        retryable: false
      };
    }

    // Data errors
    if (error.message.includes('not found') || error.message.includes('missing')) {
      return {
        type: ErrorType.DATA_ERROR,
        message: 'Required data not found. Please refresh and try again.',
        details: error.message,
        retryable: true
      };
    }
  }

  // Unknown errors
  return {
    type: ErrorType.UNKNOWN_ERROR,
    message: 'An unexpected error occurred. Please try again.',
    details: error instanceof Error ? error.message : String(error),
    retryable: true
  };
};

// User-friendly error messages
export const getErrorMessage = (error: AppError): string => {
  switch (error.type) {
    case ErrorType.NETWORK_ERROR:
      return 'Connection problem. Please check your internet and try again.';
    case ErrorType.VALIDATION_ERROR:
      return 'Please check your input and try again.';
    case ErrorType.PERMISSION_ERROR:
      return 'You do not have permission to perform this action.';
    case ErrorType.DATA_ERROR:
      return 'Data not found. Please refresh the page.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

// Error handler with toast notifications
export const handleError = (error: unknown, context?: string) => {
  const appError = classifyError(error);
  const message = getErrorMessage(appError);
  
  console.error(`Error in ${context || 'Fees Collection'}:`, appError);
  
  toast({
    variant: "destructive",
    title: "Error",
    description: message,
  });

  return appError;
};

// Retry utility for network operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const appError = classifyError(error);
      
      // Don't retry non-retryable errors
      if (!appError.retryable) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError;
};

// Network status checker
export const checkNetworkStatus = (): boolean => {
  return navigator.onLine;
};

// Offline error handler
export const handleOfflineError = () => {
  toast({
    variant: "destructive",
    title: "No Internet Connection",
    description: "Please check your internet connection and try again.",
  });
};

// Validation error formatter
export const formatValidationErrors = (errors: Record<string, string[]>): string => {
  const errorMessages = Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .join('\n');
  
  return errorMessages;
};

// Payment-specific error handlers
export const handlePaymentError = (error: unknown) => {
  const appError = classifyError(error);
  
  let message = 'Payment failed. Please try again.';
  
  if (appError.type === ErrorType.NETWORK_ERROR) {
    message = 'Payment failed due to connection issues. Please check your internet and try again.';
  } else if (appError.type === ErrorType.VALIDATION_ERROR) {
    message = 'Invalid payment details. Please check the amount and try again.';
  } else if (appError.details?.includes('insufficient')) {
    message = 'Insufficient balance or invalid payment amount.';
  }
  
  toast({
    variant: "destructive",
    title: "Payment Error",
    description: message,
  });
  
  return appError;
};

// PDF generation error handler
export const handlePDFError = (error: unknown) => {
  const appError = classifyError(error);
  
  let message = 'Failed to generate PDF. Please try again.';
  
  if (appError.type === ErrorType.NETWORK_ERROR) {
    message = 'PDF generation failed due to connection issues.';
  } else if (appError.details?.includes('browser')) {
    message = 'PDF generation not supported in this browser. Please try a different browser.';
  }
  
  toast({
    variant: "destructive",
    title: "PDF Generation Error",
    description: message,
  });
  
  return appError;
};

// Data loading error handler
export const handleDataLoadingError = (error: unknown, dataType: string) => {
  const appError = classifyError(error);
  
  let message = `Failed to load ${dataType}. Please refresh the page.`;
  
  if (appError.type === ErrorType.NETWORK_ERROR) {
    message = `Failed to load ${dataType} due to connection issues.`;
  } else if (appError.type === ErrorType.PERMISSION_ERROR) {
    message = `You do not have permission to view ${dataType}.`;
  }
  
  toast({
    variant: "destructive",
    title: "Loading Error",
    description: message,
  });
  
  return appError;
};

// Success message handler
export const handleSuccess = (message: string, description?: string) => {
  toast({
    title: message,
    description: description,
  });
};

// Warning message handler
export const handleWarning = (message: string, description?: string) => {
  toast({
    variant: "default",
    title: message,
    description: description,
  });
}; 