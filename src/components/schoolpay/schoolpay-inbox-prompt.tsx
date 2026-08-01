'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSchoolPayInbox } from '@/lib/hooks/use-schoolpay-inbox';
import { Button } from '@/components/ui/button';
import { SchoolPayInboxCard } from './schoolpay-inbox-card';

type DismissedMap = Record<string, string>;

function recordVersion(record: { status: string; studentPaymentCode?: string; lastError?: string }) {
  // Automatic reconciliation retries must not nag the user again after a
  // dismissal unless the actionable state, code, or failure reason changes.
  return `${record.status}:${record.studentPaymentCode || ''}:${record.lastError || ''}`;
}

export function SchoolPayInboxPrompt() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: records } = useSchoolPayInbox();
  const storageKey = `schoolpay-inbox-dismissed:${user?.id || 'anonymous'}`;
  const [dismissed, setDismissed] = useState<DismissedMap>({});

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(storageKey) || '{}'));
    } catch {
      setDismissed({});
    }
  }, [storageKey]);

  const visible = useMemo(() => records.filter(record => dismissed[record.id] !== recordVersion(record)), [dismissed, records]);
  const current = visible[0];
  if (!current) return null;

  const dismiss = () => {
    const next = { ...dismissed, [current.id]: recordVersion(current) };
    setDismissed(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* device storage may be unavailable */ }
  };

  return (
    <aside aria-label="Unresolved SchoolPay payment" aria-live="polite" className="fixed bottom-3 left-3 right-3 z-40 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[min(31rem,calc(100vw-2.5rem))]">
      <SchoolPayInboxCard record={current} onDismiss={dismiss} compact />
      {visible.length > 1 && (
        <Button type="button" variant="outline" size="sm" onClick={() => router.push('/accounts/schoolpay-feed')} className="mt-2 w-full bg-white/95 shadow-md">
          Review {visible.length - 1} more payment{visible.length === 2 ? '' : 's'} needing attention <ChevronRight />
        </Button>
      )}
    </aside>
  );
}
