import { auth } from '@/lib/firebase';

export async function withWorkspaceIdentity<T>(userId: string | undefined, read: () => Promise<T>): Promise<T> {
  // The cached application profile paints before Firebase restores its signed
  // identity. Protected downloads must wait for that restoration, without a
  // forced token refresh or another profile/Firestore read.
  await auth.authStateReady();
  if (!userId || auth.currentUser?.uid !== userId || auth.currentUser.isAnonymous) {
    throw Object.assign(new Error('Waiting for the signed workspace identity.'), { code: 'auth/workspace-identity' });
  }
  return read();
}
