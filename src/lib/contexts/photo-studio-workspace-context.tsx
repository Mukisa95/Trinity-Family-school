"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Pupil, SchoolSettings } from '@/types';
import { useAuth } from '@/lib/contexts/auth-context';
import { circumferenceKey } from '@/lib/access/circumference';

export interface PhotoStudioLaunch {
  pupils: Pupil[];
  schoolSettings?: SchoolSettings | null;
  schoolBadge?: string;
}
interface StudioSession { owner: string; data: PhotoStudioLaunch; minimized: boolean; title: string }
interface PhotoStudioWorkspace {
  session: StudioSession | null;
  suspended: boolean;
  openStudio: (data: PhotoStudioLaunch) => void;
  syncStudioData: (data: PhotoStudioLaunch) => void;
  minimizeStudio: () => void;
  restoreStudio: () => void;
  closeStudio: () => void;
  setStudioTitle: (title: string) => void;
}
const Context = createContext<PhotoStudioWorkspace | null>(null);

/** Lives above route content so navigating away cannot unmount the design session. */
export function PhotoStudioWorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isLocked, canAccessPage } = useAuth();
  const owner = user ? JSON.stringify([user.id, user.role, user.isActive, circumferenceKey(user), user.modulePermissions, user.granularPermissions]) : '';
  const permitted = !!user && user.isActive !== false && !isLocked && canAccessPage('reports', 'docx');
  const [stored, setStored] = useState<StudioSession | null>(null);
  // Immediately conceal old-session data; discard it on logout, permission or scope changes.
  const session = stored?.owner === owner ? stored : null;
  useEffect(() => { setStored(previous => previous && (previous.owner !== owner || (!isLocked && !permitted)) ? null : previous); }, [owner, permitted, isLocked]);
  const openStudio = useCallback((data: PhotoStudioLaunch) => {
    if (!permitted) return;
    setStored(previous => previous?.owner === owner ? { ...previous, data, minimized: false } : { owner, data, minimized: false, title: 'Custom Photo Studio' });
  }, [owner, permitted]);
  const syncStudioData = useCallback((data: PhotoStudioLaunch) => {
    if (!permitted) return;
    setStored(previous => !previous || previous.owner !== owner ||
      (previous.data.pupils === data.pupils && previous.data.schoolBadge === data.schoolBadge && JSON.stringify(previous.data.schoolSettings) === JSON.stringify(data.schoolSettings))
      ? previous : { ...previous, data });
  }, [owner, permitted]);
  const minimizeStudio = useCallback(() => setStored(previous => previous ? { ...previous, minimized: true } : null), []);
  const restoreStudio = useCallback(() => { if (permitted) setStored(previous => previous ? { ...previous, minimized: false } : null); }, [permitted]);
  const closeStudio = useCallback(() => setStored(null), []);
  const setStudioTitle = useCallback((title: string) => setStored(previous => previous && previous.title !== title ? { ...previous, title } : previous), []);
  const value = useMemo(() => ({ session, suspended: !permitted, openStudio, syncStudioData, minimizeStudio, restoreStudio, closeStudio, setStudioTitle }), [session, permitted, openStudio, syncStudioData, minimizeStudio, restoreStudio, closeStudio, setStudioTitle]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePhotoStudioWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('Photo Studio must be inside PhotoStudioWorkspaceProvider.');
  return value;
}
