export type EffectsPreference = 'automatic' | 'full' | 'reduced';
export const EFFECTS_STORAGE_KEY = 'trinity-effects-preference';

export function parseEffectsPreference(value: unknown): EffectsPreference {
  return value === 'full' || value === 'reduced' ? value : 'automatic';
}

export function shouldReduceEffects(preference: EffectsPreference, hints: {
  memoryGB?: number; processors?: number; lowRam?: boolean; struggling?: boolean; reducedMotion?: boolean;
}): boolean {
  // Accessibility preferences apply even when full decorative effects are selected.
  if (hints.reducedMotion) return true;
  if (preference !== 'automatic') return preference === 'reduced';
  return hints.lowRam === true || hints.struggling === true
    || (Number.isFinite(hints.memoryGB) && hints.memoryGB! > 0 && hints.memoryGB! <= 2)
    || (Number.isFinite(hints.processors) && hints.processors! > 0 && hints.processors! <= 2);
}

/** Require repeated distinct slow interactions, beyond startup, before adapting. */
export function createInteractionMonitor(startedAt: number) {
  const slow = new Map<number, number>();
  return (id: number, duration: number, at: number): boolean => {
    if (at - startedAt < 10_000 || id <= 0 || duration < 200) return false;
    for (const [key, time] of slow) if (at - time > 60_000) slow.delete(key);
    if (!slow.has(id)) slow.set(id, at);
    return at - startedAt >= 30_000 && slow.size >= 5;
  };
}
