import type { SystemUser } from '@/types';
import { circumferenceKey, hasCircumference } from './circumference';

let currentUser: SystemUser | null = null;
let pupils = new Map<string, any>();
export function registerCircumferencePupils(items: any[]) { pupils = new Map(items.map(item => [item.id, item])); }
export function circumferencePupil(id: string) { return pupils.get(id); }
export const getCircumferenceUser = () => currentUser;
export function setCircumferenceUser(user: SystemUser | null): boolean {
  const changed = currentUser?.id !== user?.id || currentUser?.role !== user?.role
    || circumferenceKey(currentUser) !== circumferenceKey(user)
    || JSON.stringify(currentUser?.granularPermissions) !== JSON.stringify(user?.granularPermissions)
    || JSON.stringify(currentUser?.modulePermissions) !== JSON.stringify(user?.modulePermissions);
  currentUser = user;
  if (changed) pupils.clear();
  return changed;
}
export function circumferenceCacheSuffix(userId?: string): string {
  return currentUser?.id === userId && hasCircumference(currentUser) ? `:circumference:${encodeURIComponent(circumferenceKey(currentUser))}` : '';
}
