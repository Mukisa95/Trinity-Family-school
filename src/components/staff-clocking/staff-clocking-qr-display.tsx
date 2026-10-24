'use client';

import QRCode from 'react-qr-code';
import { useEffect, useRef, useState } from 'react';
import { Loader2, QrCode, RefreshCw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateStaffClockingQrSession, useRevokeStaffClockingQrSession } from '@/lib/hooks/use-staff-clocking';

type QrSession = { sessionId: string; token: string; expiresAt: string };

export function StaffClockingQrDisplay({ available }: { available: boolean }) {
  const qrSession = useCreateStaffClockingQrSession();
  const revoke = useRevokeStaffClockingQrSession();
  const generation = useRef(0);
  const { mutate: refreshSession } = qrSession;
  const [session, setSession] = useState<QrSession>();
  const [message, setMessage] = useState<string>();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!available) { generation.current += 1; setSession(undefined); } }, [available]);

  const start = () => {
    setMessage(undefined);
    const currentGeneration = ++generation.current;
    qrSession.mutate(undefined, {
      onSuccess: (next) => { if (generation.current === currentGeneration) setSession(next); },
      onError: (error) => setMessage(error.message),
    });
  };

  useEffect(() => {
    if (!session || !available) return;
    const currentGeneration = generation.current;
    const refreshInMs = Math.max(1_000, new Date(session.expiresAt).getTime() - Date.now() - 8_000);
    const timeout = window.setTimeout(() => {
      refreshSession(session.sessionId, {
        onSuccess: (next) => { if (generation.current === currentGeneration) setSession(next); },
        onError: (error) => setMessage(error.message),
      });
    }, refreshInMs);
    return () => window.clearTimeout(timeout);
  }, [refreshSession, session, available]);

  if (!available) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/35 p-6 text-center">
        <QrCode className="h-14 w-14 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 font-semibold">QR display is unavailable</p>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Enable Staff Clocking and publish at least one active schedule before creating a school QR.</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/35 p-6 text-center">
        <QrCode className="h-14 w-14 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 font-semibold">Ready to present a secure QR</p>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">The displayed token expires after one minute and rotates while this display remains open.</p>
        <Button type="button" className="mt-5 min-h-11" onClick={start} disabled={qrSession.isPending}>
          {qrSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          Start QR display
        </Button>
        {message && <p role="alert" className="mt-3 text-sm text-destructive">{message}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="mx-auto w-fit rounded-xl bg-white p-4 shadow-sm" aria-label="Rotating staff clocking QR code">
        {now < Date.parse(session.expiresAt) ? <QRCode value={session.token} size={224} level="M" /> : <p className="max-w-56 p-5 text-sm text-slate-800">This code expired. Refresh the display to continue.</p>}
      </div>
      <p className="mt-4 font-semibold">{now < Date.parse(session.expiresAt) ? 'Staff can scan this QR now' : 'QR refresh required'}</p>
      <p className="mt-1 text-sm text-muted-foreground">It refreshes before expiry. Keep this screen visible until the clocking period ends.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => { const currentGeneration = generation.current; qrSession.mutate(session.sessionId, { onSuccess: (next) => { if (currentGeneration === generation.current) setSession(next); }, onError: (error) => setMessage(error.message) }); }} disabled={qrSession.isPending}>
          {qrSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh now
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" disabled={revoke.isPending} onClick={() => { generation.current += 1; revoke.mutate(session.sessionId, { onSuccess: () => { setSession(undefined); setMessage(undefined); }, onError: (error) => setMessage(error.message) }); }}>
          <Square className="h-4 w-4" /> End display
        </Button>
      </div>
      {message && <p role="alert" className="mt-3 text-sm text-destructive">{message}</p>}
    </div>
  );
}
