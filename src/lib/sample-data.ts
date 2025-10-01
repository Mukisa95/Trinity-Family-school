import type { Staff, Subject, Class, Pupil, Guardian, PromotionHistoryEntry, StatusChangeHistoryEntry, SchoolSettings, AcademicYear, Term, Exam, ExamType, ExamResult, ExamRecordPupilInfo, ExamRecordSubjectInfo, PupilSubjectResult, AttendanceRecord, ExcludedDay, FeeStructure, FeeAdjustmentEntry, DisableHistoryEntry, PupilAssignedFee } from '@/types';
import { getYear as getYearFromDateFns, parseISO, formatISO, isWithinInterval, format } from 'date-fns';
import { EXAM_TYPES as EXAM_TYPES_CONST, OTHER_EXAM_TYPE_ID, FEE_CATEGORIES, FEE_FREQUENCIES, FEE_STATUSES, CLASS_FEE_TYPES, SECTION_FEE_TYPES, FEE_SECTIONS } from './constants';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter'; 

export const sampleStaff: Staff[] = [
  { id: "t1", firstName: "Michael", lastName: "Scott", employeeId: "T001", department: ["Teaching"], role: ["History Teacher"], dateOfBirth: "1975-03-10", contactNumber:"555-1111", email: "m.scott@example.com", createdAt: new Date().toISOString() },
  { id: "t2", firstName: "Pam", lastName: "Beesly", employeeId: "T002", department: ["Teaching"], role: ["Art Teacher"], dateOfBirth: "1982-06-05", contactNumber:"555-2222", email: "p.beesly@example.com", createdAt: new Date().toISOString() },
  { id: "t3", firstName: "Dwight", lastName: "Schrute", employeeId: "A001", department: ["Administration"], role: ["Safety Officer"], dateOfBirth: "1978-01-20", contactNumber:"555-3333", email: "d.schrute@example.com", createdAt: new Date().toISOString() },
  { id: "s1", firstName: "Robert", lastName: "Downy", employeeId: "S001", dateOfBirth: "1980-01-10", department: ["Teaching"], role: ["Mathematics Teacher"], contactNumber: "555-0101", email: "robert.d@example.com", createdAt: new Date().toISOString() },
  { id: "s2", firstName: "Sarah", lastName: "Connor", employeeId: "S002", dateOfBirth: "1985-07-22", department: ["Administration"], role: ["School Secretary"], contactNumber: "555-0102", email: "sarah.c@example.com", createdAt: new Date().toISOString() },
];

export const sampleSubjects: Subject[] = [
  { id: "sub1", name: "Mathematics", code: "MAT101", type: "Core", createdAt: new Date().toISOString() },
  { id: "sub2", name: "English Literature", code: "ENG101", type: "Core", createdAt: new Date().toISOString() },
  { id: "sub3", name: "Physics", code: "PHY101", type: "Core", createdAt: new Date().toISOString() },
  { id: "sub4", name: "Creative Writing", code: "CRW201", type: "Elective", createdAt: new Date().toISOString() },
  { id: "sub5", name: "Music", code: "MUS301", type: "Elective", createdAt: new Date().toISOString() },
];

export const sampleClasses: Class[] = [
  {
    id: "c3",
    name: "Nursery Rhymes",
    code: "N.1",
    level: "Nursery",
    order: 1, 
    classTeacherId: "t2", 
    classTeacherName: "Pam Beesly",
    subjectAssignments: [
      { subjectId: "sub5", teacherId: "t2" }, 
    ],
    subjects: [sampleSubjects[4]],
    createdAt: new Date().toISOString()
  },
  {
    id: "c5",
    name: "Year 2 Red",
    code: "P.2",
    level: "Lower Primary",
    order: 2,
    classTeacherId: "t1",
    classTeacherName: "Michael Scott",
    subjectAssignments: [
      { subjectId: "sub1", teacherId: "s1"},
      { subjectId: "sub2", teacherId: "t2"},
    ],
    subjects: [sampleSubjects[0], sampleSubjects[1]],
    createdAt: new Date().toISOString()
  },
  {
    id: "c2",
    name: "Year 3 Blue",
    code: "P.3",
    level: "Lower Primary",
    order: 3, 
    classTeacherId: "t2",
    classTeacherName: "Pam Beesly",
    subjectAssignments: [
      { subjectId: "sub2", teacherId: "t2" },
      { subjectId: "sub4", teacherId: null },
      { subjectId: "sub5", teacherId: "t2" },
    ],
    subjects: [sampleSubjects[1], sampleSubjects[3], sampleSubjects[4]],
    createdAt: new Date().toISOString()
  },
  {
    id: "c1",
    name: "Grade 10A",
    code: "S.10A",
    level: "Secondary",
    order: 10, 
    classTeacherId: "t1",
    classTeacherName: "Michael Scott",
    subjectAssignments: [
      { subjectId: "sub1", teacherId: "s1" },
      { subjectId: "sub2", teacherId: "t2" },
    ],
    subjects: [sampleSubjects[0], sampleSubjects[1]],
    createdAt: new Date().toISOString()
  },
  {
    id: "c4",
    name: "Grade 11B",
    code: "S.11B",
    level: "Secondary",
    order: 11, 
    classTeacherId: "s1",
    classTeacherName: "Robert Downy",
    subjectAssignments: [
      { subjectId: "sub1", teacherId: "s1" },
      { subjectId: "sub3", teacherId: "s1" },
    ],
    subjects: [sampleSubjects[0], sampleSubjects[2]],
    createdAt: new Date().toISOString()
  }
];


const defaultGuardian: Omit<Guardian, 'id'> = {
  relationship: 'Father',
  firstName: 'GuardianFirstName',
  lastName: 'GuardianLastName',
  phone: '555-0000',
  email: 'guardian@example.com',
  occupation: 'Engineer',
  address: '123 Guardian St, City',
};

const initialPromotionHistoryP1: PromotionHistoryEntry[] = [
  { date: new Date(2023,0,10).toISOString(), fromClassId: undefined, fromClassName: 'N/A', toClassId: 'c2', toClassName: sampleClasses.find(c => c.id === "c2")?.name || 'Year 3 Blue', type: 'Initial Placement', processedBy: "System Admin" },
  { date: new Date(2023,8,1).toISOString(), fromClassId: 'c2', fromClassName: sampleClasses.find(c => c.id === "c2")?.name || 'Year 3 Blue', toClassId: 'c1', toClassName: sampleClasses.find(c => c.id === "c1")?.name || 'Grade 10A', type: 'Promotion', processedBy: "System Admin" }
];
const initialStatusHistoryP1: StatusChangeHistoryEntry[] = [
    { date: new Date(2023,0,10).toISOString(), fromStatus: 'N/A', toStatus: 'Active', processedBy: 'System Admin', reason: 'Initial Registration'},
];


const initialPromotionHistoryP2: PromotionHistoryEntry[] = [
   { date: new Date(2023,2,15).toISOString(), fromClassId: undefined, fromClassName: 'N/A', toClassId: 'c2', toClassName: sampleClasses.find(c => c.id === "c2")?.name || 'Year 3 Blue', type: 'Initial Placement', processedBy: "System Admin" }
];
const initialStatusHistoryP2: StatusChangeHistoryEntry[] = [
    { date: new Date(2023,2,15).toISOString(), fromStatus: 'N/A', toStatus: 'Active', processedBy: 'System Admin', reason: 'Initial Registration'},
    { date: new Date(2023,5,1).toISOString(), fromStatus: 'Active', toStatus: 'Inactive', processedBy: 'System Admin', reason: 'Long Absence'},
];

export const samplePupils: Pupil[] = [
  {
    id: "p1",
    firstName: "John",
    lastName: "Doe",
    otherNames: "Alex",
    admissionNumber: "P001",
    gender: "Male",
    dateOfBirth: "2010-05-15",
    placeOfBirth: "City Hospital",
    nationality: "Kenyan",
    religion: "Christianity",
    address: "123 Main St, Townsville",
    classId: "c1", 
    className: sampleClasses.find(c => c.id === "c1")?.name,
    photo: "https://placehold.co/128x128.png",
    section: "Day",
    status: "Active",
    familyId: "fam-doe-001",
    guardians: [{ ...defaultGuardian, id: "g1", relationship: "Mother", firstName: "Jane", lastName: "Doe", phone: "555-1234", email: "jane.doe@example.com" }],
    medicalConditions: "None",
    allergies: "Peanuts",
    medications: "None",
    bloodType: "O+",
    emergencyContactGuardianId: "g1",
    learnerIdentificationNumber: "LN001",
    previousSchool: "Kiddie Kollege",
    registrationDate: "2023-01-10",
    additionalIdentifiers: [
      { idType: "National ID (Child)", idValue: "CM1234567" },
      { idType: "Library Card No", idValue: "LIB007" }
    ],
    promotionHistory: initialPromotionHistoryP1,
    statusChangeHistory: initialStatusHistoryP1,
    assignedFees: [
      {
        id: 'paf-1',
        feeStructureId: 'fs6', // Science Lab Fee - Assignment
        assignedAt: new Date().toISOString(),
        assignedBy: 'System Admin',
        notes: 'Standard lab fee for new secondary pupils.',
        status: 'active',
        validityType: 'indefinite',
        termApplicability: 'all_terms'
      },
      {
        id: 'paf-2',
        feeStructureId: 'fs5', // Early Payment Discount (linked to fs1 - Tuition Fee)
        assignedAt: new Date().toISOString(),
        assignedBy: 'System Admin',
        notes: 'Early payment discount for tuition fee.',
        status: 'active',
        validityType: 'specific_year',
        startAcademicYearId: 'ay-2025', // Current academic year
        termApplicability: 'all_terms'
      }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "p2",
    firstName: "Emily",
    lastName: "Smith",
    admissionNumber: "P002",
    gender: "Female",
    dateOfBirth: "2011-02-20",
    placeOfBirth: "Rural Clinic",
    nationality: "Ugandan",
    religion: "Islam",
    address: "456 Oak Ave, Villagetown",
    classId: "c2",
    className: sampleClasses.find(c => c.id === "c2")?.name,
    photo: "https://placehold.co/128x128.png",
    section: "Boarding",
    status: "Inactive", 
    familyId: "fam-smith-001",
    guardians: [{ ...defaultGuardian, id: "g2", relationship: "Father", firstName: "John", lastName: "Smith", phone: "555-5678", email: "john.smith@example.com" }],
    medicalConditions: "Asthma",
    allergies: "None",
    medications: "Inhaler as needed",
    bloodType: "A-",
    emergencyContactGuardianId: "g2",
    learnerIdentificationNumber: "LN002",
    previousSchool: "Bright Sparks Academy",
    registrationDate: "2023-03-15",
    additionalIdentifiers: [],
    promotionHistory: initialPromotionHistoryP2,
    statusChangeHistory: initialStatusHistoryP2,
    assignedFees: [],
    createdAt: new Date().toISOString()
  },
   {
    id: "p3",
    firstName: "Ali",
    lastName: "Omar",
    admissionNumber: "P003",
    gender: "Male",
    dateOfBirth: "2009-11-01",
    placeOfBirth: "Capital City",
    nationality: "Tanzanian",
    religion: "Islam",
    address: "789 Palm Rd, Beachtown",
    classId: "c1",
    className: sampleClasses.find(c => c.id === "c1")?.name,
    photo: "https://placehold.co/128x128.png",
    section: "Day",
    status: "Active",
    familyId: "fam-omar-002",
    guardians: [{ ...defaultGuardian, id: "g3", relationship: "Uncle", firstName: "Ahmed", lastName: "Salim", phone: "555-9012", email: "ahmed.salim@example.com" }],
    medicalConditions: "None",
    allergies: "None",
    medications: "None",
    bloodType: "B+",
    emergencyContactGuardianId: "g3",
    learnerIdentificationNumber: "LN003",
    previousSchool: "Sunrise Primary",
    registrationDate: "2022-09-05",
    promotionHistory: [
      { date: new Date(2022,8,5).toISOString(), fromClassId: undefined, fromClassName: 'N/A', toClassId: 'c1', toClassName: sampleClasses.find(c => c.id === "c1")?.name || 'Grade 10A', type: 'Initial Placement', processedBy: "System Admin" }
    ],
    statusChangeHistory: [
        { date: new Date(2022,8,5).toISOString(), fromStatus: 'N/A', toStatus: 'Active', processedBy: 'System Admin', reason: 'Initial Registration'},
    ],
    assignedFees: [],
    createdAt: new Date().toISOString()
  },
  {
    id: "p4",
    firstName: "Fatuma",
    lastName: "Juma",
    admissionNumber: "P004",
    gender: "Female",
    dateOfBirth: "2010-08-25",
    placeOfBirth: "Town Clinic",
    nationality: "Kenyan",
    religion: "Islam",
    address: "Plot 22, Uhuru Street",
    classId: "c1", 
    className: sampleClasses.find(c => c.id === "c1")?.name,
    photo: "https://placehold.co/128x128.png",
    section: "Day",
    status: "Active",
    familyId: "fam-omar-002", 
    guardians: [{ ...defaultGuardian, id: "g4", relationship: "Mother", firstName: "Aisha", lastName: "Juma", phone: "555-4321", email: "aisha.j@example.com" }],
    medicalConditions: "None",
    allergies: "None",
    medications: "None",
    bloodType: "AB+",
    emergencyContactGuardianId: "g4",
    learnerIdentificationNumber: "LN004",
    previousSchool: "Greenhill Academy",
    registrationDate: "2023-01-12",
    promotionHistory: [
      { date: new Date(2023,0,12).toISOString(), fromClassId: undefined, fromClassName: 'N/A', toClassId: 'c1', toClassName: sampleClasses.find(c => c.id === "c1")?.name || 'Grade 10A', type: 'Initial Placement', processedBy: "System Admin" }
    ],
    statusChangeHistory: [
        { date: new Date(2023,0,12).toISOString(), fromStatus: 'N/A', toStatus: 'Active', processedBy: 'System Admin', reason: 'Initial Registration'},
    ],
    assignedFees: [],
    createdAt: new Date().toISOString()
  },
];

export const sampleSchoolSettings: SchoolSettings = {
  generalInfo: {
    name: "Trinity Family School",
    logo: "https://placehold.co/150x150.png", 
    motto: "Knowledge is Power",
    establishedYear: "1995",
    schoolType: "Mixed Day & Boarding",
    registrationNumber: "MOE/S/12345",
  },
  contact: {
    email: "info@trinityfamilyschool.edu",
    phone: "+256 777 123456",
    alternativePhone: "+256 700 654321",
    website: "www.trinityfamilyschool.edu",
  },
  address: {
    physical: "123 Education Lane, Kampala",
    postal: "P.O. Box 789, Kampala",
    poBox: "P.O. Box 789",
    city: "Kampala",
    country: "Uganda",
  },
  headTeacher: {
    name: "Dr. Eleanor Vance",
    signature: "https://placehold.co/200x100.png",
    message: "Welcome to Trinity Family School, where we strive for excellence in education and character development.",
  },
  visionMissionValues: {
    vision: "To be a leading institution in providing holistic and transformative education.",
    mission: "To nurture students into critical thinkers, lifelong learners, and responsible global citizens through a balanced and challenging curriculum.",
    coreValues: "Integrity, Excellence, Respect, Collaboration, Innovation",
    description: "Trinity Family School is committed to fostering an environment where students can achieve their full potential academically, socially, and morally.",
  },
  socialMedia: { 
    facebook: "https://facebook.com/trinityfamilyschool",
    twitter: "https://twitter.com/trinityfamily",
    instagram: "https://instagram.com/trinityfamilyschool",
    linkedin: "https://linkedin.com/company/trinity-family-school",
  },
};


const createYear = (year: number, isLocked: boolean, isActiveSuggestion: boolean): AcademicYear => {
  const yearName = year.toString();
  
  // Helper function to find the first Monday of February
  const getFirstMondayOfFebruary = (targetYear: number): Date => {
    const feb1 = new Date(targetYear, 1, 1); // February 1st (month is 0-indexed)
    const dayOfWeek = feb1.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days to add to get to the first Monday
    const daysToAdd = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
    const firstMonday = new Date(targetYear, 1, 1 + daysToAdd);
    
    // If the first Monday is too late in February (after 7th), use the previous Monday
    if (firstMonday.getDate() > 7) {
      return new Date(targetYear, 1, firstMonday.getDate() - 7);
    }
    
    return firstMonday;
  };

  // Helper function to add school days (excluding weekends)
  const addSchoolDays = (startDate: Date, schoolDaysToAdd: number): Date => {
    const result = new Date(startDate);
    let schoolDaysCounted = 0;
    
    // If schoolDaysToAdd is 0, it means the term is 1 day long (the startDate itself)
    // so we don't need to add any more days.
    if (schoolDaysToAdd === 0) {
      return result; // startDate is the only day of the term
    }

    while (schoolDaysCounted < schoolDaysToAdd) {
      result.setDate(result.getDate() + 1);
      // Only count weekdays (Monday = 1, Friday = 5)
      if (result.getDay() >= 1 && result.getDay() <= 5) {
        schoolDaysCounted++;
      }
    }
    // The forceful adjustment to Friday has been removed.
    // The Nth school day should naturally be a Friday if the term length and start day are per the pattern.
    return result;
  };

  // Helper function to add calendar days
  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  // Helper function to get next Monday
  const getNextMonday = (date: Date): Date => {
    const result = new Date(date);
    const daysUntilMonday = (8 - result.getDay()) % 7 || 7;
    result.setDate(result.getDate() + daysUntilMonday);
    return result;
  };

  let term1Start: Date, term1End: Date;
  let term2Start: Date, term2End: Date;
  let term3Start: Date, term3End: Date;

  // Use illustrative dates for specific years
  if (year === 2023) {
    term1Start = new Date('2023-02-06'); // Mon 6 Feb
    term1End = new Date('2023-05-05');   // Fri 5 May
    // Recess: May 6 - May 28 (23 days)
    term2Start = new Date('2023-05-29'); // Mon 29 May
    term2End = new Date('2023-08-25');   // Fri 25 Aug
    // Recess: Aug 26 - Sep 17 (23 days)
    term3Start = new Date('2023-09-18'); // Mon 18 Sept
    term3End = new Date('2023-12-01');   // Fri 1 Dec
  } else if (year === 2024) {
    term1Start = new Date('2024-02-05'); // Mon 5 Feb
    term1End = new Date('2024-05-03');   // Fri 3 May
    // Recess: May 4 - May 26 (23 days)
    term2Start = new Date('2024-05-27'); // Mon 27 May
    term2End = new Date('2024-08-23');   // Fri 23 Aug
    // Recess: Aug 24 - Sep 15 (23 days)
    term3Start = new Date('2024-09-16'); // Mon 16 Sept
    term3End = new Date('2024-12-06');   // Fri 6 Dec
  } else if (year === 2025) {
    term1Start = new Date('2025-02-03'); // Mon 3 Feb
    term1End = new Date('2025-05-02');   // Fri 2 May
    // Recess: May 3 - May 25 (23 days)
    term2Start = new Date('2025-05-26'); // Mon 26 May
    term2End = new Date('2025-08-22');   // Fri 22 Aug
    // Recess: Aug 23 - Sep 14 (23 days)
    term3Start = new Date('2025-09-15'); // Mon 15 Sept
    term3End = new Date('2025-12-05');   // Fri 5 Dec
  } else {
    // General pattern for other years
    term1Start = getFirstMondayOfFebruary(year);
    term1End = addSchoolDays(term1Start, 90 - 1); // 90 M-F days (18 weeks)

    const recess1End = addDays(term1End, 23);
    term2Start = getNextMonday(recess1End); // Ensure it starts on Monday after 23 full days of recess
    term2End = addSchoolDays(term2Start, 90 - 1); // 90 M-F days (18 weeks)

    const recess2End = addDays(term2End, 23);
    term3Start = getNextMonday(recess2End); // Ensure it starts on Monday
    term3End = addSchoolDays(term3Start, 75 - 1); // 75 M-F days (15 weeks)
  }

  // Academic year spans from Term I start to Term III end
  const yearStartDate = formatISO(term1Start, { representation: 'date' });
  const yearEndDate = formatISO(term3End, { representation: 'date' });

  return {
    id: `ay-${year}`,
    name: yearName,
    startDate: yearStartDate,
    endDate: yearEndDate,
    isLocked: isLocked,
    isActive: isActiveSuggestion, 
    terms: [
      {
        id: `t1-${year}`,
        name: "Term 1",
        startDate: formatISO(term1Start, { representation: 'date' }),
        endDate: formatISO(term1End, { representation: 'date' })
      },
      {
        id: `t2-${year}`,
        name: "Term 2", 
        startDate: formatISO(term2Start, { representation: 'date' }),
        endDate: formatISO(term2End, { representation: 'date' })
      },
      {
        id: `t3-${year}`,
        name: "Term 3",
        startDate: formatISO(term3Start, { representation: 'date' }),
        endDate: formatISO(term3End, { representation: 'date' })
      }
    ],
  };
};

const currentSystemYear = new Date().getFullYear();
const startYearGen = 2024; 
const endYearGen = 2150; 

const generatedYears: AcademicYear[] = [];
for (let year = startYearGen; year <= endYearGen; year++) {
  const isLocked = year < currentSystemYear;
  const isActiveSuggestion = year === currentSystemYear; 
  generatedYears.push(createYear(year, isLocked, isActiveSuggestion));
}

if (!generatedYears.find(y => y.name === currentSystemYear.toString()) && (currentSystemYear < startYearGen || currentSystemYear > endYearGen) ) {
    const isCurrentYearLocked = false; 
    generatedYears.push(createYear(currentSystemYear, isCurrentYearLocked, true));
}

const prevYear = currentSystemYear - 1;
if (prevYear >= 2000 && !generatedYears.find(y => y.name === prevYear.toString()) && (prevYear < startYearGen || prevYear > endYearGen) ) { 
    generatedYears.push(createYear(prevYear, true, false));
}

generatedYears.sort((a, b) => parseInt(a.name) - parseInt(b.name));


export const initialSampleAcademicYears: AcademicYear[] = generatedYears;

export const sampleExamTypes: ExamType[] = EXAM_TYPES_CONST;


let examIdCounter = 1;

const findAcademicContext = (date: Date, years: AcademicYear[]): { academicYearId?: string, termId?: string } => {
  const targetDate = parseISO(formatISO(date, { representation: 'date' }));
  for (const year of years) {
    if (isWithinInterval(targetDate, { start: parseISO(year.startDate), end: parseISO(year.endDate) })) {
      for (const term of year.terms) {
        if (isWithinInterval(targetDate, { start: parseISO(term.startDate), end: parseISO(term.endDate) })) {
          return { academicYearId: year.id, termId: term.id };
        }
      }
      return { academicYearId: year.id, termId: year.terms[0]?.id };
    }
  }
  const closestFutureOrCurrentYear = years.find(y => !y.isLocked && (y.isActive || (parseISO(y.startDate) >= new Date()))) 
                                    || years.find(y => !y.isLocked) 
                                    || years[0]; 
  return { academicYearId: closestFutureOrCurrentYear?.id, termId: closestFutureOrCurrentYear?.terms[0]?.id };
};

const currentYearForExams = new Date().getFullYear();
const mathMidtermContext = findAcademicContext(new Date(currentYearForExams, 2, 15), initialSampleAcademicYears); 
const engPhyContext = findAcademicContext(new Date(currentYearForExams, 6, 20), initialSampleAcademicYears); 
const musicContext = findAcademicContext(new Date(currentYearForExams, 1, 28), initialSampleAcademicYears); 


export const initialExamsData: Exam[] = [
  {
    id: `exam${examIdCounter++}`,
    name: 'Mathematics Midterm',
    baseName: 'Mathematics Midterm',
    batchId: `batch-${Date.now()}-1`,
    examTypeId: 'et_mid', 
    examTypeName: sampleExamTypes.find(et => et.id === 'et_mid')?.name,
    examNature: 'Set based',
    classId: 'c1', 
    startDate: format(new Date(currentYearForExams, 2, 15), "yyyy-MM-dd"),
    startTime: '09:00',
    endDate: format(new Date(currentYearForExams, 2, 15), "yyyy-MM-dd"),
    endTime: '11:00',
    maxMarks: 100,
    passingMarks: 50,
    status: 'Graded',
    instructions: 'Answer all questions. Show your working.',
    academicYearId: mathMidtermContext.academicYearId,
    termId: mathMidtermContext.termId,
    createdAt: new Date().toISOString(),
    examResultId: `er-batch-${Date.now()}-1-c1`,
  },
  {
    id: `exam${examIdCounter++}`,
    name: 'English & Physics End of Term', 
    baseName: 'English & Physics End of Term',
    batchId: `batch-${Date.now()}-2`,
    examTypeId: 'et_eot', 
    examTypeName: sampleExamTypes.find(et => et.id === 'et_eot')?.name,
    examNature: 'Subject based',
    classId: 'c2', 
    subjectIds: ['sub2'], 
    startDate: format(new Date(currentYearForExams, 6, 20), "yyyy-MM-dd"),
    startTime: '10:00',
    endDate: format(new Date(currentYearForExams, 6, 20), "yyyy-MM-dd"),
    endTime: '12:30',
    maxMarks: 100,
    passingMarks: 45,
    status: 'Scheduled',
    instructions: 'Essay questions for English.',
    academicYearId: engPhyContext.academicYearId,
    termId: engPhyContext.termId,
    createdAt: new Date().toISOString(),
    examResultId: `er-batch-${Date.now()}-2-c2`,
  },
  {
    id: `exam${examIdCounter++}`,
    name: 'English & Physics End of Term', 
    baseName: 'English & Physics End of Term',
    batchId: `batch-${Date.now()}-2`, 
    examTypeId: 'et_eot', 
    examTypeName: sampleExamTypes.find(et => et.id === 'et_eot')?.name,
    examNature: 'Subject based',
    classId: 'c4', 
    subjectIds: ['sub3'], 
    startDate: format(new Date(currentYearForExams, 6, 20), "yyyy-MM-dd"), 
    startTime: '10:00',
    endDate: format(new Date(currentYearForExams, 6, 20), "yyyy-MM-dd"),
    endTime: '12:30',
    maxMarks: 100,
    passingMarks: 45,
    status: 'Scheduled',
    instructions: 'Physics practical component.',
    academicYearId: engPhyContext.academicYearId,
    termId: engPhyContext.termId,
    createdAt: new Date().toISOString(),
    examResultId: `er-batch-${Date.now()}-2-c4`,
  },
  {
    id: `exam${examIdCounter++}`,
    name: 'Music Assessment',
    baseName: 'Music Assessment',
    batchId: `batch-${Date.now()}-3`,
    examTypeId: OTHER_EXAM_TYPE_ID, 
    examTypeName: sampleExamTypes.find(et => et.id === OTHER_EXAM_TYPE_ID)?.name,
    customExamTypeName: 'Practical Music Assessment',
    examNature: 'Set based', 
    classId: 'c3', 
    startDate: format(new Date(currentYearForExams, 1, 28), "yyyy-MM-dd"),
    startTime: '14:00',
    endDate: format(new Date(currentYearForExams, 1, 29), "yyyy-MM-dd"),
    endTime: '16:30',
    maxMarks: 50,
    passingMarks: 25,
    status: 'Completed',
    academicYearId: musicContext.academicYearId,
    termId: musicContext.termId,
    createdAt: new Date().toISOString(),
    examResultId: `er-batch-${Date.now()}-3-c3`,
  }
];

const getSubjectsForClassUtil = (classId: string): Subject[] => {
    const cls = sampleClasses.find(c => c.id === classId);
    if (!cls || !cls.subjectAssignments) return [];
    return cls.subjectAssignments
      .map(sa => sampleSubjects.find(s => s.id === sa.subjectId))
      .filter(Boolean) as Subject[];
  };


const createExamResultShell = (exam: Exam): ExamResult => {
    const targetClass = sampleClasses.find(c => c.id === exam.classId);
    const pupilsInClass = samplePupils.filter(p => p.classId === exam.classId && p.status === 'Active');
    
    const pupilSnapshots: ExamRecordPupilInfo[] = pupilsInClass.map(p => ({
      pupilId: p.id,
      name: formatPupilDisplayName(p),
      admissionNumber: p.admissionNumber,
      classNameAtExam: targetClass?.name || 'N/A',
      ageAtExam: exam.startDate && p.dateOfBirth ? getYearFromDateFns(parseISO(exam.startDate)) - getYearFromDateFns(parseISO(p.dateOfBirth)) : undefined
    }));

    let subjectSnapshots: ExamRecordSubjectInfo[] = [];
    if (exam.examNature === 'Set based' && targetClass) {
        subjectSnapshots = getSubjectsForClassUtil(exam.classId).map(s => ({
        subjectId: s.id, name: s.name, code: s.code, maxMarks: exam.maxMarks, passingMarks: exam.passingMarks
        }));
    } else if (exam.examNature === 'Subject based' && exam.subjectIds) {
      subjectSnapshots = exam.subjectIds
        .map(subId => {
          const subj = sampleSubjects.find(s => s.id === subId);
          return subj ? { subjectId: subId, name: subj.name, code: subj.code, maxMarks: exam.maxMarks, passingMarks: exam.passingMarks } : null;
        })
        .filter(Boolean) as ExamRecordSubjectInfo[];
    }
    
    const initialResultsForPupils: Record<string, Record<string, PupilSubjectResult>> = {};
     pupilSnapshots.forEach(pupil => {
      initialResultsForPupils[pupil.pupilId] = {};
      subjectSnapshots.forEach(subject => {
        initialResultsForPupils[pupil.pupilId][subject.subjectId] = { subjectId: subject.subjectId, marks: undefined, grade: '-', aggregates: undefined, comment: 'N/A' };
      });
    });

    return {
      id: exam.examResultId!,
      examId: exam.id,
      classId: exam.classId,
      pupilSnapshots,
      subjectSnapshots,
      results: initialResultsForPupils,
      recordedAt: new Date().toISOString(), 
      isPublished: false,
    };
};

export const initialExamResultsData: ExamResult[] = initialExamsData
    .filter(exam => exam.examResultId) 
    .map(exam => createExamResultShell(exam));


export const initialAttendanceRecords: AttendanceRecord[] = [];

export const initialExcludedDays: ExcludedDay[] = [
  {
    id: 'exd-1',
    date: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'), 
    description: "New Year's Day",
    type: 'specific_date',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exd-2',
    date: format(new Date(new Date().getFullYear(), 4, 1), 'yyyy-MM-dd'), 
    description: "Labour Day",
    type: 'specific_date',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exd-3',
    type: 'recurring_day_of_week',
    dayOfWeek: 6, 
    description: "Weekend",
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exd-4',
    type: 'recurring_day_of_week',
    dayOfWeek: 0, 
    description: "Weekend",
    createdAt: new Date().toISOString(),
  }
];

const defaultAcademicYearForFees = initialSampleAcademicYears.find(ay => ay.name === currentSystemYear.toString()) || initialSampleAcademicYears.find(ay => !ay.isLocked) || initialSampleAcademicYears[0];
const defaultTermForFees = defaultAcademicYearForFees?.terms.find(t => t.isCurrent) || defaultAcademicYearForFees?.terms[0];

export const initialFeeStructures: FeeStructure[] = [
  {
    id: "fs1",
    name: "Term 1 Tuition Fee",
    amount: 500000,
    category: "Tuition Fee",
    academicYearId: defaultAcademicYearForFees?.id,
    termId: defaultTermForFees?.id,
    classFeeType: "all",
    sectionFeeType: "all",
    isRequired: true,
    isRecurring: true,
    frequency: "Termly",
    status: "active",
    disableHistory: [],
    createdAt: new Date().toISOString(),
    isAssignmentFee: false,
    description: "Standard tuition fee for Term 1.",
  },
  {
    id: "fs2",
    name: "Uniform Set - Lower Primary",
    amount: 150000,
    category: "Uniform Fee",
    academicYearId: defaultAcademicYearForFees?.id,
    termId: defaultTermForFees?.id,
    classFeeType: "specific",
    classIds: sampleClasses.filter(c => c.level === "Lower Primary").map(c => c.id),
    sectionFeeType: "all",
    isRequired: true,
    isRecurring: false,
    frequency: "Once",
    status: "active",
    disableHistory: [],
    createdAt: new Date().toISOString(),
    isAssignmentFee: false,
    description: "Complete uniform set for lower primary students.",
  },
  {
    id: "fs3",
    name: "Sports Day Contribution",
    amount: 25000,
    category: "Activity Fee",
    academicYearId: defaultAcademicYearForFees?.id,
    termId: defaultAcademicYearForFees?.terms?.[1]?.id || defaultTermForFees?.id, 
    classFeeType: "all",
    sectionFeeType: "all",
    isRequired: false,
    isRecurring: false,
    frequency: "Once",
    status: "active",
    disableHistory: [],
    createdAt: new Date().toISOString(),
    isAssignmentFee: false,
    description: "Contribution towards annual sports day activities.",
  },
  {
    id: "fs4",
    name: "Boarding Fee - Term 1",
    amount: 300000,
    category: "Boarding Fee",
    academicYearId: defaultAcademicYearForFees?.id,
    termId: defaultTermForFees?.id,
    classFeeType: "all",
    sectionFeeType: "specific",
    section: "Boarding",
    isRequired: true,
    isRecurring: true,
    frequency: "Termly",
    status: "active",
    disableHistory: [],
    createdAt: new Date().toISOString(),
    isAssignmentFee: false,
    description: "Boarding accommodation fee for Term 1.",
  },
  {
    id: "fs5",
    name: "Early Payment Discount",
    amount: -50000, 
    category: "Discount",
    academicYearId: undefined, 
    termId: undefined,
    classFeeType: "all",
    sectionFeeType: "all",
    isRequired: false, 
    isRecurring: false, 
    frequency: undefined,
    status: "active",
    linkedFeeId: "fs1", 
    disableHistory: [],
    createdAt: new Date().toISOString(),
    isAssignmentFee: false, 
    description: "For fees paid before official start of term.",
  },
  {
    id: "fs6",
    name: "Science Lab Fee - Secondary",
    amount: 75000,
    category: "Activity Fee",
    isAssignmentFee: true, 
    isRequired: true,
    isRecurring: false, 
    status: "active",
    classFeeType: 'all', 
    sectionFeeType: 'all', 
    disableHistory: [],
    createdAt: new Date().toISOString(),
    description: "Laboratory usage fee for secondary science classes.",
  }
];

export const initialFeeAdjustments: FeeAdjustmentEntry[] = [];



export const samplePaymentRecords = [
  // Sample payments for real Firebase pupil IDs
  {
    id: 'pay-3',
    pupilId: 'nQNOtVaIGMYpn4o4qbic',
    feeStructureId: 'fs1',
    academicYearId: 'ay-2025',
    termId: 't1-2025',
    amount: 200000,
    paymentDate: new Date(2025, 1, 15).toISOString(),
    balance: 300000,
    paidBy: {
      id: 'admin-1',
      name: 'System Admin',
      role: 'Admin'
    },
    notes: 'Partial payment for current term tuition',
    reverted: false,
    createdAt: new Date(2025, 1, 15).toISOString()
  }
];
    
    
