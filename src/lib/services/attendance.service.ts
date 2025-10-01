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
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AttendanceRecord, EnhancedAttendanceRecord } from '@/types';
import { PupilSnapshotsService } from './pupil-snapshots.service';

const COLLECTION_NAME = 'attendanceRecords';

export class AttendanceService {
  static async getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
          recordedAt: data.recordedAt?.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt
        } as AttendanceRecord;
      });
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
          date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
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
      // Create start and end timestamps
      const startTimestamp = Timestamp.fromDate(new Date(startDate));
      const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59.999Z'));
      
      const q = query(
        collection(db, COLLECTION_NAME),
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp)
      );
      const querySnapshot = await getDocs(q);
      
      const results = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
          recordedAt: data.recordedAt?.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt
        } as AttendanceRecord;
      });
      
      // Sort by date in descending order (most recent first)
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return results;
    } catch (error) {
      console.error('Error fetching attendance records by date range:', error);
      throw error;
    }
  }

  static async getAttendanceByPupil(pupilId: string): Promise<AttendanceRecord[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('pupilId', '==', pupilId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
          recordedAt: data.recordedAt?.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt
        } as AttendanceRecord;
      });
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

      // Convert date string to Timestamp
      const dateTimestamp = Timestamp.fromDate(new Date(recordData.date));

      const docData = {
        ...recordData,
        date: dateTimestamp,
        recordedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating attendance record:', error);
      throw error;
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
        updateData.date = Timestamp.fromDate(new Date(recordData.date));
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

  static async bulkCreateAttendanceRecords(records: Omit<AttendanceRecord, 'id' | 'recordedAt'>[]): Promise<string[]> {
    try {
      if (!records || records.length === 0) {
        return [];
      }

      const results: string[] = [];

      // Process records sequentially to avoid overwhelming Firebase
      for (const record of records) {
        const docId = await AttendanceService.createAttendanceRecord(record);
        results.push(docId);
      }

      return results;
    } catch (error) {
      console.error('Error bulk creating attendance records:', error);
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
    const attendanceRecords = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceRecord));

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
    const attendanceRecords = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceRecord));

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
   */
  private static async enhanceWithHistoricalData(
    attendanceRecords: AttendanceRecord[]
  ): Promise<EnhancedAttendanceRecord[]> {
    const enhancedRecords: EnhancedAttendanceRecord[] = [];

    for (const record of attendanceRecords) {
      try {
        // Get snapshot for the specific term
        const snapshot = await PupilSnapshotsService.getSnapshot(
          record.pupilId,
          record.termId
        );

        const enhancedRecord: EnhancedAttendanceRecord = {
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

        enhancedRecords.push(enhancedRecord);
      } catch (error) {
        console.error(`Error enhancing attendance record ${record.id}:`, error);
        // If enhancement fails, include the record without enhancement
        enhancedRecords.push(record as EnhancedAttendanceRecord);
      }
    }

    return enhancedRecords;
  }
} 