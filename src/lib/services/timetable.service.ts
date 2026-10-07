import {
    collection,
    doc,
    getDocs,
    getDoc,
    getDocFromServer,
    addDoc,
    query,
    orderBy,
    where,
    Timestamp,
    writeBatch,
    deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { TimetableProfile, GeneratedPeriod, TimetableEntry, ClassStream } from '@/types';
import { bumpTimetableRevisionInBatch } from './dashboard-cache-revisions.service';

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

    static async getTimetableById(
        yearId: string,
        termId: string,
        timetableId: string,
        source: 'default' | 'server' = 'default',
    ): Promise<TimetableProfile | null> {
        try {
            const docRef = doc(db, getTimetablesCollectionPath(yearId, termId), timetableId);
            const docSnap = source === 'server'
                ? await getDocFromServer(docRef)
                : await getDoc(docRef);

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
            if (generatedPeriods.length > 498) {
                throw new Error('Too many periods were generated for one atomic timetable creation.');
            }
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

            bumpTimetableRevisionInBatch(batch, profileData.academicYearId, profileData.termId);

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
            // Keep period document ids stable by matching the ordered blocks for
            // each day. Lesson entries and per-period stream overrides point at
            // these ids, so deleting and recreating every period would silently
            // orphan an already populated timetable.
            const profileRef = doc(db, getTimetablesCollectionPath(yearId, termId), timetableId);
            const periodsCol = collection(db, getPeriodsCollectionPath(yearId, termId, timetableId));
            const existingPeriods = await getDocs(periodsCol);
            const writeCount = 2 + existingPeriods.size + generatedPeriods.length;
            if (writeCount > 500) {
                throw new Error('This timetable has too many periods for an atomic update.');
            }

            const batch = writeBatch(db);
            batch.update(profileRef, { ...profileData, updatedAt: new Date().toISOString() });

            const existingByDay = new Map<number, typeof existingPeriods.docs>();
            existingPeriods.docs.forEach(periodDoc => {
                const day = Number(periodDoc.data().dayOfWeek);
                existingByDay.set(day, [...(existingByDay.get(day) || []), periodDoc]);
            });
            existingByDay.forEach(dayPeriods => dayPeriods.sort((a, b) => (
                String(a.data().startTime).localeCompare(String(b.data().startTime))
            )));

            const generatedByDay = new Map<number, Omit<GeneratedPeriod, 'id'>[]>();
            generatedPeriods.forEach(period => {
                generatedByDay.set(period.dayOfWeek, [...(generatedByDay.get(period.dayOfWeek) || []), period]);
            });
            generatedByDay.forEach(dayPeriods => dayPeriods.sort((a, b) => a.startTime.localeCompare(b.startTime)));

            const allDays = new Set([...existingByDay.keys(), ...generatedByDay.keys()]);
            for (const day of allDays) {
                const oldPeriods = existingByDay.get(day) || [];
                const newPeriods = generatedByDay.get(day) || [];
                const sharedLength = Math.min(oldPeriods.length, newPeriods.length);
                for (let index = 0; index < sharedLength; index++) {
                    const periodRef = oldPeriods[index].ref;
                    batch.set(periodRef, this.cleanUndefinedValues({
                        ...newPeriods[index],
                        id: periodRef.id,
                        updatedAt: Timestamp.now(),
                    }), { merge: true });
                }
                for (let index = sharedLength; index < oldPeriods.length; index++) {
                    batch.delete(oldPeriods[index].ref);
                }
                for (let index = sharedLength; index < newPeriods.length; index++) {
                    const newRef = doc(periodsCol);
                    batch.set(newRef, this.cleanUndefinedValues({
                        ...newPeriods[index],
                        id: newRef.id,
                        createdAt: Timestamp.now(),
                    }));
                }
            }
            bumpTimetableRevisionInBatch(batch, yearId, termId);
            await batch.commit();
        } catch (error) {
            console.error('Error updating timetable:', error);
            throw error;
        }
    }

    static async deleteTimetable(yearId: string, termId: string, timetableId: string): Promise<void> {
        try {
            const docRef = doc(db, getTimetablesCollectionPath(yearId, termId), timetableId);
            const batch = writeBatch(db);
            batch.delete(docRef);
            bumpTimetableRevisionInBatch(batch, yearId, termId);
            await batch.commit();
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
            const batch = writeBatch(db);
            batch.update(docRef, {
                name: newName,
                updatedAt: Timestamp.now()
            });
            bumpTimetableRevisionInBatch(batch, yearId, termId);
            await batch.commit();
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

        // Read every source document before creating the destination batch.
        const srcEntries = includeEntries
            ? await TimetableService.getEntries(srcYearId, srcTermId, srcTimetableId)
            : [];
        const cloneWriteCount = 2 + srcPeriods.length + srcEntries.length;
        if (cloneWriteCount > 500) {
            throw new Error('This timetable is too large to clone atomically.');
        }

        // 3. Build the new profile, periods, entries, and revision in one batch.
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
        const cloneBatch = writeBatch(db);
        const newTimetableId = newProfileRef.id;

        // 4. Clone periods, building old->new id map
        const periodsCol = collection(db, getPeriodsCollectionPath(dstYearId, dstTermId, newTimetableId));
        const periodIdMap: Record<string, string> = {};
        for (const period of srcPeriods) {
            const newRef = doc(periodsCol);
            periodIdMap[period.id] = newRef.id;
            cloneBatch.set(newRef, {
                ...period,
                id: newRef.id,
                timetableId: newTimetableId,
                createdAt: new Date().toISOString(),
            });
        }

        const remappedStreamLayouts = srcProfile.streamLayouts
            ? Object.fromEntries(Object.entries(srcProfile.streamLayouts).map(([classId, layout]) => [
                classId,
                {
                    ...layout,
                    periodModes: Object.fromEntries(
                        Object.entries(layout.periodModes || {}).flatMap(([oldPeriodId, mode]) => {
                            const newPeriodId = periodIdMap[oldPeriodId];
                            return newPeriodId ? [[newPeriodId, mode]] : [];
                        })
                    ),
                },
            ]))
            : undefined;
        cloneBatch.set(newProfileRef, this.cleanUndefinedValues({
            ...newProfileData,
            streamLayouts: remappedStreamLayouts,
            id: newProfileRef.id,
            createdAt: new Date().toISOString(),
        }));

        // 5. Optionally clone entries, remapping periodIds
        if (includeEntries) {
            const entriesCol = collection(db, getEntriesCollectionPath(dstYearId, dstTermId, newTimetableId));
            for (const entry of srcEntries) {
                const newPeriodId = periodIdMap[entry.periodId];
                if (!newPeriodId) continue; // skip if period not found
                const newRef = doc(entriesCol);
                cloneBatch.set(newRef, {
                    ...entry,
                    id: newRef.id,
                    periodId: newPeriodId,
                    createdAt: new Date().toISOString(),
                });
            }
        }
        bumpTimetableRevisionInBatch(cloneBatch, dstYearId, dstTermId);
        await cloneBatch.commit();

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
            if (periods.length > 499) {
                throw new Error('A maximum of 499 periods can be saved atomically.');
            }
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

            bumpTimetableRevisionInBatch(batch, yearId, termId);
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
            if (entries.length > 499) {
                throw new Error('A maximum of 499 timetable entries can be saved atomically.');
            }
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
                    const cleanedEntryData = this.cleanUndefinedValues(entryData);
                    const shouldClearAlternatives = entry.entryType === 'activity';
                    if (
                        shouldClearAlternatives
                        || (Object.prototype.hasOwnProperty.call(entry, 'optionalSubjectId') && entry.optionalSubjectId == null)
                    ) {
                        cleanedEntryData.optionalSubjectId = deleteField();
                    }
                    if (
                        shouldClearAlternatives
                        || (Object.prototype.hasOwnProperty.call(entry, 'optionalTeacherId') && entry.optionalTeacherId == null)
                    ) {
                        cleanedEntryData.optionalTeacherId = deleteField();
                    }
                    if (
                        shouldClearAlternatives
                        || (Object.prototype.hasOwnProperty.call(entry, 'coOptionalTeacherId') && entry.coOptionalTeacherId == null)
                    ) {
                        cleanedEntryData.coOptionalTeacherId = deleteField();
                    }
                    batch.update(docRef, cleanedEntryData);
                } else {
                    docRef = doc(entriesRef);
                    entryData.createdAt = Timestamp.now() as any;
                    batch.set(docRef, this.cleanUndefinedValues(entryData));
                }
            });

            bumpTimetableRevisionInBatch(batch, yearId, termId);
            await batch.commit();
        } catch (error) {
            console.error('Error saving timetable entries batch:', error);
            throw error;
        }
    }

    /** Remove every optional/alternative subject assignment from one timetable. */
    static async clearOptionalSubjects(
        yearId: string,
        termId: string,
        timetableId: string,
    ): Promise<number> {
        try {
            const entries = await this.getEntries(yearId, termId, timetableId);
            const entriesWithAlternatives = entries.filter(entry => (
                Object.prototype.hasOwnProperty.call(entry, 'optionalSubjectId')
                || Object.prototype.hasOwnProperty.call(entry, 'optionalTeacherId')
                || Object.prototype.hasOwnProperty.call(entry, 'coOptionalTeacherId')
            ));
            if (entriesWithAlternatives.length === 0) return 0;

            const entriesRef = collection(db, getEntriesCollectionPath(yearId, termId, timetableId));
            const maxUpdatesPerBatch = 499;
            for (let offset = 0; offset < entriesWithAlternatives.length; offset += maxUpdatesPerBatch) {
                const chunk = entriesWithAlternatives.slice(offset, offset + maxUpdatesPerBatch);
                const isFinalChunk = offset + maxUpdatesPerBatch >= entriesWithAlternatives.length;
                const batch = writeBatch(db);
                chunk.forEach(entry => {
                    batch.update(doc(entriesRef, entry.id), {
                        optionalSubjectId: deleteField(),
                        optionalTeacherId: deleteField(),
                        coOptionalTeacherId: deleteField(),
                        updatedAt: Timestamp.now(),
                    });
                });
                if (isFinalChunk) bumpTimetableRevisionInBatch(batch, yearId, termId);
                await batch.commit();
            }

            return entriesWithAlternatives.length;
        } catch (error) {
            console.error('Error clearing optional timetable subjects:', error);
            throw error;
        }
    }

    /**
     * Change one streamed class between consolidated and per-stream lessons.
     * Profile rules and affected entry documents are committed together so the
     * grid can never observe a new layout with the old set of lessons.
     */
    static async setClassStreamMode(
        yearId: string,
        termId: string,
        timetableId: string,
        args: {
            classId: string;
            mode: 'consolidated' | 'separate';
            scope: 'timetable' | 'day' | 'period';
            streams: ClassStream[];
            dayId?: number;
            periodId?: string;
            sourceEntryId?: string;
        }
    ): Promise<void> {
        if (args.streams.length < 2) {
            throw new Error('At least two active streams are required to separate lessons.');
        }
        if (args.scope === 'day' && args.dayId === undefined) throw new Error('A day is required.');
        if (args.scope === 'period' && !args.periodId) throw new Error('A lesson period is required.');

        const [profile, periods, entries] = await Promise.all([
            this.getTimetableById(yearId, termId, timetableId),
            this.getPeriods(yearId, termId, timetableId),
            this.getEntries(yearId, termId, timetableId),
        ]);
        if (!profile) throw new Error('Timetable not found.');

        const targetPeriodIds = new Set(
            periods
                .filter(period => (
                    period.type === 'lesson'
                    && (args.scope !== 'day' || period.dayOfWeek === args.dayId)
                    && (args.scope !== 'period' || period.id === args.periodId)
                ))
                .map(period => period.id)
        );
        const targetEntries = entries.filter(entry => (
            entry.classId === args.classId && targetPeriodIds.has(entry.periodId)
        ));

        const classLayout = profile.streamLayouts?.[args.classId] || { defaultMode: 'consolidated' as const };
        const nextLayout = {
            ...classLayout,
            dayModes: { ...(classLayout.dayModes || {}) },
            periodModes: { ...(classLayout.periodModes || {}) },
        };
        if (args.scope === 'timetable') {
            nextLayout.defaultMode = args.mode;
            nextLayout.dayModes = {};
            nextLayout.periodModes = {};
        } else if (args.scope === 'day') {
            nextLayout.dayModes[String(args.dayId)] = args.mode;
            periods
                .filter(period => period.dayOfWeek === args.dayId)
                .forEach(period => delete nextLayout.periodModes[period.id]);
        } else if (args.periodId) {
            nextLayout.periodModes[args.periodId] = args.mode;
        }

        const replacementEntries: Array<Omit<TimetableEntry, 'id' | 'createdAt'> & { createdAt?: unknown }> = [];
        for (const periodId of targetPeriodIds) {
            const cellEntries = targetEntries.filter(entry => entry.periodId === periodId);
            if (cellEntries.length === 0) continue;

            const toReplacement = (entry: TimetableEntry, stream?: ClassStream) => {
                const { id: _id, createdAt: _createdAt, ...lesson } = entry;
                const base = {
                    ...lesson,
                    classId: args.classId,
                    periodId,
                    createdAt: Timestamp.now(),
                };
                if (!stream) {
                    delete base.streamId;
                    delete base.streamName;
                    delete base.streamCode;
                    return base;
                }
                return {
                    ...base,
                    streamId: stream.id,
                    streamName: stream.name,
                    streamCode: stream.code,
                    ...(base.entryType === 'activity' ? { linkedClassIds: [] } : {}),
                };
            };

            if (args.mode === 'separate') {
                const consolidated = cellEntries.find(entry => !entry.streamId);
                for (const stream of args.streams) {
                    const source = cellEntries.find(entry => entry.streamId === stream.id) || consolidated || cellEntries[0];
                    replacementEntries.push(toReplacement(source, stream));
                }
            } else {
                const selectedSource = args.sourceEntryId
                    ? cellEntries.find(entry => entry.id === args.sourceEntryId)
                    : undefined;
                const source = selectedSource
                    || cellEntries.find(entry => !entry.streamId)
                    || args.streams.map(stream => cellEntries.find(entry => entry.streamId === stream.id)).find(Boolean)
                    || cellEntries[0];
                replacementEntries.push(toReplacement(source));
            }
        }

        const writeCount = 2 + targetEntries.length + replacementEntries.length;
        if (writeCount > 500) {
            throw new Error('This conversion is too large for one safe update. Convert one day at a time.');
        }

        const batch = writeBatch(db);
        const profileRef = doc(db, getTimetablesCollectionPath(yearId, termId), timetableId);
        batch.update(profileRef, this.cleanUndefinedValues({
            streamLayouts: {
                ...(profile.streamLayouts || {}),
                [args.classId]: nextLayout,
            },
            updatedAt: Timestamp.now(),
        }));

        const entriesRef = collection(db, getEntriesCollectionPath(yearId, termId, timetableId));
        targetEntries.forEach(entry => batch.delete(doc(entriesRef, entry.id)));
        replacementEntries.forEach(entry => batch.set(doc(entriesRef), this.cleanUndefinedValues(entry)));
        bumpTimetableRevisionInBatch(batch, yearId, termId);
        await batch.commit();
    }

    static async deleteEntry(yearId: string, termId: string, timetableId: string, entryId: string): Promise<void> {
        try {
            const docRef = doc(db, getEntriesCollectionPath(yearId, termId, timetableId), entryId);
            const batch = writeBatch(db);
            batch.delete(docRef);
            bumpTimetableRevisionInBatch(batch, yearId, termId);
            await batch.commit();
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
