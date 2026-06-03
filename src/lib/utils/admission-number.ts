/**
 * Utility functions for generating dynamic admission numbers
 */

/**
 * Generates a dynamic admission number in the format: ABC/12M/472
 * Where:
 * - ABC: First letter of first two words of school name + first letter of nationality
 * - 12M: Last 2 digits of birth year + gender (M/F/O)
 * - 472: Three random digits
 */
export function generateAdmissionNumber(
  schoolName: string,
  nationality: string,
  dateOfBirth: string, // YYYY-MM-DD format
  gender: 'Male' | 'Female' | 'Other' | ''
): string {
  // First section: School initials + nationality initial
  const schoolWords = schoolName.trim().split(/\s+/).filter(word => word.length > 0);
  const schoolInitials = schoolWords
    .slice(0, 2) // Take first two words
    .map(word => word.charAt(0).toUpperCase())
    .join('');
  
  const nationalityInitial = nationality.trim().charAt(0).toUpperCase();
  const firstSection = (schoolInitials + nationalityInitial).padEnd(3, 'X').substring(0, 3);

  // Second section: Birth year last 2 digits + gender initial
  const birthYear = new Date(dateOfBirth).getFullYear();
  const yearLastTwoDigits = birthYear.toString().slice(-2);
  const genderInitial = gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : 'O';
  const secondSection = yearLastTwoDigits + genderInitial;

  // Third section: Three random digits
  const randomDigits = Math.floor(Math.random() * 900) + 100; // Ensures 3 digits (100-999)
  const thirdSection = randomDigits.toString();

  return `${firstSection}/${secondSection}/${thirdSection}`;
}

/**
 * Validates if an admission number follows the expected format
 */
export function validateAdmissionNumberFormat(admissionNumber: string): boolean {
  const pattern = /^[A-Z]{3}\/\d{2}[MFO]\/\d{3}$/;
  return pattern.test(admissionNumber);
}

/**
 * Extracts components from an admission number
 */
export function parseAdmissionNumber(admissionNumber: string) {
  const parts = admissionNumber.split('/');
  if (parts.length !== 3) {
    return null;
  }

  const [schoolNationalityCode, yearGenderCode, randomCode] = parts;
  
  if (schoolNationalityCode.length !== 3 || yearGenderCode.length !== 3 || randomCode.length !== 3) {
    return null;
  }

  const schoolInitials = schoolNationalityCode.substring(0, 2);
  const nationalityInitial = schoolNationalityCode.substring(2);
  const yearDigits = yearGenderCode.substring(0, 2);
  const genderCode = yearGenderCode.substring(2);

  return {
    schoolInitials,
    nationalityInitial,
    yearDigits,
    genderCode,
    randomCode
  };
} 