/**
 * Format term name to show number with word in parentheses
 * Examples:
 * - "Term 1" -> "1 (One)"
 * - "Term 2" -> "2 (Two)"
 * - "Term 3" -> "3 (Three)"
 */
export function formatTermName(termName: string): string {
  if (!termName) return '';
  
  const termWords: { [key: string]: string } = {
    '1': 'One',
    '2': 'Two',
    '3': 'Three',
    '4': 'Four'
  };
  
  // Extract number from term name (e.g., "Term 1" -> "1", "Term 3" -> "3")
  const match = termName.match(/\d+/);
  
  if (match) {
    const termNumber = match[0];
    const termWord = termWords[termNumber] || termNumber;
    return `${termNumber} (${termWord})`;
  }
  
  // If no number found, return original
  return termName;
}

/**
 * Calculate accurate age based on date of birth and a reference date
 * @param dateOfBirth - Date of birth string or Date object
 * @param referenceDate - Reference date (exam date, current date, etc.)
 * @returns Age in years
 */
export function calculateAccurateAge(dateOfBirth: string | Date | undefined, referenceDate: string | Date = new Date()): number {
  if (!dateOfBirth) {
    console.error('❌ AGE CALC ERROR: No date of birth provided');
    throw new Error('Date of birth is required for age calculation');
  }
  
  console.log('🔍 AGE CALC DEBUG: Input DOB:', dateOfBirth, 'Ref Date:', referenceDate);
  
  try {
    // Parse birth date
    let birthDate: Date;
    if (typeof dateOfBirth === 'string') {
      // First try direct parsing (works for ISO format: YYYY-MM-DD)
      birthDate = new Date(dateOfBirth);
      
      console.log('📅 Parsed birthDate (initial):', birthDate, 'Valid:', !isNaN(birthDate.getTime()));
      
      // If invalid, try other formats
      if (isNaN(birthDate.getTime())) {
        console.log('⚠️ Initial parse failed, trying alternative formats');
        const parts = dateOfBirth.split(/[\/\-]/);
        if (parts.length === 3) {
          const p0 = parseInt(parts[0]);
          const p1 = parseInt(parts[1]);
          const p2 = parseInt(parts[2]);
          
          // Determine which part is year (usually 4 digits or > 31)
          if (p0 > 31) {
            // YYYY-MM-DD or YYYY/MM/DD
            birthDate = new Date(p0, p1 - 1, p2);
          } else if (p2 > 31) {
            // DD-MM-YYYY or MM-DD-YYYY
            // Assume DD/MM/YYYY (common in many countries)
            birthDate = new Date(p2, p1 - 1, p0);
          } else {
            // Ambiguous - try DD/MM/YYYY first
            birthDate = new Date(p2 + 2000, p1 - 1, p0); // Assume 20xx for 2-digit years
          }
          
          console.log('📅 Parsed birthDate (alternative):', birthDate, 'Valid:', !isNaN(birthDate.getTime()));
        }
      }
    } else {
      birthDate = dateOfBirth;
    }
    
    // Parse reference date
    let refDate: Date;
    if (typeof referenceDate === 'string') {
      refDate = new Date(referenceDate);
      if (isNaN(refDate.getTime())) {
        console.log('⚠️ Invalid reference date, using today');
        refDate = new Date();
      }
    } else {
      refDate = referenceDate;
    }
    
    console.log('📅 Reference date:', refDate);
    
    // Check for invalid dates
    if (isNaN(birthDate.getTime())) {
      console.error('❌ AGE CALC ERROR: Invalid birth date after all parsing attempts:', dateOfBirth);
      throw new Error(`Invalid birth date: ${dateOfBirth}`);
    }
    
    if (isNaN(refDate.getTime())) {
      console.error('❌ AGE CALC ERROR: Invalid reference date:', referenceDate);
      refDate = new Date(); // Use today as fallback
    }
    
    let age = refDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = refDate.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred yet in the reference year
    if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < birthDate.getDate())) {
      age--;
    }
    
    console.log('✅ Calculated age:', age);
    
    // Validate age is reasonable
    if (age < 3 || age > 25) {
      console.warn('⚠️ AGE WARNING: Age out of expected range:', age, 'for DOB:', dateOfBirth, 'Ref:', referenceDate);
      // Don't throw error, return the calculated age anyway
    }
    
    return age > 0 ? age : 0;
  } catch (error) {
    console.error('❌ AGE CALC ERROR:', error, 'DOB:', dateOfBirth, 'Ref:', referenceDate);
    throw error; // Re-throw to force proper error handling
  }
}

