import type { AcademicYear, Pupil, FeeStructure, PaymentRecord } from '@/types';

// Extended interfaces for the fees collection component
export interface PupilFee extends FeeStructure {
  paid: number;
  balance: number;
  payments: PaymentRecord[];
  discount?: {
    id: string;
    name: string;
    amount: number;
    type: 'fixed' | 'percentage';
  };
  originalAmount?: number;
  feeBreakdown?: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
  }>;
}

export interface PreviousTermBalance {
  amount: number;
  termInfo: { term: string; year: string };
  breakdown: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
    feeStructureId?: string;
    termId?: string;
    academicYearId?: string;
  }>;
}

export interface SelectedFee {
  feeId: string;
  amount: number;
  name: string;
  balance: number;
  amountPaid: number;
}

export interface FeeBreakdownItem {
  name: string;
  amount: number;
  paid: number;
  balance: number;
  term: string;
  year: string;
}

export interface TermTotals {
  totalFees: number;
  totalPaid: number;
  totalBalance: number;
}

export interface PaymentData {
  feeId: string;
  amount: number;
  pupilId: string;
  term: string;
  academicYear: string;
}

export enum PaymentType {
  FULL_PAYMENT = 'full',
  PARTIAL_PAYMENT = 'partial',
  OVERPAYMENT = 'overpayment',
  BALANCE_PAYMENT = 'balance'
}

// Component Props Interfaces
export interface FeeCardProps {
  fee: PupilFee;
  onPayment: (fee: PupilFee, balance: number, totalPaid: number) => void;
  selectedTerm: string;
  selectedAcademicYear: AcademicYear | null;
}

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: number }) => Promise<void>;
  fee: SelectedFee;
}

export interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  fees: PupilFee[];
  onPrint: (selectedFees: PupilFee[]) => void;
}

export interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupil: Pupil;
  fees: PupilFee[];
}

// Utility Functions Type Definitions
export type FeeFilterFunction = (
  feeStructures: FeeStructure[],
  pupil: Pupil,
  termId: string,
  academicYear: AcademicYear
) => FeeStructure[];

export type BalanceCalculationFunction = (
  pupilId: string,
  currentTerm: string,
  currentAcademicYear: AcademicYear,
  allAcademicYears: AcademicYear[]
) => Promise<PreviousTermBalance>;

export type PaymentTypeDetector = (amount: number, balance: number) => PaymentType; 