'use client';

/**
 * useSchoolPayBadge
 * 
 * Lightweight hook for the top-bar badge.
 * Listens to Firestore payments (source=schoolpay) and counts how many distinct
 * SchoolPay transactions arrived after the user last opened the feed page.
 */

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSchoolPayInbox } from '@/lib/hooks/use-schoolpay-inbox';

const STORAGE_KEY = (userId: string) => `schoolpay-feed-state-${userId}`;

function getLastViewedAt(userId: string): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    if (!raw) return null;
    return (JSON.parse(raw) as { lastViewedAt: string | null }).lastViewedAt ?? null;
  } catch {
    return null;
  }
}

export function useSchoolPayBadge() {
  const { user } = useAuth();
  const { data: unresolvedPayments } = useSchoolPayInbox();
  const userId = user?.id || 'anonymous';

  const [badgeCount, setBadgeCount] = useState(0);
  // Track the lastViewedAt so we can re-compute when the user opens the page
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);

  // Load lastViewedAt from localStorage (client only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLastViewedAt(getLastViewedAt(userId));
    }
  }, [userId]);

  // Re-read lastViewedAt whenever the storage might have changed
  // (e.g. when the feed page saves it). Poll every 5 s is cheap.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      const lv = getLastViewedAt(userId);
      setLastViewedAt(prev => (prev !== lv ? lv : prev));
    }, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  // Listen to all SchoolPay payments and compute badge
  useEffect(() => {
    const q = query(
      collection(db, 'payments'),
      where('source', '==', 'schoolpay')
    );

    let unsub: (() => void) | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const startListener = () => {
      if (stopped) return;
      unsub = onSnapshot(q, snap => {
        // Collect distinct SchoolPay transaction ids
        const seen = new Set<string>();
        let count = 0;
        for (const doc of snap.docs) {
          const d = doc.data();
          if (d.reverted) continue;
          const key: string = d.schoolPayReceiptNumber || d.schoolPayTransactionId || doc.id;
          if (seen.has(key)) continue;
          seen.add(key);

          // It's "new" (orange) if it arrived after lastViewedAt (or if never viewed)
          if (!lastViewedAt) {
            count++;
          } else {
            const paymentDate =
              d.paymentDate?.toDate?.()?.toISOString?.() ?? d.paymentDate ?? '';
            if (paymentDate && new Date(paymentDate).getTime() > new Date(lastViewedAt).getTime()) {
              count++;
            }
          }
        }
        setBadgeCount(count);
      }, error => {
        console.error('SchoolPay badge listener error:', error);
        retryTimer = setTimeout(startListener, 3000);
      });
    };

    startListener();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (unsub) unsub();
    };
  }, [lastViewedAt]);

  return badgeCount + unresolvedPayments.length;
}
