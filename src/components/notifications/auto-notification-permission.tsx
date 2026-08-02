"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCircle, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePushSubscribe } from '@/lib/hooks/use-push-subscribe';
import { isIosDevice, isStandalonePwa } from '@/lib/push-subscription-client';

/**
 * Prompts for the one user gesture browsers require, then keeps an authorized
 * PWA/browser subscription reconciled whenever it is online and in use.
 */
export function AutoNotificationPermission() {
  const { user } = useAuth();
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    sync,
  } = usePushSubscribe();
  const [showPrompt, setShowPrompt] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);
  const [needsIosInstall, setNeedsIosInstall] = useState(false);

  useEffect(() => {
    setNeedsIosInstall(isIosDevice() && !isStandalonePwa());
  }, []);

  useEffect(() => {
    if (!user?.id || !isSupported || permission !== 'granted') return;

    const reconcile = () => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        void sync(user.id);
      }
    };
    const handleVisibility = () => reconcile();

    reconcile();
    window.addEventListener('online', reconcile);
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', handleVisibility);
    const timer = window.setInterval(reconcile, 30 * 60 * 1000);

    return () => {
      window.removeEventListener('online', reconcile);
      window.removeEventListener('focus', reconcile);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(timer);
    };
  }, [user?.id, isSupported, permission, sync]);

  useEffect(() => {
    if (!user) return;
    if (!needsIosInstall && !isSupported) return;
    if (!needsIosInstall && permission === 'granted' && isSubscribed) return;
    if (sessionStorage.getItem('push_prompt_dismissed')) return;

    const timer = window.setTimeout(() => setShowPrompt(true), 3000);
    return () => window.clearTimeout(timer);
  }, [user, isSupported, permission, isSubscribed, needsIosInstall]);

  const handleEnable = async () => {
    if (!user?.id) return;
    const enabled = await subscribe(user.id);
    if (enabled) {
      setJustEnabled(true);
      window.setTimeout(() => setShowPrompt(false), 2000);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('push_prompt_dismissed', '1');
  };

  if (!user) return null;
  if (!needsIosInstall && !isSupported) return null;
  if (!needsIosInstall && permission === 'granted' && isSubscribed) return null;

  const notificationsBlocked = !needsIosInstall && permission === 'denied';
  const heading = needsIosInstall
    ? 'Install the School App'
    : notificationsBlocked
      ? 'Notifications Are Blocked'
      : 'Stay in the Loop';
  const subheading = needsIosInstall
    ? 'Required for notifications on iPhone and iPad'
    : notificationsBlocked
      ? 'Allow them in your browser or phone settings'
      : 'Enable push notifications';

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          key="push-prompt"
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-2rem)]"
        >
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight">{heading}</p>
                    <p className="mt-0.5 text-xs text-indigo-100">{subheading}</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="mt-0.5 text-white/60 transition-colors hover:text-white"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {justEnabled ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                  Notifications enabled on this device!
                </div>
              ) : needsIosInstall ? (
                <Guidance onDismiss={handleDismiss}>
                  In Safari, tap <strong>Share</strong>, choose <strong>Add to Home Screen</strong>,
                  then open Trinity School from its icon and enable notifications there.
                </Guidance>
              ) : notificationsBlocked ? (
                <Guidance onDismiss={handleDismiss}>
                  Open this app in your phone or browser notification settings, allow notifications,
                  then return here. The app will register this device automatically.
                </Guidance>
              ) : (
                <>
                  <ul className="space-y-1.5 text-xs text-gray-500">
                    {[
                      'SchoolPay payment alerts',
                      'Important school announcements',
                      'Fee reminders and updates',
                    ].map(item => (
                      <li key={item} className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  {error && (
                    <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleEnable}
                      disabled={isLoading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60"
                    >
                      {isLoading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent"
                        />
                      ) : (
                        <Bell className="h-3.5 w-3.5" />
                      )}
                      {isLoading ? 'Enabling...' : 'Enable Notifications'}
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
                    >
                      Later
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Guidance({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return (
    <>
      <p className="text-xs leading-relaxed text-gray-600">{children}</p>
      <button
        onClick={onDismiss}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        Got it
      </button>
    </>
  );
}
