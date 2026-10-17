import base from '../../../public/manifest.json';
import parent from '../../../public/parent-manifest.json';
import { androidReleaseForProject } from '@/lib/android/download';

/** Origin storage and a stable manifest ID keep the two schools independent. */
export function schoolWebAppManifest(projectId: string, parentPortal = false) {
  const school = androidReleaseForProject(projectId)?.appName || 'Trinity School';
  return { ...(parentPortal ? parent : base), id: parentPortal ? '/parent' : '/',
    name: parentPortal ? `${school} Parent` : school,
    short_name: parentPortal ? `${school} Parent` : school };
}
