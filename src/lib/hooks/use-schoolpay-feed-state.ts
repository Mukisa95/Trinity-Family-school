'use client';

/**
 * useSchoolPayFeedState
 *
 * Manages per-user state for the SchoolPay Live Feed:
 *   - lastViewedAt  : timestamp when user last opened the feed page
 *   - clickedTxKeys : set of transaction keys the user has clicked through to the pupil page
 *
 * Colour rules:
 *   ORANGE  – arrived AFTER lastViewedAt  → new, user hasn't opened feed since
 *   BLUE    – arrived BEFORE lastViewedAt but never clicked  → seen in feed, not drilled in
 *   GREEN   – user has clicked "View Fees" for this transaction
 *
 * Badge count = number of ORANGE transactions (cleared when user opens the feed).
 *
 * Storage: localStorage (per-user, per-browser).
 * Key format: `schoolpay-feed-state-<userId>`
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';

const STORAGE_KEY = (userId: string) => `schoolpay-feed-state-${userId}`;

interface FeedState {
  lastViewedAt: string | null;  // ISO timestamp or null (never opened)
  clickedTxKeys: string[];      // txKeys the user has ever clicked
}

function loadState(userId: string): FeedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    if (!raw) return { lastViewedAt: null, clickedTxKeys: [] };
    return JSON.parse(raw) as FeedState;
  } catch {
    return { lastViewedAt: null, clickedTxKeys: [] };
  }
}

function saveState(userId: string, state: FeedState) {
  try {
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(state));
  } catch { /* ignore */ }
}

export type TxStatus = 'new' | 'seen' | 'clicked';

export function useSchoolPayFeedState(txPaymentDates?: Record<string, string>) {
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';

  const [state, setState] = useState<FeedState>(() => {
    if (typeof window === 'undefined') return { lastViewedAt: null, clickedTxKeys: [] };
    return loadState(userId);
  });

  // Re-load when user changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setState(loadState(userId));
    }
  }, [userId]);

  /** Call when the feed page mounts — marks "viewed now", clears the badge */
  const markFeedViewed = useCallback(() => {
    const next: FeedState = { ...state, lastViewedAt: new Date().toISOString() };
    setState(next);
    saveState(userId, next);
  }, [state, userId]);

  /** Call when user clicks "View Fees" for a transaction */
  const markTxClicked = useCallback((txKey: string) => {
    if (state.clickedTxKeys.includes(txKey)) return;
    const next: FeedState = { ...state, clickedTxKeys: [...state.clickedTxKeys, txKey] };
    setState(next);
    saveState(userId, next);
  }, [state, userId]);

  /**
   * Derive the visual status for each transaction.
   * txPaymentDates: map of txKey → paymentDate ISO string
   */
  const getTxStatus = useCallback((txKey: string, paymentDate: string): TxStatus => {
    if (state.clickedTxKeys.includes(txKey)) return 'clicked';
    if (!state.lastViewedAt) return 'new'; // never opened feed
    const arrivedAt = new Date(paymentDate).getTime();
    const viewedAt = new Date(state.lastViewedAt).getTime();
    return arrivedAt > viewedAt ? 'new' : 'seen';
  }, [state]);

  /**
   * Count of "new" (orange) transactions.
   * txPaymentDates: map of txKey → paymentDate ISO string.
   */
  const newCount = useCallback((txMap: Record<string, string>): number => {
    return Object.entries(txMap).filter(([key, date]) => getTxStatus(key, date) === 'new').length;
  }, [getTxStatus]);

  return {
    lastViewedAt: state.lastViewedAt,
    clickedTxKeys: state.clickedTxKeys,
    markFeedViewed,
    markTxClicked,
    getTxStatus,
    newCount,
  };
}
