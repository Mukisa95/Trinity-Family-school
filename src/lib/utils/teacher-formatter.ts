/**
 * Get appropriate title for a teacher based on gender
 * @param gender - Teacher's gender
 * @returns Mr. or Mrs./Ms.
 */
export function getTeacherTitle(gender?: string): string {
  if (!gender) return 'Mr./Mrs.';
  
  const normalizedGender = gender.toLowerCase();
  
  if (normalizedGender === 'male' || normalizedGender === 'm') {
    return 'Mr.';
  } else if (normalizedGender === 'female' || normalizedGender === 'f') {
    return 'Mrs.';
  }
  
  return 'Mr./Mrs.';
}

/**
 * Format teacher name with title
 * @param name - Teacher's full name
 * @param gender - Teacher's gender
 * @returns Formatted name with title (e.g., "Mr. John Doe")
 */
export function formatTeacherNameWithTitle(name?: string, gender?: string): string {
  if (!name || name === 'Class Teacher' || name === 'Unknown Teacher') {
    return 'Class Teacher';
  }
  
  const title = getTeacherTitle(gender);
  return `${title} ${name}`;
}

