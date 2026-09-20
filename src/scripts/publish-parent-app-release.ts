import dotenv from 'dotenv';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getFirebaseAdminProjectId } from '@/lib/firebase-admin';

dotenv.config({ path: '.env.local' });

const version = process.env.PARENT_APP_RELEASE_VERSION?.trim();
const apply = process.argv.includes('--apply');
const confirmed = process.argv.includes('--confirm-parent-app-release');

async function main() {
  if (!version || version.length > 200) {
    throw new Error('Set PARENT_APP_RELEASE_VERSION to the already-deployed parent interface version.');
  }
  if (apply && !confirmed) {
    throw new Error('--apply requires --confirm-parent-app-release after the hosting deployment has completed.');
  }

  const plan = {
    projectId: getFirebaseAdminProjectId() ?? getFirebaseAdminApp().options.projectId ?? 'unknown',
    document: 'settings/parent-app-release',
    version,
    mode: apply ? 'apply' : 'dry-run',
    effect: 'Prepared parent devices receive one hosting update check and download the new interface shell.',
  };

  if (apply) {
    await getFirestore(getFirebaseAdminApp()).collection('settings').doc('parent-app-release').set({
      schema: 1,
      version,
      releasedAt: Timestamp.now(),
    }, { merge: true });
  }

  console.log(JSON.stringify(plan, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
