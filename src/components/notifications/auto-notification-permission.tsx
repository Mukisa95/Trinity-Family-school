"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePushSubscribe } from '@/lib/hooks/use-push-subscribe';

/**
 * AutoNotificationPermission
 *
 * Shows a floating permission prompt 3 seconds after login if the user hasn't
 * granted push notification permission yet. On "Enable", subscribes the user
 * via usePushSubscribe which registers the service worker and saves the
 * subscription to Firestore.
 *
 * Dismissed state is stored in sessionStorage so the prompt doesn't nag
 * on every navigation, but reappears the next session if still not granted.
 */
export function AutoNotificationPermission() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, permission, isLoading, subscribe } = usePushSubscribe();
  const [showPrompt, setShowPrompt] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    if (!user || !isSupported) return;
    if (permission === 'granted' || isSubscribed) return;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('push_prompt_dismissed')) return;

    // Show after 3 seconds
    const timer = setTimeout(() => setShowPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, [user, isSupported, permission, isSubscribed]);

  const handleEnable = async () => {
    if (!user?.id) return;
    const ok = await subscribe(user.id);
    if (ok) {
      setJustEnabled(true);
      setTimeout(() => setShowPrompt(false), 2000);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('push_prompt_dismissed', '1');
    }
  };

  // Nothing to show if not supported / already granted / not logged in
  if (!isSupported || !user || permission === 'denied') return null;
  if (permission === 'granted' && isSubscribed) return null;

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
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Header gradient */}
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-tight">Stay in the Loop</p>
                    <p className="text-xs text-indigo-100 mt-0.5">Enable push notifications</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-white/60 hover:text-white transition-colors mt-0.5"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {justEnabled ? (
                <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                  <CheckCircle className="w-5 h-5" />
                  Notifications enabled!
                </div>
              ) : (
                <>
                  <ul className="text-xs text-gray-500 space-y-1.5">
                {['SchoolPay payment alerts', 'Important school announcements', 'Fee reminders & updates'].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="flex gap-2">
                    <button
                      onClick={handleEnable}
                      disabled={isLoading}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"
                        />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                      {isLoading ? 'Enabling…' : 'Enable Notifications'}
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
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
