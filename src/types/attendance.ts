// Event Attendance Tracking Types

export type AttendanceStatus = 'present' | 'absent' | 'late';

// Individual record types for storing within the main document
export interface PupilAttendanceEntry {
  pupilId: string;
  pupilName: string;
  className: string;
  status: AttendanceStatus;
  recordedAt: Date;
  recordedBy: string;
}

export interface StaffAttendanceEntry {
  staffId: string;
  staffName: string;
  position: string;
  department: string;
  email: string;
  status: AttendanceStatus;
  recordedAt: Date;
  recordedBy: string;
}

export interface ParentAttendeeDetails {
  name: string;
  relationship: string;
  primaryContact: string;
  secondaryContact?: string;
  address: string;
  reason: string;
}

export interface ParentAttendanceEntry {
  id: string; // unique ID for this parent group
  pupilId: string;
  pupilName: string;
  className: string;
  attendees: ParentAttendeeDetails[];
  status: AttendanceStatus;
  recordedAt: Date;
  recordedBy: string;
}

// Main event attendance document structure
export interface EventAttendanceDocument {
  eventId: string;
  eventName: string;
  eventDate: Date;
  pupils: PupilAttendanceEntry[];
  staff: StaffAttendanceEntry[];
  parents: ParentAttendanceEntry[];
  summary: {
    totalPupils: number;
    presentPupils: number;
    absentPupils: number;
    latePupils: number;
    totalStaff: number;
    presentStaff: number;
    absentStaff: number;
    lateStaff: number;
    totalParentGroups: number;
    presentParentGroups: number;
    absentParentGroups: number;
    lateParentGroups: number;
  };
  lastUpdated: Date;
  createdAt: Date;
}

// Form data interfaces
export interface PupilAttendanceFormData {
  classId: string;
  className: string;
  pupils: Array<{
    pupilId: string;
    pupilName: string;
    status: AttendanceStatus;
  }>;
  notes?: string;
}

export interface StaffAttendanceFormData {
  staff: Array<{
    staffId: string;
    staffName: string;
    position: string;
    department: string;
    email: string;
    status: AttendanceStatus;
  }>;
  notes?: string;
}

export interface ParentAttendanceFormData {
  groups: Array<{
    pupilId: string;
    pupilName: string;
    className: string;
    attendees: ParentAttendeeDetails[];
    status: AttendanceStatus;
  }>;
  notes?: string;
}

// Filter and summary interfaces
export interface AttendanceFilters {
  status?: AttendanceStatus;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface AttendanceSummary {
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  byType: {
    pupils: { total: number; present: number; absent: number; late: number };
    staff: { total: number; present: number; absent: number; late: number };
    parents: { total: number; present: number; absent: number; late: number };
  };
}

// API response types
export interface AttendanceRecordingResponse {
  success: boolean;
  recordsCreated: number;
  recordsUpdated: number;
  errors?: string[];
} 