'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, RefreshCw, Trash2 } from 'lucide-react';
import { PasskeyService } from '@/lib/services/passkey.service';
import { useAuth } from '@/lib/contexts/auth-context';
import { hasNativeDeviceUnlock, nativeDeviceUnlockAvailable } from '@/lib/android/device-unlock';
import { hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { Switch } from '@/components/ui/switch';
import { SettingsRow, SettingsRows, settingsButtonClass, settingsSwitchClass } from './settings-controls';

type Passkey = Awaited<ReturnType<typeof PasskeyService.list>>[number];

export function PasskeySettings({ setupMode = false, compact = false, onBusyChange, onRegistered }: {
  setupMode?: boolean; compact?: boolean; onBusyChange?: (busy: boolean) => void; onRegistered?: () => void;
}) {
  const { user, setDeviceUnlockForAutoLock } = useAuth();
  const [native, setNative] = useState(false);
  const [android, setAndroid] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [nativeSupported, setNativeSupported] = useState<boolean | null>(null);
  const [nativeEnabled, setNativeEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [listError, setListError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    setNative(hasNativeDeviceUnlock());
    setAndroid(hasAndroidOfflineBridge());
  }, []);
  useEffect(() => {
    if (!native) return;
    void nativeDeviceUnlockAvailable().then(setNativeSupported).catch(() => setNativeSupported(false));
    setNativeEnabled(Boolean(user && PasskeyService.hasNativeUnlock(user.id)));
  }, [native, user]);

  const enableNative = async () => {
    if (!password) { setMessage('Enter your current password first.'); return; }
    setBusy(true); setMessage(null);
    try {
      await PasskeyService.enableNativeUnlock(password);
      setNativeEnabled(true); onRegistered?.();
      setMessage('Device unlock is ready. Enable Require device unlock under Automatic privacy lock to use it when returning to the app, including offline.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not enable device unlock.'); }
    finally { setPassword(''); setBusy(false); }
  };

  const disableNative = () => {
    if (!user) return;
    PasskeyService.disableNativeUnlock(user.id);
    setDeviceUnlockForAutoLock(false); setNativeEnabled(false);
    setMessage('Android privacy unlock disabled for this account.');
  };

  const refreshPasskeys = useCallback(async () => {
    setChecking(true);
    try {
      setPasskeys(await PasskeyService.list());
      setListError(false);
    } catch {
      setListError(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void PasskeyService.supported().then(setSupported).catch(() => setSupported(false));
    void refreshPasskeys();

    const refreshWhenOnline = () => { void refreshPasskeys(); };
    window.addEventListener('online', refreshWhenOnline);
    return () => window.removeEventListener('online', refreshWhenOnline);
  }, [refreshPasskeys]);

  const register = async () => {
    if (!password) { setMessage('Enter your current password first.'); return; }
    setBusy(true);
    setMessage(null);
    try {
      await PasskeyService.register(password);
      setPassword('');
      onRegistered?.();
      setMessage('Device unlock is ready for your next sign-in.');
      try { setPasskeys(await PasskeyService.list()); setListError(false); }
      catch { setListError(true); }
    } catch (error) {
      if (PasskeyService.isPreviouslyRegisteredError(error)) {
        // The authenticator is the source of truth for this condition. Refresh
        // the server list and local credential cache instead of asking the user
        // to register the same fingerprint/face/PIN again.
        try {
          setPasskeys(await PasskeyService.list());
          setListError(false);
          setPassword('');
          onRegistered?.();
          setMessage('This device unlock was already registered and is ready to use.');
        } catch {
          setListError(true);
          setMessage('This device unlock is already registered. Check its status again when the connection is available.');
        }
      } else {
        setPassword('');
        setMessage(error instanceof Error ? error.message : 'Could not enable device unlock.');
      }
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!password) { setMessage('Enter your current password first.'); return; }
    setBusy(true);
    setMessage(null);
    try {
      await PasskeyService.remove(id, password);
      setPasskeys(await PasskeyService.list());
      setPassword('');
      setMessage('Device unlock removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove device unlock.');
    } finally { setBusy(false); }
  };

  if (compact) return <div className="space-y-3">
    {checking && <p role="status" className="text-xs text-muted-foreground">Checking devices…</p>}
    {listError && !checking && <div className="flex items-center justify-between gap-3"><span role="status" className="text-xs text-muted-foreground">Could not check registered devices.</span><button type="button" className={settingsButtonClass} disabled={busy} onClick={() => void refreshPasskeys()}>Retry</button></div>}
    {(native || supported === true) && <SettingsRows>
      <SettingsRow label="Current password" htmlFor="passkey-current-password">
        <input id="passkey-current-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className="h-10 w-32 max-w-full rounded-full border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-44 sm:text-sm" />
      </SettingsRow>
      {native && <SettingsRow label="Android privacy unlock" htmlFor="settings-native-unlock" hint={nativeSupported === false ? 'Set a phone screen lock first.' : !nativeEnabled && !password ? 'Enter your password to enable.' : undefined}>
        <Switch id="settings-native-unlock" className={settingsSwitchClass} checked={nativeEnabled} disabled={busy || nativeSupported !== true || (!nativeEnabled && !password)} onCheckedChange={enabled => { if (enabled) void enableNative(); else disableNative(); }} />
      </SettingsRow>}
      {supported === true && <SettingsRow label="Sign-in passkey"><button type="button" className={settingsButtonClass} disabled={busy || checking || !password} onClick={() => void register()}>{busy ? 'Working…' : 'Add passkey'}</button></SettingsRow>}
      {passkeys.map(key => <SettingsRow key={key.id} label={key.name} hint={key.createdAt ? new Date(key.createdAt).toLocaleDateString() : undefined}>
        {!setupMode && <button type="button" className={settingsButtonClass} aria-label={`Remove ${key.name}`} disabled={busy || !password} onClick={() => void remove(key.id)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>}
      </SettingsRow>)}
    </SettingsRows>}
    {supported === false && !native && <p className="text-xs text-muted-foreground">{android ? 'Update the Android app for device unlock.' : 'Device unlock is unavailable in this browser.'}</p>}
    {message && <p role="status" className="text-xs leading-5 text-muted-foreground">{message}</p>}
  </div>;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3 text-card-foreground">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-brand-alt-surface-100 text-brand-alt-ink-700 flex items-center justify-center shrink-0 dark:bg-brand-alt-surface-950 dark:text-brand-alt-ink-300"><Fingerprint className="w-5 h-5" /></span>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Biometric / device unlock</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">{native ? 'Unlock your saved session with fingerprint, face or screen PIN, even offline. Add a passkey below for account sign-in.' : 'Use your phone or computer’s fingerprint, face unlock, or screen PIN to sign in. Your account password remains available.'}</p>
        </div>
      </div>
      {supported === false && !native && <p className="text-xs text-amber-700 dark:text-amber-300">{android ? 'Update the Android app to enable native device unlock. Your account password remains available.' : 'This browser or device does not offer secure device unlock. You can still sign in with your password.'}</p>}
      {checking && <p className="text-xs text-gray-500 dark:text-slate-400">Checking registered device unlocks…</p>}
      {listError && !checking && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <span>Registered devices could not be checked.</span>
          <button type="button" disabled={busy} onClick={() => void refreshPasskeys()}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 font-semibold hover:bg-amber-100 disabled:opacity-50 dark:hover:bg-amber-950">
            <RefreshCw className="h-3.5 w-3.5" /> Check status
          </button>
        </div>
      )}
      {passkeys.length > 0 && (
        <ul className="space-y-2">
          {passkeys.map(key => <li key={key.id} className="flex items-center justify-between gap-2 text-xs text-gray-700 rounded-lg bg-gray-50 px-3 py-2 dark:text-slate-200 dark:bg-slate-900">
            <span>{key.name}{key.createdAt ? ` · added ${new Date(key.createdAt).toLocaleDateString()}` : ''}</span>
            {!setupMode && <button type="button" disabled={busy} onClick={() => void remove(key.id)} aria-label="Remove device unlock" className="text-red-600 disabled:opacity-50 p-2 dark:text-red-300"><Trash2 className="w-4 h-4" /></button>}
          </li>)}
        </ul>
      )}
      <label className="block text-xs font-medium text-gray-600 dark:text-slate-300" htmlFor="passkey-current-password">Current password</label>
      <input id="passkey-current-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}
        disabled={busy} className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm" placeholder={setupMode ? 'Required only to enable device unlock' : 'Required to add or remove a device'} />
      {native && <div className="space-y-2 rounded-xl border border-border bg-background p-3">
        <h3 className="text-sm font-medium">Android privacy unlock</h3>
        <p className="text-xs text-muted-foreground">{nativeSupported === null ? 'Checking Android device security…' : nativeSupported ? nativeEnabled ? 'Enabled for this account on this phone. Your saved choice is kept when the app updates.' : 'Verify your account password and device once to enable offline privacy unlock.' : 'Set up a screen PIN, fingerprint or face unlock in Android settings first.'}</p>
        <button type="button" disabled={busy || nativeSupported !== true || (!nativeEnabled && !password)} onClick={nativeEnabled ? disableNative : () => void enableNative()}
          className="min-h-11 w-full rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
          {busy ? 'Working…' : nativeEnabled ? 'Disable Android privacy unlock' : 'Enable Android privacy unlock'}
        </button>
      </div>}
      {native && <div className="space-y-1"><h3 className="text-sm font-medium">Passkey sign-in</h3><p className="text-xs text-muted-foreground">{supported === false ? 'Passkey sign-in needs an updated Android System WebView and a compatible credential provider. Android privacy unlock remains available.' : 'Sign in to your school account using a passkey. Your account password remains available.'}</p></div>}
      <button type="button" disabled={busy || checking || supported !== true || !password} onClick={() => void register()}
        className="w-full min-h-11 rounded-lg bg-brand-alt-surface-600 text-white text-sm font-semibold disabled:opacity-50">
        {busy ? 'Working…' : native ? 'Add a sign-in passkey' : 'Enable on this device'}
      </button>
      {message && <p role="status" className="text-xs text-gray-700 dark:text-slate-200">{message}</p>}
    </section>
  );
}
