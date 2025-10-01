/**
 * Utility functions for formatting pupil and staff names consistently
 * throughout the application. Uses surname-first format.
 * 
 * IMPORTANT: After database migration, firstName and lastName fields are correctly aligned:
 * - firstName contains the actual first name
 * - lastName contains the actual surname
 * - Display format is "Surname, FirstName" (lastName, firstName)
 */

export interface NameData {
  firstName?: string;
  lastName?: string;
  otherNames?: string;
}

/**
 * Formats a pupil's full name in surname-first format
 * @param nameData - Object containing firstName (actual first name), lastName (actual surname), and optionally otherNames
 * @param options - Formatting options
 * @returns Formatted name string in "Surname, FirstName" format
 */
export function formatPupilName(
  nameData: NameData, 
  options: {
    includeOtherNames?: boolean;
    separator?: string;
    fallback?: string;
  } = {}
): string {
  const { 
    includeOtherNames = false, 
    separator = ', ', 
    fallback = 'Unknown' 
  } = options;

  const { firstName = '', lastName = '', otherNames = '' } = nameData;

  // Handle missing names
  if (!firstName && !lastName) {
    return fallback;
  }
  
  if (!lastName) {
    return firstName;
  }
  
  if (!firstName) {
    return lastName;
  }

  // Build name: "Surname, FirstName" or "Surname, FirstName OtherNames"
  // After migration: lastName = surname, firstName = first name
  let formattedName = `${lastName}${separator}${firstName}`;
  
  if (includeOtherNames && otherNames) {
    formattedName += ` ${otherNames}`;
  }

  return formattedName;
}

/**
 * Formats a pupil's name for display in lists and cards
 * @param nameData - Object containing firstName, lastName, and optionally otherNames
 * @returns Formatted name string suitable for display
 */
export function formatPupilDisplayName(nameData: NameData): string {
  return formatPupilName(nameData, {
    includeOtherNames: true,
    separator: ' ',
    fallback: 'Unknown Student'
  });
}

/**
 * Formats a pupil's full name including other names for official documents
 * @param nameData - Object containing firstName, lastName, and optionally otherNames
 * @returns Full formatted name string
 */
export function formatPupilFullName(nameData: NameData): string {
  return formatPupilName(nameData, {
    includeOtherNames: true,
    separator: ' ',
    fallback: 'Unknown Student'
  });
}

/**
 * Formats initials for a pupil (e.g., "SM" for "Smith, Mary")
 * @param nameData - Object containing firstName and lastName
 * @returns Initials string
 */
export function formatPupilInitials(nameData: NameData): string {
  const { firstName = '', lastName = '' } = nameData;
  
  const lastInitial = lastName.charAt(0).toUpperCase();
  const firstInitial = firstName.charAt(0).toUpperCase();
  
  if (!lastInitial && !firstInitial) {
    return '??';
  }
  
  return `${lastInitial}${firstInitial}`;
}

/**
 * Formats a staff member's name (typically first name first for staff)
 * @param nameData - Object containing firstName, lastName, and optionally otherNames
 * @returns Formatted staff name
 */
export function formatStaffName(nameData: NameData): string {
  const { firstName = '', lastName = '', otherNames = '' } = nameData;

  if (!firstName && !lastName) {
    return 'Unknown Staff';
  }
  
  if (!lastName) {
    return firstName;
  }
  
  if (!firstName) {
    return lastName;
  }

  // For staff, we typically use "FirstName LastName" format
  let formattedName = `${firstName} ${lastName}`;
  
  if (otherNames) {
    formattedName = `${firstName} ${otherNames} ${lastName}`;
  }

  return formattedName;
}

/**
 * Formats a guardian's name
 * @param nameData - Object containing firstName and lastName
 * @returns Formatted guardian name
 */
export function formatGuardianName(nameData: NameData): string {
  const { firstName = '', lastName = '' } = nameData;

  if (!firstName && !lastName) {
    return 'Unknown Guardian';
  }
  
  if (!lastName) {
    return firstName;
  }
  
  if (!firstName) {
    return lastName;
  }

  // For guardians, use "FirstName LastName" format
  return `${firstName} ${lastName}`;
}

/**
 * Creates a search-friendly string for pupil names
 * @param nameData - Object containing firstName, lastName, and optionally otherNames
 * @returns Lowercase search string
 */
export function createPupilSearchString(nameData: NameData): string {
  const { firstName = '', lastName = '', otherNames = '' } = nameData;
  return `${lastName} ${firstName} ${otherNames}`.toLowerCase().trim();
}

/**
 * Sorts pupils by surname, then first name
 * @param pupils - Array of pupils to sort
 * @returns Sorted array of pupils
 */
export function sortPupilsByName<T extends NameData>(pupils: T[]): T[] {
  return pupils.sort((a, b) => {
    // First compare by lastName
    const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
    if (lastNameCompare !== 0) {
      return lastNameCompare;
    }
    
    // If lastNames are equal, compare by firstName
    return (a.firstName || '').localeCompare(b.firstName || '');
  });
} 