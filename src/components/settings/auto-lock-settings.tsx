'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Lock, LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { PASSKEYS_CHANGED_EVENT, PasskeyService } from '@/lib/services/passkey.service';

export function AutoLockSettings() {
  const {
    user,
    autoLockEnabled,
    setAutoLockEnabled,
    autoLockAction,
    setAutoLockAction,
    deviceUnlockForAutoLock,
    setDeviceUnlockForAutoLock,
    lockAccount,
  } = useAuth();
  const [deviceUnlockAvailable, setDeviceUnlockAvailable] = useState<boolean | null>(null);

  const checkDeviceUnlock = useCallback(async () => {
    if (!user) return setDeviceUnlockAvailable(false);
    const supported = await PasskeyService.supported().catch(() => false);
    setDeviceUnlockAvailable(supported && PasskeyService.hasLocalUnlock(user.id));
  }, [user]);

  useEffect(() => {
    void checkDeviceUnlock();
    window.addEventListener(PASSKEYS_CHANGED_EVENT, checkDeviceUnlock);
    window.addEventListener('focus', checkDeviceUnlock);
    return () => {
      window.removeEventListener(PASSKEYS_CHANGED_EVENT, checkDeviceUnlock);
      window.removeEventListener('focus', checkDeviceUnlock);
    };
  }, [checkDeviceUnlock]);

  useEffect(() => {
    // Device support is checked asynchronously whenever Settings mounts. Do
    // not erase the user's saved preference while that check is pending or if
    // a browser capability check temporarily fails. Signing out is the only
    // action that is inherently incompatible with a local privacy unlock.
    if (deviceUnlockForAutoLock && autoLockAction === 'signout') {
      setDeviceUnlockForAutoLock(false);
    }
  }, [autoLockAction, deviceUnlockForAutoLock, setDeviceUnlockForAutoLock]);

  const toggleAutoLock = () => {
    const enabled = !autoLockEnabled;
    if (enabled && !autoLockAction) setAutoLockAction('lock-on-close');
    setAutoLockEnabled(enabled);
  };

  const actions = [
    { value: 'lock-on-close' as const, label: 'When app closes', icon: Lock },
    { value: 'lock-on-leave' as const, label: 'When app is left', icon: Smartphone },
    { value: 'signout' as const, label: 'Sign out on close', icon: LogOut },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Automatic privacy lock</h2>
            <p className="text-xs leading-5 text-gray-500">Protect the open dashboard when this app is closed or placed in the background.</p>
          </div>
        </div>
        <button type="button" role="switch" aria-checked={autoLockEnabled} onClick={toggleAutoLock}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${autoLockEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
          <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${autoLockEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {autoLockEnabled && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {actions.map(action => {
              const Icon = action.icon;
              const selected = autoLockAction === action.value;
              return (
                <button key={action.value} type="button" onClick={() => setAutoLockAction(action.value)}
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${selected ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <Icon className="h-4 w-4 shrink-0" /> {action.label}
                </button>
              );
            })}
          </div>

          {autoLockAction !== 'signout' && (
            <div className="flex items-start justify-between gap-3 rounded-xl bg-indigo-50 px-3 py-3">
              <div className="flex gap-2">
                <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
                <div>
                  <p className="text-xs font-semibold text-indigo-950">Require device unlock</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-indigo-700">
                    {deviceUnlockAvailable === null
                      ? 'Checking biometric / device unlock on this device…'
                      : deviceUnlockAvailable
                      ? 'Use fingerprint, face unlock, or the device PIN. The privacy lock can be opened offline.'
                      : 'First enable biometric / device unlock on this device while online.'}
                  </p>
                </div>
              </div>
              <button type="button" role="switch" aria-checked={deviceUnlockForAutoLock}
                disabled={deviceUnlockAvailable !== true}
                onClick={() => setDeviceUnlockForAutoLock(!deviceUnlockForAutoLock)}
                className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${deviceUnlockForAutoLock ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${deviceUnlockForAutoLock ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          <button type="button" onClick={lockAccount} className="min-h-10 text-xs font-semibold text-blue-700">
            Lock now to test
          </button>
        </>
      )}
    </section>
  );
}
