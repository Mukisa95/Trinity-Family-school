import { UniformTrackingService } from './uniform-tracking.service';
import { UniformsService } from './uniforms.service';
import type { UniformTracking, UniformItem } from '@/types';
import type { PupilFee } from '@/app/fees/collect/[id]/types';

export interface UniformFeeData extends PupilFee {
  uniformTrackingId: string;
  uniformDetails: {
    uniformId: string | string[];
    selectionMode: 'item' | 'partial' | 'full';
    uniformNames: string[];
    originalAmount: number;
    discountAmount: number;
  };
  isUniformFee: true;
}

export class UniformFeesIntegrationService {
  /**
   * Get uniform tracking records for a pupil and convert them to fee structures
   * Optionally filter by specific term and academic year
   */
  static async getUniformFeesForPupil(
    pupilId: string, 
    termId?: string, 
    academicYearId?: string
  ): Promise<UniformFeeData[]> {
    try {
      // Get uniform tracking records for the pupil
      const trackingRecords = await UniformTrackingService.getTrackingRecordsByPupil(pupilId);
      
      // Filter by term and academic year if specified
      let filteredRecords = trackingRecords;
      if (termId && academicYearId) {
        filteredRecords = trackingRecords.filter(record => 
          record.termId === termId && record.academicYearId === academicYearId
        );
        
        console.log('📅 Uniform fees filtered by term:', {
          pupilId,
          termId,
          academicYearId,
          totalRecords: trackingRecords.length,
          filteredRecords: filteredRecords.length,
          filtered: filteredRecords.map(r => ({
            id: r.id,
            termId: r.termId,
            academicYearId: r.academicYearId,
            amount: r.finalAmount
          }))
        });
      }
      
      // Get all uniforms to resolve names and details
      const allUniforms = await UniformsService.getAllUniforms();
      
      // Convert tracking records to fee structures
      const uniformFees: UniformFeeData[] = [];
      
      for (const record of filteredRecords) {
        const uniformFee = await this.convertTrackingRecordToFee(record, allUniforms);
        if (uniformFee) {
          uniformFees.push(uniformFee);
        }
      }
      
      return uniformFees;
    } catch (error) {
      console.error('Error fetching uniform fees for pupil:', error);
      return [];
    }
  }

  /**
   * Get ALL uniform tracking records for a pupil (not filtered by term/year)
   * This is specifically for carry forward calculations to ensure uniforms appear
   * across all terms and academic years
   */
  static async getAllUniformFeesForPupil(pupilId: string): Promise<UniformFeeData[]> {
    try {
      // Get ALL uniform tracking records for the pupil (no filtering)
      const trackingRecords = await UniformTrackingService.getTrackingRecordsByPupil(pupilId);
      
      console.log('👕 Getting ALL uniform fees for carry forward:', {
        pupilId,
        totalRecords: trackingRecords.length,
        records: trackingRecords.map(r => ({
          id: r.id,
          termId: r.termId,
          academicYearId: r.academicYearId,
          amount: r.finalAmount,
          balance: Math.max(0, r.finalAmount - (r.paidAmount || 0))
        }))
      });
      
      // Get all uniforms to resolve names and details
      const allUniforms = await UniformsService.getAllUniforms();
      
      // Convert tracking records to fee structures
      const uniformFees: UniformFeeData[] = [];
      
      for (const record of trackingRecords) {
        const uniformFee = await this.convertTrackingRecordToFee(record, allUniforms);
        if (uniformFee) {
          uniformFees.push(uniformFee);
        }
      }
      
      return uniformFees;
    } catch (error) {
      console.error('Error fetching all uniform fees for pupil:', error);
      return [];
    }
  }

  /**
   * Convert a uniform tracking record to a fee structure
   */
  private static async convertTrackingRecordToFee(
    record: UniformTracking,
    allUniforms: UniformItem[]
  ): Promise<UniformFeeData | null> {
    try {
      // Get uniform details
      const uniformIds = Array.isArray(record.uniformId) ? record.uniformId : [record.uniformId];
      const uniformDetails = uniformIds.map(id => allUniforms.find(u => u.id === id)).filter(Boolean) as UniformItem[];
      
      if (uniformDetails.length === 0) {
        console.warn('No uniform details found for tracking record:', record.id);
        return null;
      }

      // Calculate amounts
      const originalAmount = record.originalAmount || this.calculateOriginalAmount(uniformDetails);
      const finalAmount = record.finalAmount || originalAmount;
      const discountAmount = originalAmount - finalAmount;
      const paidAmount = record.paidAmount || 0;
      const balance = Math.max(0, finalAmount - paidAmount);

      // Create uniform fee name based on selection mode
      let feeName = '';
      const uniformNames = uniformDetails.map(u => u.name);
      
      switch (record.selectionMode) {
        case 'full':
          feeName = 'Full Uniform Set';
          break;
        case 'partial':
          feeName = `Uniform Items (${uniformNames.slice(0, 2).join(', ')}${uniformNames.length > 2 ? '...' : ''})`;
          break;
        case 'item':
          feeName = `Uniform - ${uniformNames[0] || 'Unknown Item'}`;
          break;
        default:
          feeName = 'Uniform Items';
      }

      // Create the uniform fee structure
      const uniformFee: UniformFeeData = {
        // Fee structure properties
        id: `uniform-${record.id}`,
        name: feeName,
        description: `Uniform tracking record - ${record.selectionMode} selection`,
        amount: finalAmount,
        category: 'Uniform Fee',
        academicYearId: record.academicYearId, // Use the specific academic year from tracking record
        termId: record.termId, // Use the specific term from tracking record
        classFeeType: 'all',
        sectionFeeType: 'all',
        isRequired: true, // Uniforms are mandatory assignments, so they are required for carry-forward
        isRecurring: false,
        status: 'active',
        createdAt: record.createdAt,
        
        // Payment information
        paid: paidAmount,
        balance: balance,
        payments: [], // Will be populated separately
        
        // Discount information if applicable
        ...(discountAmount > 0 && {
          discount: {
            id: 'uniform-discount',
            name: record.discountConfig?.reason || 'Uniform Discount',
            amount: discountAmount,
            type: 'fixed' as const
          },
          originalAmount: originalAmount
        }),

        // Uniform-specific data
        uniformTrackingId: record.id,
        uniformDetails: {
          uniformId: record.uniformId,
          selectionMode: record.selectionMode,
          uniformNames: uniformNames,
          originalAmount: originalAmount,
          discountAmount: discountAmount
        },
        isUniformFee: true
      };

      return uniformFee;
    } catch (error) {
      console.error('Error converting tracking record to fee:', error);
      return null;
    }
  }

  /**
   * Calculate original amount from uniform details
   */
  private static calculateOriginalAmount(uniformDetails: UniformItem[]): number {
    return uniformDetails.reduce((total, uniform) => total + (uniform.price || 0), 0);
  }

  /**
   * Update uniform tracking payment when a payment is made through the fees system
   */
  static async handleUniformPayment(
    uniformTrackingId: string,
    paymentAmount: number,
    paymentDate: string,
    paymentId: string
  ): Promise<void> {
    try {
      // Get the tracking record
      const trackingRecord = await UniformTrackingService.getTrackingRecordById(uniformTrackingId);
      if (!trackingRecord) {
        throw new Error('Uniform tracking record not found');
      }

      // Calculate new paid amount
      const newPaidAmount = (trackingRecord.paidAmount || 0) + paymentAmount;
      const finalAmount = trackingRecord.finalAmount || trackingRecord.originalAmount;
      const newBalance = Math.max(0, finalAmount - newPaidAmount);

      // Determine new payment status
      let newPaymentStatus = trackingRecord.paymentStatus;
      if (newBalance === 0) {
        newPaymentStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newPaymentStatus = 'partial';
      }

      // Update the tracking record
      await UniformTrackingService.updateTrackingRecord(uniformTrackingId, {
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus,
        paymentDate: newBalance === 0 ? paymentDate : trackingRecord.paymentDate || paymentDate,
        history: [
          ...(trackingRecord.history || []),
          {
            date: paymentDate,
            paymentStatus: newPaymentStatus,
            paidAmount: newPaidAmount,
            collectionStatus: trackingRecord.collectionStatus
          }
        ]
      });

      console.log('✅ Updated uniform tracking after payment:', {
        uniformTrackingId,
        paymentAmount,
        newPaidAmount,
        newBalance,
        newPaymentStatus
      });
    } catch (error) {
      console.error('Error handling uniform payment:', error);
      throw error;
    }
  }

  /**
   * Check if a fee is a uniform fee
   */
  static isUniformFee(fee: any): fee is UniformFeeData {
    return fee?.isUniformFee === true && fee?.uniformTrackingId;
  }

  /**
   * Get uniform tracking record ID from a uniform fee
   */
  static getUniformTrackingId(fee: any): string | null {
    if (this.isUniformFee(fee)) {
      return fee.uniformTrackingId;
    }
    return null;
  }

  /**
   * Create payment records that update both systems
   */
  static async createUniformPaymentRecord(
    uniformFee: UniformFeeData,
    paymentAmount: number,
    pupilId: string,
    academicYearId: string,
    termId: string,
    paidBy: { id: string; name: string; role: string }
  ): Promise<string> {
    try {
      const paymentDate = new Date().toISOString();
      
      // Import PaymentsService here to avoid circular dependency
      const { PaymentsService } = await import('./payments.service');
      
      // Create payment record in the payments system
      const paymentRecord = {
        pupilId,
        feeStructureId: uniformFee.id,
        academicYearId,
        termId,
        amount: paymentAmount,
        paymentDate,
        paidBy,
        notes: `Uniform payment - ${uniformFee.name}`,
        // Add custom properties to identify as uniform payment
        isUniformPayment: true,
        uniformTrackingId: uniformFee.uniformTrackingId
      };

      const paymentId = await PaymentsService.createPayment(paymentRecord as any);

      // Update the uniform tracking record
      await this.handleUniformPayment(
        uniformFee.uniformTrackingId,
        paymentAmount,
        paymentDate,
        paymentId
      );

      return paymentId;
    } catch (error) {
      console.error('Error creating uniform payment record:', error);
      throw error;
    }
  }

  /**
   * Get payments made for uniform fees
   */
  static async getUniformPayments(pupilId: string): Promise<any[]> {
    try {
      // Import PaymentsService here to avoid circular dependency
      const { PaymentsService } = await import('./payments.service');
      
      const allPayments = await PaymentsService.getPaymentsByPupil(pupilId);
      
      // Filter payments that are for uniform fees
      return allPayments.filter(payment => 
        (payment as any).isUniformPayment === true || 
        (payment.feeStructureId && payment.feeStructureId.startsWith('uniform-'))
      );
    } catch (error) {
      console.error('Error fetching uniform payments:', error);
      return [];
    }
  }
} 