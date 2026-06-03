// Digital Signature Types for Trinity Family School System

export interface DigitalSignature {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface SignedRecord {
  id: string;
  signature: DigitalSignature;
  recordType: RecordType;
  recordId: string;
  description: string;
  metadata?: Record<string, any>;
}

export type RecordType = 
  | 'fee_payment'
  | 'attendance_record'
  | 'exam_creation'
  | 'exam_result'
  | 'procurement'
  | 'requirement_collection'
  | 'uniform_payment'
  | 'pupil_promotion'
  | 'event_creation'
  | 'banking_transaction'
  | 'user_creation'
  | 'user_modification'
  | 'academic_year_creation'
  | 'class_creation'
  | 'subject_creation'
  | 'fee_structure_creation'
  | 'exam_type_creation'
  | 'bulk_sms'
  | 'notification_send'
  | 'data_export'
  | 'system_backup'
  | 'password_change'
  | 'permission_change'
  | 'leadership_term_creation'
  | 'leadership_term_update'
  | 'leadership_term_termination'
  | 'prefectoral_post_creation'
  | 'prefectoral_post_update'
  | 'prefectoral_post_deletion'
  | 'post_assignment_creation'
  | 'post_assignment_deletion'
  | 'duty_rota_creation'
  | 'duty_rota_update'
  | 'duty_rota_deletion'
  | 'duty_assignment_creation'
  | 'duty_assignment_update'
  | 'duty_assignment_deletion'
  | 'bulk_duty_assignment'
  | 'poll_creation'
  | 'poll_vote'
  | 'performance_ranking_creation';

export interface SignatureDisplayProps {
  signature: DigitalSignature;
  action: string;
  showFullDetails?: boolean;
  className?: string;
}

export interface CreateSignatureData {
  action: string;
  recordType: RecordType;
  recordId: string;
  description: string;
  metadata?: Record<string, any>;
}

// Signature verification result
export interface SignatureVerification {
  isValid: boolean;
  signature: DigitalSignature;
  verifiedAt: string;
  issues?: string[];
}

// Audit trail entry
export interface AuditTrailEntry {
  id: string;
  signature: DigitalSignature;
  recordType: RecordType;
  recordId: string;
  action: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
} 