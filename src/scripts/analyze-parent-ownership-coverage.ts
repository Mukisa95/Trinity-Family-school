import dotenv from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';

dotenv.config({ path: '.env.local' });

// These records are displayed in parent-facing modules and will eventually need
// a rule-checkable familyId. The script deliberately uses aggregate counts only:
// it does not download documents, modify data, or infer ownership from a pupil.
const PARENT_OWNED_COLLECTIONS = [
  'attendanceRecords',
  'payments',
  'bankAccounts',
  'bankLoans',
  'bankTransactions',
  'examResults',
  'pupilSnapshots',
  'requirement-tracking',
  'uniformTracking',
] as const;

async function getCount(query: { count: () => { get: () => Promise<{ data: () => { count: number } }> } }) {
  return (await query.count().get()).data().count;
}

async function main() {
  const projectId = getFirebaseAdminProjectId();
  if (!projectId) throw new Error('Firebase Admin project is not configured.');

  const db = getFirestore(getFirebaseAdminApp());
  const coverage = [];

  for (const collectionName of PARENT_OWNED_COLLECTIONS) {
    const collection = db.collection(collectionName);
    const [total, withStringFamilyId] = await Promise.all([
      getCount(collection),
      // `orderBy` excludes documents where the field does not exist. Starting
      // at an empty string also excludes null/non-string values, which are not
      // safe ownership values for a future parent rule.
      getCount(collection.orderBy('familyId').startAt('')),
    ]);
    coverage.push({
      collection: collectionName,
      total,
      withStringFamilyId,
      missingOrInvalidFamilyId: total - withStringFamilyId,
    });
  }

  console.table(coverage);
  console.log(JSON.stringify({
    projectId,
    mode: 'aggregate-counts-only',
    coverage,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
