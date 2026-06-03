import { PupilsService } from './pupils.service';
import { PaymentsService } from './payments.service';
import { FeeStructuresService } from './fee-structures.service';
import { ClassesService } from './classes.service';
import type { Pupil, PaymentRecord, FeeStructure, Class } from '@/types';

// Types for analytics
export interface CollectionOverview {
  totalExpected: number;
  totalCollected: number;
  outstanding: number;
  collectionRate: number;
  totalPupils: number;
  paidPupils: number;
  unpaidPupils: number;
  partiallyPaidPupils: number;
}

export interface TimeBasedStats {
  period: string;
  startDate: Date;
  endDate: Date;
  totalCollected: number;
  paymentCount: number;
  averagePayment: number;
  uniquePayers: number;
}

export interface ClassCollectionStats {
  classId: string;
  className: string;
  classCode: string;
  pupilCount: number;
  expectedAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  collectionRate: number;
  paidPupils: number;
  unpaidPupils: number;
  partiallyPaidPupils: number;
}

export interface DailyCollection {
  date: string;
  amount: number;
  count: number;
}

export interface PaymentMethodStats {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface CollectionAnalytics {
  overview: CollectionOverview;
  timeBased: {
    today: TimeBasedStats;
    thisWeek: TimeBasedStats;
    thisMonth: TimeBasedStats;
    thisTerm: TimeBasedStats;
  };
  byClass: ClassCollectionStats[];
  dailyTrend: DailyCollection[];
  paymentMethods: PaymentMethodStats[];
  recentPayments: PaymentRecord[];
}

export class CollectionAnalyticsService {
  /**
   * 🚀 MAIN METHOD: Get comprehensive collection analytics
   * Uses batch loading for optimal performance
   */
  static async getCollectionAnalytics(
    academicYearId: string,
    termId: string,
    termStartDate: Date,
    termEndDate: Date
  ): Promise<CollectionAnalytics> {
    console.log('🚀 ANALYTICS: Starting batch data load for collection analytics');
    console.log('📅 ANALYTICS: TERM-BASED CALCULATION for:', {
      academicYearId,
      termId,
      termStartDate: termStartDate.toLocaleDateString(),
      termEndDate: termEndDate.toLocaleDateString()
    });
    const startTime = performance.now();

    try {
      // 🚀 BATCH LOAD: Load all data in parallel for speed
      console.log('🔍 ANALYTICS: Loading TERM-SPECIFIC data (not entire year)...');
      const [pupils, payments, feeStructures, classes] = await Promise.all([
        PupilsService.getActivePupils(),
        PaymentsService.getAllPaymentsByTerm(academicYearId, termId), // ← TERM-SPECIFIC payments
        FeeStructuresService.getByTermAndYear(termId, academicYearId), // ← TERM-SPECIFIC fees
        ClassesService.getAll()
      ]);

      const dataLoadTime = performance.now();
      console.log(`✅ ANALYTICS: Loaded TERM-SPECIFIC data in ${(dataLoadTime - startTime).toFixed(2)}ms:`, {
        pupils: pupils.length,
        paymentsForThisTerm: payments.length, // Only payments for selected term
        feeStructuresForThisTerm: feeStructures.length, // Only fees for selected term
        classes: classes.length,
        termId,
        academicYearId
      });

      // Create fast lookup maps
      const classesMap = new Map(classes.map(c => [c.id, c]));
      const paymentsByPupil = PaymentsService.groupPaymentsByPupil(payments);

      // Calculate overview stats
      const overview = this.calculateOverview(
        pupils,
        feeStructures,
        paymentsByPupil,
        termId,
        academicYearId
      );

      // Calculate time-based stats
      const now = new Date();
      const timeBased = {
        today: this.calculateTimeBasedStats(payments, this.getStartOfDay(now), now),
        thisWeek: this.calculateTimeBasedStats(payments, this.getStartOfWeek(now), now),
        thisMonth: this.calculateTimeBasedStats(payments, this.getStartOfMonth(now), now),
        thisTerm: this.calculateTimeBasedStats(payments, termStartDate, termEndDate)
      };

      // Calculate class breakdown
      const byClass = this.calculateClassBreakdown(
        pupils,
        feeStructures,
        paymentsByPupil,
        classesMap,
        termId,
        academicYearId
      );

      // Calculate daily trend
      const dailyTrend = this.calculateDailyTrend(payments, termStartDate, termEndDate);

      // Calculate payment methods breakdown
      const paymentMethods = this.calculatePaymentMethods(payments);

      // Get recent payments (last 20)
      const recentPayments = payments
        .sort((a, b) => {
          // Handle different date formats (Date, Timestamp, string)
          const dateA = a.paymentDate instanceof Date ? a.paymentDate : new Date(a.paymentDate);
          const dateB = b.paymentDate instanceof Date ? b.paymentDate : new Date(b.paymentDate);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 20);

      const endTime = performance.now();
      console.log(`🎉 ANALYTICS: Complete analytics calculated in ${(endTime - startTime).toFixed(2)}ms`);

      return {
        overview,
        timeBased,
        byClass,
        dailyTrend,
        paymentMethods,
        recentPayments
      };
    } catch (error) {
      console.error('❌ ANALYTICS: Error calculating collection analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate overview statistics
   */
  private static calculateOverview(
    pupils: Pupil[],
    feeStructures: FeeStructure[],
    paymentsByPupil: Map<string, PaymentRecord[]>,
    termId: string,
    academicYearId: string
  ): CollectionOverview {
    console.log('📊 ANALYTICS: Calculating overview stats...');

    let totalExpected = 0;
    let totalCollected = 0;
    let paidPupils = 0;
    let unpaidPupils = 0;
    let partiallyPaidPupils = 0;

    for (const pupil of pupils) {
      // Calculate expected fees for this pupil
      const expectedFees = this.calculatePupilExpectedFees(
        pupil,
        feeStructures,
        termId,
        academicYearId
      );

      // Get collected amount for this pupil
      const pupilPayments = paymentsByPupil.get(pupil.id) || [];
      const collectedAmount = pupilPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      totalExpected += expectedFees;
      totalCollected += collectedAmount;

      // Categorize pupil payment status
      if (collectedAmount >= expectedFees) {
        paidPupils++;
      } else if (collectedAmount > 0) {
        partiallyPaidPupils++;
      } else {
        unpaidPupils++;
      }
    }

    const outstanding = totalExpected - totalCollected;
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    return {
      totalExpected,
      totalCollected,
      outstanding,
      collectionRate,
      totalPupils: pupils.length,
      paidPupils,
      unpaidPupils,
      partiallyPaidPupils
    };
  }

  /**
   * Calculate expected fees for a single pupil
   */
  private static calculatePupilExpectedFees(
    pupil: Pupil,
    feeStructures: FeeStructure[],
    termId: string,
    academicYearId: string
  ): number {
    let total = 0;

    for (const fee of feeStructures) {
      // Check if fee is applicable to this pupil
      if (this.isFeeApplicableToPupil(fee, pupil, termId, academicYearId)) {
        let feeAmount = fee.amount || 0;

        // Apply discount if applicable (simplified for now)
        // TODO: Implement full discount logic
        
        total += feeAmount;
      }
    }

    return total;
  }

  /**
   * Check if a fee structure is applicable to a pupil
   */
  private static isFeeApplicableToPupil(
    fee: FeeStructure,
    pupil: Pupil,
    termId: string,
    academicYearId: string
  ): boolean {
    // Check term and year
    if (fee.termId !== termId || fee.academicYearId !== academicYearId) {
      return false;
    }

    // Check if discount (discounts are not independent fees)
    if (fee.isDiscount) {
      return false;
    }

    // Check class applicability
    if (fee.applicableClasses && fee.applicableClasses.length > 0) {
      if (!pupil.classId || !fee.applicableClasses.includes(pupil.classId)) {
        return false;
      }
    }

    // Check section applicability
    if (fee.applicableSections && fee.applicableSections.length > 0) {
      const pupilSection = pupil.section || 'Day';
      if (!fee.applicableSections.includes(pupilSection)) {
        return false;
      }
    }

    // Check if it's an assigned fee
    if (fee.assignmentType === 'individual') {
      if (!fee.assignedPupils || !fee.assignedPupils.includes(pupil.id)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate time-based statistics
   */
  private static calculateTimeBasedStats(
    payments: PaymentRecord[],
    startDate: Date,
    endDate: Date
  ): TimeBasedStats {
    const filtered = payments.filter(p => {
      const paymentDate = p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    const totalCollected = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paymentCount = filtered.length;
    const averagePayment = paymentCount > 0 ? totalCollected / paymentCount : 0;
    const uniquePayers = new Set(filtered.map(p => p.pupilId)).size;

    return {
      period: this.formatDateRange(startDate, endDate),
      startDate,
      endDate,
      totalCollected,
      paymentCount,
      averagePayment,
      uniquePayers
    };
  }

  /**
   * Calculate class-wise breakdown
   */
  private static calculateClassBreakdown(
    pupils: Pupil[],
    feeStructures: FeeStructure[],
    paymentsByPupil: Map<string, PaymentRecord[]>,
    classesMap: Map<string, Class>,
    termId: string,
    academicYearId: string
  ): ClassCollectionStats[] {
    console.log('📊 ANALYTICS: Calculating class breakdown...');

    // Group pupils by class
    const pupilsByClass = new Map<string, Pupil[]>();
    for (const pupil of pupils) {
      if (pupil.classId) {
        if (!pupilsByClass.has(pupil.classId)) {
          pupilsByClass.set(pupil.classId, []);
        }
        pupilsByClass.get(pupil.classId)!.push(pupil);
      }
    }

    const classStats: ClassCollectionStats[] = [];

    for (const [classId, classPupils] of pupilsByClass.entries()) {
      const classData = classesMap.get(classId);
      if (!classData) continue;

      let expectedAmount = 0;
      let collectedAmount = 0;
      let paidPupils = 0;
      let unpaidPupils = 0;
      let partiallyPaidPupils = 0;

      for (const pupil of classPupils) {
        const expectedFees = this.calculatePupilExpectedFees(
          pupil,
          feeStructures,
          termId,
          academicYearId
        );

        const pupilPayments = paymentsByPupil.get(pupil.id) || [];
        const collected = pupilPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        expectedAmount += expectedFees;
        collectedAmount += collected;

        if (collected >= expectedFees) {
          paidPupils++;
        } else if (collected > 0) {
          partiallyPaidPupils++;
        } else {
          unpaidPupils++;
        }
      }

      const outstandingAmount = expectedAmount - collectedAmount;
      const collectionRate = expectedAmount > 0 ? (collectedAmount / expectedAmount) * 100 : 0;

      classStats.push({
        classId,
        className: classData.name,
        classCode: classData.code,
        pupilCount: classPupils.length,
        expectedAmount,
        collectedAmount,
        outstandingAmount,
        collectionRate,
        paidPupils,
        unpaidPupils,
        partiallyPaidPupils
      });
    }

    // Sort by class name
    return classStats.sort((a, b) => a.className.localeCompare(b.className));
  }

  /**
   * Calculate daily collection trend
   */
  private static calculateDailyTrend(
    payments: PaymentRecord[],
    startDate: Date,
    endDate: Date
  ): DailyCollection[] {
    const dailyMap = new Map<string, { amount: number; count: number }>();

    // Filter payments within date range
    const filtered = payments.filter(p => {
      const paymentDate = p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    // Group by date
    for (const payment of filtered) {
      const paymentDate = payment.paymentDate instanceof Date ? payment.paymentDate : new Date(payment.paymentDate);
      const dateKey = paymentDate.toISOString().split('T')[0];

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { amount: 0, count: 0 });
      }

      const stats = dailyMap.get(dateKey)!;
      stats.amount += payment.amount || 0;
      stats.count += 1;
    }

    // Convert to array and sort by date
    const dailyTrend: DailyCollection[] = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        amount: stats.amount,
        count: stats.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return dailyTrend;
  }

  /**
   * Calculate payment methods breakdown
   */
  private static calculatePaymentMethods(payments: PaymentRecord[]): PaymentMethodStats[] {
    const methodMap = new Map<string, { amount: number; count: number }>();
    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    for (const payment of payments) {
      const method = payment.paymentMethod || 'Not Specified';

      if (!methodMap.has(method)) {
        methodMap.set(method, { amount: 0, count: 0 });
      }

      const stats = methodMap.get(method)!;
      stats.amount += payment.amount || 0;
      stats.count += 1;
    }

    return Array.from(methodMap.entries())
      .map(([method, stats]) => ({
        method,
        amount: stats.amount,
        count: stats.count,
        percentage: totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  // ============================================================================
  // DATE UTILITY METHODS
  // ============================================================================

  private static getStartOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private static getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private static getStartOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  private static formatDateRange(startDate: Date, endDate: Date): string {
    const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  }
}

