import { androidOfflineRequest, hasAndroidOfflineBridge } from './android-bridge';
import { hasBrowserOfflineWorkspace } from '@/lib/pwa/platform';

/** Native capabilities stay native; only the authorized offline workspace is shared. */
export function hasOfflineWorkspace() { return hasAndroidOfflineBridge() || hasBrowserOfflineWorkspace(); }

export async function workspaceOfflineRequest(action: string, data: Record<string, unknown> = {}) {
  if (hasAndroidOfflineBridge()) return androidOfflineRequest(action, data);
  if (!hasBrowserOfflineWorkspace()) throw new Error('Install this website on your Home Screen to prepare offline access.');
  return (await import('@/lib/pwa/offline-store')).browserOfflineRequest(action, data);
}
