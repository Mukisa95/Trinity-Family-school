import type { SystemUser } from '@/types';
import { circumferenceKey, hasCircumference } from './circumference';
import { sessionAccessKey } from './session-profile';

let currentUser: SystemUser | null = null;
let pupils = new Map<string, any>();
export function registerCircumferencePupils(items: any[]) { pupils = new Map(items.map(item => [item.id, item])); }
export function circumferencePupil(id: string) { return pupils.get(id); }
export const getCircumferenceUser = () => currentUser;
export function setCircumferenceUser(user: SystemUser | null): boolean {
  const changed = sessionAccessKey(currentUser) !== sessionAccessKey(user);
  currentUser = user;
  if (changed) pupils.clear();
  return changed;
}
export function circumferenceCacheSuffix(userId?: string): string {
  return currentUser?.id === userId && hasCircumference(currentUser) ? `:circumference:${encodeURIComponent(circumferenceKey(currentUser))}` : '';
}
