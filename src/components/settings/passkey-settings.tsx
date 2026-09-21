'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, RefreshCw, Trash2 } from 'lucide-react';
import { PasskeyService } from '@/lib/services/passkey.service';

type Passkey = Awaited<ReturnType<typeof PasskeyService.list>>[number];

export function PasskeySettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [listError, setListError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      setPasskeys(await PasskeyService.list());
      setListError(false);
      setPassword('');
      setMessage('Device unlock is ready for your next sign-in.');
    } catch (error) {
      if (PasskeyService.isPreviouslyRegisteredError(error)) {
        // The authenticator is the source of truth for this condition. Refresh
        // the server list and local credential cache instead of asking the user
        // to register the same fingerprint/face/PIN again.
        try {
          setPasskeys(await PasskeyService.list());
          setListError(false);
          setPassword('');
          setMessage('This device unlock was already registered and is ready to use.');
        } catch {
          setListError(true);
          setMessage('This device unlock is already registered. Check its status again when the connection is available.');
        }
      } else {
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

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><Fingerprint className="w-5 h-5" /></span>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Biometric / device unlock</h2>
          <p className="text-xs text-gray-500">Use your phone or computer’s fingerprint, face unlock, or screen PIN to sign in. Your account password remains available.</p>
        </div>
      </div>
      {supported === false && <p className="text-xs text-amber-700">This browser or device does not offer secure device unlock. You can still sign in with your password.</p>}
      {checking && <p className="text-xs text-gray-500">Checking registered device unlocks…</p>}
      {listError && !checking && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>Registered devices could not be checked.</span>
          <button type="button" disabled={busy} onClick={() => void refreshPasskeys()}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 font-semibold hover:bg-amber-100 disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Check status
          </button>
        </div>
      )}
      {passkeys.length > 0 && (
        <ul className="space-y-2">
          {passkeys.map(key => <li key={key.id} className="flex items-center justify-between gap-2 text-xs text-gray-700 rounded-lg bg-gray-50 px-3 py-2">
            <span>{key.name}{key.createdAt ? ` · added ${new Date(key.createdAt).toLocaleDateString()}` : ''}</span>
            <button type="button" disabled={busy} onClick={() => void remove(key.id)} aria-label="Remove device unlock" className="text-red-600 disabled:opacity-50 p-2"><Trash2 className="w-4 h-4" /></button>
          </li>)}
        </ul>
      )}
      <label className="block text-xs font-medium text-gray-600" htmlFor="passkey-current-password">Current password</label>
      <input id="passkey-current-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="Required to add or remove a device" />
      <button type="button" disabled={busy || checking || supported !== true || !password} onClick={() => void register()}
        className="w-full min-h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
        {busy ? 'Working…' : 'Enable on this device'}
      </button>
      {message && <p role="status" className="text-xs text-gray-700">{message}</p>}
    </section>
  );
}
