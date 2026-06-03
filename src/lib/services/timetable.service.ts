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
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import type { TimetableProfile, GeneratedPeriod, TimetableEntry } from '@/types';

// Path constructor for academic term scoped timetables
// academicYears/${yearId}/terms/${termId}/timetables
export const getTimetablesCollectionPath = (yearId: string, termId: string) =>
    `academicYears/${yearId}/terms/${termId}/timetables`;

export const getPeriodsCollectionPath = (yearId: string, termId: string, timetableId: string) =>
    `${getTimetablesCollectionPath(yearId, termId)}/${timetableId}/periods`;

export const getEntriesCollectionPath = (yearId: string, termId: string, timetableId: string) =>
    `${getTimetablesCollectionPath(yearId, termId)}/${timetableId}/entries`;

export class TimetableService {
    /**
     * Timetable Profiles
     */
    static async getTimetables(yearId: string, termId: string): Promise<TimetableProfile[]> {
        try {
            const q = query(
                collection(db, getTimetablesCollectionPath(yearId, termId)),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
                updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
            })) as TimetableProfile[];
        } catch (error) {
            console.error('Error fetching timetables:', error);
            throw error;
        }
    }

    static async getTimetableById(yearId: string, termId: string, timetableId: string): Promise<TimetableProfile | null> {
        try {
            const docRef = doc(db, getTimetablesCollectionPath(yearId, termId), timetableId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
                } as TimetableProfile;
            }
            return null;
        } catch (error) {
            console.error('Error fetching timetable:', error);
            throw error;
        }
    }

    static async createTimetable(
        profileData: Omit<TimetableProfile, 'id' | 'createdAt' | 'updatedAt'>,
        generatedPeriods: Omit<GeneratedPeriod, 'id'>[]
    ): Promise<string> {
        try {
            const batch = writeBatch(db);

            // 1. Create Profile
            const timetablesRef = collection(db, getTimetablesCollectionPath(profileData.academicYearId, profileData.termId));
            const profileDocRef = doc(timetablesRef);

            const newProfile = {
                ...profileData,
                createdAt: Timestamp.now(),
            };

            batch.set(profileDocRef, this.cleanUndefinedValues(newProfile));

            // 2. Create Periods under the Profile
            const periodsRef = collection(db, getPeriodsCollectionPath(profileData.academicYearId, profileData.termId, profileDocRef.id));

            generatedPeriods.forEach(period => {
                const periodDocRef = doc(periodsRef);
                batch.set(periodDocRef, this.cleanUndefinedValues(period));
            });

            // Commit the batch
            await batch.commit();

            return profileDocRef.id;
        } catch (error) {
            console.error('Error creating timetable profile:', error);
            throw error;
        }
    }

    /** Update existing timetable profile metadata AND regenerate its periods. Existing lesson entries are preserved. */
    static async updateTimetable(
        yearId: string,
        termId: string,
        timetableId: string,
        profileData: Partial<Omit<TimetableProfile, 'id' | 'createdAt'>>,
        generatedPeriods: Omit<GeneratedPeriod, 'id'>[]
    ): Promise<void> {
        try {
            const batch = (await import('firebase/firestore')).writeBatch(db);

            // 1. Update the profile document
            const profileRef = doc(db, getTimetablesCollectionPath(yearId, termId), timetableId);
            batch.update(profileRef, { ...profileData, updatedAt: new Date().toISOString() });

            // 2. Delete all existing periods for this profile
            const periodsCol = collection(db, getPeriodsCollectionPath(yearId, termId, timetableId));
            const existingPeriods = await getDocs(periodsCol);
            existingPeriods.forEach(d => batch.delete(d.ref));

            await batch.commit();

            // 3. Re-create periods with a new batch
            const periodsBatch = (await import('firebase/firestore')).writeBatch(db);
            for (const period of generatedPeriods) {
                const newRef = doc(periodsCol);
                periodsBatch.set(newRef, { ...period, id: newRef.id, createdAt: new Date().toISOString() });
            }
            await periodsBatch.commit();
        } catch (error) {
            console.error('Error updating timetable:', error);
            throw error;
        }
    }

    static async deleteTimetable(yearId: string, termId: string, timetableId: string): Promise<void> {
        try {
            const docRef = doc(db, getTimetablesCollectionPath(yearId, termId), timetableId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting timetable:', error);
            throw error;
        }
    }

    /**
     * Rename a timetable profile without affecting its periods or entries.
     */
    static async renameTimetable(yearId: string, termId: string, timetableId: string, newName: string): Promise<void> {
        try {
            const docRef = doc(db, getTimetablesCollectionPath(yearId, termId), timetableId);
            await updateDoc(docRef, {
                name: newName,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error renaming timetable:', error);
            throw error;
        }
    }

    /**
     * Clone a timetable from one year/term into another.
     * @param includeEntries - if true, lesson entries are copied (Populated); if false, only periods (Empty grid)
     * Returns the new timetable ID.
     */
    static async cloneTimetable(
        srcYearId: string, srcTermId: string, srcTimetableId: string,
        dstYearId: string, dstTermId: string,
        overrideName: string,
        includeEntries: boolean
    ): Promise<string> {
        // 1. Read source profile
        const srcProfile = await TimetableService.getTimetableById(srcYearId, srcTermId, srcTimetableId);
        if (!srcProfile) throw new Error('Source timetable not found');

        // 2. Read source periods
        const srcPeriods = await TimetableService.getPeriods(srcYearId, srcTermId, srcTimetableId);

        // 3. Create new profile doc
        const newProfileRef = doc(collection(db, getTimetablesCollectionPath(dstYearId, dstTermId)));
        const newProfileData: Omit<TimetableProfile, 'id' | 'createdAt' | 'updatedAt'> = {
            name: overrideName,
            classIds: srcProfile.classIds,
            academicYearId: dstYearId,
            termId: dstTermId,
            firstLessonStart: srcProfile.firstLessonStart,
            lessonDuration: srcProfile.lessonDuration,
            timeBlocks: srcProfile.timeBlocks,
            activeDays: srcProfile.activeDays || [1, 2, 3, 4, 5],
        };
        await (await import('firebase/firestore')).setDoc(newProfileRef, {
            ...newProfileData,
            id: newProfileRef.id,
            createdAt: new Date().toISOString(),
        });
        const newTimetableId = newProfileRef.id;

        // 4. Clone periods, building old->new id map
        const periodsCol = collection(db, getPeriodsCollectionPath(dstYearId, dstTermId, newTimetableId));
        const periodIdMap: Record<string, string> = {};
        const periodBatch = (await import('firebase/firestore')).writeBatch(db);
        for (const period of srcPeriods) {
            const newRef = doc(periodsCol);
            periodIdMap[period.id] = newRef.id;
            periodBatch.set(newRef, {
                ...period,
                id: newRef.id,
                timetableId: newTimetableId,
                createdAt: new Date().toISOString(),
            });
        }
        await periodBatch.commit();

        // 5. Optionally clone entries, remapping periodIds
        if (includeEntries) {
            const srcEntries = await TimetableService.getEntries(srcYearId, srcTermId, srcTimetableId);
            const entriesCol = collection(db, getEntriesCollectionPath(dstYearId, dstTermId, newTimetableId));
            const entryBatch = (await import('firebase/firestore')).writeBatch(db);
            for (const entry of srcEntries) {
                const newPeriodId = periodIdMap[entry.periodId];
                if (!newPeriodId) continue; // skip if period not found
                const newRef = doc(entriesCol);
                entryBatch.set(newRef, {
                    ...entry,
                    id: newRef.id,
                    periodId: newPeriodId,
                    createdAt: new Date().toISOString(),
                });
            }
            await entryBatch.commit();
        }

        return newTimetableId;
    }

    /**
     * Generated Periods
     */
    static async getPeriods(yearId: string, termId: string, timetableId: string): Promise<GeneratedPeriod[]> {
        try {
            const q = query(
                collection(db, getPeriodsCollectionPath(yearId, termId, timetableId))
                // Removed orderBy to prevent requiring a composite index. 
                // Sorting will be handled client-side in the components.
            );
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as GeneratedPeriod[];
        } catch (error) {
            console.error('Error fetching timetable periods:', error);
            throw error;
        }
    }

    static async savePeriodsBatch(
        yearId: string,
        termId: string,
        timetableId: string,
        periods: Partial<GeneratedPeriod>[]
    ): Promise<void> {
        try {
            const batch = writeBatch(db);
            const periodsRef = collection(db, getPeriodsCollectionPath(yearId, termId, timetableId));

            periods.forEach(period => {
                if (period.id) {
                    const docRef = doc(periodsRef, period.id);
                    const periodData = { ...period };
                    delete periodData.id;
                    batch.update(docRef, this.cleanUndefinedValues(periodData));
                }
            });

            await batch.commit();
        } catch (error) {
            console.error('Error saving timetable periods batch:', error);
            throw error;
        }
    }

    /**
     * Timetable Entries (Lessons assigned to cells)
     */
    static async getEntries(yearId: string, termId: string, timetableId: string): Promise<TimetableEntry[]> {
        try {
            const q = query(collection(db, getEntriesCollectionPath(yearId, termId, timetableId)));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
            })) as TimetableEntry[];
        } catch (error) {
            console.error('Error fetching timetable entries:', error);
            throw error;
        }
    }

    static async getEntriesByClass(yearId: string, termId: string, timetableId: string, classId: string): Promise<TimetableEntry[]> {
        try {
            const q = query(
                collection(db, getEntriesCollectionPath(yearId, termId, timetableId)),
                where('classId', '==', classId)
            );
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
            })) as TimetableEntry[];
        } catch (error) {
            console.error('Error fetching timetable entries by class:', error);
            throw error;
        }
    }

    // Teacher collision detection utility backend logic
    // Returns true if teacher is free, false if collision
    static async checkTeacherAvailability(
        yearId: string,
        termId: string,
        timetableId: string,
        periodId: string,
        teacherId: string,
        excludeEntryId?: string // If we are editing an entry, exclude it from check
    ): Promise<{ available: boolean; conflictingClassId?: string }> {
        try {
            const q = query(
                collection(db, getEntriesCollectionPath(yearId, termId, timetableId)),
                where('periodId', '==', periodId),
                where('teacherId', '==', teacherId)
            );
            const snapshot = await getDocs(q);

            // Filter out excluded entry if editing
            const conflicts = snapshot.docs.filter(doc => doc.id !== excludeEntryId);

            if (conflicts.length > 0) {
                return {
                    available: false,
                    conflictingClassId: conflicts[0].data().classId
                };
            }
            return { available: true };
        } catch (error) {
            console.error('Error checking teacher availability:', error);
            throw error;
        }
    }

    static async saveEntriesBatch(
        yearId: string,
        termId: string,
        timetableId: string,
        entries: Partial<TimetableEntry>[]
    ): Promise<void> {
        try {
            const batch = writeBatch(db);
            const entriesRef = collection(db, getEntriesCollectionPath(yearId, termId, timetableId));

            // This is a simplified mass save. In a real scenario, you either update existing 
            // by ID, or clear for a class and write new. 
            // For simplicity here, we assume if `id` exists we update, else set as new.

            entries.forEach(entry => {
                let docRef;
                const entryData = {
                    ...entry,
                    updatedAt: Timestamp.now(),
                };

                if (entry.id) {
                    docRef = doc(entriesRef, entry.id);
                    delete entryData.id;
                    // Clean before sending
                    batch.update(docRef, this.cleanUndefinedValues(entryData));
                } else {
                    docRef = doc(entriesRef);
                    entryData.createdAt = Timestamp.now() as any;
                    batch.set(docRef, this.cleanUndefinedValues(entryData));
                }
            });

            await batch.commit();
        } catch (error) {
            console.error('Error saving timetable entries batch:', error);
            throw error;
        }
    }

    static async deleteEntry(yearId: string, termId: string, timetableId: string, entryId: string): Promise<void> {
        try {
            const docRef = doc(db, getEntriesCollectionPath(yearId, termId, timetableId), entryId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting timetable entry:', error);
            throw error;
        }
    }

    // Utility function to recursively clean undefined values from objects
    private static cleanUndefinedValues(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        // Do not destroy Dates or Firebase Timestamps/FieldValues
        if (obj instanceof Date || (obj && typeof obj === 'object' && typeof obj.toDate === 'function')) {
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
