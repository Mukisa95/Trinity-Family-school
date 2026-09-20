'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import { onIdTokenChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  isParentAppReleaseVersion,
  readParentAppReleaseVersion,
  shouldRefreshParentAppRelease,
  writeParentAppReleaseVersion,
} from '@/lib/parent-offline/app-release';
import { refreshParentAppShellForReleasedVersion } from '@/lib/parent-offline/app-shell';

const PARENT_APP_RELEASE_DOCUMENT = 'parent-app-release';

/**
 * Listens only to a tiny Firebase release record. The first confirmed version
 * is remembered; later versions are the sole trigger for a parent hosting
 * update check and replacement of the locally saved application shell.
 */
export function useParentAppRelease(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let refreshing = false;
    let unsubscribeRelease: () => void = () => {};
    const unsubscribeAuth = onIdTokenChanged(auth, firebaseUser => {
      unsubscribeRelease();
      if (!firebaseUser || firebaseUser.isAnonymous) return;
      unsubscribeRelease = onSnapshot(
        doc(db, 'settings', PARENT_APP_RELEASE_DOCUMENT),
        { includeMetadataChanges: true },
        snapshot => {
          if (!snapshot.exists() || snapshot.metadata.fromCache) return;
          const releasedVersion = snapshot.data()?.version;
          if (!isParentAppReleaseVersion(releasedVersion) || refreshing) return;

          const previousVersion = readParentAppReleaseVersion();
          if (!previousVersion) {
            writeParentAppReleaseVersion(releasedVersion);
            return;
          }
          if (!shouldRefreshParentAppRelease({
            previousVersion,
            releasedVersion,
            isServerSnapshot: true,
          })) return;

          refreshing = true;
          void refreshParentAppShellForReleasedVersion()
            .then(() => writeParentAppReleaseVersion(releasedVersion))
            .catch(error => console.warn('Could not refresh the released parent interface:', error))
            .finally(() => {
              refreshing = false;
            });
        },
        error => console.warn('Parent interface release listener failed:', error),
      );
    });
    return () => {
      unsubscribeRelease();
      unsubscribeAuth();
    };
  }, [enabled]);
}
