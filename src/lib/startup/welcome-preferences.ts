export type LockAction = 'lock-on-close' | 'lock-on-leave' | 'signout';
export type PrivacyChoices = { enabled: boolean; action: LockAction; deviceUnlock: boolean };
export type WelcomeDraft = { step: number; privacy: PrivacyChoices };
export const welcomeDraftKey = (scope: string) => `trinity:welcome:v1:${scope}`;

// Only non-sensitive preferences belong here. Credentials stay in the
// existing platform authenticator and password input, never in this draft.
export function readWelcomeDraft(value: string | null, privacy: PrivacyChoices): WelcomeDraft {
  try {
    const draft = JSON.parse(value || 'null');
    if (!draft || typeof draft !== 'object') return { step: 0, privacy };
    const saved = draft.privacy;
    return {
      step: Number.isInteger(draft.step) ? Math.max(0, Math.min(3, draft.step)) : 0,
      privacy: saved && typeof saved.enabled === 'boolean' && typeof saved.deviceUnlock === 'boolean'
        && ['lock-on-close', 'lock-on-leave', 'signout'].includes(saved.action)
        ? { enabled: saved.enabled, action: saved.action, deviceUnlock: saved.action !== 'signout' && saved.deviceUnlock }
        : privacy,
    };
  } catch { return { step: 0, privacy }; }
}
