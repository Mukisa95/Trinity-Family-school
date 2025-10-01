import { useToast } from "@/hooks/use-toast";

// Optimized toast durations for different message types
export const TOAST_DURATIONS = {
  SUCCESS: 2000,        // 2 seconds - quick confirmation
  ERROR: 4000,          // 4 seconds - longer to read error details
  WARNING: 3000,        // 3 seconds - moderate attention
  INFO: 2500,           // 2.5 seconds - informational
  RATE_LIMIT: 1500,     // 1.5 seconds - brief rate limiting notice
  LOADING: 1000,        // 1 second - quick loading feedback
} as const;

// Toast utility functions for common scenarios
export const createToastHelpers = (toast: ReturnType<typeof useToast>['toast']) => ({
  
  // Success messages - quick, positive feedback
  success: (title: string, description?: string, duration = TOAST_DURATIONS.SUCCESS) => {
    toast({
      title,
      description,
      duration,
    });
  },

  // Error messages - longer duration for reading
  error: (title: string, description?: string, duration = TOAST_DURATIONS.ERROR) => {
    toast({
      variant: "destructive",
      title,
      description,
      duration,
    });
  },

  // Warning messages - moderate attention
  warning: (title: string, description?: string, duration = TOAST_DURATIONS.WARNING) => {
    toast({
      variant: "default", // You can create a warning variant if needed
      title,
      description,
      duration,
    });
  },

  // Quick info messages
  info: (title: string, description?: string, duration = TOAST_DURATIONS.INFO) => {
    toast({
      title,
      description,
      duration,
    });
  },

  // Rate limiting message
  rateLimit: (duration = TOAST_DURATIONS.RATE_LIMIT) => {
    toast({
      variant: "destructive",
      title: "Please wait",
      description: "Please wait before submitting again.",
      duration,
    });
  },

  // Loading confirmation (very brief)
  loading: (title: string, description?: string, duration = TOAST_DURATIONS.LOADING) => {
    toast({
      title,
      description,
      duration,
    });
  },

  // Form submission success with custom callback
  formSuccess: (
    entityName: string, 
    action: 'created' | 'updated' | 'deleted' = 'created',
    duration = TOAST_DURATIONS.SUCCESS
  ) => {
    const actionText = action === 'created' ? 'added' : action === 'updated' ? 'updated' : 'deleted';
    toast({
      title: `${entityName} ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`,
      description: `${entityName} has been successfully ${actionText}.`,
      duration,
    });
  },

  // Form submission error
  formError: (
    entityName: string, 
    action: 'create' | 'update' | 'delete' = 'create',
    duration = TOAST_DURATIONS.ERROR
  ) => {
    const actionText = action === 'create' ? 'add' : action === 'update' ? 'update' : 'delete';
    toast({
      variant: "destructive",
      title: `Failed to ${actionText} ${entityName}`,
      description: `Unable to ${actionText} ${entityName}. Please check your data and try again.`,
      duration,
    });
  },

  // Network/connection error
  networkError: (duration = TOAST_DURATIONS.ERROR) => {
    toast({
      variant: "destructive",
      title: "Connection Error",
      description: "Please check your internet connection and try again.",
      duration,
    });
  },

  // Permission error
  permissionError: (duration = TOAST_DURATIONS.ERROR) => {
    toast({
      variant: "destructive",
      title: "Permission Denied",
      description: "You don't have permission to perform this action.",
      duration,
    });
  },

  // Auto-dismissible toast with custom duration
  autoDialog: (title: string, description: string, isError = false, customDuration?: number) => {
    const duration = customDuration || (isError ? TOAST_DURATIONS.ERROR : TOAST_DURATIONS.SUCCESS);
    toast({
      variant: isError ? "destructive" : "default",
      title,
      description,
      duration,
    });
  }
});

// Hook that provides all the toast helpers
export const useToastHelpers = () => {
  const { toast } = useToast();
  return createToastHelpers(toast);
};

// Common toast messages for form operations
export const FORM_TOAST_MESSAGES = {
  PUPIL: {
    SUCCESS: {
      CREATED: "Pupil Registered",
      UPDATED: "Pupil Updated", 
      DELETED: "Pupil Removed"
    },
    ERROR: {
      CREATED: "Registration Failed",
      UPDATED: "Update Failed",
      DELETED: "Deletion Failed"
    }
  },
  STAFF: {
    SUCCESS: {
      CREATED: "Staff Member Added",
      UPDATED: "Staff Member Updated",
      DELETED: "Staff Member Removed"
    },
    ERROR: {
      CREATED: "Addition Failed",
      UPDATED: "Update Failed", 
      DELETED: "Deletion Failed"
    }
  },
  REQUIREMENT: {
    SUCCESS: {
      CREATED: "Requirement Added",
      UPDATED: "Requirement Updated",
      DELETED: "Requirement Removed"
    },
    ERROR: {
      CREATED: "Addition Failed",
      UPDATED: "Update Failed",
      DELETED: "Deletion Failed"
    }
  },
  UNIFORM: {
    SUCCESS: {
      CREATED: "Uniform Item Added",
      UPDATED: "Uniform Item Updated",
      DELETED: "Uniform Item Removed"
    },
    ERROR: {
      CREATED: "Addition Failed",
      UPDATED: "Update Failed",
      DELETED: "Deletion Failed"
    }
  }
} as const; 