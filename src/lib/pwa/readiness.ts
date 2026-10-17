import { readAndroidRoute } from '@/lib/offline/android-route-cache';
import { readBrowserWorkspace } from './offline-store';
import { offlineSections } from './sections';

/** A receipt alone cannot prove the browser still has this build's route assets. */
export async function browserOfflineReadiness(build: string) {
  const workspace = await readBrowserWorkspace();
  if (!workspace) return null;
  const sections = await Promise.all((workspace.sections || offlineSections(workspace.session)).map(async section => ({ ...section,
    saved: section.saved && workspace.shellBuild === build && !!await readAndroidRoute(section.path, build),
  })));
  return { ...workspace, sections };
}
