import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
  serverTimestamp,
  setDoc,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AttendanceRecord, EnhancedAttendanceRecord } from '@/types';
import { PupilSnapshotsService } from './pupil-snapshots.service';
import { getDocsWithTimeout } from '../utils/firestore-helpers';

/**
 * EAT TIMEZONE FIX:
 * Convert a Date (from Firestore Timestamp) to a local ISO string WITHOUT 'Z'.
 * This ensures split('T')[0] returns the local date, not the UTC date.
 * e.g. a record stored at 2026-03-01T21:00:00Z (= 2026-03-02 midnight EAT)
 *      returns '2026-03-02T00:00:00' instead of '2026-03-01T21:00:00.000Z'
 */
function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getFullYear() + '-' +
    pad(date.getMonth() + 1) + '-' +
    pad(date.getDate()) + 'T' +
    pad(date.getHours()) + ':' +
    pad(date.getMinutes()) + ':' +
    pad(date.getSeconds())
  );
}

/**
 * EAT TIMEZONE FIX:
 * Parse a date value to a Timestamp-ready Date, always at LOCAL midnight.
 * A bare 'YYYY-MM-DD' string is treated as UTC midnight by JS — we must
 * append 'T00:00:00' (no Z) to force local midnight interpretation.
 */
function parseDateToLocalMidnight(dateValue: string | Date): Date {
  if (dateValue instanceof Date) return dateValue;
  // If it is already a full ISO string (contains 'T'), use it as-is
  if (dateValue.includes('T')) return new Date(dateValue);
  // Bare date 'YYYY-MM-DD' — append local midnight marker
  return new Date(dateValue + 'T00:00:00');
}

const COLLECTION_NAME = 'attendanceRecords';

export function getAttendanceRecordId(date: string, classId: string, pupilId: string): string {
  return [date.split('T')[0], classId, pupilId].map(encodeURIComponent).join('__');
}

export class AttendanceService {
  static async getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
    try {
      console.log('🚀 ATTENDANCE: Fetching recent attendance records (limited to 500)');
      const startTime = performance.now();

      // 🚀 OPTIMIZATION: Limit to 500 most recent records and use timeout protection
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('date', 'desc'),
        limit(500) // Prevent loading thousands of records
      );

      const docs = await getDocsWithTimeout<any>(q, 30000);

      const records = docs.map(doc => {
        const data = doc;
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? toLocalISOString(data.date.toDate()) : data.date,
          recordedAt: data.recordedAt?.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt
        } as AttendanceRecord;
      });

      const endTime = performance.now();
      console.log(`✅ ATTENDANCE: Loaded ${records.length} records in ${(endTime - startTime).toFixed(2)}ms`);

      return records;
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      throw error;
    }
  }

  static async getAttendanceRecordById(id: string): Promise<AttendanceRecord | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          date: data.date?.toDate ? toLocalISOString(data.date.toDate()) : data.date,
          recordedAt: data.recordedAt?.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt
        } as AttendanceRecord;
      }
      return null;
    } catch (error) {
      console.error('Error fetching attendance record:', error);
      throw error;
    }
  }

  static async getAttendanceByDateRange(startDate: string, endDate: string): Promise<AttendanceRecord[]> {
    try {
      console.log('🚀 ATTENDANCE: Fetching by date range with timeout protection');
      const startTime = performance.now();

      // Create start and end timestamps — use LOCAL midnight (no 'Z') so
      // records saved in e.g. UTC+3 at the start of the school day are included.
      const startTimestamp = Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
      const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59.999'));

      const q = query(
        collection(db, COLLECTION_NAME),
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp)
      );

      // Increase timeout for Android/Capacitor
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
      const timeout = isNative ? 60000 : 30000; // 60s for native, 30s for web
      const docs = await getDocsWithTimeout<any>(q, timeout);

      const results = docs.map(doc => {
        const data = doc;
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? toLocalISOString(data.date.toDate()) : data.date,
          recordedAt: data.recordedAt?.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt
        } as AttendanceRecord;
      });

      // Sort by date in descending order (most recent first)
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const endTime = performance.now();
      console.log(`✅ ATTENDANCE: Loaded ${results.length} records in ${(endTime - startTime).toFixed(2)}ms`);

      return results;
    } catch (error) {
      console.error('Error fetching attendance records by date range:', error);
      throw error;
    }
  }

  static async getAttendanceByPupil(pupilId: string): Promise<AttendanceRecord[]> {
    try {
      console.log('🚀 ATTENDANCE: Fetching by pupil with timeout protection');
      const startTime = performance.now();

      const q = query(
        collection(db, COLLECTION_NAME),
        where('pupilId', '==', pupilId),
        orderBy('date', 'desc')
      );

      // Increase timeout for Android/Capacitor
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
      const timeout = isNative ? 60000 : 30000; // 60s for native, 30s for web
      const docs = await getDocsWithTimeout<any>(q, timeout);

      const records = docs.map(doc => {
        const data = doc;
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? toLocalISOString(data.date.toDate()) : data.date,
          recordedAt: data.recordedAt?.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt
        } as AttendanceRecord;
      });

      const endTime = performance.now();
      console.log(`✅ ATTENDANCE: Loaded ${records.length} records for pupil in ${(endTime - startTime).toFixed(2)}ms`);

      return records;
    } catch (error) {
      console.error('Error fetching attendance records by pupil:', error);
      throw error;
    }
  }

  static async createAttendanceRecord(recordData: Omit<AttendanceRecord, 'id' | 'recordedAt'>): Promise<string> {
    try {
      // Validate required fields
      if (!recordData.date) throw new Error('Date is required');
      if (!recordData.classId) throw new Error('Class ID is required');
      if (!recordData.pupilId) throw new Error('Pupil ID is required');
      if (!recordData.status) throw new Error('Status is required');

      // Convert date string to Timestamp — use local midnight to avoid UTC offset issues (EAT fix)
      const dateTimestamp = Timestamp.fromDate(parseDateToLocalMidnight(recordData.date));

      const docData = {
        ...recordData,
        date: dateTimestamp,
        recordedAt: Timestamp.now()
      };

      const docRef = doc(
        db,
        COLLECTION_NAME,
        getAttendanceRecordId(recordData.date, recordData.classId, recordData.pupilId),
      );
      await setDoc(docRef, docData, { merge: true });
      return docRef.id;
    } catch (error) {
      console.error('Error creating attendance record:', error);
      throw error;
    }
  }

  static async bulkUpdateAttendanceRecords(
    updates: { id: string; data: Partial<Omit<AttendanceRecord, 'id' | 'recordedAt'>> }[]
  ): Promise<void> {
    if (!updates || updates.length === 0) return;

    // 🚀 writeBatch = single network round-trip regardless of how many records
    const BATCH_LIMIT = 500; // Firestore hard limit per batch
    for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
      const chunk = updates.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const { id, data } of chunk) {
        const docRef = doc(db, COLLECTION_NAME, id);
        const updateData: any = { ...data, updatedAt: Timestamp.now() };
        if (data.date) {
          updateData.date = Timestamp.fromDate(parseDateToLocalMidnight(data.date));
        }
        batch.update(docRef, updateData);
      }
      await batch.commit();
    }
  }

  static async updateAttendanceRecord(id: string, recordData: Partial<Omit<AttendanceRecord, 'id' | 'recordedAt'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData: any = {
        ...recordData,
        updatedAt: Timestamp.now()
      };

      if (recordData.date) {
        updateData.date = Timestamp.fromDate(parseDateToLocalMidnight(recordData.date));
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating attendance record:', error);
      throw error;
    }
  }

  static async deleteAttendanceRecord(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      throw error;
    }
  }

  /**
   * Upsert bulk attendance records — prevents duplicate Firestore documents.
   * If a record already exists for the same pupilId + classId + date, it is
   * UPDATED. Only genuinely new records get a new document created.
   */
  static async bulkCreateAttendanceRecords(records: Omit<AttendanceRecord, 'id' | 'recordedAt'>[]): Promise<string[]> {
    try {
      if (!records || records.length === 0) {
        return [];
      }

      // Deterministic IDs make this a no-read upsert.
      const batch = writeBatch(db);
      const results: string[] = [];

      for (const record of records) {
        const id = getAttendanceRecordId(record.date, record.classId, record.pupilId);
        const docRef = doc(db, COLLECTION_NAME, id);
        batch.set(docRef, {
          ...record,
          date: Timestamp.fromDate(parseDateToLocalMidnight(record.date)),
          recordedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }, { merge: true });
        results.push(id);
      }

      await batch.commit();
      return results;
    } catch (error) {
      console.error('Error bulk upserting attendance records:', error);
      throw error;
    }
  }


  /**
   * NEW: Get enhanced attendance records with historical pupil data
   */
  static async getEnhancedAttendanceByDateRange(
    startDate: string,
    endDate: string,
    academicYearId?: string,
    termId?: string
  ): Promise<EnhancedAttendanceRecord[]> {
    let q = query(
      collection(db, COLLECTION_NAME),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc'),
      orderBy('recordedAt', 'desc')
    );

    // Add academic context filters if provided
    if (academicYearId) {
      q = query(q, where('academicYearId', '==', academicYearId));
    }
    if (termId) {
      q = query(q, where('termId', '==', termId));
    }

    const querySnapshot = await getDocs(q);
    const attendanceRecords = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate ? toLocalISOString(data.date.toDate()) : data.date,
        recordedAt: data.recordedAt?.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt
      } as AttendanceRecord;
    });

    // Enhance with historical pupil data
    return this.enhanceWithHistoricalData(attendanceRecords);
  }

  /**
   * NEW: Get enhanced attendance records for a specific pupil with historical accuracy
   */
  static async getEnhancedAttendanceByPupil(
    pupilId: string,
    academicYearId?: string,
    termId?: string
  ): Promise<EnhancedAttendanceRecord[]> {
    let q = query(
      collection(db, COLLECTION_NAME),
      where('pupilId', '==', pupilId),
      orderBy('date', 'desc')
    );

    if (academicYearId) {
      q = query(q, where('academicYearId', '==', academicYearId));
    }
    if (termId) {
      q = query(q, where('termId', '==', termId));
    }

    const querySnapshot = await getDocs(q);
    const attendanceRecords = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate ? toLocalISOString(data.date.toDate()) : data.date,
        recordedAt: data.recordedAt?.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt
      } as AttendanceRecord;
    });

    return this.enhanceWithHistoricalData(attendanceRecords);
  }

  /**
   * NEW: Enhanced method to create attendance record with academic context
   */
  static async createEnhancedAttendanceRecord(
    recordData: Omit<AttendanceRecord, 'id' | 'recordedAt'>
  ): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...recordData,
      recordedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * NEW: Private method to enhance attendance records with historical pupil data
   * 🚀 OPTIMIZED: Batch-loads all snapshots in ONE query instead of N queries
   */
  private static async enhanceWithHistoricalData(
    attendanceRecords: AttendanceRecord[]
  ): Promise<EnhancedAttendanceRecord[]> {
    if (attendanceRecords.length === 0) return [];

    console.log('🚀 ATTENDANCE: Batch-loading snapshots for enhancement...');
    const startTime = performance.now();

    try {
      // 🚀 OPTIMIZATION: Collect all unique pupilId+termId combinations
      const snapshotKeys = new Set<string>();
      attendanceRecords.forEach(record => {
        if (record.pupilId && record.termId) {
          snapshotKeys.add(`${record.pupilId}__${record.termId}`);
        }
      });

      // 🚀 BATCH LOAD: Load ALL snapshots in parallel (max 10 at a time to avoid overwhelming)
      const snapshotsMap = new Map<string, any>();
      const uniqueKeys = Array.from(snapshotKeys);

      console.log(`📊 ATTENDANCE: Loading ${uniqueKeys.length} unique snapshots...`);

      // Process in batches of 10 to avoid too many concurrent requests
      const batchSize = 10;
      for (let i = 0; i < uniqueKeys.length; i += batchSize) {
        const batch = uniqueKeys.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (key) => {
            const [pupilId, termId] = key.split('__');
            try {
              const snapshot = await PupilSnapshotsService.getSnapshot(pupilId, termId);
              if (snapshot) {
                snapshotsMap.set(key, snapshot);
              }
            } catch (error) {
              // Silently fail for individual snapshots
              console.warn(`⚠️ Failed to load snapshot for ${key}`);
            }
          })
        );
      }

      // 💨 IN-MEMORY: Instant lookups using the snapshots map
      const enhancedRecords: EnhancedAttendanceRecord[] = attendanceRecords.map(record => {
        const key = `${record.pupilId}__${record.termId}`;
        const snapshot = snapshotsMap.get(key);

        return {
          ...record,
          pupilSnapshotData: snapshot ? {
            classId: snapshot.classId,
            section: snapshot.section,
            admissionNumber: snapshot.admissionNumber,
            dateOfBirth: snapshot.dateOfBirth,
            dataSource: 'snapshot',
            snapshotId: snapshot.id
          } : undefined
        };
      });

      const endTime = performance.now();
      console.log(`✅ ATTENDANCE: Enhanced ${enhancedRecords.length} records in ${(endTime - startTime).toFixed(2)}ms`);

      return enhancedRecords;
    } catch (error) {
      console.error('Error enhancing attendance records:', error);
      // Return records without enhancement on error
      return attendanceRecords as EnhancedAttendanceRecord[];
    }
  }
} 
