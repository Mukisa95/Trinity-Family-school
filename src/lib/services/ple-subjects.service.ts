import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface PLESubject {
    id: string;
    name: string;
    code: string;
    order: number;
}

// Default PLE subjects in standard order
export const PLE_SUBJECTS_DEFAULT: PLESubject[] = [
    { id: 'english', name: 'English', code: 'ENG', order: 0 },
    { id: 'mathematics', name: 'Mathematics', code: 'MATH', order: 1 },
    { id: 'science', name: 'Science', code: 'SCI', order: 2 },
    { id: 'social_studies', name: 'Social Studies', code: 'SST', order: 3 },
];

export class PLESubjectsService {
    /**
     * Get subjects for a PLE record in the correct order
     * If the record has a custom subjectOrder, use that.
     * Otherwise, use the default order.
     */
    static getSubjectsForRecord(pleRecord?: { subjectOrder?: string[] } | null): PLESubject[] {
        if (!pleRecord || !pleRecord.subjectOrder || pleRecord.subjectOrder.length === 0) {
            return [...PLE_SUBJECTS_DEFAULT];
        }

        // Create a map for quick lookup
        const subjectMap = new Map(PLE_SUBJECTS_DEFAULT.map(s => [s.id, s]));

        // Build ordered array based on subjectOrder
        const orderedSubjects: PLESubject[] = [];

        pleRecord.subjectOrder.forEach((subjectId, index) => {
            const subject = subjectMap.get(subjectId);
            if (subject) {
                orderedSubjects.push({
                    ...subject,
                    order: index
                });
            }
        });

        // Add any missing subjects at the end (in case of data inconsistency)
        PLE_SUBJECTS_DEFAULT.forEach(subject => {
            if (!orderedSubjects.find(s => s.id === subject.id)) {
                orderedSubjects.push({
                    ...subject,
                    order: orderedSubjects.length
                });
            }
        });

        return orderedSubjects;
    }

    /**
     * Update the subject order for a PLE record
     */
    static async updateSubjectOrder(
        pleRecordId: string,
        subjectOrder: string[]
    ): Promise<void> {
        try {
            const recordRef = doc(db, 'pleRecords', pleRecordId);
            await updateDoc(recordRef, {
                subjectOrder
            });
            console.log(`✅ Updated subject order for PLE record ${pleRecordId}`);
        } catch (error) {
            console.error('Error updating subject order:', error);
            throw error;
        }
    }

    /**
     * Get default subject IDs in order
     */
    static getDefaultSubjectIds(): string[] {
        return PLE_SUBJECTS_DEFAULT.map(s => s.id);
    }
}
