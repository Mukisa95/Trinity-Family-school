/**
 * Date utilities to prevent timezone-related date shifts
 * 
 * This module provides safe date handling functions that avoid the common
 * timezone issues that cause dates to shift by one day when being stored
 * and retrieved from the database.
 */

/**
 * Date utility functions for consistent date handling across the application
 * These utilities handle timezone-safe date operations to prevent date shifting issues
 */

/**
 * Safely parse a date string (YYYY-MM-DD) without timezone conversion
 * This function ensures that a date like "2010-07-18" remains exactly "2010-07-18"
 * regardless of the user's timezone.
 */
export function parseLocalDate(dateString: string | undefined | null): Date | undefined {
  if (!dateString) return undefined;
  
  // Handle YYYY-MM-DD format
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateString.match(dateRegex);
  
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // Month is 0-indexed
    const day = parseInt(match[3], 10);
    
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      // Create date in local timezone to avoid shifts
      return new Date(year, month, day);
    }
  }
  
  // Fallback for other formats
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return undefined;
  
  // Return a new date in local timezone
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Safely convert a Date object to YYYY-MM-DD string without timezone conversion
 * This ensures that a Date representing July 18, 2010 becomes "2010-07-18"
 * regardless of timezone.
 */
export function formatDateForStorage(date: Date | undefined | null): string {
  if (!date || isNaN(date.getTime())) {
    return new Date().toLocaleDateString('en-CA'); // Canadian format is YYYY-MM-DD
  }
  
  // Use local date components to avoid timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format a date for display in a human-readable format
 */
export function formatDateForDisplay(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  
  try {
    let date: Date | undefined;
    
    if (typeof dateString === 'string') {
      date = parseLocalDate(dateString);
    } else {
      date = dateString;
    }
    
    if (!date || isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'N/A';
  }
}

/**
 * Get current date in YYYY-MM-DD format for storage
 */
export function getCurrentDateForStorage(): string {
  return formatDateForStorage(new Date());
}

/**
 * Validate if a date string is in the correct YYYY-MM-DD format
 */
export function isValidDateString(dateString: string): boolean {
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = parseLocalDate(dateString);
  return date !== undefined && !isNaN(date.getTime());
}

/**
 * Format a date and time for display
 */
export function formatDateTimeForDisplay(dateString: string | Date): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date time:', error);
    return 'N/A';
  }
}

/**
 * Get relative time string (e.g., "2 days ago", "Just now")
 */
export function getRelativeTime(dateString: string | Date): string {
  if (!dateString) return 'Unknown';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    } else {
      return formatDateForDisplay(date);
    }
  } catch (error) {
    console.error('Error getting relative time:', error);
    return 'Unknown';
  }
}

/**
 * Check if a date is today
 */
export function isToday(dateString: string | Date): boolean {
  if (!dateString) return false;
  
  try {
    const date = typeof dateString === 'string' ? parseLocalDate(dateString) : dateString;
    if (!date) return false;
    
    const today = new Date();
    
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  } catch (error) {
    return false;
  }
}

/**
 * Check if a date is within the current academic year
 */
export function isCurrentAcademicYear(dateString: string | Date): boolean {
  if (!dateString) return false;
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Academic year typically runs from September to August
    // If current month is Sept-Dec, academic year started this calendar year
    // If current month is Jan-Aug, academic year started last calendar year
    const academicYearStart = now.getMonth() >= 8 ? currentYear : currentYear - 1;
    const academicYearEnd = academicYearStart + 1;
    
    const startDate = new Date(academicYearStart, 8, 1); // September 1st
    const endDate = new Date(academicYearEnd, 7, 31); // August 31st
    
    return date >= startDate && date <= endDate;
  } catch (error) {
    return false;
  }
} 