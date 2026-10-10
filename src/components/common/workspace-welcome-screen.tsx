'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Fingerprint, Monitor, Moon, Palette, ShieldCheck, Sun } from 'lucide-react';
import { useAppearance } from '@/components/providers/theme-provider';
import { PasskeySettings } from '@/components/settings/passkey-settings';
import { Button } from '@/components/ui/button';
import { PasskeyService } from '@/lib/services/passkey.service';
import { THEME_PRESETS } from '@/lib/theme/appearance-settings';
import { hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { readWelcomeDraft, welcomeDraftKey, type PrivacyChoices } from '@/lib/startup/welcome-preferences';
import type { useFirstWorkspaceSetup } from '@/lib/hooks/use-first-workspace-setup';

const steps = ['Appearance', 'Device unlock', 'Privacy', 'Ready to go'];
const lockOptions = [
  { id: 'lock-on-close', name: 'When I close the app', detail: 'Ask me to unlock when I return.' },
  { id: 'lock-on-leave', name: 'When I leave the app', detail: 'Lock when I switch away or hide the app.' },
  { id: 'signout', name: 'Sign out when I close', detail: 'End my session and require a new sign-in.' },
] as const;
const tips = ['Your school records are downloading while you make these choices.', 'Large collections or a slower connection can make this first setup take longer.', 'You can change these preferences later in Settings.'];
const choice = 'min-h-12 rounded-xl border p-3 text-left text-sm transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const selected = 'border-primary bg-primary/10 text-foreground';
const normal = 'border-border bg-card text-card-foreground hover:bg-accent';

export function WorkspaceWelcomeScreen({ setup, userId, privacy, applyPrivacy }: {
  setup: ReturnType<typeof useFirstWorkspaceSetup>; userId: string;
  privacy: PrivacyChoices; applyPrivacy: (choices: PrivacyChoices) => void;
}) {
  const appearance = useAppearance();
  const [draft, setDraft] = useState(() => {
    try { return readWelcomeDraft(localStorage.getItem(welcomeDraftKey(setup.scope)), privacy); }
    catch { return readWelcomeDraft(null, privacy); }
  });
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [supported, setSupported] = useState(false);
  const [finished, setFinished] = useState(false);
  const [tip, setTip] = useState(0);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    heading.current?.focus();
    const interval = setInterval(() => setTip(value => (value + 1) % tips.length), 6500);
    let active = true;
    void PasskeyService.supported().then(value => { if (active) setSupported(value); }).catch(() => {});
    return () => { active = false; clearInterval(interval); previous?.focus(); };
  }, []);
  useEffect(() => {
    try {
      if (setup.fading) localStorage.removeItem(welcomeDraftKey(setup.scope));
      else localStorage.setItem(welcomeDraftKey(setup.scope), JSON.stringify(draft));
    }
    catch { setStorageAvailable(false); }
  }, [draft, setup.fading, setup.scope]);
  useEffect(() => {
    heading.current?.focus();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const animation = stage.current?.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      return () => animation?.cancel();
    }
  }, [draft.step]);
  const canUnlock = supported && (registered || PasskeyService.hasLocalUnlock(userId));
  const themeBusy = !appearance.ready || appearance.changing;
  const setPrivacy = (patch: Partial<PrivacyChoices>) => setDraft(value => ({ ...value, privacy: { ...value.privacy, ...patch } }));
  const advance = (step: number) => setDraft(value => ({ ...value, step }));
  const finish = () => {
    if (!setup.ready || busy || themeBusy || finished) return;
    // Apply security preferences only after the OS enrollment prompt and
    // initial downloads have finished, never while the user is switching apps.
    applyPrivacy({ ...draft.privacy, deviceUnlock: draft.privacy.action !== 'signout' && draft.privacy.deviceUnlock });
    setFinished(true);
    setup.finishPersonalization();
  };
  const message = setup.ready ? 'Your data is ready. Take your time choosing your settings.' : !setup.online ? 'Waiting for your connection. You can still personalise your workspace.' : setup.failed ? 'Some records need another download attempt.' : tips[tip];

  return <div ref={root} role="dialog" aria-modal="true" aria-labelledby="workspace-welcome-title"
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const items = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]') || []).filter(item => item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); heading.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    className={`fixed inset-0 z-[110] overflow-y-auto bg-background text-foreground transition-opacity duration-300 motion-reduce:transition-none print:hidden ${setup.fading ? 'opacity-0 pointer-events-none' : ''}`}>
    <div className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col justify-center gap-5 px-4 py-6 sm:p-8">
      <header className="flex items-center gap-3"><img src="/logo.png" alt="Trinity Family School" className="h-11 w-11 object-contain" /><div><p className="text-sm font-semibold">Trinity Family School</p><p className="text-xs text-muted-foreground">A workspace that feels like yours</p></div></header>
      <div className="sticky top-0 z-10 rounded-xl border border-border bg-card p-3 md:hidden"><div className="flex justify-between text-xs"><span>{setup.ready ? 'Workspace data ready' : 'Downloading your workspace'}</span><strong>{setup.percent}%</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${setup.percent}%` }} /></div></div>
      <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-lg md:grid-cols-[1fr_17rem]">
        <section className="min-w-0 p-5 sm:p-8">
          <ol aria-label="Setup steps" className="mb-7 flex justify-between gap-2">{steps.map((label, index) => <li key={label} aria-current={draft.step === index ? 'step' : undefined} className="flex flex-col items-center gap-2 text-center text-[10px] sm:text-xs"><span className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${draft.step === index ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{index < draft.step ? <Check className="h-4 w-4" /> : index + 1}</span><span className={draft.step === index ? 'font-semibold' : 'text-muted-foreground'}>{label}</span></li>)}</ol>
          <div ref={stage}>
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{draft.step === 0 ? <Palette /> : draft.step === 1 ? <Fingerprint /> : draft.step === 2 ? <ShieldCheck /> : <Check />}</div>
            <h1 ref={heading} tabIndex={-1} id="workspace-welcome-title" className="text-2xl font-semibold tracking-tight outline-none">{['Make Trinity yours', 'A simpler way to unlock', 'Choose your privacy', 'Your workspace, your way'][draft.step]}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{['Choose a look you love. Preview your choices as your data downloads.', 'Optional: use your fingerprint, face or device PIN. Your password remains available.', 'Choose how the app protects your session when you step away.', 'Review your choices. We’ll open your workspace when its initial data is ready.'][draft.step]}</p>
            {draft.step === 0 && <div className="mt-6 space-y-5">
              <fieldset><legend className="mb-2 text-sm font-semibold">Appearance</legend><div className="grid grid-cols-3 gap-2">{([{ id: 'system', name: 'Device', icon: Monitor }, { id: 'light', name: 'Light', icon: Sun }, { id: 'dark', name: 'Dark', icon: Moon }] as const).map(mode => <button key={mode.id} aria-pressed={appearance.preference === mode.id} disabled={themeBusy} onClick={event => void appearance.changeTheme(mode.id, event.currentTarget)} className={`${choice} ${appearance.preference === mode.id ? selected : normal}`}><mode.icon className="mb-2 h-4 w-4" />{mode.name}</button>)}</div><p className="mt-2 text-xs text-muted-foreground">Device follows your system’s light or dark setting automatically.</p></fieldset>
              <fieldset><legend className="mb-2 text-sm font-semibold">Colour theme</legend><div className="grid gap-2 sm:grid-cols-2">{THEME_PRESETS.map(preset => <button key={preset.id} aria-pressed={!appearance.lookAndFeel.deviceColors && appearance.lookAndFeel.preset === preset.id} disabled={themeBusy} onClick={event => void appearance.changeLookAndFeel({ preset: preset.id, deviceColors: false }, event.currentTarget)} className={`${choice} ${!appearance.lookAndFeel.deviceColors && appearance.lookAndFeel.preset === preset.id ? selected : normal}`}><span className="font-semibold">{preset.name}</span><span className="mt-1 block text-xs text-muted-foreground">{preset.description}</span></button>)}{hasAndroidOfflineBridge() && <button disabled={themeBusy || !appearance.deviceColorsSupported} aria-pressed={appearance.lookAndFeel.deviceColors} onClick={event => void appearance.changeLookAndFeel({ deviceColors: true }, event.currentTarget)} className={`${choice} ${appearance.lookAndFeel.deviceColors ? selected : normal}`}>Material You<span className="mt-1 block text-xs text-muted-foreground">Colours from your Android device.</span></button>}</div></fieldset>
              <fieldset><legend className="mb-2 text-sm font-semibold">Workspace background</legend><div className="grid grid-cols-2 gap-2">{(['illustration', 'plain'] as const).map(background => <button key={background} disabled={themeBusy} aria-pressed={appearance.lookAndFeel.background === background} onClick={event => void appearance.changeLookAndFeel({ background }, event.currentTarget)} className={`${choice} ${appearance.lookAndFeel.background === background ? selected : normal}`}>{background === 'illustration' ? 'School illustration' : 'Simple & calm'}</button>)}</div></fieldset>
              {(!appearance.storageAvailable || !storageAvailable) && <p role="status" className="text-xs text-muted-foreground">Preferences work for this visit, but this browser cannot save them for next time.</p>}
            </div>}
            {draft.step === 1 && <div className="mt-6"><PasskeySettings setupMode onBusyChange={setBusy} onRegistered={() => setRegistered(true)} /><p className="mt-3 text-xs text-muted-foreground">Your device handles biometric verification. Trinity does not receive your fingerprint or face data. You can skip this and set it up later.</p></div>}
            {draft.step === 2 && <div className="mt-6 space-y-4"><fieldset><legend className="mb-2 text-sm font-semibold">Automatic lock</legend><div className="grid grid-cols-2 gap-2">{[false, true].map(enabled => <button key={String(enabled)} aria-pressed={draft.privacy.enabled === enabled} onClick={() => setPrivacy({ enabled })} className={`${choice} ${draft.privacy.enabled === enabled ? selected : normal}`}>{enabled ? 'Turn on' : 'Keep off'}</button>)}</div></fieldset>{draft.privacy.enabled && <><fieldset><legend className="mb-2 text-sm font-semibold">When should we protect your session?</legend><div className="space-y-2">{lockOptions.map(option => <button key={option.id} aria-pressed={draft.privacy.action === option.id} onClick={() => setPrivacy({ action: option.id, deviceUnlock: option.id === 'signout' ? false : draft.privacy.deviceUnlock })} className={`${choice} w-full ${draft.privacy.action === option.id ? selected : normal}`}><span className="font-medium">{option.name}</span><span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span></button>)}</div></fieldset>{draft.privacy.action !== 'signout' && <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={draft.privacy.deviceUnlock} disabled={!canUnlock && !draft.privacy.deviceUnlock} onChange={event => setPrivacy({ deviceUnlock: event.target.checked })} /><span>Require device unlock after auto-lock<span className="mt-1 block text-xs text-muted-foreground">{canUnlock ? 'Verify with your fingerprint, face or device PIN before unlocking.' : 'Set up device unlock first to enable this option. Existing saved choices are kept.'}</span></span></label>}</>}<p className="text-xs text-muted-foreground">These choices take effect when you finish setup.</p></div>}
            {draft.step === 3 && <dl className="mt-6 divide-y divide-border rounded-2xl border border-border px-4 text-sm">{[
              ['Appearance', appearance.preference === 'system' ? 'Follow device' : appearance.preference === 'dark' ? 'Dark' : 'Light'],
              ['Colour theme', appearance.lookAndFeel.deviceColors ? 'Material You' : THEME_PRESETS.find(p => p.id === appearance.lookAndFeel.preset)?.name || 'Trinity Classic'],
              ['Background', appearance.lookAndFeel.background === 'plain' ? 'Simple & calm' : 'School illustration'],
              ['Device unlock', registered ? 'Enabled on this device' : 'Manage anytime in Settings'],
              ['Automatic lock', draft.privacy.enabled ? lockOptions.find(o => o.id === draft.privacy.action)?.name || '' : 'Off'],
              ...(draft.privacy.enabled && draft.privacy.action !== 'signout' ? [['Require device unlock', draft.privacy.deviceUnlock ? 'On' : 'Off']] : []),
            ].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>}
          </div>
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-border pt-5"><Button variant="ghost" disabled={busy || finished || draft.step === 0} onClick={() => advance(draft.step - 1)}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>{draft.step < 3 ? <Button disabled={busy || themeBusy} onClick={() => advance(draft.step + 1)}>{draft.step === 1 && !registered ? 'Skip for now' : 'Continue'}<ArrowRight className="ml-1 h-4 w-4" /></Button> : <Button disabled={!setup.ready || busy || themeBusy || finished} onClick={finish}>{finished ? 'Opening…' : setup.ready ? 'Open my workspace' : 'Waiting for data…'}</Button>}</div>
          {draft.step < 3 && <button disabled={busy || themeBusy} className="mt-3 min-h-10 w-full text-xs text-muted-foreground underline underline-offset-4 disabled:opacity-50" onClick={() => setDraft({ step: 3, privacy })}>Use current settings and skip personalisation</button>}
        </section>
        <aside aria-label="Download progress" className="min-w-0 border-t border-border bg-muted/40 p-5 md:border-l md:border-t-0 sm:p-6">
          <p className="text-sm font-semibold">Preparing your workspace</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">This one-time setup downloads the initial records available to your account on this device.</p>
          <div className="mt-5 flex justify-between text-xs"><span>{setup.completed} of {setup.total} tasks ready</span><strong>{setup.percent}%</strong></div>
          <div role="progressbar" aria-label="Workspace setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={setup.percent} className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${setup.percent}%` }} /></div>
          <p role="status" aria-live="polite" className="mt-4 text-xs leading-relaxed text-muted-foreground">{finished && setup.ready ? 'Finishing setup and opening your workspace…' : message}</p>
          <details className="mt-4"><summary className="min-h-10 cursor-pointer text-xs font-medium">What’s downloading?</summary><ul className="space-y-2 pt-2">{setup.tasks.map(task => <li key={task.id} className="flex gap-2 text-xs text-muted-foreground"><span aria-hidden="true">{task.state === 'ready' ? '✓' : task.state === 'error' ? '!' : '·'}</span>{task.label}<span className="sr-only">: {task.state}</span></li>)}</ul></details>
          {(setup.failed || !setup.online || setup.slow && !setup.ready) && <div className="mt-4 border-t border-border pt-4"><p className="mb-3 text-xs text-muted-foreground">{!setup.online ? 'Reconnect to continue downloading.' : 'Still downloading. Retry if the connection has recovered.'} Your saved choices will be kept.</p><Button variant="outline" disabled={!setup.online || busy} onClick={setup.retry}>Retry setup</Button></div>}
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Next time, you’ll use the normal quick startup. Clearing app data or changing accounts may require setup again.</p>
        </aside>
      </div>
    </div>
  </div>;
}
