import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
};

export type NavGroup = {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
};

export type NavigationItem = NavItem | NavGroup;

// Helper type guards
export const isNavGroup = (item: NavigationItem): item is NavGroup => {
  return 'items' in item;
};

export const isNavItem = (item: NavigationItem): item is NavItem => {
  return 'href' in item;
};

// User Management Types
export type UserRole = 'Admin' | 'Staff' | 'Parent';

export type Permission = 
  | 'view_only'           // Can only view, no editing
  | 'edit'               // Can view and edit
  | 'full_access';       // Can view, edit, and delete

// Legacy module permission type (kept for backward compatibility)
export type ModulePermission = {
  module: 'pupils' | 'classes' | 'staff' | 'subjects' | 'fees' | 'exams' | 'attendance' | 'academic_years' | 'users' | 'banking' | 'procurement' | 'requirements' | 'uniforms' | 'notifications' | 'bulk_sms' | 'reports' | 'settings' | 'pupil_history' | 'events' | 'promotion';
  permission: Permission;
};

// New granular permission types
export interface ActionPermission {
  actionId: string;
  allowed: boolean;
}

export interface PagePermission {
  pageId: string;
  canAccess: boolean;
  actions: ActionPermission[];
}

export interface ModulePermissions {
  moduleId: string;
  pages: PagePermission[];
}

export type SystemUser = {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  
  // Staff-specific fields
  staffId?: string; // Links to Staff record
  firstName?: string;
  lastName?: string;
  modulePermissions?: ModulePermission[]; // Legacy - for backward compatibility
  granularPermissions?: ModulePermissions[]; // New granular permissions
  
  // Parent-specific fields
  pupilId?: string; // Links to Pupil record for parents (legacy - for backward compatibility)
  familyId?: string; // Links to Family - preferred method for parent accounts
  guardianId?: string; // Links to specific guardian
  
  // Authentication
  passwordHash?: string; // For development - in production use Firebase Auth
  lastLogin?: string;
  
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
};

// Legacy User type for backward compatibility
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Teacher' | 'Student' | 'Staff';
  avatar?: string;
  createdAt: string;
};

export type Guardian = {
  id: string;
  relationship: string;
  firstName: string;
  lastName: string;
  phone: string;
  additionalPhones?: string[]; // Array of additional phone numbers
  email?: string;
  occupation?: string;
  address?: string;
};

export type AdditionalIdentifier = {
  idType: string;
  idValue: string;
  customIdName?: string;
};

export type PromotionHistoryEntry = {
  date: string; // ISO date string
  fromClassId: string | undefined | null;
  fromClassName?: string;
  toClassId: string;
  toClassName?: string;
  type: 'Promotion' | 'Demotion' | 'Transfer' | 'Initial Placement' | 'Graduation';
  notes?: string;
  processedBy?: string;
  academicYearId?: string; // For graduation tracking
  graduationYear?: number; // For graduation entries
};

export type PupilStatus = 'Active' | 'Inactive' | 'Graduated' | 'Transferred' | '';

export type StatusChangeHistoryEntry = {
  date: string; // ISO date string
  fromStatus: PupilStatus | 'N/A';
  toStatus: PupilStatus;
  reason?: string;
  processedBy?: string;
};

export type FeeValidityType = 'indefinite' | 'current_term' | 'current_year' | 'specific_year' | 'year_range' | 'specific_terms';
export type TermApplicabilityType = 'all_terms' | 'specific_terms';
export type AssignmentStatus = 'active' | 'disabled';
export type DisableEffectType = 'from_next_term' | 'from_current_term';

export interface AssignmentStatusHistory {
  date: string; // ISO date string
  action: 'enabled' | 'disabled' | 'time_adjusted';
  previousStatus?: AssignmentStatus;
  newStatus: AssignmentStatus;
  disableEffect?: DisableEffectType; // Only for disable actions
  reason?: string;
  processedBy?: string;
  previousTimeSettings?: {
    validityType: FeeValidityType;
    startAcademicYearId?: string;
    endAcademicYearId?: string;
    termApplicability: TermApplicabilityType;
    applicableTermIds?: string[];
  };
}

export interface PupilAssignedFee {
  id: string; 
  feeStructureId: string; 
  assignedAt: string; 
  assignedBy?: string; 
  notes?: string; 
  status: AssignmentStatus; // New field for enable/disable

  // Enhanced validity fields
  validityType: FeeValidityType;
  startAcademicYearId?: string; // For 'specific_year' and 'year_range' start
  endAcademicYearId?: string;   // For 'year_range' end

  termApplicability: TermApplicabilityType;
  applicableTermIds?: string[]; // If termApplicability is 'specific_terms'
  
  // Status history tracking
  statusHistory?: AssignmentStatusHistory[];
}

export interface Pupil {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  admissionNumber: string;
  gender: 'Male' | 'Female' | '';
  dateOfBirth?: string; // YYYY-MM-DD
  placeOfBirth?: string;
  nationality?: string;
  religion?: string;
  address?: string;
  classId: string;
  className?: string; // Denormalized for easier display
  classCode?: string; // Denormalized
  photo?: string; // URL or base64 string
  section: 'Day' | 'Boarding' | '';
  status: PupilStatus;
  guardians: Guardian[];
  emergencyContactGuardianId?: string; // ID of one of the guardians
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
  bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown' | '';
  learnerIdentificationNumber?: string; // LIN - can be moved to additionalIdentifiers
  previousSchool?: string;
  registrationDate?: string; // YYYY-MM-DD
  familyId?: string; // To link siblings
  transportRouteId?: string;
  houseId?: string; // For schools with house systems
  additionalIdentifiers?: AdditionalIdentifier[]; // New field
  promotionHistory?: PromotionHistoryEntry[];
  statusChangeHistory?: StatusChangeHistoryEntry[];
  assignedFees?: PupilAssignedFee[];
  
  // Graduation-specific fields
  graduationDate?: string; // YYYY-MM-DD when status changed to Graduated
  graduationYear?: number; // Year of graduation for easy filtering
  graduationClassId?: string; // Class they graduated from
  graduationClassName?: string; // Denormalized class name
  graduationAcademicYearId?: string; // Academic year of graduation
  
  createdAt: string;
}

export type Staff = {
  id:string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  employeeId: string;
  dateOfBirth: string;
  nationalId?: string;
  religion?: string;
  gender?: 'Male' | 'Female';
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  department: string[]; // Changed to array to support multiple departments
  role: string[]; // Changed to array to support multiple roles 
  contactNumber: string;
  alternativePhone?: string;
  email: string;
  address?: string;
  city?: string;
  country?: string;
  joinDate?: string;
  status?: 'active' | 'inactive' | 'onLeave';
  contractType?: 'permanent' | 'contract' | 'temporary';
  qualifications?: string[];
  specializations?: string[];
  bloodGroup?: string;
  allergies?: string[];
  medicalConditions?: string[];
  medications?: string[];
  insuranceProvider?: string;
  insuranceNumber?: string;
  vaccinationStatus?: string[];
  photo?: string;
  cvPhotos?: string[];
  qualificationPhotos?: string[];
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
    address?: string;
  };
  createdAt: string;
  updatedAt?: string;
};

export type ClassLevel = 'Nursery' | 'Lower Primary' | 'Upper Primary' | 'Secondary' | 'Other';

export type SubjectAssignment = {
  subjectId: string;
  teacherId: string | null; 
};

export type Class = {
  id: string;
  name: string;
  code: string; // Class abbreviation e.g., P.1, S.2, etc.
  level: ClassLevel;
  order: number; 
  classTeacherId: string;
  classTeacherName?: string; 
  subjectAssignments: SubjectAssignment[];
  subjects?: Subject[]; 
  createdAt: string;
};

export type Subject = {
  id: string;
  name: string;
  code: string;
  type: 'Core' | 'Elective' | 'Optional';
  createdAt: string;
};

export interface SchoolSettings {
  generalInfo: {
    name: string;
    logo?: string; 
    motto?: string;
    establishedYear?: string;
    schoolType?: string;
    registrationNumber?: string;
  };
  contact: {
    email?: string;
    phone?: string;
    alternativePhone?: string;
    website?: string;
  };
  address: {
    physical?: string;
    postal?: string;
    poBox?: string; // P.O Box field for reports
    city?: string;
    country?: string;
  };
  headTeacher: {
    name?: string;
    signature?: string; 
    message?: string;
  };
  visionMissionValues: {
    vision?: string;
    mission?: string;
    coreValues?: string; 
    description?: string; 
  };
  socialMedia?: { 
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
}

// Comment Management Types
export interface CommentTemplate {
  id: string;
  status: 'good' | 'fair' | 'weak' | 'young' | 'irregular';
  type: 'class_teacher' | 'head_teacher';
  comment: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentCategory {
  status: string;
  label: string;
  classTeacherComments: CommentTemplate[];
  headTeacherComments: CommentTemplate[];
}

export interface Term {
  id: string;
  name: string; 
  startDate: string; 
  endDate: string; 
  isCurrent?: boolean;
}

export interface AcademicYear {
  id: string;
  name: string; 
  startDate: string; 
  endDate: string; 
  terms: Term[];
  isActive?: boolean; 
  isLocked: boolean; 
}

export interface ExamType {
  id: string;
  name: string; 
}

export type ExamStatus = 'Scheduled' | 'Ongoing' | 'Completed' | 'Graded' | 'Cancelled';
export type ExamNature = 'Set based' | 'Subject based' | '';

export interface Exam {
  id: string;
  name: string; 
  baseName?: string; 
  batchId?: string; 
  examTypeId: string; 
  examTypeName?: string;
  customExamTypeName?: string; 
  examNature?: ExamNature;
  
  classId: string; 
  subjectIds?: string[]; 

  academicYearId?: string;
  termId?: string;
  
  startDate: string; 
  startTime?: string; 
  endDate: string; 
  endTime?: string; 
  
  maxMarks: number;
  passingMarks: number;
  
  status: ExamStatus;
  instructions?: string;
  examResultId?: string; 
  
  createdAt: string; 
  updatedAt?: string; 
}

export type CreateExamData = Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateExamData = Partial<Omit<Exam, 'id' | 'createdAt'>>;

// Fee Structure types
export type CreateFeeStructureData = Omit<FeeStructure, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateFeeStructureData = Partial<Omit<FeeStructure, 'id' | 'createdAt'>>;

export interface GradingScaleItem {
  minMark: number;
  maxMark: number; 
  grade: string;
  aggregates?: number; 
  comment?: string;
}

export interface ExamRecordPupilInfo { 
  pupilId: string;
  name: string; 
  admissionNumber: string;
  classNameAtExam: string; 
  classCodeAtExam?: string;
  ageAtExam?: number; 
  dateOfBirth?: string; // Add date of birth for age calculation
  section?: 'Day' | 'Boarding' | '';
  status?: PupilStatus;
  gender?: 'Male' | 'Female' | 'Other' | '';
  rMQRCode?: string; // Rectangular Micro QR Code
}

export interface ExamRecordSubjectInfo { 
  subjectId: string;
  name: string;
  code: string;
  maxMarks: number; 
  passingMarks: number; 
  teacherId?: string | null;
  teacherName?: string;
}

export interface PupilSubjectResult {
  subjectId: string; 
  marks?: number;
  grade?: string;
  aggregates?: number;
  comment?: string;
  status?: 'present' | 'missed'; // New field to track attendance status
}

// New interface for Class Snapshot
export interface ExamClassInfoSnapshot {
  classId: string;
  name: string;
  code: string;
  level?: ClassLevel;
  classTeacherId?: string;
  classTeacherName?: string;
  subjectsTaught: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    teacherId?: string | null;
    teacherName?: string;
  }>;
  pupilsInClassAtExamCreation: Array<{
    pupilId: string;
    name: string;
    admissionNumber: string;
  }>;
}

export interface ResultReleaseInfo {
  examId: string;
  classId: string;
  releasedPupils: string[]; // Array of pupil IDs whose results are released
  releasedBy: string; // Admin user ID who released the results
  releasedAt: string; // Timestamp of release
  adminPasswordHash?: string; // Optional: for additional security
  releaseNotes?: string; // Optional: admin notes about the release
}

export interface ExamResult {
  id: string; 
  examId: string; 
  classId: string;
  classSnapshot?: ExamClassInfoSnapshot;
  pupilSnapshots: ExamRecordPupilInfo[];
  subjectSnapshots: ExamRecordSubjectInfo[];
  results: Record<string, Record<string, PupilSubjectResult>>; 
  majorSubjects?: string[]; // Subject codes for major subjects (used for aggregates when >4 subjects)
  isPublished?: boolean;
  recordedAt: string; 
  recordedBy?: string;
  gradingScale?: GradingScaleItem[];
  lastUpdatedAt?: string;
  isReleasedToParents?: boolean; // Per-pupil release status
  releasedAt?: string; // When this specific result was released
  releasedBy?: string; // Admin who released this specific result
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused' | '';

export interface AttendanceRecord {
  id: string;
  date: string; 
  classId: string;
  pupilId: string;
  status: AttendanceStatus;
  remarks?: string;
  recordedAt: string; 
  recordedBy?: string;
  
  // NEW: Academic context for historical accuracy
  academicYearId: string;
  termId: string;
}

export interface ExcludedDay {
  id: string;
  date?: string; 
  description?: string; 
  type: 'specific_date' | 'recurring_day_of_week'; 
  dayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6; 
  createdAt: string;
}

// Fees Management Types
export type FeeCategory = "Tuition Fee" | "Uniform Fee" | "Activity Fee" | "Transport Fee" | "Boarding Fee" | "Development Fee" | "Examination Fee" | "Other Fee" | "Discount";
export type FeeFrequency = "Termly" | "Yearly" | "Once" | undefined;
export type FeeStatus = "active" | "disabled";
export type ClassFeeType = "all" | "specific" | undefined; 
export type SectionFeeType = "all" | "specific" | undefined; 
export type FeeSection = "Day" | "Boarding" | undefined; 

export type DisableTypeOption = 'immediate_indefinite' | 'from_year_onwards' | 'year_range';

export interface DisableHistoryEntry {
  date: string; // Date the disable action was recorded
  reason: string;
  disabledBy: string;
  disableType: DisableTypeOption;
  startYearId?: string; // For 'from_year_onwards' and 'year_range' (ID of the AcademicYear)
  endYearId?: string;   // For 'year_range' (ID of the AcademicYear)
}


export interface FeeStructure {
  id: string;
  name: string;
  amount: number; // Base amount
  category: FeeCategory;
  
  academicYearId?: string; 
  termId?: string; 
  
  classFeeType?: ClassFeeType; 
  classIds?: string[]; 
  
  sectionFeeType?: SectionFeeType; 
  section?: FeeSection; 
  
  isRequired: boolean;
  isRecurring: boolean;
  frequency?: FeeFrequency; 
  
  isAssignmentFee?: boolean; 
  linkedFeeId?: string; 
  description?: string;

  status: FeeStatus;
  disableHistory?: DisableHistoryEntry[];
  createdAt: string;
  updatedAt?: string;
}

// Fee Adjustments
export type FeeAdjustmentType = 'increase' | 'decrease';
export type FeeAdjustmentEffectivePeriodType = 'from_year_onwards' | 'year_range' | 'specific_year';

export interface FeeAdjustmentEntry {
  id: string;
  feeStructureId: string; 
  adjustmentType: FeeAdjustmentType;
  amount: number; // Always positive
  effectivePeriodType: FeeAdjustmentEffectivePeriodType;
  startYearId: string; // ID of the AcademicYear
  endYearId?: string;   // ID of the AcademicYear, for 'year_range'
  reason?: string;
  createdAt: string; // ISO date string
  adjustedBy?: string; // Placeholder for user
}

// Payment-related types
export interface PaymentRecord {
  id: string;
  pupilId: string;
  feeStructureId: string;

  academicYearId: string;
  termId: string;
  amount: number;
  paymentDate: string;
  balance?: number; // Remaining balance after this payment
  paidBy: {
    id: string;
    name: string;
    role: string;
  };
  notes?: string;
  reverted?: boolean;
  revertedAt?: string;
  revertedBy?: {
    id: string;
    name: string;
  };
  

  
  createdAt: string | Date;
}

// Photo/Media Management Types
export type PhotoCategory = 'school_building' | 'classroom' | 'playground' | 'events' | 'staff' | 'activities' | 'facilities' | 'other';
export type PhotoUsage = 'dashboard' | 'homepage' | 'login' | 'about' | 'gallery' | 'background' | 'banner' | 'general';

export interface Photo {
  id: string;
  title: string;
  description?: string;
  category: PhotoCategory;
  usage: PhotoUsage[];
  url: string; // Firebase Storage URL
  thumbnailUrl?: string; // Optimized thumbnail URL
  fileName: string;
  fileSize: number; // in bytes
  dimensions?: {
    width: number;
    height: number;
  };
  isActive: boolean;
  isPrimary?: boolean; // For featured/primary photos in each category
  uploadedBy: string;
  uploadedAt: string;
  updatedAt?: string;
  tags?: string[]; // For better searchability
}

// Uniform Management Types
export type UniformGender = 'male' | 'female' | 'all';
export type UniformClassType = 'all' | 'specific';
export type UniformSectionType = 'all' | 'specific';
export type UniformSection = 'Day' | 'Boarding';

export interface UniformItem {
  id: string;
  name: string;
  group: string; // Category like "Shirts", "Trousers", "Accessories", etc.
  price: number;
  gender: UniformGender;
  classType: UniformClassType;
  classIds?: string[]; // Only used when classType is 'specific'
  sectionType: UniformSectionType;
  section?: UniformSection; // Only used when sectionType is 'specific'
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type CreateUniformData = Omit<UniformItem, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateUniformData = Partial<Omit<UniformItem, 'id' | 'createdAt'>>;

export interface UniformFormData {
  name: string;
  price: string; // String for form handling, converted to number in service
  group: string;
  gender: UniformGender;
  classType: UniformClassType;
  classIds?: string[];
  sectionType: UniformSectionType;
  section?: UniformSection;
  description?: string;
}

// Uniform Tracking Types
export type SelectionMode = 'item' | 'partial' | 'full';
export type PaymentStatus = 'paid' | 'pending' | 'partial';
export type CollectionStatus = 'pending' | 'collected';

// Discount Types
export type DiscountType = 'static' | 'dynamic';
export type DiscountValueType = 'percentage' | 'fixed';

export interface DiscountConfig {
  isEnabled: boolean;
  type: DiscountType;
  valueType: DiscountValueType;
  value: number; // percentage (0-100) or fixed amount
  reason?: string;
  appliedBy?: string;
  appliedAt: string;
  dynamicDiscountId?: string; // ID of the dynamic discount that was applied (for auto-applied discounts)
}

export interface DynamicDiscount {
  id: string;
  uniformId?: string | string[]; // specific uniform(s) or undefined for all
  selectionMode?: SelectionMode; // specific mode or undefined for all
  classId?: string; // specific class or undefined for all
  section?: string; // specific section or undefined for all
  gender?: string; // specific gender or undefined for all
  valueType: DiscountValueType;
  value: number;
  reason: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  expiresAt?: string; // optional expiration date
  updatedAt?: string;
}

export interface UniformHistory {
  date: string;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  collectionStatus: CollectionStatus;
  collectionDate?: string;
  receivedBy?: string;
  releasedBy?: string;
  collectedItems?: string[];
}

export interface UniformTracking {
  id: string;
  pupilId: string;
  uniformId: string | string[];
  paymentStatus: PaymentStatus;
  paidAmount: number;
  paymentDate?: string;
  collectionStatus: CollectionStatus;
  collectionDate?: string;
  releasedBy?: string;
  receivedBy?: string;
  collectedItems?: string[];
  history?: UniformHistory[];
  selectionMode: SelectionMode;
  
  // Academic year and term tracking for fees integration
  academicYearId: string;
  termId: string;
  
  // Discount fields
  originalAmount: number; // amount before discount
  discountConfig?: DiscountConfig;
  finalAmount: number; // amount after discount
  
  createdAt: string;
  updatedAt?: string;
}

export type CreateUniformTrackingData = Omit<UniformTracking, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateUniformTrackingData = Partial<Omit<UniformTracking, 'id' | 'createdAt'>>;

export interface UniformTrackingFormData {
  uniformId: string | string[];
  selectionMode: SelectionMode;
  paidAmount: string; // String for form handling
  paymentStatus: PaymentStatus;
  collectionStatus: CollectionStatus;
  
  // Academic year and term selection
  academicYearId: string;
  termId: string;
  
  // Discount form fields
  hasDiscount: boolean;
  discountType: DiscountType;
  discountValueType: DiscountValueType;
  discountValue: string; // String for form handling
  discountReason: string;
}

// Requirements Management Types
export type RequirementGender = 'male' | 'female' | 'all';
export type RequirementClassType = 'all' | 'specific';
export type RequirementSectionType = 'all' | 'specific';
export type RequirementSection = 'Day' | 'Boarding';
export type RequirementFrequency = 'termly' | 'yearly' | 'one-time';

export interface RequirementItem {
  id: string;
  name: string;
  group: string; // Category like "Books", "Stationery", "Equipment", etc.
  price: number;
  quantity?: number; // Number of items required (optional for flexible requirements)
  gender: RequirementGender;
  classType: RequirementClassType;
  classIds?: string[]; // Only used when classType is 'specific'
  sectionType: RequirementSectionType;
  section?: RequirementSection; // Only used when sectionType is 'specific'
  frequency: RequirementFrequency;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type CreateRequirementData = Omit<RequirementItem, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateRequirementData = Partial<Omit<RequirementItem, 'id' | 'createdAt'>>;

export interface RequirementFormData {
  name: string;
  price: string; // String for form handling, converted to number in service
  quantity?: string; // String for form handling, converted to number in service
  group: string;
  gender: RequirementGender;
  classType: RequirementClassType;
  classIds?: string[];
  sectionType: RequirementSectionType;
  section?: RequirementSection;
  frequency: RequirementFrequency;
  description?: string;
}

// Requirement Tracking Types
export type RequirementPaymentStatus = 'paid' | 'pending' | 'partial';
export type RequirementReleaseStatus = 'pending' | 'released';
export type RequirementSelectionMode = 'full' | 'partial' | 'item';
export type RequirementCoverageMode = 'cash' | 'item';
export type RequirementReceiptType = 'payment_only' | 'receipt_only' | 'payment_and_receipt';
export type RequirementReceiptLocation = 'office' | 'class';

export interface RequirementHistory {
  date: string;
  paymentStatus: RequirementPaymentStatus;
  paidAmount: number;
  coverageMode: RequirementCoverageMode;
  itemQuantityProvided?: number; // For item coverage mode
  releaseStatus: RequirementReleaseStatus;
  releaseDate?: string;
  receivedBy?: string;
  releasedBy?: string;
  releasedItems?: string[];
  academicYearId?: string;
  termId?: string;
  
  // New receipt tracking fields
  receiptType?: RequirementReceiptType; // Type of transaction
  itemQuantityReceived?: number; // Items actually received in class
  receiptLocation?: RequirementReceiptLocation; // Where the transaction occurred
  isOfficePayment?: boolean; // True if this was paid at office
  classReceiptDate?: string; // When items were received in class
  classReceivedBy?: string; // Teacher who received items in class
}

export interface RequirementTracking {
  id: string;
  pupilId: string;
  requirementId: string | string[];
  academicYearId: string;
  termId?: string;
  paymentStatus: RequirementPaymentStatus;
  paidAmount: number;
  paymentDate?: string;
  
  // Coverage tracking
  coverageMode: RequirementCoverageMode;
  totalItemQuantityRequired?: number; // Total quantity needed (calculated from requirements)
  itemQuantityProvided?: number; // Total quantity provided through items (office payments)
  remainingQuantity?: number; // Calculated: totalRequired - itemProvided
  
  // New receipt tracking fields
  itemQuantityReceived?: number; // Total quantity actually received in class
  itemQuantityReceivedFromOffice?: number; // Items received that were paid at office
  itemQuantityReceivedFromParent?: number; // Items received directly from parent
  lastClassReceiptDate?: string; // When items were last received in class
  lastClassReceivedBy?: string; // Teacher who last received items in class
  
  releaseStatus: RequirementReleaseStatus;
  releaseDate?: string;
  releasedBy?: string;
  receivedBy?: string;
  releasedItems?: string[];
  history?: RequirementHistory[];
  selectionMode: RequirementSelectionMode;
  createdAt: string;
  updatedAt?: string;
}

export type CreateRequirementTrackingData = Omit<RequirementTracking, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateRequirementTrackingData = Partial<Omit<RequirementTracking, 'id' | 'createdAt'>>;

export interface RequirementTrackingFormData {
  requirementId: string | string[];
  selectionMode: RequirementSelectionMode;
  paidAmount: string; // String for form handling
  paymentStatus: RequirementPaymentStatus;
  releaseStatus: RequirementReleaseStatus;
  coverageMode: RequirementCoverageMode;
  itemQuantityProvided?: string; // String for form handling
}

// Banking Types
export interface Account {
  id: string;
  pupilId: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Loan {
  id: string;
  pupilId: string;
  amount: number;
  amountRepaid: number;
  purpose: string;
  repaymentDate: string;
  status: 'ACTIVE' | 'PAID' | 'CANCELLED';
  createdAt: string;
  updatedAt?: string;
  
  // NEW: Academic context for historical tracking
  academicYearId?: string;
  termId?: string;
  
  // NEW: Cancellation tracking
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface Transaction {
  id: string;
  pupilId: string;
  accountId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'LOAN_DISBURSEMENT' | 'LOAN_REPAYMENT';
  amount: number;
  description: string;
  balance: number;
  transactionDate: string;
  createdAt: string;
  processedBy?: string;
  
  // NEW: Academic context for historical tracking
  academicYearId: string;
  termId: string;
  
  // NEW: Reversal tracking
  isReverted?: boolean;
  revertedAt?: string;
  revertedBy?: string;
  originalTransactionId?: string; // For reversal transactions, links to the original
}

// NEW: Enhanced banking types with snapshot integration
export interface EnhancedTransaction extends Transaction {
  // Historical pupil data (from snapshot or live data)
  pupilSnapshotData?: {
    classId: string;
    section: string;
    admissionNumber: string;
    dateOfBirth?: string;
    dataSource: 'snapshot' | 'live';
    snapshotId?: string;
  };
}

export interface EnhancedLoan extends Loan {
  // Historical pupil data (from snapshot or live data)
  pupilSnapshotData?: {
    classId: string;
    section: string;
    admissionNumber: string;
    dateOfBirth?: string;
    dataSource: 'snapshot' | 'live';
    snapshotId?: string;
  };
}

export interface EnhancedAccount extends Account {
  // Historical pupil data and context
  pupilSnapshotData?: {
    classId: string;
    section: string;
    admissionNumber: string;
    dateOfBirth?: string;
    dataSource: 'snapshot' | 'live';
    snapshotId?: string;
  };
  // Enhanced transaction history
  transactions?: EnhancedTransaction[];
  // Enhanced loan history  
  loans?: EnhancedLoan[];
}

export type CreateAccountData = Omit<Account, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateLoanData = Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'amountRepaid' | 'status'>;
export type CreateTransactionData = Omit<Transaction, 'id' | 'createdAt' | 'balance'>;

// Notification System Types
export type NotificationStatus = 'pending' | 'completed' | 'cancelled' | 'failed';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationType = 'reminder' | 'alert' | 'announcement' | 'task' | 'system' | 'fee_reminder' | 'exam_reminder' | 'attendance_alert' | 'flow';

export interface NotificationRecipient {
  id: string;
  type: 'user' | 'group' | 'all_staff' | 'all_parents' | 'all_admins' | 'all_users';
  name?: string;
}

export interface NotificationGroup {
  id: string;
  name: string;
  description: string;
  userIds: string[];
  type: 'admin' | 'staff' | 'parent' | 'custom';
  createdAt: string;
  updatedAt: string;
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: string;
  isActive: boolean;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  userId: string;
  method: 'push' | 'email' | 'sms' | 'in_app';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  error?: string;
  retryCount: number;
}

export interface Notification {
  id: string;
  title: string;
  description?: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  recipients: NotificationRecipient[];
  targetGroups: string[]; // Group IDs
  createdBy: string;
  createdAt: string;
  scheduledFor?: string;
  sentAt?: string;
  completedAt?: string;
  updatedAt?: string;
  
  // Push notification specific
  enablePush: boolean;
  pushTitle?: string;
  pushBody?: string;
  pushIcon?: string;
  pushImage?: string;
  pushUrl?: string;
  
  // Flow notification specific (rich content)
  richContent?: {
    longMessage?: string; // Support for 3000+ characters
    attachments?: Array<{
      id: string;
      name: string;
      type: 'pdf' | 'image' | 'document';
      url: string;
      downloadUrl?: string;
      size: number;
      uploadedAt: string;
    }>;
    formatting?: {
      useMarkdown?: boolean;
      allowHtml?: boolean;
    };
  };
  
  // Delivery tracking
  deliveryStats: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    read: number;
  };
  
  // Read tracking
  readBy: string[]; // Array of user IDs who have read this notification
  
  // Actions
  actions?: NotificationAction[];
  
  // Metadata
  metadata?: Record<string, any>;
  expiresAt?: string;
  
  // Legacy fields for backward compatibility
  deliveryAttempts?: number;
  lastDeliveryAttempt?: string;
}

export interface NotificationAction {
  id: string;
  title: string;
  action: string;
  icon?: string;
  url?: string;
}

export interface CreateNotificationData {
  title: string;
  description?: string;
  type: NotificationType;
  priority: NotificationPriority;
  status?: NotificationStatus;
  recipients: NotificationRecipient[];
  targetGroups?: string[];
  createdBy: string;
  scheduledFor?: string;
  
  // Push notification settings
  enablePush?: boolean;
  pushTitle?: string;
  pushBody?: string;
  pushIcon?: string;
  pushImage?: string;
  pushUrl?: string;
  
  // Flow notification specific (rich content)
  richContent?: {
    longMessage?: string;
    attachments?: Array<{
      id: string;
      name: string;
      type: 'pdf' | 'image' | 'document';
      url: string;
      downloadUrl?: string;
      size: number;
      uploadedAt: string;
    }>;
    formatting?: {
      useMarkdown?: boolean;
      allowHtml?: boolean;
    };
  };
  
  // Actions
  actions?: NotificationAction[];
  
  // Metadata
  metadata?: Record<string, any>;
  expiresAt?: string;
}

export interface UpdateNotificationData {
  title?: string;
  description?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  recipients?: NotificationRecipient[];
  targetGroups?: string[];
  scheduledFor?: string;
  sentAt?: string;
  completedAt?: string;
  
  // Push notification settings
  enablePush?: boolean;
  pushTitle?: string;
  pushBody?: string;
  pushIcon?: string;
  pushImage?: string;
  pushUrl?: string;
  
  // Actions
  actions?: NotificationAction[];
  
  // Metadata
  metadata?: Record<string, any>;
  expiresAt?: string;
}

// Notification Templates for common scenarios
export interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  type: NotificationType;
  priority: NotificationPriority;
  titleTemplate: string; // Can include placeholders like {{pupilName}}
  descriptionTemplate?: string;
  defaultRecipients: NotificationRecipient[];
  defaultActions?: NotificationAction[];
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export type CreateNotificationTemplateData = Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateNotificationTemplateData = Partial<Omit<NotificationTemplate, 'id' | 'createdAt'>>;

// Sync Context Types
export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt?: string;
  isSyncing: boolean;
  pendingChanges: number;
  syncErrors?: string[];
}

// ===== PROCUREMENT SYSTEM TYPES =====

export type ProcurementCategory = 'Foodstuff' | 'Class Utility' | 'Office Utility' | 'Tools' | 'Equipment' | 'Infrastructure' | 'Transport' | 'Medical' | 'Other';

export type ProcurementUnit = 'Kg' | 'Litres' | 'Dozens' | 'Pieces' | 'Packets' | 'Bags' | 'Boxes' | 'Metres' | 'Bundles' | 'Sets' | 'Rolls' | 'Bottles' | 'Cans' | 'Other';

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Mobile Money' | 'Cheque' | 'Credit Card' | 'Other';

export type BudgetPeriodType = 'Term' | 'Annual';

export type BudgetStatus = 'Draft' | 'Active' | 'Completed' | 'Archived';

export type ViewPeriodType = 'Week' | 'Month' | 'Term' | 'Year';

export type YearViewFormat = 'By Terms' | 'By Months' | 'By Weeks';

// Procurement Item (Master List)
export interface ProcurementItem {
  id: string;
  name: string;
  category: ProcurementCategory;
  unit: ProcurementUnit;
  customUnit?: string; // For 'Other' unit type
  useCase: string; // Purpose/description
  description?: string;
  isActive: boolean;
  stockTracking?: boolean; // For future stock management
  reorderLevel?: number; // For future stock alerts
  averagePrice?: number; // Calculated from purchase history
  lastPurchasePrice?: number;
  lastPurchaseDate?: string;
  totalQuantityPurchased?: number; // Lifetime total
  totalAmountSpent?: number; // Lifetime total
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Purchase Record
export interface ProcurementPurchase {
  id: string;
  itemId: string;
  itemName?: string; // Denormalized for easier display
  itemCategory?: ProcurementCategory; // Denormalized
  quantity: number;
  unitCost: number;
  totalCost: number; // Auto-calculated: quantity * unitCost
  supplierName?: string;
  supplierContact?: string;
  paymentMethod: PaymentMethod;
  procuredBy: string; // Staff name or ID
  procuredByUserId?: string; // New field for authentication audit trail
  procuredByUsername?: string; // New field for authentication audit trail
  purchaseDate: string; // ISO date string
  
  // Auto-linked time periods
  academicYearId: string;
  academicYearName?: string; // Denormalized
  termId: string;
  termName?: string; // Denormalized
  weekNumber?: number; // Week of the year
  monthNumber?: number; // Month of the year (1-12)
  
  invoiceNumber?: string;
  receiptNumber?: string;
  receiptImageUrl?: string; // For uploaded receipts
  notes?: string;
  
  // Approval workflow (optional)
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  
  // Audit trail fields
  modifiedBy?: string; // Name of user who modified the record
  modifiedByUserId?: string; // ID of user who modified the record
  modifiedByUsername?: string; // Username of user who modified the record
  
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Budget Entry
export interface BudgetItem {
  id: string;
  itemId: string;
  itemName?: string; // Denormalized
  itemCategory?: ProcurementCategory; // Denormalized
  estimatedQuantity: number;
  estimatedUnitPrice: number;
  estimatedTotalCost: number; // Auto-calculated
  notes?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
}

// Budget Plan
export interface ProcurementBudget {
  id: string;
  name: string;
  description?: string;
  periodType: BudgetPeriodType;
  
  // Time period
  academicYearId: string;
  academicYearName?: string; // Denormalized
  termId?: string; // Only for Term budgets
  termName?: string; // Denormalized
  
  // Budget period dates
  startDate: string;
  endDate: string;
  
  budgetItems: BudgetItem[];
  totalEstimatedCost: number; // Sum of all budget items
  
  status: BudgetStatus;
  
  // Approval workflow
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Budget vs Actual Comparison
export interface BudgetComparison {
  itemId: string;
  itemName: string;
  itemCategory: ProcurementCategory;
  
  // Budget data
  budgetedQuantity: number;
  budgetedUnitPrice: number;
  budgetedTotalCost: number;
  
  // Actual data
  actualQuantity: number;
  actualAveragePrice: number;
  actualTotalCost: number;
  actualPurchaseCount: number;
  
  // Variance analysis
  quantityVariance: number; // actual - budgeted
  quantityVariancePercentage: number;
  costVariance: number; // actual - budgeted
  costVariancePercentage: number;
  
  // Status flags
  isOverBudget: boolean;
  isUnderUtilized: boolean;
  hasSignificantVariance: boolean; // e.g., >10% variance
}

// Summary/Report Types
export interface ProcurementSummary {
  totalItems: number;
  totalPurchases: number;
  totalAmountSpent: number;
  categorySummary: Record<ProcurementCategory, {
    itemCount: number;
    purchaseCount: number;
    totalSpent: number;
    averagePrice: number;
  }>;
  topExpenseItems: Array<{
    itemId: string;
    itemName: string;
    totalSpent: number;
    purchaseCount: number;
  }>;
  supplierSummary: Record<string, {
    purchaseCount: number;
    totalSpent: number;
  }>;
}

// View/Filter Types
export interface ProcurementFilters {
  categoryIds?: ProcurementCategory[];
  itemIds?: string[];
  supplierNames?: string[];
  procuredBy?: string[];
  paymentMethods?: PaymentMethod[];
  academicYearIds?: string[];
  termIds?: string[];
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface ProcurementViewSettings {
  period: ViewPeriodType;
  yearFormat?: YearViewFormat; // Only for Year view
  groupBy?: 'Category' | 'Item' | 'Supplier' | 'Staff';
  sortBy?: 'Date' | 'Amount' | 'Quantity' | 'Name';
  sortOrder?: 'asc' | 'desc';
}

// Form Data Types
export type CreateProcurementItemData = Omit<ProcurementItem, 'id' | 'createdAt' | 'updatedAt' | 'averagePrice' | 'lastPurchasePrice' | 'lastPurchaseDate' | 'totalQuantityPurchased' | 'totalAmountSpent'>;

export type UpdateProcurementItemData = Partial<Omit<ProcurementItem, 'id' | 'createdAt' | 'createdBy'>>;

export type CreateProcurementPurchaseData = Omit<ProcurementPurchase, 'id' | 'createdAt' | 'updatedAt' | 'totalCost' | 'itemName' | 'itemCategory' | 'academicYearName' | 'termName' | 'weekNumber' | 'monthNumber'>;

export type UpdateProcurementPurchaseData = Partial<Omit<ProcurementPurchase, 'id' | 'createdAt' | 'createdBy'>>;

export type CreateProcurementBudgetData = Omit<ProcurementBudget, 'id' | 'createdAt' | 'updatedAt' | 'totalEstimatedCost' | 'academicYearName' | 'termName'>;

export type UpdateProcurementBudgetData = Partial<Omit<ProcurementBudget, 'id' | 'createdAt' | 'createdBy'>>;

// Export/Import Types
export interface ProcurementExportData {
  items: ProcurementItem[];
  purchases: ProcurementPurchase[];
  budgets: ProcurementBudget[];
  summary: ProcurementSummary;
  filters: ProcurementFilters;
  exportedAt: string;
  exportedBy: string;
  periodInfo: {
    startDate: string;
    endDate: string;
    description: string;
  };
}

// Notification/Alert Types
export interface ProcurementAlert {
  id: string;
  type: 'Budget Exceeded' | 'Frequent Purchase' | 'Price Increase' | 'Stock Low' | 'Approval Required';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  itemId?: string;
  budgetId?: string;
  purchaseId?: string;
  message: string;
  threshold?: number;
  actualValue?: number;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

// Graduate class data structure
export interface GraduateClass {
  classId: string;
  className: string;
  classCode: string;
  graduationYears: number[]; // Years that have graduates from this class
}

export interface GraduatedPupil extends Pupil {
  status: 'Graduated';
  graduationDate: string;
  graduationYear: number;
  graduationClassId: string;
  graduationClassName: string;
}

export interface GraduationBatch {
  year: number;
  classId: string;
  className: string;
  pupils: GraduatedPupil[];
  totalCount: number;
}

// Graduation operation data
export interface GraduatePupilsData {
  pupilIds: string[];
  graduationDate: string;
  academicYearId: string;
  notes?: string;
  processedBy: string;
}

// ========================================
// EVENTS AND CALENDAR MANAGEMENT TYPES
// ========================================

// Event Core Types
export type EventType = 'Academic' | 'Co-curricular' | 'Administrative' | 'Holiday';
export type EventStatus = 'Draft' | 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled';
export type EventPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type RecurrenceFrequency = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
export type NotificationTiming = 'immediate' | 'one_week_before' | 'one_day_before' | 'one_hour_before';
export type CalendarViewType = 'month' | 'week' | 'day' | 'agenda';

// Event Reminder Configuration
export interface EventReminder {
  timing: NotificationTiming;
  enabled: boolean;
  channels: ('in_app' | 'email' | 'sms')[];
}

// Event Recurrence Configuration
export interface EventRecurrence {
  frequency: RecurrenceFrequency;
  interval?: number; // Every N days/weeks/months
  daysOfWeek?: number[]; // For weekly: [1,3,5] = Mon,Wed,Fri (0=Sunday, 6=Saturday)
  endDate?: string; // When recurrence stops (ISO date string)
  occurrences?: number; // Alternative to endDate
}

// Exam Integration Data
export interface EventExamIntegration {
  examIds: string[]; // Array of exam IDs for batch exams
  examName: string;
  maxMarks: number;
  passingMarks: number;
  classIds: string[]; // Array of class IDs
}

// Notification Tracking
export interface EventNotificationRecord {
  timing: NotificationTiming;
  sentAt: string;
  recipients: string[];
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'failed';
  notificationId?: string; // Link to notification system
}

// Main Event Interface
export interface Event {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  priority: EventPriority;
  status: EventStatus;
  
  // Schedule Information
  startDate: string; // ISO date string (YYYY-MM-DD)
  startTime?: string; // HH:MM format (24-hour)
  endDate: string; // ISO date string (YYYY-MM-DD)
  endTime?: string; // HH:MM format (24-hour)
  isAllDay: boolean;
  timezone?: string; // For future timezone support
  
  // Location & Audience
  location?: string;
  targetAudience: string[]; // e.g., ['All Pupils', 'P4 Class', 'Science Teachers', 'Parents']
  
  // Academic Context
  academicYearId?: string;
  academicYearName?: string; // Denormalized
  termId?: string;
  termName?: string; // Denormalized
  classIds?: string[]; // For class-specific events
  classNames?: string[]; // Denormalized class names
  subjectIds?: string[]; // For subject-specific events
  subjectNames?: string[]; // Denormalized subject names
  
  // Recurrence Configuration
  recurrence: EventRecurrence;
  parentEventId?: string; // For recurring events, link to parent
  isRecurringInstance: boolean; // True if this is an instance of a recurring event
  
  // Exam Integration
  isExamEvent: boolean;
  linkedExamId?: string; // If this event is linked to an exam
  examIntegration?: EventExamIntegration;
  
  // Notifications & Reminders
  reminders: EventReminder[];
  notificationsSent: EventNotificationRecord[];
  sendReminders: boolean; // Master toggle for all reminders
  
  // Visual & UI
  colorCode: string; // Hex color for display (e.g., '#4287f5')
  
  // Approval Workflow
  requiresApproval: boolean;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedByName?: string; // Denormalized
  approvedAt?: string;
  rejectionReason?: string;
  
  // Attachments & Resources
  attachments?: EventAttachment[];
  relatedLinks?: EventLink[];
  
  // Attendance Tracking (for events requiring attendance)
  requiresAttendance: boolean;
  expectedAttendees?: string[]; // User IDs expected to attend
  actualAttendees?: string[]; // User IDs who actually attended
  attendanceNotes?: string;
  
  // Metadata & Audit
  createdBy: string;
  createdByName?: string; // Denormalized
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string; // Denormalized
  
  // Legacy support and flexibility
  tags?: string[]; // For categorization and search
  isPublic: boolean; // Whether event is visible to all or restricted
  customFields?: Record<string, any>; // For future extensibility
}

// Event Attachment
export interface EventAttachment {
  id: string;
  name: string;
  url: string;
  type: 'document' | 'image' | 'video' | 'audio' | 'other';
  size: number; // File size in bytes
  uploadedAt: string;
  uploadedBy: string;
}

// Event Related Link
export interface EventLink {
  id: string;
  title: string;
  url: string;
  description?: string;
}

// Event Filter Configuration
export interface EventFilters {
  types?: EventType[];
  statuses?: EventStatus[];
  priorities?: EventPriority[];
  academicYearIds?: string[];
  termIds?: string[];
  classIds?: string[];
  subjectIds?: string[];
  createdBy?: string[];
  targetAudience?: string[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  searchTerm?: string;
  isExamEvent?: boolean;
  requiresApproval?: boolean;
  approvalStatus?: string[];
  tags?: string[];
}

// Calendar View Settings
export interface CalendarViewSettings {
  viewType: CalendarViewType;
  showWeekends: boolean;
  startTime: string; // Start of day view (e.g., '07:00')
  endTime: string; // End of day view (e.g., '18:00')
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 0 | 1; // 0 = Sunday, 1 = Monday
  showEventDetails: boolean;
  colorCoding: 'type' | 'priority' | 'class' | 'subject';
  defaultView: CalendarViewType;
  compactMode: boolean;
  showAllDayEvents: boolean;
  groupByCategory: boolean;
}

// Event Statistics & Analytics
export interface EventStatistics {
  totalEvents: number;
  eventsByType: Record<EventType, number>;
  eventsByStatus: Record<EventStatus, number>;
  eventsByPriority: Record<EventPriority, number>;
  upcomingEvents: number;
  overdueEvents: number;
  eventsThisWeek: number;
  eventsThisMonth: number;
  averageEventsPerWeek: number;
  mostActiveClasses: Array<{
    classId: string;
    className: string;
    eventCount: number;
  }>;
  mostActiveCreators: Array<{
    userId: string;
    userName: string;
    eventCount: number;
  }>;
}

// Event Template for recurring patterns
export interface EventTemplate {
  id: string;
  name: string;
  description?: string;
  type: EventType;
  priority: EventPriority;
  defaultDuration: number; // Duration in minutes
  defaultLocation?: string;
  defaultTargetAudience: string[];
  defaultReminders: EventReminder[];
  colorCode: string;
  requiresApproval: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

// Calendar Export Configuration
export interface CalendarExportSettings {
  format: 'ical' | 'csv' | 'pdf';
  dateRange: {
    startDate: string;
    endDate: string;
  };
  includeTypes: EventType[];
  includeStatuses: EventStatus[];
  includePrivate: boolean;
  timezone: string;
}

// Event Color Scheme Configuration
export interface EventColorScheme {
  id: string;
  name: string;
  colors: Record<EventType, string>; // Type to color mapping
  isDefault: boolean;
  isActive: boolean;
}

// Form Data Types for Event CRUD Operations
export type CreateEventData = Omit<Event, 
  | 'id' 
  | 'createdAt' 
  | 'updatedAt' 
  | 'notificationsSent' 
  | 'actualAttendees'
  | 'academicYearName'
  | 'termName'
  | 'classNames'
  | 'subjectNames'
  | 'createdByName'
  | 'updatedByName'
  | 'approvedByName'
>;

export type UpdateEventData = Partial<Omit<Event, 
  | 'id' 
  | 'createdAt' 
  | 'createdBy'
  | 'createdByName'
  | 'notificationsSent'
>>;

export type CreateEventTemplateData = Omit<EventTemplate, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEventTemplateData = Partial<Omit<EventTemplate, 'id' | 'createdAt' | 'createdBy'>>;

// Event Form Data (for form handling with string inputs)
export interface EventFormData {
  title: string;
  description?: string;
  type: EventType;
  priority: EventPriority;
  status: EventStatus;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  targetAudience: string[];
  academicYearId?: string;
  termId?: string;
  classIds?: string[];
  subjectIds?: string[];
  isExamEvent: boolean;
  linkedExamId?: string;
  sendReminders: boolean;
  reminders: EventReminder[];
  recurrence: EventRecurrence;
  requiresApproval: boolean;
  requiresAttendance: boolean;
  expectedAttendees?: string[];
  colorCode: string;
  tags?: string[];
  isPublic: boolean;
}

// Quick Event Creation (simplified form)
export interface QuickEventData {
  title: string;
  type: EventType;
  startDate: string;
  startTime?: string;
  endDate?: string; // Optional for quick creation
  endTime?: string;
  isAllDay: boolean;
  targetAudience: string[];
  classIds?: string[];
}

// Event Conflict Detection
export interface EventConflict {
  conflictType: 'time_overlap' | 'resource_conflict' | 'audience_overlap';
  conflictingEventId: string;
  conflictingEventTitle: string;
  conflictDetails: string;
  severity: 'warning' | 'error';
  suggestions?: string[];
}

// Bulk Event Operations
export interface BulkEventOperation {
  operation: 'update_status' | 'delete' | 'reschedule' | 'change_type' | 'assign_class';
  eventIds: string[];
  data: Record<string, any>;
  processedBy: string;
  processedAt: string;
  results: {
    successful: string[];
    failed: Array<{
      eventId: string;
      error: string;
    }>;
  };
}

// Calendar Integration Types
export interface CalendarIntegration {
  id: string;
  type: 'google' | 'outlook' | 'apple' | 'ical';
  name: string;
  userId: string;
  isActive: boolean;
  syncSettings: {
    syncDirection: 'import' | 'export' | 'bidirectional';
    includeEventTypes: EventType[];
    syncFrequency: 'realtime' | 'hourly' | 'daily';
  };
  credentials?: Record<string, any>; // Encrypted integration credentials
  lastSyncAt?: string;
  lastSyncStatus: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  createdAt: string;
}

// Event Reminder Job (for background processing)
export interface EventReminderJob {
  id: string;
  eventId: string;
  eventTitle: string;
  timing: NotificationTiming;
  scheduledFor: string; // When to send the reminder
  recipients: Array<{
    userId: string;
    userName: string;
    channels: ('in_app' | 'email' | 'sms')[];
    notificationPreferences?: Record<string, boolean>;
  }>;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sentAt?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

// Permission Types for Events Module
export interface EventPermissions extends ModulePermissions {
  moduleId: 'events';
  pages: [
    {
      pageId: 'events_calendar';
      canAccess: boolean;
      actions: [
        { actionId: 'view_all_events'; allowed: boolean },
        { actionId: 'view_own_events'; allowed: boolean },
        { actionId: 'view_class_events'; allowed: boolean },
        { actionId: 'view_department_events'; allowed: boolean },
        { actionId: 'create_event'; allowed: boolean },
        { actionId: 'create_exam_event'; allowed: boolean },
        { actionId: 'edit_own_events'; allowed: boolean },
        { actionId: 'edit_all_events'; allowed: boolean },
        { actionId: 'delete_own_events'; allowed: boolean },
        { actionId: 'delete_all_events'; allowed: boolean },
        { actionId: 'approve_events'; allowed: boolean },
        { actionId: 'manage_event_templates'; allowed: boolean },
        { actionId: 'export_calendar'; allowed: boolean },
        { actionId: 'manage_calendar_settings'; allowed: boolean },
        { actionId: 'send_event_notifications'; allowed: boolean },
        { actionId: 'view_event_analytics'; allowed: boolean }
      ];
    }
  ];
}

// Add events to ModulePermission union type
export type ExtendedModulePermission = {
  module: 'pupils' | 'classes' | 'staff' | 'subjects' | 'fees' | 'exams' | 'attendance' | 'academic_years' | 'users' | 'banking' | 'procurement' | 'requirements' | 'uniforms' | 'notifications' | 'bulk_sms' | 'reports' | 'settings' | 'events';
  permission: Permission;
};

export interface PupilTermSnapshot {
  id: string;
  pupilId: string;
  termId: string;
  academicYearId: string;
  
  // Core snapshot data - these are the key fields that get locked when terms end
  classId: string;
  section: string;
  admissionNumber: string;  // NEW: Preserve admission number as it was during the term
  dateOfBirth?: string;     // NEW: Preserve date of birth (in case it gets corrected later)
  
  // Metadata
  isActive: boolean;
  snapshotDate: string; // When this snapshot was created
  termStartDate: string; // When the term started
  termEndDate: string; // When the term ended
  createdAt: string;
  updatedAt: string;
}

// NEW: Enhanced attendance record with historical pupil data
export interface EnhancedAttendanceRecord extends AttendanceRecord {
  // Historical pupil data (from snapshot or live data)
  pupilSnapshotData?: {
    classId: string;
    section: string;
    admissionNumber: string;
    dateOfBirth?: string;
    dataSource: 'snapshot' | 'live'; // Indicates source of data
    snapshotId?: string; // If from snapshot, reference to snapshot
  };
}

// NEW: Enhanced requirement tracking with historical accuracy
export interface EnhancedRequirementTracking extends RequirementTracking {
  // Historical pupil data (from snapshot or live data)
  pupilSnapshotData?: {
    classId: string;
    section: string;
    admissionNumber: string;
    dateOfBirth?: string;
    dataSource: 'snapshot' | 'live'; // Indicates source of data
    snapshotId?: string; // If from snapshot, reference to snapshot
  };
}

// Re-export digital signature types
export * from './digital-signature';


