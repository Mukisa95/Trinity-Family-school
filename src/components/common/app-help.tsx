'use client';

import { useEffect, useState } from 'react';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { createAppDiagnosticReport, installAppDiagnosticMonitor } from '@/lib/utils/app-diagnostics';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

/** Available on login and the local privacy screen as well as protected pages. */
export function AppHelp() {
  const [native, setNative] = useState(false);
  const [report, setReport] = useState('');
  const [copied, setCopied] = useState(false);
  const [nativeHelp, setNativeHelp] = useState(false);
  useEffect(() => {
    if (!hasAndroidOfflineBridge()) return;
    setNative(true);
    const update = () => setNativeHelp(window.trinityNativeDiagnostics === true);
    update();
    window.addEventListener('trinity-native-diagnostics', update);
    const stop = installAppDiagnosticMonitor();
    return () => { stop(); window.removeEventListener('trinity-native-diagnostics', update); };
  }, []);
  const open = async () => {
    const fallback = createAppDiagnosticReport();
    try { await androidOfflineRequest('diagnostics', {}, 3000); }
    catch { setCopied(false); setReport(fallback); }
  };
  if (!native || nativeHelp) return null;
  return <>
    {!report && <Button type="button" variant="outline" size="sm" className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-3 z-[100] min-h-11 shadow-sm sm:bottom-3 print:hidden" onClick={() => void open()}>App help</Button>}
    <Dialog open={Boolean(report)} onOpenChange={value => { if (!value) setReport(''); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>App problem report</DialogTitle><DialogDescription>Copy this report after a sign-out, freeze, or reconnect warning. It contains diagnostic codes and timing, without passwords or school records.</DialogDescription></DialogHeader>
        <textarea aria-label="Diagnostic report" readOnly value={report} className="h-56 w-full rounded border bg-background p-3 font-mono text-xs" />
        <Button onClick={async () => { try { await navigator.clipboard.writeText(report); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy report'}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
