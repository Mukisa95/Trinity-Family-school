import type { Pupil, AcademicYear, FeeStructure, PaymentRecord } from '@/types';
import type { PupilFee } from '../types';

// Mock data generators
export const createMockPupil = (overrides?: Partial<Pupil>): Pupil => ({
  id: 'pupil-1',
  firstName: 'John',
  lastName: 'Doe',
  admissionNumber: 'ADM001',
  className: 'Primary 1',
  classId: 'class-1',
  section: 'Day',
  status: 'Active',
  dateOfBirth: '2015-01-01',
  gender: 'Male',
  familyId: 'family-1',
  guardians: [],
  registrationDate: '2023-01-01',
  createdAt: '2023-01-01',
  ...overrides
});

export const createMockAcademicYear = (overrides?: Partial<AcademicYear>): AcademicYear => ({
  id: 'year-1',
  name: '2024',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  isActive: true,
  isLocked: false,
  terms: [
    {
      id: 'term-1',
      name: 'Term 1',
      startDate: '2024-01-01',
      endDate: '2024-04-30',
      isCurrent: true
    },
    {
      id: 'term-2',
      name: 'Term 2',
      startDate: '2024-05-01',
      endDate: '2024-08-31',
      isCurrent: false
    },
    {
      id: 'term-3',
      name: 'Term 3',
      startDate: '2024-09-01',
      endDate: '2024-12-31',
      isCurrent: false
    }
  ],
  ...overrides
});

export const createMockFeeStructure = (overrides?: Partial<FeeStructure>): FeeStructure => ({
  id: 'fee-1',
  name: 'Tuition Fee',
  description: 'Monthly tuition fee',
  amount: 100000,
  category: 'Tuition Fee',
  academicYearId: 'year-1',
  termId: 'term-1',
  classIds: ['class-1'],
  isRequired: true,
  isRecurring: true,
  status: 'active',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides
});

export const createMockPaymentRecord = (overrides?: Partial<PaymentRecord>): PaymentRecord => ({
  id: 'payment-1',
  pupilId: 'pupil-1',
  feeStructureId: 'fee-1',
  academicYearId: 'year-1',
  termId: 'term-1',
  amount: 50000,
  paymentDate: '2024-01-15',
  paidBy: {
    id: 'user-1',
    name: 'Finance Officer',
    role: 'Finance'
  },
  reverted: false,
  createdAt: '2024-01-15',
  ...overrides
});

export const createMockPupilFee = (overrides?: Partial<PupilFee>): PupilFee => ({
  ...createMockFeeStructure(),
  paid: 50000,
  balance: 50000,
  payments: [createMockPaymentRecord()],
  discount: {
    id: 'discount-1',
    name: 'Sibling Discount',
    amount: 10,
    type: 'percentage' as const
  },
  originalAmount: 110000,
  ...overrides
});

// Mock API responses
export const mockApiResponses = {
  pupil: createMockPupil(),
  academicYears: [createMockAcademicYear()],
  feeStructures: [createMockFeeStructure()],
  payments: [createMockPaymentRecord()],
  pupilFees: [createMockPupilFee()]
};

// Test data sets for different scenarios
export const testScenarios = {
  // Pupil with no payments
  noPaidFees: {
    pupil: createMockPupil(),
    fees: [
      createMockPupilFee({ paid: 0, balance: 100000, payments: [] })
    ]
  },
  
  // Pupil with partial payments
  partiallyPaidFees: {
    pupil: createMockPupil(),
    fees: [
      createMockPupilFee({ paid: 50000, balance: 50000 })
    ]
  },
  
  // Pupil with fully paid fees
  fullyPaidFees: {
    pupil: createMockPupil(),
    fees: [
      createMockPupilFee({ paid: 100000, balance: 0 })
    ]
  },
  
  // Pupil with multiple fees and mixed payment status
  mixedPaymentStatus: {
    pupil: createMockPupil(),
    fees: [
      createMockPupilFee({ 
        id: 'fee-1', 
        name: 'Tuition Fee', 
        paid: 100000, 
        balance: 0 
      }),
      createMockPupilFee({ 
        id: 'fee-2', 
        name: 'Transport Fee', 
        paid: 25000, 
        balance: 25000 
      }),
      createMockPupilFee({ 
        id: 'fee-3', 
        name: 'Lunch Fee', 
        paid: 0, 
        balance: 30000 
      })
    ]
  },
  
  // Large dataset for performance testing
  largeDataset: {
    pupil: createMockPupil(),
    fees: Array.from({ length: 100 }, (_, i) => 
      createMockPupilFee({ 
        id: `fee-${i}`, 
        name: `Fee ${i}`,
        amount: Math.floor(Math.random() * 200000) + 50000,
        paid: Math.floor(Math.random() * 100000),
        balance: Math.floor(Math.random() * 100000)
      })
    )
  }
};

// Utility functions for testing
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 100));
};

// Performance testing utilities
export const measurePerformance = async (fn: () => Promise<void> | void) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

export const measureMemoryUsage = () => {
  if ('memory' in performance) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return 0;
}; 