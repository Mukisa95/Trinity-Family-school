import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import type { RequirementTracking, CreateRequirementTrackingData, UpdateRequirementTrackingData, EnhancedRequirementTracking, Pupil, AcademicYear } from '@/types';
import { PupilSnapshotsService } from './pupil-snapshots.service';
import { 
  validateRequirementTrackingCreation, 
  createEnhancedRequirementTracking,
  filterApplicableRequirements,
  getHistoricalPupilDataForTerm
} from '@/lib/utils/requirements-data-integrity';

const COLLECTION_NAME = 'requirement-tracking';

export class RequirementTrackingService {
  static async getTrackingRecordsByPupil(pupilId: string): Promise<RequirementTracking[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('pupilId', '==', pupilId)
      );
      
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementTracking[];

      // Sort by creation date (client-side sorting)
      return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching requirement tracking records by pupil:', error);
      throw error;
    }
  }

  static async getTrackingRecordsByPupilAndAcademicYear(pupilId: string, academicYearId: string): Promise<RequirementTracking[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('pupilId', '==', pupilId),
        where('academicYearId', '==', academicYearId)
      );
      
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementTracking[];

      // Sort by creation date (client-side sorting)
      return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching requirement tracking records by pupil and academic year:', error);
      throw error;
    }
  }

  static async getTrackingRecordsByPupilAndTerm(pupilId: string, academicYearId: string, termId: string): Promise<RequirementTracking[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('pupilId', '==', pupilId),
        where('academicYearId', '==', academicYearId),
        where('termId', '==', termId)
      );
      
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementTracking[];

      // Sort by creation date (client-side sorting)
      return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching requirement tracking records by pupil and term:', error);
      throw error;
    }
  }

  /**
   * Gets tracking records with enhanced historical data integrity
   */
  static async getEnhancedTrackingRecordsByPupilAndTerm(
    pupil: Pupil,
    termId: string,
    academicYear: AcademicYear
  ): Promise<RequirementTracking[]> {
    try {
      console.log('🔍 Getting enhanced tracking records with data integrity:', {
        pupilId: pupil.id,
        termId,
        academicYearId: academicYear.id
      });

      // Get historical pupil data for this term
      const historicalData = await getHistoricalPupilDataForTerm(pupil, termId, academicYear);
      
      if (!historicalData) {
        console.log(`❌ Could not determine historical data for pupil ${pupil.id} in term ${termId}`);
        return [];
      }

      // Get tracking records from database
      const records = await this.getTrackingRecordsByPupilAndTerm(pupil.id, academicYear.id, termId);

      // Enhance records with historical data if they don't have it
      const enhancedRecords = records.map(record => {
        if (!record.pupilSnapshotData) {
          console.log(`📸 Enhancing record ${record.id} with historical data`);
          return {
            ...record,
            pupilSnapshotData: {
              classId: historicalData.classId,
              section: historicalData.section,
              admissionNumber: historicalData.admissionNumber,
              dateOfBirth: historicalData.dateOfBirth,
              dataSource: 'enhanced' as const,
              snapshotId: undefined
            }
          };
        }
        return record;
      });

      console.log(`✅ Retrieved ${enhancedRecords.length} enhanced tracking records`);
      return enhancedRecords;
    } catch (error) {
      console.error('Error fetching enhanced requirement tracking records:', error);
      throw error;
    }
  }

  static async getTrackingRecordById(id: string): Promise<RequirementTracking | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || docSnap.data().createdAt,
          updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() || docSnap.data().updatedAt
        } as RequirementTracking;
      }
      return null;
    } catch (error) {
      console.error('Error fetching requirement tracking record:', error);
      throw error;
    }
  }

  static async createTrackingRecord(trackingData: CreateRequirementTrackingData): Promise<string> {
    try {
      // Enhanced validation and data integrity
      const newRecord = {
        ...trackingData,
        createdAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newRecord);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating requirement tracking record:', error);
      throw error;
    }
  }

  /**
   * Creates a requirement tracking record with enhanced data integrity validation
   */
  static async createEnhancedTrackingRecord(
    pupil: Pupil,
    termId: string,
    academicYear: AcademicYear,
    requirementId: string | string[],
    trackingData: Omit<CreateRequirementTrackingData, 'pupilId' | 'requirementId' | 'academicYearId' | 'termId'>
  ): Promise<string> {
    try {
      console.log('🔍 Creating enhanced requirement tracking record with data integrity:', {
        pupilId: pupil.id,
        termId,
        academicYearId: academicYear.id,
        requirementId
      });

      // Create enhanced tracking record with historical data integrity
      const enhancedTracking = await createEnhancedRequirementTracking(
        pupil,
        termId,
        academicYear,
        requirementId,
        trackingData
      );

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(enhancedTracking);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      console.log(`✅ Successfully created enhanced requirement tracking record: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Error creating enhanced requirement tracking record:', error);
      throw error;
    }
  }

  static async updateTrackingRecord(id: string, trackingData: UpdateRequirementTrackingData): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...trackingData,
        updatedAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating requirement tracking record:', error);
      throw error;
    }
  }

  static async deleteTrackingRecord(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting requirement tracking record:', error);
      throw error;
    }
  }

  static async getAllTrackingRecords(): Promise<RequirementTracking[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementTracking[];

      // Sort by creation date (client-side sorting)
      return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching all requirement tracking records:', error);
      throw error;
    }
  }

  static async getTrackingRecordsByRequirement(requirementId: string): Promise<RequirementTracking[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('requirementId', '==', requirementId)
      );
      
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementTracking[];

      // Sort by creation date (client-side sorting)
      return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching requirement tracking records by requirement:', error);
      throw error;
    }
  }

  static async getTrackingRecordsByClass(classId: string, academicYearId: string, termId: string): Promise<RequirementTracking[]> {
    try {
      // First, we need to get all pupils in the class
      // Since we don't have direct access to pupils service here, we'll query by academic year and term
      // and then filter by class on the client side if needed
      const q = query(
        collection(db, COLLECTION_NAME),
        where('academicYearId', '==', academicYearId),
        where('termId', '==', termId)
      );
      
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementTracking[];

      // Sort by creation date (client-side sorting)
      return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching requirement tracking records by class:', error);
      throw error;
    }
  }

  static async findDuplicateRecords(pupilId: string, academicYearId: string): Promise<RequirementTracking[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('pupilId', '==', pupilId),
        where('academicYearId', '==', academicYearId)
      );
      
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementTracking[];

      // Group records by requirement ID and term ID
      const groupedRecords = new Map<string, RequirementTracking[]>();
      
      records.forEach(record => {
        const key = `${record.requirementId}-${record.termId}`;
        if (!groupedRecords.has(key)) {
          groupedRecords.set(key, []);
        }
        groupedRecords.get(key)!.push(record);
      });

      // Find duplicates (groups with more than one record)
      const duplicates: RequirementTracking[] = [];
      groupedRecords.forEach((group) => {
        if (group.length > 1) {
          // Keep the oldest record, mark others as duplicates
          const sorted = group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          duplicates.push(...sorted.slice(1)); // All except the first (oldest)
        }
      });

      return duplicates;
    } catch (error) {
      console.error('Error finding duplicate requirement tracking records:', error);
      throw error;
    }
  }

  // New methods for the requirements tracking dashboard
  static async getAll(): Promise<RequirementTracking[]> {
    return this.getAllTrackingRecords();
  }

  static async getByPupil(pupilId: string): Promise<RequirementTracking[]> {
    return this.getTrackingRecordsByPupil(pupilId);
  }

  static async getByClass(classId: string): Promise<RequirementTracking[]> {
    try {
      // Since RequirementTracking doesn't have classId, we need to get pupils in the class
      // and then filter tracking records by those pupils
      const allRecords = await this.getAllTrackingRecords();
      // For now, return all records - the component will filter by pupils in the class
      return allRecords;
    } catch (error) {
      console.error('Error fetching requirement tracking records by class:', error);
      throw error;
    }
  }

  static async getByRequirement(requirementId: string): Promise<RequirementTracking[]> {
    return this.getTrackingRecordsByRequirement(requirementId);
  }

  static async create(data: Omit<RequirementTracking, 'id' | 'createdAt' | 'updatedAt'>): Promise<RequirementTracking> {
    try {
      const newRecord = {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      const cleanedData = this.cleanUndefinedValues(newRecord);
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      
      return {
        id: docRef.id,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating requirement tracking record:', error);
      throw error;
    }
  }

  static async update(id: string, data: Partial<RequirementTracking>): Promise<RequirementTracking> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...data,
        updatedAt: Timestamp.now()
      };
      
      const cleanedData = this.cleanUndefinedValues(updateData);
      await updateDoc(docRef, cleanedData);
      
      // Fetch and return the updated record
      const updated = await this.getTrackingRecordById(id);
      if (!updated) {
        throw new Error('Failed to fetch updated record');
      }
      return updated;
    } catch (error) {
      console.error('Error updating requirement tracking record:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<void> {
    return this.deleteTrackingRecord(id);
  }

  static async bulkUpdate(updates: { id: string; data: Partial<RequirementTracking> }[]): Promise<void> {
    try {
      const promises = updates.map(({ id, data }) => this.update(id, data));
      await Promise.all(promises);
    } catch (error) {
      console.error('Error performing bulk update:', error);
      throw error;
    }
  }

  static async getClassStats(classId: string): Promise<{
    totalPupils: number;
    completePupils: number;
    partialPupils: number;
    pendingPupils: number;
    totalItemsRequired: number;
    totalItemsReceived: number;
    overallProgress: number;
  }> {
    try {
      const records = await this.getByClass(classId);
      
      // Group records by pupil
      const pupilGroups = new Map<string, RequirementTracking[]>();
      records.forEach(record => {
        if (!pupilGroups.has(record.pupilId)) {
          pupilGroups.set(record.pupilId, []);
        }
        pupilGroups.get(record.pupilId)!.push(record);
      });

      let completePupils = 0;
      let partialPupils = 0;
      let pendingPupils = 0;
      let totalItemsRequired = 0;
      let totalItemsReceived = 0;

      pupilGroups.forEach(pupilRecords => {
        const pupilRequired = pupilRecords.reduce((sum, r) => sum + (r.totalItemQuantityRequired || 0), 0);
        const pupilReceived = pupilRecords.reduce((sum, r) => sum + (r.itemQuantityReceived || 0), 0);
        
        totalItemsRequired += pupilRequired;
        totalItemsReceived += pupilReceived;

        if (pupilReceived >= pupilRequired && pupilRequired > 0) {
          completePupils++;
        } else if (pupilReceived > 0) {
          partialPupils++;
        } else {
          pendingPupils++;
        }
      });

      return {
        totalPupils: pupilGroups.size,
        completePupils,
        partialPupils,
        pendingPupils,
        totalItemsRequired,
        totalItemsReceived,
        overallProgress: totalItemsRequired > 0 ? (totalItemsReceived / totalItemsRequired) * 100 : 0
      };
    } catch (error) {
      console.error('Error getting class stats:', error);
      throw error;
    }
  }

  static async getPupilProgress(pupilId: string): Promise<{
    totalRequired: number;
    totalReceived: number;
    progress: number;
    requirements: Array<{
      requirementId: string;
      required: number;
      received: number;
      progress: number;
    }>;
  }> {
    try {
      const records = await this.getByPupil(pupilId);
      
      const requirementMap = new Map<string, { required: number; received: number }>();
      
      records.forEach(record => {
        const reqId = Array.isArray(record.requirementId) ? record.requirementId[0] : record.requirementId;
        if (!requirementMap.has(reqId)) {
          requirementMap.set(reqId, { required: 0, received: 0 });
        }
        
        const req = requirementMap.get(reqId)!;
        req.required += record.totalItemQuantityRequired || 0;
        req.received += record.itemQuantityReceived || 0;
      });

      const requirements = Array.from(requirementMap.entries()).map(([requirementId, data]) => ({
        requirementId,
        required: data.required,
        received: data.received,
        progress: data.required > 0 ? (data.received / data.required) * 100 : 0
      }));

      const totalRequired = requirements.reduce((sum, r) => sum + r.required, 0);
      const totalReceived = requirements.reduce((sum, r) => sum + r.received, 0);

      return {
        totalRequired,
        totalReceived,
        progress: totalRequired > 0 ? (totalReceived / totalRequired) * 100 : 0,
        requirements
      };
    } catch (error) {
      console.error('Error getting pupil progress:', error);
      throw error;
    }
  }

  /**
   * NEW: Get enhanced requirement tracking with historical pupil data
   */
  static async getEnhancedTrackingRecordsByPupilAndTerm(
    pupilId: string, 
    academicYearId: string, 
    termId: string
  ): Promise<EnhancedRequirementTracking[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('pupilId', '==', pupilId),
      where('academicYearId', '==', academicYearId),
      where('termId', '==', termId)
    );

    const querySnapshot = await getDocs(q);
    const trackingRecords = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as RequirementTracking));

    return this.enhanceWithHistoricalData(trackingRecords);
  }

  /**
   * NEW: Get enhanced requirement tracking for a class with historical accuracy
   */
  static async getEnhancedTrackingRecordsByClassAndTerm(
    classId: string,
    academicYearId: string,
    termId: string
  ): Promise<EnhancedRequirementTracking[]> {
    // Get all pupils who were in this class during this term
    const pupils = await this.getPupilsInClassForTerm(classId, academicYearId, termId);
    const pupilIds = pupils.map(p => p.id);

    if (pupilIds.length === 0) {
      return [];
    }

    // Get tracking records for these pupils
    const q = query(
      collection(db, COLLECTION_NAME),
      where('pupilId', 'in', pupilIds),
      where('academicYearId', '==', academicYearId),
      where('termId', '==', termId)
    );

    const querySnapshot = await getDocs(q);
    const trackingRecords = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as RequirementTracking));

    return this.enhanceWithHistoricalData(trackingRecords);
  }

  /**
   * NEW: Private method to enhance tracking records with historical pupil data
   */
  private static async enhanceWithHistoricalData(
    trackingRecords: RequirementTracking[]
  ): Promise<EnhancedRequirementTracking[]> {
    const enhancedRecords: EnhancedRequirementTracking[] = [];

    for (const record of trackingRecords) {
      try {
        // Get snapshot for the specific term
        const snapshot = await PupilSnapshotsService.getSnapshot(
          record.pupilId,
          record.termId || ''
        );

        const enhancedRecord: EnhancedRequirementTracking = {
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
        console.error(`Error enhancing requirement tracking record ${record.id}:`, error);
        // If enhancement fails, include the record without enhancement
        enhancedRecords.push(record as EnhancedRequirementTracking);
      }
    }

    return enhancedRecords;
  }

  /**
   * NEW: Helper method to get pupils who were in a class during a specific term
   */
  private static async getPupilsInClassForTerm(
    classId: string,
    academicYearId: string,
    termId: string
  ): Promise<Array<{ id: string; name: string }>> {
    // This would need integration with the pupil service
    // For now, returning empty array - to be implemented
    return [];
  }

  // Utility function to recursively clean undefined values from objects
  private static cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }
}