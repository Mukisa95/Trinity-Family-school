import { auth } from '@/lib/firebase';
import { measureWorkspaceStep } from './workspace-timing';

export async function withWorkspaceIdentity<T>(userId: string | undefined, read: () => Promise<T>): Promise<T> {
  // The cached application profile paints before Firebase restores its signed
  // identity. Protected downloads must wait for that restoration, without a
  // forced token refresh or another profile/Firestore read.
  const startedAt = performance.now();
  await auth.authStateReady();
  measureWorkspaceStep('identity-wait', startedAt);
  if (!userId || auth.currentUser?.uid !== userId || auth.currentUser.isAnonymous) {
    throw Object.assign(new Error('Waiting for the signed workspace identity.'), { code: 'auth/workspace-identity' });
  }
  return read();
}
