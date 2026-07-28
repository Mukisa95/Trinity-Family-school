import dotenv from 'dotenv';
import { FieldPath, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';

dotenv.config({ path: '.env.local' });

// Only collections whose documents represent one pupil are eligible here. A
// parent-facing result must never be granted access to an aggregate examResults
// document, because that document contains several pupils' marks.
const TARGETS = [
  'attendanceRecords',
  'payments',
  'pupilSnapshots',
  'requirement-tracking',
  'uniformTracking',
] as const;

const PAGE_SIZE = 250;
const WRITE_BATCH_SIZE = 400;

type BackfillCounts = {
  collection: string;
  scanned: number;
  alreadyScoped: number;
  candidates: number;
  missingPupilId: number;
  unresolvedPupil: number;
  conflictingFamilyId: number;
  writesPerformed: number;
};

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function main() {
  const apply = hasFlag('--apply');
  const confirmed = hasFlag('--confirm-parent-ownership-backfill');
  if (apply && !confirmed) {
    throw new Error(
      '--apply requires --confirm-parent-ownership-backfill. Run the default dry run and review every count first.',
    );
  }

  const projectId = getFirebaseAdminProjectId();
  if (!projectId) throw new Error('Firebase Admin project is not configured.');

  const db = getFirestore(getFirebaseAdminApp());

  // This is one controlled pupil scan, rather than a per-record lookup. It
  // prevents an N+1 read pattern while providing trusted family ownership for
  // the backfill candidates.
  const pupilsSnapshot = await db.collection('pupils').select('familyId').get();
  const familyIdByPupilId = new Map<string, string>();
  let pupilsMissingFamilyId = 0;
  pupilsSnapshot.forEach(pupil => {
    const familyId = pupil.data().familyId;
    if (nonEmptyString(familyId)) {
      familyIdByPupilId.set(pupil.id, familyId);
    } else {
      pupilsMissingFamilyId += 1;
    }
  });

  const results: BackfillCounts[] = [];

  for (const collectionName of TARGETS) {
    const counts: BackfillCounts = {
      collection: collectionName,
      scanned: 0,
      alreadyScoped: 0,
      candidates: 0,
      missingPupilId: 0,
      unresolvedPupil: 0,
      conflictingFamilyId: 0,
      writesPerformed: 0,
    };
    let lastDocument: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    while (true) {
      let pageQuery = db
        .collection(collectionName)
        .orderBy(FieldPath.documentId())
        .limit(PAGE_SIZE);
      if (lastDocument) pageQuery = pageQuery.startAfter(lastDocument);

      const page = await pageQuery.get();
      if (page.empty) break;
      lastDocument = page.docs[page.docs.length - 1];

      let batch = db.batch();
      let pendingWrites = 0;

      for (const record of page.docs) {
        counts.scanned += 1;
        const data = record.data();
        const pupilId = data.pupilId;
        const existingFamilyId = data.familyId;
        const resolvedFamilyId = nonEmptyString(pupilId)
          ? familyIdByPupilId.get(pupilId)
          : undefined;

        if (nonEmptyString(existingFamilyId)) {
          if (resolvedFamilyId && existingFamilyId !== resolvedFamilyId) {
            counts.conflictingFamilyId += 1;
          } else {
            counts.alreadyScoped += 1;
          }
          continue;
        }

        if (!nonEmptyString(pupilId)) {
          counts.missingPupilId += 1;
          continue;
        }
        if (!resolvedFamilyId) {
          counts.unresolvedPupil += 1;
          continue;
        }

        counts.candidates += 1;
        if (!apply) continue;

        // Existing familyId values are never overwritten. The script only adds
        // this denormalized ownership field to records whose live pupil has a
        // trusted familyId. Run apply mode in a quiet maintenance window and
        // rerun the aggregate coverage audit afterward.
        batch.update(record.ref, {
          familyId: resolvedFamilyId,
          parentOwnershipSchemaVersion: 1,
          parentOwnershipBackfilledAt: Timestamp.now(),
        });
        pendingWrites += 1;

        if (pendingWrites === WRITE_BATCH_SIZE) {
          await batch.commit();
          counts.writesPerformed += pendingWrites;
          batch = db.batch();
          pendingWrites = 0;
        }
      }

      if (pendingWrites > 0) {
        await batch.commit();
        counts.writesPerformed += pendingWrites;
      }
    }

    results.push(counts);
  }

  console.table(results);
  console.log(JSON.stringify({
    projectId,
    mode: apply ? 'apply' : 'dry-run',
    pupilsScanned: pupilsSnapshot.size,
    pupilsMissingFamilyId,
    results,
    excludedCollections: [
      'examResults (shared multi-pupil documents require a separate parent-safe projection)',
      'bankAccounts, bankLoans, bankTransactions (not confirmed parent-owned records)',
    ],
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
