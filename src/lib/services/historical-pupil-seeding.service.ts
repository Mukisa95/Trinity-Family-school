import { addDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Pupil,
  PupilAcademicYearHistoryEntry,
  PupilStatus,
  PromotionHistoryEntry,
  StatusChangeHistoryEntry,
} from '@/types';
import { PupilsService } from './pupils.service';

const SEED_COLLECTION = 'historicalPupilSeeds';

export type HistoricalPupilSeedRecord = {
  id: string;
  pupilId: string;
  createdAt: string;
  createdById?: string;
  createdByName?: string;
  academicYearIds: string[];
};

export type HistoricalPupilSeedInput = {
  firstName: string;
  lastName?: string;
  otherNames?: string;
  admissionNumber?: string;
  gender?: Pupil['gender'];
  dateOfBirth?: string;
  registrationDate?: string;
  section?: Pupil['section'];
  previousSchool?: string;
  academicYearHistory: PupilAcademicYearHistoryEntry[];
  createdById?: string;
  createdByName?: string;
};

const dateOnly = (date: string) => date.slice(0, 10);

export class HistoricalPupilSeedingService {
  static async list(): Promise<HistoricalPupilSeedRecord[]> {
    const snapshot = await getDocs(query(collection(db, SEED_COLLECTION), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((snapshotDoc) => ({
      id: snapshotDoc.id,
      ...snapshotDoc.data(),
    })) as HistoricalPupilSeedRecord[];
  }

  static async create(input: HistoricalPupilSeedInput): Promise<string> {
    const academicYearHistory = [...input.academicYearHistory]
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const firstHistoryDate = academicYearHistory[0]?.startDate;
    const effectiveRegistrationDate = input.registrationDate ? dateOnly(input.registrationDate) : undefined;
    const initialDate = effectiveRegistrationDate || firstHistoryDate;

    let currentStatus: PupilStatus = academicYearHistory.length > 0 ? 'Active' : 'Pending';
    const statusChangeHistory: StatusChangeHistoryEntry[] = initialDate && academicYearHistory.length > 0
      ? [{ date: initialDate, fromStatus: 'N/A', toStatus: 'Active', reason: 'Initial enrollment' }]
      : [];
    const promotionHistory: PromotionHistoryEntry[] = [];
    let previousClass: Pick<PupilAcademicYearHistoryEntry, 'classId' | 'className'> | undefined;
    let graduationEntry: PupilAcademicYearHistoryEntry | undefined;

    academicYearHistory.forEach((entry) => {
      if (entry.classId && entry.classId !== previousClass?.classId) {
        promotionHistory.push({
          date: entry.startDate,
          fromClassId: previousClass?.classId ?? null,
          fromClassName: previousClass?.className,
          toClassId: entry.classId,
          toClassName: entry.className,
          type: previousClass ? 'Promotion' : 'Initial Placement',
          academicYearId: entry.academicYearId,
          processedBy: input.createdByName,
        });
        previousClass = entry;
      }

      if (entry.status && entry.status !== currentStatus) {
        const statusEffectiveDate = entry.statusEffectiveDate || (
          entry.status === 'Graduated' ? entry.endDate : entry.startDate
        );
        statusChangeHistory.push({
          date: statusEffectiveDate,
          fromStatus: currentStatus,
          toStatus: entry.status,
          reason: entry.notes || undefined,
          processedBy: input.createdByName,
        });
        currentStatus = entry.status;
        if (entry.status === 'Graduated') graduationEntry = entry;
      }
    });

    const lastClass = [...academicYearHistory].reverse().find((entry) => entry.classId);
    if (graduationEntry?.classId) {
      promotionHistory.push({
        date: graduationEntry.statusEffectiveDate || graduationEntry.endDate,
        fromClassId: graduationEntry.classId,
        fromClassName: graduationEntry.className,
        toClassId: graduationEntry.classId,
        toClassName: graduationEntry.className,
        type: 'Graduation',
        academicYearId: graduationEntry.academicYearId,
        graduationYear: Number(graduationEntry.academicYearName),
        processedBy: input.createdByName,
      });
    }

    const pupilData: Omit<Pupil, 'id' | 'createdAt'> = {
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || '',
      admissionNumber: input.admissionNumber?.trim() || '',
      gender: input.gender || '',
      classId: lastClass?.classId || '',
      className: lastClass?.className || '',
      classCode: lastClass?.classCode || '',
      section: input.section || '',
      status: currentStatus,
      guardians: [],
      registrationDate: effectiveRegistrationDate,
      promotionHistory,
      statusChangeHistory,
      academicYearHistory,
      ...(input.otherNames?.trim() && { otherNames: input.otherNames.trim() }),
      ...(input.dateOfBirth && { dateOfBirth: dateOnly(input.dateOfBirth) }),
      ...(input.previousSchool?.trim() && { previousSchool: input.previousSchool.trim() }),
      ...(graduationEntry && {
        graduationDate: graduationEntry.statusEffectiveDate || graduationEntry.endDate,
        graduationYear: Number(graduationEntry.academicYearName),
        graduationClassId: graduationEntry.classId,
        graduationClassName: graduationEntry.className,
        graduationAcademicYearId: graduationEntry.academicYearId,
      }),
    };

    const pupilId = await PupilsService.createPupil(pupilData, { autoAssignHouse: false });

    try {
      await addDoc(collection(db, SEED_COLLECTION), {
        pupilId,
        createdAt: new Date().toISOString(),
        createdById: input.createdById || null,
        createdByName: input.createdByName || null,
        academicYearIds: academicYearHistory.map((entry) => entry.academicYearId),
      });
    } catch (error) {
      await PupilsService.deletePupil(pupilId);
      throw error;
    }

    return pupilId;
  }
}
