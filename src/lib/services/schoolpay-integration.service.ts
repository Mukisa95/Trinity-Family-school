import { createHash, timingSafeEqual } from 'crypto';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { AcademicYearsService } from './academic-years.service';
import { FeeStructuresService } from './fee-structures.service';
import { PaymentsService } from './payments.service';
import { PupilsService } from './pupils.service';
import type { FeeStructure, Pupil } from '@/types';

const SCHOOLPAY_GENERAL_FEE_ID = 'schoolpay-general';
const SCHOOLPAY_SYNC_LOGS = 'schoolPaySyncLogs';
const SCHOOLPAY_PAYMENT_MAPPINGS = 'schoolPayPaymentMappings';
const SCHOOLPAY_SUPPLEMENTARY_MAPPINGS = 'schoolPaySupplementaryFeeMappings';
const DEFAULT_SCHOOLPAY_SYNC_BASE_URL = 'https://schoolpay.co.ug/paymentapi';

type SchoolPayPaymentType = 'SCHOOL_FEES' | 'OTHER_FEES';

export interface SchoolPayPaymentPayload {
  amount: string | number;
  paymentDateAndTime?: string;
  schoolpayReceiptNumber: string;
  settlementBankCode?: string;
  sourceChannelTransDetail?: string;
  sourceChannelTransactionId?: string;
  sourcePaymentChannel?: string;
  studentClass?: string;
  studentName?: string;
  studentPaymentCode?: string;
  studentRegistrationNumber?: string;
  supplementaryFeeDescription?: string;
  supplementaryFeeId?: string;
  transactionCompletionDateAndTime?: string;
  transactionCompletionStatus?: string;
}

export interface SchoolPayWebhookPayload {
  signature: string;
  type: SchoolPayPaymentType;
  payment: SchoolPayPaymentPayload;
}

interface SchoolPaySyncResponse {
  returnCode: number;
  returnMessage?: string;
  transactions?: SchoolPayPaymentPayload[];
  supplementaryFeePayments?: SchoolPayPaymentPayload[];
}

interface AcademicSlot {
  year: any;
  term: any;
  allAcademicYears: any[];
}

interface ProcessingContext {
  source: 'webhook' | 'sync';
  verifySignature: boolean;
}

interface ProcessingResult {
  success: boolean;
  duplicate?: boolean;
  skipped?: boolean;
  statusCode?: number;
  message: string;
  paymentType: SchoolPayPaymentType;
  receiptNumber: string;
  pupilId?: string;
  localPaymentIds: string[];
}

export class SchoolPayIntegrationService {
  private static getConfig() {
    return {
      schoolCode: process.env.SCHOOLPAY_SCHOOL_CODE || '',
      apiPassword: process.env.SCHOOLPAY_API_PASSWORD || '',
      syncBaseUrl: process.env.SCHOOLPAY_SYNC_BASE_URL || DEFAULT_SCHOOLPAY_SYNC_BASE_URL,
      requireWebhookSignature: process.env.SCHOOLPAY_REQUIRE_WEBHOOK_SIGNATURE === 'true',
    };
  }

  static isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config.schoolCode && config.apiPassword && config.syncBaseUrl);
  }

  static verifyWebhookSignature(signature: string, receiptNumber: string): boolean {
    const { apiPassword } = this.getConfig();
    if (!apiPassword || !signature || !receiptNumber) return false;

    const expected = createHash('sha256')
      .update(`${apiPassword}${receiptNumber}`)
      .digest('hex');

    const providedBuffer = Buffer.from(signature.trim().toLowerCase(), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(providedBuffer, expectedBuffer);
  }

  static async processWebhookPayload(payload: SchoolPayWebhookPayload): Promise<ProcessingResult> {
    const { requireWebhookSignature } = this.getConfig();

    return this.processPaymentPayload(payload.type, payload.payment, payload.signature, {
      source: 'webhook',
      verifySignature: requireWebhookSignature || !!payload.signature,
    });
  }

  static async syncTransactionsForDate(date: string): Promise<{
    success: boolean;
    date: string;
    processed: number;
    duplicates: number;
    skipped: number;
    failed: number;
    results: ProcessingResult[];
    returnCode?: number;
    returnMessage?: string;
  }> {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      throw new Error('SchoolPay integration is not configured');
    }

    const hash = createHash('md5')
      .update(`${config.schoolCode}${date}${config.apiPassword}`)
      .digest('hex')
      .toUpperCase();

    const url = `${config.syncBaseUrl}/AndroidRS/SyncSchoolTransactions/${encodeURIComponent(
      config.schoolCode
    )}/${date}/${hash}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SchoolPay sync failed (${response.status}): ${text || response.statusText}`);
    }

    const data = (await response.json()) as SchoolPaySyncResponse;
    const schoolFees = (data.transactions || []).map((payment) => ({
      type: 'SCHOOL_FEES' as const,
      payment,
    }));
    const otherFees = (data.supplementaryFeePayments || []).map((payment) => ({
      type: 'OTHER_FEES' as const,
      payment,
    }));
    const allPayments = [...schoolFees, ...otherFees];

    const results: ProcessingResult[] = [];
    for (const item of allPayments) {
      const result = await this.processPaymentPayload(item.type, item.payment, undefined, {
        source: 'sync',
        verifySignature: false,
      });
      results.push(result);
    }

    const processed = results.filter((item) => item.success && !item.duplicate && !item.skipped).length;
    const duplicates = results.filter((item) => item.duplicate).length;
    const skipped = results.filter((item) => item.skipped).length;
    const failed = results.filter((item) => !item.success && !item.duplicate && !item.skipped).length;

    await this.logSync({
      type: 'sync_batch',
      source: 'sync',
      status: failed > 0 ? 'partial' : 'success',
      date,
      processed,
      duplicates,
      skipped,
      failed,
      returnCode: data.returnCode,
      returnMessage: data.returnMessage,
      receiptNumbers: results.map((item) => item.receiptNumber),
      timestamp: new Date().toISOString(),
    });

    return {
      success: failed === 0,
      date,
      processed,
      duplicates,
      skipped,
      failed,
      results,
      returnCode: data.returnCode,
      returnMessage: data.returnMessage,
    };
  }

  static async getSyncLogs(limitCount: number = 100): Promise<any[]> {
    const q = query(
      collection(db, SCHOOLPAY_SYNC_LOGS),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limitCount).map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));
  }

  static async logWebhookReceipt(data: Record<string, unknown>): Promise<void> {
    await this.logSync({
      type: 'webhook_receipt',
      source: 'webhook',
      status: 'received',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  private static async processPaymentPayload(
    paymentType: SchoolPayPaymentType,
    rawPayment: SchoolPayPaymentPayload,
    signature: string | undefined,
    context: ProcessingContext
  ): Promise<ProcessingResult> {
    const payment = this.normalizePayment(rawPayment);
    const receiptNumber = payment.schoolpayReceiptNumber;

    if (!receiptNumber) {
      return {
        success: false,
        statusCode: 422,
        message: 'schoolpayReceiptNumber is required',
        paymentType,
        receiptNumber: '',
        localPaymentIds: [],
      };
    }

    if (context.verifySignature) {
      if (!signature) {
        await this.logSync({
          type: 'payment',
          source: context.source,
          status: 'failed',
          paymentType,
          receiptNumber,
          errorMessage: 'Missing signature',
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          statusCode: 401,
          message: 'Missing signature',
          paymentType,
          receiptNumber,
          localPaymentIds: [],
        };
      }

      if (!this.verifyWebhookSignature(signature, receiptNumber)) {
        await this.logSync({
          type: 'payment',
          source: context.source,
          status: 'failed',
          paymentType,
          receiptNumber,
          errorMessage: 'Invalid signature',
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          statusCode: 401,
          message: 'Invalid signature',
          paymentType,
          receiptNumber,
          localPaymentIds: [],
        };
      }
    }

    const completionStatus = (payment.transactionCompletionStatus || '').toLowerCase();
    if (completionStatus && completionStatus !== 'completed') {
      await this.logSync({
        type: 'payment',
        source: context.source,
        status: 'skipped',
        paymentType,
        receiptNumber,
        transactionCompletionStatus: payment.transactionCompletionStatus,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        skipped: true,
        message: `Skipped payment with status ${payment.transactionCompletionStatus}`,
        paymentType,
        receiptNumber,
        localPaymentIds: [],
      };
    }

    const existing = await this.getPaymentMapping(receiptNumber);
    if (existing) {
      await this.logSync({
        type: 'payment',
        source: context.source,
        status: 'duplicate',
        paymentType,
        receiptNumber,
        pupilId: existing.pupilId,
        localPaymentIds: existing.localPaymentIds || [],
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        duplicate: true,
        message: 'Payment already recorded',
        paymentType,
        receiptNumber,
        pupilId: existing.pupilId,
        localPaymentIds: existing.localPaymentIds || [],
      };
    }

    try {
      const pupil = await this.findPupil(payment.studentPaymentCode, payment.studentRegistrationNumber);
      if (!pupil) {
        await this.logSync({
          type: 'payment',
          source: context.source,
          status: 'failed',
          paymentType,
          receiptNumber,
          paymentCode: payment.studentPaymentCode,
          registrationNumber: payment.studentRegistrationNumber,
          errorMessage: 'Pupil not found',
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          statusCode: 404,
          message: 'Pupil not found for SchoolPay payment',
          paymentType,
          receiptNumber,
          localPaymentIds: [],
        };
      }

      const paymentDate = this.resolvePaymentDate(payment);
      const slot = await this.resolveAcademicSlot(paymentDate);
      const existingPayments = await PaymentsService.getPaymentsByPupil(pupil.id);

      const recordingResult =
        paymentType === 'OTHER_FEES'
          ? await this.recordSupplementaryFeePayment(payment, pupil, slot)
          : await this.recordSchoolFeesPayment(payment, pupil, slot, existingPayments);

      await this.storePaymentMapping({
        receiptNumber,
        paymentType,
        pupilId: pupil.id,
        studentPaymentCode: payment.studentPaymentCode || '',
        studentRegistrationNumber: payment.studentRegistrationNumber || '',
        localPaymentIds: recordingResult.localPaymentIds,
        amount: this.parseAmount(payment.amount),
        paymentDate,
        sourceChannelTransactionId: payment.sourceChannelTransactionId || '',
        sourcePaymentChannel: payment.sourcePaymentChannel || '',
        source: context.source,
      });

      await this.logSync({
        type: 'payment',
        source: context.source,
        status: 'success',
        paymentType,
        receiptNumber,
        pupilId: pupil.id,
        localPaymentIds: recordingResult.localPaymentIds,
        distributionBreakdown: recordingResult.distributionBreakdown,
        sourceChannelTransactionId: payment.sourceChannelTransactionId || '',
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Payment recorded successfully',
        paymentType,
        receiptNumber,
        pupilId: pupil.id,
        localPaymentIds: recordingResult.localPaymentIds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      await this.logSync({
        type: 'payment',
        source: context.source,
        status: 'failed',
        paymentType,
        receiptNumber,
        sourceChannelTransactionId: payment.sourceChannelTransactionId || '',
        errorMessage: message,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        statusCode: 500,
        message,
        paymentType,
        receiptNumber,
        localPaymentIds: [],
      };
    }
  }

  private static normalizePayment(payment: SchoolPayPaymentPayload): SchoolPayPaymentPayload {
    return {
      ...payment,
      schoolpayReceiptNumber: `${payment.schoolpayReceiptNumber || ''}`.trim(),
      studentPaymentCode: `${payment.studentPaymentCode || ''}`.trim(),
      studentRegistrationNumber: `${payment.studentRegistrationNumber || ''}`.trim(),
      supplementaryFeeId: `${payment.supplementaryFeeId || ''}`.trim(),
      supplementaryFeeDescription: `${payment.supplementaryFeeDescription || ''}`.trim(),
      transactionCompletionStatus: `${payment.transactionCompletionStatus || ''}`.trim(),
      sourceChannelTransactionId: `${payment.sourceChannelTransactionId || ''}`.trim(),
      sourcePaymentChannel: `${payment.sourcePaymentChannel || ''}`.trim(),
      studentName: `${payment.studentName || ''}`.trim(),
      sourceChannelTransDetail: `${payment.sourceChannelTransDetail || ''}`.trim(),
    };
  }

  private static parseAmount(amount: string | number | undefined): number {
    if (typeof amount === 'number') return amount;
    const parsed = Number(`${amount || 0}`.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private static resolvePaymentDate(payment: SchoolPayPaymentPayload): string {
    const rawValue =
      payment.transactionCompletionDateAndTime ||
      payment.paymentDateAndTime ||
      new Date().toISOString();

    const normalized = rawValue.includes(' ') ? rawValue.replace(' ', 'T') : rawValue;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  private static async findPupil(
    studentPaymentCode?: string,
    studentRegistrationNumber?: string
  ): Promise<Pupil | null> {
    const allPupils = await PupilsService.getAllPupils();

    const normalizedPaymentCode = `${studentPaymentCode || ''}`.trim().toLowerCase();
    if (normalizedPaymentCode) {
      const paymentCodeMatches = allPupils.filter((pupil) => {
        const identifiers = (pupil.additionalIdentifiers || []).map((identifier) => ({
          type: `${identifier.idType || ''}`.trim().toLowerCase(),
          value: `${identifier.idValue || ''}`.trim().toLowerCase(),
        }));

        return (
          `${pupil.payCode || ''}`.trim().toLowerCase() === normalizedPaymentCode ||
          identifiers.some(
            (identifier) =>
              (identifier.type.includes('payment code') || identifier.type.includes('pay code')) &&
              identifier.value === normalizedPaymentCode
          )
        );
      });

      if (paymentCodeMatches.length === 1) return paymentCodeMatches[0];
    }

    const normalizedRegistration = `${studentRegistrationNumber || ''}`.trim().toLowerCase();
    if (!normalizedRegistration) return null;

    const registrationMatches = allPupils.filter((pupil) => {
      const identifiers = (pupil.additionalIdentifiers || []).map((identifier) =>
        `${identifier.idValue || ''}`.trim().toLowerCase()
      );

      return (
        `${pupil.admissionNumber || ''}`.trim().toLowerCase() === normalizedRegistration ||
        `${pupil.learnerIdentificationNumber || ''}`.trim().toLowerCase() === normalizedRegistration ||
        identifiers.includes(normalizedRegistration)
      );
    });

    return registrationMatches.length === 1 ? registrationMatches[0] : null;
  }

  private static async resolveAcademicSlot(paymentDate: string): Promise<AcademicSlot> {
    const allAcademicYears = await AcademicYearsService.getAllAcademicYears();
    const target = new Date(paymentDate);

    let activeYear: any | undefined;
    let term: any | undefined;

    outer: for (const year of allAcademicYears) {
      for (const yearTerm of year.terms || []) {
        const start = new Date(yearTerm.startDate);
        const end = new Date(yearTerm.endDate);
        if (target >= start && target <= end) {
          activeYear = year;
          term = yearTerm;
          break outer;
        }
      }
    }

    if (!term) {
      let best: { year: any; term: any; start: number } | null = null;
      for (const year of allAcademicYears) {
        for (const yearTerm of year.terms || []) {
          const start = new Date(yearTerm.startDate).getTime();
          if (start <= target.getTime() && (!best || start > best.start)) {
            best = { year, term: yearTerm, start };
          }
        }
      }

      if (best) {
        activeYear = best.year;
        term = best.term;
      }
    }

    if (!activeYear || !term) {
      throw new Error(`Could not determine academic term for payment date ${paymentDate}`);
    }

    return { year: activeYear, term, allAcademicYears };
  }

  private static extractTermOrder(name?: string): number | null {
    if (!name) return null;
    const numericMatch = name.match(/(\d+)/);
    if (numericMatch) return parseInt(numericMatch[1], 10);

    const normalized = name.trim().toLowerCase();
    if (normalized.includes('first')) return 1;
    if (normalized.includes('second')) return 2;
    if (normalized.includes('third')) return 3;
    if (normalized.includes('fourth')) return 4;
    return null;
  }

  private static lookupTerm(allAcademicYears: any[], termId: string): any | null {
    for (const year of allAcademicYears) {
      const term = (year.terms || []).find((item: any) => item.id === termId);
      if (term) return term;
    }
    return null;
  }

  private static async getApplicableFeeStructures(
    pupil: Pupil,
    slot: AcademicSlot
  ): Promise<FeeStructure[]> {
    const currentTermOrder = this.extractTermOrder(slot.term.name);
    const allFees = await FeeStructuresService.getAllFeeStructures();

    return allFees.filter((fee: any) => {
      if (fee.status === 'inactive') return false;
      if (fee.category === 'Discount' || (typeof fee.amount === 'number' && fee.amount < 0)) return false;

      if (fee.isAssignmentFee) {
        const assigned = (pupil.assignedFees || []).some((assignedFee) => assignedFee.feeStructureId === fee.id);
        if (!assigned) return false;
      }

      if (fee.academicYearId) {
        const feeYear = slot.allAcademicYears.find((year: any) => year.id === fee.academicYearId);
        if (feeYear) {
          const feeStart = new Date(feeYear.startDate);
          const activeStart = new Date(slot.year.startDate);
          if (activeStart < feeStart) return false;
        } else if (fee.academicYearId !== slot.year.id) {
          return false;
        }
      }

      if (fee.termId) {
        const exactMatch = fee.termId === slot.term.id;
        if (!exactMatch) {
          const feeTerm = this.lookupTerm(slot.allAcademicYears, fee.termId);
          const feeTermOrder = feeTerm ? this.extractTermOrder(feeTerm.name) : null;
          const equivalentMatch =
            feeTermOrder !== null &&
            currentTermOrder !== null &&
            feeTermOrder === currentTermOrder;
          if (!equivalentMatch) return false;
        }
      }

      const classFeeType = fee.classFeeType || 'all';
      if (classFeeType === 'specific') {
        const classIds: string[] = Array.isArray(fee.classIds)
          ? fee.classIds
          : fee.classId
            ? [fee.classId]
            : [];
        if (!classIds.includes(pupil.classId)) return false;
      }

      const sectionFeeType = fee.sectionFeeType || 'all';
      if (sectionFeeType === 'specific' && fee.section && fee.section !== pupil.section) return false;

      return true;
    });
  }

  private static buildPaymentNotes(
    payment: SchoolPayPaymentPayload,
    label: string,
    extraParts: string[] = []
  ): string {
    const parts = [
      label,
      `Receipt: ${payment.schoolpayReceiptNumber}`,
      payment.sourceChannelTransactionId ? `Source Txn: ${payment.sourceChannelTransactionId}` : '',
      payment.sourcePaymentChannel ? `Channel: ${payment.sourcePaymentChannel}` : '',
      payment.sourceChannelTransDetail ? `Detail: ${payment.sourceChannelTransDetail}` : '',
      payment.studentPaymentCode ? `Payment Code: ${payment.studentPaymentCode}` : '',
      payment.studentRegistrationNumber ? `Registration No: ${payment.studentRegistrationNumber}` : '',
      payment.studentName ? `Student: ${payment.studentName}` : '',
      ...extraParts,
    ].filter(Boolean);

    return parts.join(' | ');
  }

  private static async recordSchoolFeesPayment(
    payment: SchoolPayPaymentPayload,
    pupil: Pupil,
    slot: AcademicSlot,
    existingPayments: any[]
  ): Promise<{
    localPaymentIds: string[];
    distributionBreakdown: Array<{ feeName: string; feeStructureId: string; amount: number }>;
  }> {
    const feeStructures = await this.getApplicableFeeStructures(pupil, slot);
    const createdPaymentIds: string[] = [];
    const distributionBreakdown: Array<{ feeName: string; feeStructureId: string; amount: number }> = [];
    let remainingAmount = this.parseAmount(payment.amount);

    const createGenericRecord = async (
      amount: number,
      academicYearId: string,
      termId: string,
      description: string
    ) => {
      const paymentId = await PaymentsService.createPayment({
        pupilId: pupil.id,
        feeStructureId: SCHOOLPAY_GENERAL_FEE_ID,
        academicYearId,
        termId,
        amount,
        paymentDate: this.resolvePaymentDate(payment),
        paidBy: {
          id: 'schoolpay-system',
          name: payment.studentName || pupil.firstName + ' ' + pupil.lastName,
          role: 'Parent/Guardian',
        },
        notes: this.buildPaymentNotes(payment, description),
        paymentMethod: payment.sourcePaymentChannel || 'SchoolPay',
        schoolPayReceiptNumber: payment.schoolpayReceiptNumber,
        schoolPayTransactionId: payment.sourceChannelTransactionId,
        schoolPayPaymentCode: payment.studentPaymentCode,
        source: 'schoolpay',
      } as any);

      createdPaymentIds.push(paymentId);
      distributionBreakdown.push({
        feeName: description,
        feeStructureId: SCHOOLPAY_GENERAL_FEE_ID,
        amount,
      });
    };

    if (feeStructures.length === 0) {
      await createGenericRecord(remainingAmount, slot.year.id, slot.term.id, 'SchoolPay unmatched school fees');
      return { localPaymentIds: createdPaymentIds, distributionBreakdown };
    }

    const feesWithBalance = feeStructures
      .map((fee: any) => {
        const paidForFee = existingPayments
          .filter(
            (paymentRecord: any) =>
              paymentRecord.feeStructureId === fee.id &&
              paymentRecord.academicYearId === slot.year.id &&
              paymentRecord.termId === slot.term.id &&
              !paymentRecord.reverted
          )
          .reduce((sum: number, paymentRecord: any) => sum + (paymentRecord.amount || 0), 0);

        return {
          ...fee,
          balance: Math.max(0, (fee.amount || 0) - paidForFee),
        };
      })
      .filter((fee: any) => fee.balance > 0)
      .sort((a: any, b: any) => b.balance - a.balance);

    if (feesWithBalance.length === 0) {
      await createGenericRecord(remainingAmount, slot.year.id, slot.term.id, 'SchoolPay advance / overpayment');
      return { localPaymentIds: createdPaymentIds, distributionBreakdown };
    }

    for (const fee of feesWithBalance) {
      if (remainingAmount <= 0) break;

      const allocatedAmount = Math.min(remainingAmount, fee.balance);
      const paymentId = await PaymentsService.createPayment({
        pupilId: pupil.id,
        feeStructureId: fee.id,
        academicYearId: slot.year.id,
        termId: slot.term.id,
        amount: allocatedAmount,
        paymentDate: this.resolvePaymentDate(payment),
        paidBy: {
          id: 'schoolpay-system',
          name: payment.studentName || pupil.firstName + ' ' + pupil.lastName,
          role: 'Parent/Guardian',
        },
        notes: this.buildPaymentNotes(payment, `${fee.name} (SchoolPay)`),
        paymentMethod: payment.sourcePaymentChannel || 'SchoolPay',
        schoolPayReceiptNumber: payment.schoolpayReceiptNumber,
        schoolPayTransactionId: payment.sourceChannelTransactionId,
        schoolPayPaymentCode: payment.studentPaymentCode,
        source: 'schoolpay',
      } as any);

      createdPaymentIds.push(paymentId);
      distributionBreakdown.push({
        feeName: fee.name,
        feeStructureId: fee.id,
        amount: allocatedAmount,
      });
      remainingAmount -= allocatedAmount;
    }

    if (remainingAmount > 0) {
      const allTermSlots: Array<{
        yearId: string;
        yearName: string;
        yearStart: Date;
        termId: string;
        termName: string;
        termStart: Date;
        termOrder: number;
      }> = [];

      for (const year of slot.allAcademicYears) {
        for (const term of year.terms || []) {
          allTermSlots.push({
            yearId: year.id,
            yearName: year.name,
            yearStart: new Date(year.startDate),
            termId: term.id,
            termName: term.name,
            termStart: new Date(term.startDate),
            termOrder: this.extractTermOrder(term.name) || 0,
          });
        }
      }

      allTermSlots.sort((a, b) => a.termStart.getTime() - b.termStart.getTime());
      const currentIndex = allTermSlots.findIndex((termSlot) => termSlot.termId === slot.term.id);
      const allFees = await FeeStructuresService.getAllFeeStructures();

      for (let index = currentIndex + 1; index < allTermSlots.length && remainingAmount > 0; index += 1) {
        const futureSlot = allTermSlots[index];

        const futureFees = allFees.filter((fee: any) => {
          if (fee.status === 'inactive') return false;
          if (fee.category === 'Discount' || (fee.amount ?? 0) < 0) return false;

          if (fee.isAssignmentFee) {
            const assigned = (pupil.assignedFees || []).some((assignedFee) => assignedFee.feeStructureId === fee.id);
            if (!assigned) return false;
          }

          if (fee.academicYearId) {
            const feeYear = slot.allAcademicYears.find((year: any) => year.id === fee.academicYearId);
            if (feeYear) {
              if (futureSlot.yearStart < new Date(feeYear.startDate)) return false;
            } else if (fee.academicYearId !== futureSlot.yearId) {
              return false;
            }
          }

          if (fee.termId) {
            const termDetails = this.lookupTerm(slot.allAcademicYears, fee.termId);
            const feeOrder = termDetails ? this.extractTermOrder(termDetails.name) : null;
            if (feeOrder !== futureSlot.termOrder) return false;
          }

          const classFeeType = fee.classFeeType || 'all';
          if (classFeeType === 'specific') {
            const classIds: string[] = Array.isArray(fee.classIds)
              ? fee.classIds
              : fee.classId
                ? [fee.classId]
                : [];
            if (!classIds.includes(pupil.classId)) return false;
          }

          if (fee.sectionFeeType === 'specific' && fee.section && fee.section !== pupil.section) return false;

          return true;
        });

        const futureFeesWithBalance = futureFees
          .map((fee: any) => {
            const paid = existingPayments
              .filter(
                (paymentRecord: any) =>
                  paymentRecord.feeStructureId === fee.id &&
                  paymentRecord.termId === futureSlot.termId &&
                  paymentRecord.academicYearId === futureSlot.yearId &&
                  !paymentRecord.reverted
              )
              .reduce((sum: number, paymentRecord: any) => sum + (paymentRecord.amount || 0), 0);

            return {
              ...fee,
              balance: Math.max(0, (fee.amount || 0) - paid),
            };
          })
          .filter((fee: any) => fee.balance > 0)
          .sort((a: any, b: any) => b.balance - a.balance);

        for (const fee of futureFeesWithBalance) {
          if (remainingAmount <= 0) break;

          const allocatedAmount = Math.min(remainingAmount, fee.balance);
          const paymentId = await PaymentsService.createPayment({
            pupilId: pupil.id,
            feeStructureId: fee.id,
            academicYearId: futureSlot.yearId,
            termId: futureSlot.termId,
            amount: allocatedAmount,
            paymentDate: this.resolvePaymentDate(payment),
            paidBy: {
              id: 'schoolpay-system',
              name: payment.studentName || pupil.firstName + ' ' + pupil.lastName,
              role: 'Parent/Guardian',
            },
            notes: this.buildPaymentNotes(
              payment,
              `${fee.name} (SchoolPay carried forward to ${futureSlot.termName} ${futureSlot.yearName})`
            ),
            paymentMethod: payment.sourcePaymentChannel || 'SchoolPay',
            schoolPayReceiptNumber: payment.schoolpayReceiptNumber,
            schoolPayTransactionId: payment.sourceChannelTransactionId,
            schoolPayPaymentCode: payment.studentPaymentCode,
            source: 'schoolpay',
          } as any);

          createdPaymentIds.push(paymentId);
          distributionBreakdown.push({
            feeName: `${fee.name} [${futureSlot.termName} ${futureSlot.yearName}]`,
            feeStructureId: fee.id,
            amount: allocatedAmount,
          });
          remainingAmount -= allocatedAmount;
        }
      }

      if (remainingAmount > 0) {
        await createGenericRecord(remainingAmount, slot.year.id, slot.term.id, 'SchoolPay excess / unmatched balance');
      }
    }

    return { localPaymentIds: createdPaymentIds, distributionBreakdown };
  }

  private static async recordSupplementaryFeePayment(
    payment: SchoolPayPaymentPayload,
    pupil: Pupil,
    slot: AcademicSlot
  ): Promise<{
    localPaymentIds: string[];
    distributionBreakdown: Array<{ feeName: string; feeStructureId: string; amount: number }>;
  }> {
    const mappedFeeStructureId = await this.getSupplementaryFeeStructureId(payment.supplementaryFeeId);
    const amount = this.parseAmount(payment.amount);
    const createdPaymentIds: string[] = [];
    const distributionBreakdown: Array<{ feeName: string; feeStructureId: string; amount: number }> = [];

    let feeStructureId = SCHOOLPAY_GENERAL_FEE_ID;
    let academicYearId = slot.year.id;
    let termId = slot.term.id;
    let description = payment.supplementaryFeeDescription || 'SchoolPay supplementary fee';
    let needsManualMapping = false;

    if (mappedFeeStructureId) {
      feeStructureId = mappedFeeStructureId;
      const feeStructure = await FeeStructuresService.getFeeStructureById(mappedFeeStructureId);
      if (feeStructure?.academicYearId) academicYearId = feeStructure.academicYearId;
      if (feeStructure?.termId) termId = feeStructure.termId;
      description = feeStructure?.name || description;
    } else {
      needsManualMapping = true;
      description = `SchoolPay unmatched supplementary fee${payment.supplementaryFeeDescription ? `: ${payment.supplementaryFeeDescription}` : ''}`;
    }

    const paymentId = await PaymentsService.createPayment({
      pupilId: pupil.id,
      feeStructureId,
      academicYearId,
      termId,
      amount,
      paymentDate: this.resolvePaymentDate(payment),
      paidBy: {
        id: 'schoolpay-system',
        name: payment.studentName || pupil.firstName + ' ' + pupil.lastName,
        role: 'Parent/Guardian',
      },
      notes: this.buildPaymentNotes(payment, description, [
        payment.supplementaryFeeId ? `Supplementary Fee ID: ${payment.supplementaryFeeId}` : '',
        payment.supplementaryFeeDescription
          ? `Supplementary Fee: ${payment.supplementaryFeeDescription}`
          : '',
      ]),
      paymentMethod: payment.sourcePaymentChannel || 'SchoolPay',
      schoolPayReceiptNumber: payment.schoolpayReceiptNumber,
      schoolPayTransactionId: payment.sourceChannelTransactionId,
      schoolPayPaymentCode: payment.studentPaymentCode,
      schoolPaySupplementaryFeeId: payment.supplementaryFeeId,
      schoolPayNeedsManualMapping: needsManualMapping,
      source: 'schoolpay',
    } as any);

    createdPaymentIds.push(paymentId);
    distributionBreakdown.push({
      feeName: description,
      feeStructureId,
      amount,
    });

    return { localPaymentIds: createdPaymentIds, distributionBreakdown };
  }

  private static async getSupplementaryFeeStructureId(supplementaryFeeId?: string): Promise<string | null> {
    const normalizedId = `${supplementaryFeeId || ''}`.trim();
    if (!normalizedId) return null;

    const directDoc = await getDoc(doc(db, SCHOOLPAY_SUPPLEMENTARY_MAPPINGS, normalizedId));
    if (directDoc.exists()) {
      const data = directDoc.data();
      return (data.feeStructureId as string) || null;
    }

    const q = query(
      collection(db, SCHOOLPAY_SUPPLEMENTARY_MAPPINGS),
      where('supplementaryFeeId', '==', normalizedId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    return (snapshot.docs[0].data().feeStructureId as string) || null;
  }

  private static async getPaymentMapping(receiptNumber: string): Promise<any | null> {
    const mappingDoc = await getDoc(doc(db, SCHOOLPAY_PAYMENT_MAPPINGS, receiptNumber));
    return mappingDoc.exists() ? mappingDoc.data() : null;
  }

  private static async storePaymentMapping(mapping: {
    receiptNumber: string;
    paymentType: SchoolPayPaymentType;
    pupilId: string;
    studentPaymentCode: string;
    studentRegistrationNumber: string;
    localPaymentIds: string[];
    amount: number;
    paymentDate: string;
    sourceChannelTransactionId: string;
    sourcePaymentChannel: string;
    source: 'webhook' | 'sync';
  }): Promise<void> {
    await setDoc(doc(db, SCHOOLPAY_PAYMENT_MAPPINGS, mapping.receiptNumber), {
      schoolpayReceiptNumber: mapping.receiptNumber,
      paymentType: mapping.paymentType,
      pupilId: mapping.pupilId,
      studentPaymentCode: mapping.studentPaymentCode,
      studentRegistrationNumber: mapping.studentRegistrationNumber,
      localPaymentIds: mapping.localPaymentIds,
      amount: mapping.amount,
      paymentDate: mapping.paymentDate,
      sourceChannelTransactionId: mapping.sourceChannelTransactionId,
      sourcePaymentChannel: mapping.sourcePaymentChannel,
      source: mapping.source,
      syncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }

  private static async logSync(data: Record<string, unknown>): Promise<void> {
    await addDoc(collection(db, SCHOOLPAY_SYNC_LOGS), data);
  }
}
