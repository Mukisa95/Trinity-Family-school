'use client';

import { useEffect, useState } from 'react';
import { Fingerprint, Trash2 } from 'lucide-react';
import { PasskeyService } from '@/lib/services/passkey.service';

type Passkey = Awaited<ReturnType<typeof PasskeyService.list>>[number];

export function PasskeySettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void PasskeyService.supported().then(setSupported).catch(() => setSupported(false));
    void PasskeyService.list().then(setPasskeys).catch(() => setMessage('Could not check registered devices. Try again online.'));
  }, []);

  const register = async () => {
    if (!password) { setMessage('Enter your current password first.'); return; }
    setBusy(true);
    setMessage(null);
    try {
      await PasskeyService.register(password);
      setPasskeys(await PasskeyService.list());
      setPassword('');
      setMessage('Device unlock is ready for your next sign-in.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not enable device unlock.');
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
      <button type="button" disabled={busy || supported !== true || !password} onClick={() => void register()}
        className="w-full min-h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
        {busy ? 'Working…' : 'Enable on this device'}
      </button>
      {message && <p role="status" className="text-xs text-gray-700">{message}</p>}
    </section>
  );
}
