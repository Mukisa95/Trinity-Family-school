/**
 * Seeds the split revision documents from settings/school-settings.
 *
 * Default mode is a read-only report. Run with --apply only after reviewing
 * the output. It never removes legacy dataRevisions from the profile document.
 */
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';

type LegacyRevisions = {
  classes?: number;
  academicYears?: number;
  staff?: number;
  subjects?: number;
  houses?: number;
  accessLevels?: number;
  exams?: number;
  pupils?: number;
  attendance?: number;
  events?: number;
  timetable?: Record<string, number>;
  examResults?: Record<string, number>;
};

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => [key, numberOrZero(entry)]));
}

async function main() {
  const apply = process.argv.includes('--apply');
  const store = getFirestore(getFirebaseAdminApp());
  const settingsRef = store.collection('settings').doc('school-settings');
  const snapshot = await settingsRef.get();
  if (!snapshot.exists) throw new Error('settings/school-settings does not exist.');

  const legacy = (snapshot.data()?.dataRevisions || {}) as LegacyRevisions;
  const plan = {
    projectId: getFirebaseAdminProjectId() ?? getFirebaseAdminApp().options.projectId ?? 'unknown',
    mode: apply ? 'apply' : 'dry-run',
    source: 'settings/school-settings.dataRevisions',
    targetDocuments: {
      'settings/school-settings-meta': { revision: 1, schema: 1 },
      'settings/data-revisions-reference': {
        schema: 1,
        legacyCompatibility: true,
        classes: numberOrZero(legacy.classes),
        academicYears: numberOrZero(legacy.academicYears),
        staff: numberOrZero(legacy.staff),
        subjects: numberOrZero(legacy.subjects),
        houses: numberOrZero(legacy.houses),
        accessLevels: numberOrZero(legacy.accessLevels),
        exams: numberOrZero(legacy.exams),
      },
      'settings/data-revisions-operational': {
        schema: 1,
        pupils: numberOrZero(legacy.pupils),
        attendance: numberOrZero(legacy.attendance),
        events: numberOrZero(legacy.events),
      },
      'settings/data-revisions-timetable': {
        schema: 1,
        timetable: numberMap(legacy.timetable),
      },
      'settings/data-revisions-exam-results': {
        schema: 1,
        examResults: numberMap(legacy.examResults),
      },
    },
  };

  if (apply) {
    const now = Timestamp.now();
    const batch = store.batch();
    Object.entries(plan.targetDocuments).forEach(([path, data]) => {
      const [collection, document] = path.split('/');
      batch.set(store.collection(collection).doc(document), { ...data, migratedAt: now }, { merge: true });
    });
    await batch.commit();
  }

  console.log(JSON.stringify(plan, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
