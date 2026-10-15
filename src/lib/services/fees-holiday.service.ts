import { collection, doc, getDocs, getDoc, query, where, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyFeeReminderChange } from '@/lib/fees/fee-reminder-change-client';
import type { FeesHoliday } from '@/types';
import { AcademicYearsService } from './academic-years.service';
import { prepareFeesHolidayWrite } from '@/lib/utils/fees-holiday-terms';

const FEES_HOLIDAY_COLLECTION = 'feesHolidays';
const normalise = (id: string, data: Record<string, any>): FeesHoliday => ({
  ...data, id,
  createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
  updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
  disabledAt: data.disabledAt?.toDate?.()?.toISOString() || data.disabledAt,
} as FeesHoliday);

export class FeesHolidayService {
  static async getAllFeesHolidays(): Promise<FeesHoliday[]> {
    const snapshot = await getDocs(collection(db, FEES_HOLIDAY_COLLECTION));
    return snapshot.docs.map(item => normalise(item.id, item.data())).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  static async getFeesHolidaysByPupil(pupilId: string): Promise<FeesHoliday[]> {
    const snapshot = await getDocs(query(collection(db, FEES_HOLIDAY_COLLECTION), where('pupilId', '==', pupilId)));
    return snapshot.docs.map(item => normalise(item.id, item.data())).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  // Stopped records can still waive ended terms. Consumers resolve their selected term.
  static async getActiveFeesHolidaysByPupil(pupilId: string): Promise<FeesHoliday[]> {
    return this.getFeesHolidaysByPupil(pupilId);
  }

  static async getFeesHolidayById(id: string): Promise<FeesHoliday | null> {
    const snapshot = await getDoc(doc(db, FEES_HOLIDAY_COLLECTION, id));
    return snapshot.exists() ? normalise(snapshot.id, snapshot.data()) : null;
  }

  /** Also used by pupil registration, inside its existing atomic transaction. */
  static async prepareNewHoliday(data: Omit<FeesHoliday, 'id' | 'createdAt' | 'updatedAt'>): Promise<Omit<FeesHoliday, 'id'>> {
    const years = await AcademicYearsService.getAllAcademicYears();
    const now = new Date().toISOString();
    return this.cleanUndefined(prepareFeesHolidayWrite(null, { ...data, createdAt: now, updatedAt: now }, years));
  }

  static async createFeesHoliday(data: Omit<FeesHoliday, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeesHoliday> {
    const prepared = await this.prepareNewHoliday(data);
    const ref = doc(collection(db, FEES_HOLIDAY_COLLECTION));
    await runTransaction(db, async transaction => { transaction.set(ref, prepared); });
    await notifyFeeReminderChange({ pupilIds: [prepared.pupilId] });
    return { ...prepared, id: ref.id };
  }

  static async updateFeesHoliday(id: string, data: Partial<Omit<FeesHoliday, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const years = await AcademicYearsService.getAllAcademicYears();
    const ref = doc(db, FEES_HOLIDAY_COLLECTION, id);
    const pupilIds = await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error('This privilege no longer exists.');
      const existing = normalise(snapshot.id, snapshot.data());
      const next = prepareFeesHolidayWrite(existing, data, years);
      transaction.set(ref, this.cleanUndefined({ ...next, updatedAt: new Date().toISOString(),
        ...(data.isActive === false ? { disabledAt: new Date().toISOString() } : data.isActive === true ? { disabledAt: null, disabledBy: null } : {}),
      }));
      return [...new Set([existing.pupilId, next.pupilId])];
    });
    await notifyFeeReminderChange({ source: { collection: 'feesHolidays', id }, pupilIds });
  }

  /** Stop current/future benefits; retain the ended-term record. */
  static async deleteFeesHoliday(id: string): Promise<void> {
    await this.disableFeesHoliday(id);
  }

  static async disableFeesHoliday(id: string, disabledBy?: string): Promise<void> {
    await this.updateFeesHoliday(id, { isActive: false, ...(disabledBy ? { disabledBy } : {}) });
  }

  static async enableFeesHoliday(id: string, updatedBy?: string): Promise<void> {
    await this.updateFeesHoliday(id, { isActive: true, ...(updatedBy ? { updatedBy } : {}) });
  }

  private static cleanUndefined(value: any): any {
    if (Array.isArray(value)) return value.map(item => this.cleanUndefined(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, this.cleanUndefined(item)]));
    return value;
  }
}
