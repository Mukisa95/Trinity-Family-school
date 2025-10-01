import type { ClassLevel, ExamType, GradingScaleItem, AttendanceStatus, FeeCategory, FeeFrequency, FeeStatus, ClassFeeType, SectionFeeType, FeeSection } from '@/types';

export const CLASS_LEVELS: ClassLevel[] = [
  'Nursery',
  'Lower Primary',
  'Upper Primary',
  'Secondary',
  'Other',
];

export const USER_ROLES = ['Admin', 'Teacher', 'Student', 'Staff'] as const;
export const STAFF_DEPARTMENTS = ['Teaching', 'Administration', 'Support', 'Management'] as const;
export const SUBJECT_TYPES = ['Core', 'Elective', 'Optional'] as const;

// Pupil Form constants
export const GENDERS = [
  'Male',
  'Female',
] as const;
export const PUPIL_SECTIONS = ['Day', 'Boarding'] as const;
export const PUPIL_STATUSES = ['Active', 'Inactive', 'Graduated', 'Transferred'] as const;
export const GUARDIAN_RELATIONSHIPS = [
  'Mother', 'Father', 'Guardian', 'Brother', 'Sister', 
  'Uncle', 'Aunt', 'Grandmother', 'Grandfather', 'Other'
] as const;
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const;
export const RELIGIONS = [
  'Catholic',
  'Protestant',
  'Pentecostal',
  'SDA',
  'Muslim',
  'Orthodox',
  'Other'
] as const;

export const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Argentine", 
  "Armenian", "Australian", "Austrian", "Azerbaijani", "Bahamian", "Bahraini", 
  "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese", 
  "Bhutanese", "Bolivian", "Bosnian", "Botswanan", "Brazilian", "British", 
  "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian", "Cambodian", 
  "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", 
  "Chilean", "Chinese", "Colombian", "Comoran", "Congolese (Congo-Brazzaville)", 
  "Congolese (Congo-Kinshasa)", "Costa Rican", "Croatian", "Cuban", "Cypriot", 
  "Czech", "Danish", "Djiboutian", "Dominican", "Dutch", "East Timorese", 
  "Ecuadorean", "Egyptian", "Emirati", "Equatorial Guinean", "Eritrean", 
  "Estonian", "Ethiopian", "Fijian", "Filipino", "Finnish", "French", "Gabonese", 
  "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian", "Guatemalan", 
  "Guinean", "Guyanese", "Haitian", "Honduran", "Hungarian", "Icelandic", "Indian", 
  "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", 
  "Jamaican", "Japanese", "Jordanian", "Kazakhstani", "Kenyan", "Kiribati", 
  "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese", "Liberian", "Libyan", 
  "Liechtensteiner", "Lithuanian", "Luxembourger", "Macedonian", "Malagasy", 
  "Malawian", "Malaysian", "Maldivian", "Malian", "Maltese", "Marshallese", 
  "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", 
  "Mongolian", "Montenegrin", "Moroccan", "Mosotho", "Motswana", "Mozambican", 
  "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan", "Nigerian", 
  "Nigerien", "North Korean", "Norwegian", "Omani", "Pakistani", "Palauan", 
  "Panamanian", "Papua New Guinean", "Paraguayan", "Peruvian", "Polish", 
  "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan", "Saint Lucian", 
  "Salvadoran", "Samoan", "San Marinese", "Sao Tomean", "Saudi", "Senegalese", 
  "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovak", "Slovenian", 
  "Solomon Islander", "Somali", "South African", "South Korean", "South Sudanese", 
  "Spanish", "Sri Lankan", "Sudanese", "Surinamer", "Swazi", "Swedish", "Swiss", 
  "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", 
  "Trinidadian or Tobagonian", "Tunisian", "Turkish", "Tuvaluan", "Ugandan", 
  "Ukrainian", "Uruguayan", "Uzbekistani", "Venezuelan", "Vietnamese", "Yemeni", 
  "Zambian", "Zimbabwean"
] as const;

// Exam constants
export const EXAM_TYPES: ExamType[] = [
  { id: 'et_bot', name: 'Beginning of Term' },
  { id: 'et_mid', name: 'Midterm' },
  { id: 'et_eot', name: 'End of Term' },
  { id: 'et_quiz', name: 'Quiz' },
  { id: 'et_assign', name: 'Assignment' },
  { id: 'et_cat', name: 'Continuous Assessment Test (CAT)' },
  { id: 'et_pra', name: 'Practical Exam' },
  { id: 'et_oral', name: 'Oral Exam' },
  { id: 'et_other', name: 'Other Assessment' }, 
];
export const OTHER_EXAM_TYPE_ID = 'et_other';

export const EXAM_STATUSES = ['Scheduled', 'Ongoing', 'Completed', 'Graded', 'Cancelled'] as const;
export const EXAM_NATURES = ['Set based', 'Subject based'] as const;

export const DEFAULT_GRADING_SCALE: GradingScaleItem[] = [
  { minMark: 80, maxMark: 100, grade: 'D1', aggregates: 1, comment: 'Excellent' },
  { minMark: 75, maxMark: 79, grade: 'D2', aggregates: 2, comment: 'Very Good' },
  { minMark: 70, maxMark: 74, grade: 'C3', aggregates: 3, comment: 'Good' },
  { minMark: 65, maxMark: 69, grade: 'C4', aggregates: 4, comment: 'Credit' },
  { minMark: 60, maxMark: 64, grade: 'C5', aggregates: 5, comment: 'Credit' },
  { minMark: 50, maxMark: 59, grade: 'C6', aggregates: 6, comment: 'Credit' },
  { minMark: 40, maxMark: 49, grade: 'P7', aggregates: 7, comment: 'Pass' },
  { minMark: 30, maxMark: 39, grade: 'P8', aggregates: 8, comment: 'Pass' },
  { minMark: 0, maxMark: 29, grade: 'F9', aggregates: 9, comment: 'Fail' },
];

// Attendance Constants
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused'];

// Fees Management Constants
export const FEE_CATEGORIES: FeeCategory[] = [
  "Tuition Fee", "Uniform Fee", "Activity Fee", "Transport Fee", 
  "Boarding Fee", "Development Fee", "Examination Fee", "Other Fee", "Discount"
];
export const FEE_FREQUENCIES: FeeFrequency[] = ["Termly", "Yearly", "Once"];
export const FEE_STATUSES: FeeStatus[] = ["active", "disabled"];
export const CLASS_FEE_TYPES: ClassFeeType[] = ["all", "specific"];
export const SECTION_FEE_TYPES: SectionFeeType[] = ["all", "specific"];
export const FEE_SECTIONS: FeeSection[] = ["Day", "Boarding"];

    