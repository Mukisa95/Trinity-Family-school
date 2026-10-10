'use client';

import { MotionConfig } from 'framer-motion';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { createInteractionMonitor, EFFECTS_STORAGE_KEY, parseEffectsPreference, shouldReduceEffects, type EffectsPreference } from '@/lib/performance/presentation-policy';

const Context = createContext({ preference: 'automatic' as EffectsPreference, reducedEffects: false, saveData: false, changePreference: (_value: EffectsPreference) => {} });

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<EffectsPreference>('automatic');
  const [hints, setHints] = useState<{ memoryGB?: number; processors?: number; lowRam?: boolean; struggling?: boolean; reducedMotion?: boolean }>({});
  const [saveData, setSaveData] = useState(false);
  const reducedEffects = shouldReduceEffects(preference, hints);

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: EventTarget & { saveData?: boolean } };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const load = () => { try { setPreference(parseEffectsPreference(localStorage.getItem(EFFECTS_STORAGE_KEY))); } catch {} };
    load();
    setHints(previous => ({ ...previous, memoryGB: nav.deviceMemory, processors: nav.hardwareConcurrency, reducedMotion: motion.matches }));
    const motionChanged = () => setHints(previous => ({ ...previous, reducedMotion: motion.matches }));
    const connectionChanged = () => setSaveData(nav.connection?.saveData === true);
    const storageChanged = (event: StorageEvent) => { if (event.key === EFFECTS_STORAGE_KEY || event.key === null) load(); };
    connectionChanged();
    motion.addEventListener('change', motionChanged);
    nav.connection?.addEventListener('change', connectionChanged);
    window.addEventListener('storage', storageChanged);
    let cancelled = false;
    // Older APKs do not implement this action; browser hints still work there.
    if (hasAndroidOfflineBridge()) void androidOfflineRequest('deviceCapabilities').then(reply => {
      if (!cancelled && reply.lowRam === true) setHints(previous => ({ ...previous, lowRam: true }));
    }).catch(() => {});
    return () => { cancelled = true; motion.removeEventListener('change', motionChanged); nav.connection?.removeEventListener('change', connectionChanged); window.removeEventListener('storage', storageChanged); };
  }, []);

  useEffect(() => { document.documentElement.dataset.effects = reducedEffects ? 'reduced' : 'full'; }, [reducedEffects]);

  useEffect(() => {
    if (preference !== 'automatic' || reducedEffects || typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('event')) return;
    const observe = createInteractionMonitor(performance.now());
    const observer = new PerformanceObserver(list => {
      if (document.visibilityState !== 'visible') return;
      for (const entry of list.getEntries()) {
        const timing = entry as PerformanceEntry & { interactionId?: number };
        if (observe(timing.interactionId || 0, timing.duration, timing.startTime)) {
          setHints(previous => ({ ...previous, struggling: true }));
          observer.disconnect();
          break;
        }
      }
    });
    try { observer.observe({ type: 'event', durationThreshold: 200 } as PerformanceObserverInit); } catch { return; }
    return () => observer.disconnect();
  }, [preference, reducedEffects]);

  const value = useMemo(() => ({ preference, reducedEffects, saveData, changePreference: (next: EffectsPreference) => {
    setPreference(next);
    try { localStorage.setItem(EFFECTS_STORAGE_KEY, next); } catch { /* Still usable for this session. */ }
  } }), [preference, reducedEffects, saveData]);
  return <Context.Provider value={value}><MotionConfig reducedMotion={reducedEffects ? "always" : "user"}>{children}</MotionConfig></Context.Provider>;
}

export function usePerformanceMode() { return useContext(Context); }
