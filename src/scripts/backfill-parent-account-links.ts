import dotenv from 'dotenv';
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';

dotenv.config({ path: '.env.local' });

const PAGE_SIZE = 250;
const WRITE_BATCH_SIZE = 400;

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const hasFlag = (flag: string) => process.argv.includes(flag);

async function main() {
  const apply = hasFlag('--apply');
  if (apply && !hasFlag('--confirm-parent-account-link-backfill')) {
    throw new Error('--apply requires --confirm-parent-account-link-backfill after reviewing the dry run.');
  }
  const projectId = getFirebaseAdminProjectId();
  if (!projectId) throw new Error('Firebase Admin project is not configured.');
  const db = getFirestore(getFirebaseAdminApp());

  const [parentsSnapshot, pupilsSnapshot] = await Promise.all([
    db.collection('system_users').where('role', '==', 'Parent').get(),
    db.collection('pupils').select('familyId', 'parentAccountId', 'parentAccountActive').get(),
  ]);
  const pupilFamilyById = new Map(
    pupilsSnapshot.docs.map(document => [document.id, text(document.data().familyId)]),
  );
  const accountsByFamily = new Map<string, Array<{ id: string; active: boolean }>>();
  const accountsByPupil = new Map<string, Array<{ id: string; active: boolean }>>();

  parentsSnapshot.docs.forEach(document => {
    const data = document.data();
    const account = { id: document.id, active: data.isActive === true };
    const pupilId = text(data.pupilId);
    const familyId = text(data.familyId) || (pupilId ? pupilFamilyById.get(pupilId) || '' : '');
    if (familyId) accountsByFamily.set(familyId, [...(accountsByFamily.get(familyId) || []), account]);
    if (pupilId) accountsByPupil.set(pupilId, [...(accountsByPupil.get(pupilId) || []), account]);
  });

  const counts = {
    pupilsScanned: 0,
    alreadyCurrent: 0,
    candidates: 0,
    activeLinks: 0,
    inactiveOrMissingLinks: 0,
    duplicateFamilyAccounts: 0,
    writesPerformed: 0,
  };
  let lastDocument: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let pageQuery = db.collection('pupils').orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastDocument) pageQuery = pageQuery.startAfter(lastDocument);
    const page = await pageQuery.get();
    if (page.empty) break;
    lastDocument = page.docs[page.docs.length - 1];
    let batch = db.batch();
    let pendingWrites = 0;

    for (const pupil of page.docs) {
      counts.pupilsScanned += 1;
      const data = pupil.data();
      const familyId = text(data.familyId);
      const candidates = familyId
        ? accountsByFamily.get(familyId) || []
        : accountsByPupil.get(pupil.id) || [];
      const uniqueCandidates = [...new Map(candidates.map(account => [account.id, account])).values()];
      if (uniqueCandidates.length > 1) {
        counts.duplicateFamilyAccounts += 1;
        continue;
      }
      const account = uniqueCandidates[0];
      const desiredId = account?.id || null;
      const desiredActive = account?.active === true;
      if (data.parentAccountId === desiredId && data.parentAccountActive === desiredActive) {
        counts.alreadyCurrent += 1;
        continue;
      }
      counts.candidates += 1;
      if (desiredActive) counts.activeLinks += 1;
      else counts.inactiveOrMissingLinks += 1;
      if (!apply) continue;

      batch.update(pupil.ref, {
        parentAccountId: desiredId,
        parentAccountActive: desiredActive,
        parentAccountLinkBackfilledAt: FieldValue.serverTimestamp(),
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

  console.log(JSON.stringify({
    projectId,
    mode: apply ? 'apply' : 'dry-run',
    parentAccountsScanned: parentsSnapshot.size,
    ...counts,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
