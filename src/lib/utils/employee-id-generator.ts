import { getSchoolFirstLetter } from "@/lib/constants/school";

export interface EmployeeIDData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  departments: string[];
}

export interface GeneratedEmployeeID {
  id: string;
  breakdown: {
    schoolLetter: string;
    staffLetter: string;
    departmentLetter: string;
    surnameLetter: string;
    birthYear: string;
    randomDigits: string;
  };
}

/**
 * Generates a unique employee ID based on the specified format:
 * [SchoolFirstLetter][StaffFirstLetter][DepartmentFirstLetter]-[Last2DigitsOfBirthYear]-[3RandomDigits]
 * Example: TSA-M87-726
 */
export function generateEmployeeID(data: EmployeeIDData): GeneratedEmployeeID {
  // Clean and validate input data
  const cleanFirstName = data.firstName?.trim() || "";
  const cleanLastName = data.lastName?.trim() || "";
  const cleanDateOfBirth = data.dateOfBirth?.trim() || "";
  const cleanDepartments = data.departments?.filter(Boolean) || [];

  // Validate required data
  if (!cleanFirstName || !cleanLastName || !cleanDateOfBirth || cleanDepartments.length === 0) {
    throw new Error("Missing required data for employee ID generation");
  }

  // Extract components
  const schoolLetter = getSchoolFirstLetter(); // T from Trinity
  const staffLetter = "S"; // S from Staff
  const departmentLetter = getDepartmentFirstLetter(cleanDepartments); // A from Admin
  const surnameLetter = cleanLastName.charAt(0).toUpperCase(); // M from Mukilo
  const birthYear = extractBirthYear(cleanDateOfBirth); // 87 from 1987
  const randomDigits = generateRandomDigits(); // 726

  // Generate the ID
  const id = `${schoolLetter}${staffLetter}${departmentLetter}-${surnameLetter}${birthYear}-${randomDigits}`;

  return {
    id,
    breakdown: {
      schoolLetter,
      staffLetter,
      departmentLetter,
      surnameLetter,
      birthYear,
      randomDigits,
    },
  };
}

/**
 * Gets the first letter of the first department alphabetically
 */
function getDepartmentFirstLetter(departments: string[]): string {
  if (departments.length === 0) {
    throw new Error("At least one department is required");
  }

  // Sort departments alphabetically and get the first one
  const sortedDepartments = [...departments].sort();
  const firstDepartment = sortedDepartments[0];
  
  return firstDepartment.charAt(0).toUpperCase();
}

/**
 * Extracts the last 2 digits from the birth year
 */
function extractBirthYear(dateOfBirth: string): string {
  // Handle different date formats
  let year: string;
  
  if (dateOfBirth.includes('-')) {
    // Format: YYYY-MM-DD or YYYY-MM
    year = dateOfBirth.split('-')[0];
  } else if (dateOfBirth.includes('/')) {
    // Format: MM/DD/YYYY or DD/MM/YYYY
    const parts = dateOfBirth.split('/');
    year = parts[parts.length - 1]; // Assume last part is year
  } else {
    // Assume it's just a year
    year = dateOfBirth;
  }

  // Validate year format
  if (!/^\d{4}$/.test(year)) {
    throw new Error("Invalid birth year format. Expected YYYY format.");
  }

  // Get last 2 digits
  return year.slice(-2);
}

/**
 * Generates 3 random digits
 */
function generateRandomDigits(): string {
  return Math.floor(Math.random() * 900 + 100).toString(); // 100-999
}

/**
 * Validates if an employee ID matches the expected format
 */
export function validateEmployeeID(id: string): boolean {
  const pattern = /^[A-Z]{3}-[A-Z]\d{2}-\d{3}$/;
  return pattern.test(id);
}

/**
 * Parses an employee ID to extract its components
 */
export function parseEmployeeID(id: string): GeneratedEmployeeID["breakdown"] | null {
  if (!validateEmployeeID(id)) {
    return null;
  }

  const parts = id.split('-');
  if (parts.length !== 3) {
    return null;
  }

  const [prefix, middle, suffix] = parts;
  
  return {
    schoolLetter: prefix.charAt(0),
    staffLetter: prefix.charAt(1),
    departmentLetter: prefix.charAt(2),
    surnameLetter: middle.charAt(0),
    birthYear: middle.slice(1),
    randomDigits: suffix,
  };
}
