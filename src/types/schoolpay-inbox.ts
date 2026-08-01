export type SchoolPayInboxStatus =
  | 'received'
  | 'processing'
  | 'recorded'
  | 'unmatched'
  | 'failed'
  | 'ignored';

export type SchoolPayInboxSource = 'webhook' | 'sync' | 'assignment';

export interface SchoolPayInboxRecord {
  id: string;
  receiptNumber: string;
  paymentType: 'SCHOOL_FEES' | 'OTHER_FEES';
  status: SchoolPayInboxStatus;
  source: SchoolPayInboxSource;
  amount: number;
  paymentDate: string;
  studentName?: string;
  studentPaymentCode?: string;
  studentRegistrationNumber?: string;
  studentClass?: string;
  sourcePaymentChannel?: string;
  sourceChannelTransactionId?: string;
  supplementaryFeeId?: string;
  supplementaryFeeDescription?: string;
  reason?: string;
  lastError?: string;
  pupilId?: string;
  localPaymentIds?: string[];
  attempts: number;
  receivedAt: string;
  updatedAt: string;
  recordedAt?: string;
  assignedAt?: string;
  assignedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
}
