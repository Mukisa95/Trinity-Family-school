import { doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const SETTINGS_COLLECTION = 'settings';
export const SCHOOL_SETTINGS_DOCUMENT_ID = 'school-settings';
export const SCHOOL_SETTINGS_META_DOCUMENT_ID = 'school-settings-meta';

export const dashboardRevisionDocumentIds = {
  reference: 'data-revisions-reference',
  operational: 'data-revisions-operational',
  timetable: 'data-revisions-timetable',
  examResults: 'data-revisions-exam-results',
} as const;

export type DashboardRevisionDocumentKind = keyof typeof dashboardRevisionDocumentIds;

export function schoolSettingsDocumentRef() {
  return doc(db, SETTINGS_COLLECTION, SCHOOL_SETTINGS_DOCUMENT_ID);
}

export function schoolSettingsMetaDocumentRef() {
  return doc(db, SETTINGS_COLLECTION, SCHOOL_SETTINGS_META_DOCUMENT_ID);
}

export function dashboardRevisionDocumentRef(kind: DashboardRevisionDocumentKind) {
  return doc(db, SETTINGS_COLLECTION, dashboardRevisionDocumentIds[kind]);
}
