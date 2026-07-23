import dotenv from 'dotenv';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';

dotenv.config({ path: '.env.local' });

async function main() {
  const apply = process.argv.includes('--apply');
  const removeLegacy = process.argv.includes('--remove-legacy');
  if (removeLegacy && !apply) throw new Error('--remove-legacy requires --apply.');

  const projectId = getFirebaseAdminProjectId();
  if (!projectId) throw new Error('Firebase Admin project is not configured.');
  const db = getFirestore(getFirebaseAdminApp());
  const users = await db.collection('system_users').get();

  let legacyUsers = 0;
  let credentialsCreated = 0;
  let existingCredentials = 0;
  let hashesRemoved = 0;
  let batch = db.batch();
  let operations = 0;

  const flush = async () => {
    if (!apply || operations === 0) return;
    await batch.commit();
    batch = db.batch();
    operations = 0;
  };

  for (const userDoc of users.docs) {
    const passwordHash = userDoc.data().passwordHash;
    if (typeof passwordHash !== 'string' || !passwordHash) continue;
    legacyUsers += 1;

    const credentialRef = db.collection('authCredentials').doc(userDoc.id);
    const credential = await credentialRef.get();
    if (credential.exists) {
      existingCredentials += 1;
    } else {
      credentialsCreated += 1;
      if (apply) {
        batch.create(credentialRef, {
          passwordHash,
          algorithm: 'legacy-b64-v1',
          migratedAt: Timestamp.now(),
        });
        operations += 1;
      }
    }

    if (removeLegacy) {
      hashesRemoved += 1;
      batch.update(userDoc.ref, {
        passwordHash: FieldValue.delete(),
        credentialMigratedAt: Timestamp.now(),
      });
      operations += 1;
    }

    if (operations >= 400) await flush();
  }
  await flush();

  console.log(JSON.stringify({
    projectId,
    mode: apply ? (removeLegacy ? 'apply-and-remove-legacy' : 'copy-only') : 'dry-run',
    totalUsers: users.size,
    legacyUsers,
    credentialsCreated,
    existingCredentials,
    hashesRemoved,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
