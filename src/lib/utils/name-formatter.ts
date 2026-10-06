/**
 * Utility functions for formatting pupil and staff names consistently
 * throughout the application. Uses surname-first format.
 * 
 * Name fields retain their storage meanings:
 * - firstName contains the actual first name
 * - lastName contains the actual surname
 * - Pupil display format is "Surname FirstName OtherNames"
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
 * @returns Formatted name string in surname-first order
 */
export function formatPupilName(
  nameData: NameData | null | undefined,
  options: {
    includeOtherNames?: boolean;
    separator?: string;
    fallback?: string;
  } = {}
): string {
  const { 
    includeOtherNames = true,
    separator = ' ',
    fallback = 'Unknown' 
  } = options;

  const clean = (value?: string) => (value || '').trim().replace(/\s+/g, ' ');
  const primaryNames = [clean(nameData?.lastName), clean(nameData?.firstName)].filter(Boolean);
  const otherNames = includeOtherNames ? clean(nameData?.otherNames) : '';
  return [primaryNames.join(separator), otherNames].filter(Boolean).join(' ') || fallback;
}

/**
 * Formats a pupil's name for display in lists and cards
 * @param nameData - Object containing firstName, lastName, and optionally otherNames
 * @returns Formatted name string suitable for display
 */
export function formatPupilDisplayName(nameData: NameData | null | undefined): string {
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
export function formatPupilFullName(nameData: NameData | null | undefined): string {
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
  return normalizePupilNameSearch([nameData.lastName, nameData.firstName, nameData.otherNames].filter(Boolean).join(' '));
}

function normalizePupilNameSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Every entered name part must match; name order and separators do not matter. */
export function matchesPupilName(nameData: NameData, query: string): boolean {
  if (!query.trim()) return true;
  const tokens = normalizePupilNameSearch(query).split(' ').filter(Boolean);
  const name = createPupilSearchString(nameData);
  return tokens.length > 0 && tokens.every(token => name.includes(token));
}

/** Name matching plus a screen's explicitly supported identifiers or labels.
 * Identifier punctuation remains significant (e.g. TFS-001 vs TFS/001).
 */
export function matchesPupilSearch(
  nameData: NameData,
  query: string,
  additionalFields: ReadonlyArray<string | null | undefined> = [],
): boolean {
  if (matchesPupilName(nameData, query)) return true;
  const term = query.trim().toLowerCase().replace(/\s+/g, ' ');
  return additionalFields.some(value => value?.trim().toLowerCase().replace(/\s+/g, ' ').includes(term));
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
