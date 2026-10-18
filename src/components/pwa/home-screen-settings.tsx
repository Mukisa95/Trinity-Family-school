'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, Download, Share2, Smartphone, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePushSubscribe } from '@/lib/hooks/use-push-subscribe';
import { useAndroidOfflineStatus } from '@/lib/hooks/use-android-offline-status';
import { hasBrowserOfflineWorkspace, isAppleMobile } from '@/lib/pwa/platform';
import { useHomeScreenWorkspace } from '@/lib/pwa/use-workspace';
import { createAppDiagnosticReport } from '@/lib/utils/app-diagnostics';
import { HomeScreenInstallGuide } from './install-guide';

function InstalledSettings() {
  const { user, isLocked } = useAuth();
  const { workspace, error: storageError } = useHomeScreenWorkspace();
  const push = usePushSubscribe();
  const offline = useAndroidOfflineStatus();
  const [storage, setStorage] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [report, setReport] = useState('');
  useEffect(() => {
    let disposed = false;
    if (!navigator.storage?.persisted) setStorage('This iOS version manages saved storage automatically.');
    if (navigator.storage?.persisted) void navigator.storage.persisted().then(saved => {
      if (!disposed) setStorage(saved ? 'Storage protection granted' : 'Storage protection is managed by iOS');
    }).catch(() => { if (!disposed) setStorage('Storage protection is unavailable in this version'); });
    return () => { disposed = true; };
  }, []);
  if (!user || isLocked) return null;

  const protectStorage = async () => {
    setWorking(true);
    try {
      const retained = await navigator.storage?.persist?.();
      setStorage(retained ? 'Storage protection granted' : 'iOS decides whether to retain this app’s saved data. Open the app regularly.');
    } catch { setMessage('Storage protection could not be requested. Your existing saved data has been kept.'); }
    finally { setWorking(false); }
  };
  const shareReport = async () => {
    const text = createAppDiagnosticReport();
    try {
      const file = new File([text], 'school-problem-report.json', { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ files: [file], title: 'School app problem report' });
      else { setReport(text); setMessage('Problem report ready. Copy it below or save the report file.'); }
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) { setReport(text); setMessage('Sharing is unavailable. You can copy or save the report below.'); } }
  };
  const saveReport = () => {
    const url = URL.createObjectURL(new Blob([report || createAppDiagnosticReport()], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'school-problem-report.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  return <section aria-labelledby="home-screen-settings-title" className="space-y-5 rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
    <div className="flex items-center gap-3"><Smartphone className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><h2 id="home-screen-settings-title" className="text-lg font-semibold">Home Screen app</h2></div>
    <p className="text-sm text-muted-foreground">Your saved pages use the same school account and privacy lock. Offline viewing is read-only.</p>
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 font-medium"><WifiOff className="h-4 w-4" aria-hidden="true" />Offline access</h3>
      {workspace ? <>
        <ul className="space-y-3 text-sm">{workspace.sections.map(section => <li key={section.path} className="flex items-start justify-between gap-3">
          <Link href={section.path} className="flex min-h-11 flex-1 items-center underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{section.label}</Link>
          <span className="flex min-h-11 items-center gap-1.5 text-right text-muted-foreground">{section.saved && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}{section.saved ? 'Saved' : 'Not fully saved'}</span>
        </li>)}</ul>
        <p className="text-xs leading-relaxed text-muted-foreground">Secure offline access renews online and currently lasts until {new Date(workspace.session.expiresAt).toLocaleString()}. Saved content may be older than the live school records.</p>
      </> : <p className="text-sm text-muted-foreground">{offline ? 'Connect to prepare or renew saved access.' : 'Preparing secure access. Visit the pages you need while connected and let their content finish loading.'}</p>}
      <Button variant="outline" className="min-h-11" disabled={offline} onClick={() => { window.dispatchEvent(new Event('trinity-pwa-prepare')); setMessage('Preparation requested. Keep the app open while connected; saved sections update here automatically.'); }}>Prepare offline access</Button>
      {(storageError || storage) && <p className="text-sm text-muted-foreground">{storageError || storage}</p>}
      <Button variant="outline" className="min-h-11" disabled={working || !navigator.storage?.persist} onClick={protectStorage}>Protect saved storage</Button>
    </div>
    <div className="space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 font-medium"><Bell className="h-4 w-4" aria-hidden="true" />Notifications</h3>
      <p className="text-sm text-muted-foreground">{!push.isSupported ? 'Web notifications need an installed Home Screen app on iOS 16.4 or newer.' : push.permission === 'denied' ? 'Notifications are blocked. Allow them for this app in iPhone Settings → Notifications, then reopen the app.' : push.isSubscribed ? 'This device is registered for school notifications.' : 'Enable alerts for school notifications sent to your account.'}</p>
      {push.isSupported && push.permission !== 'denied' && !push.isSubscribed && <Button className="min-h-11" disabled={offline || push.isLoading || push.isChecking} onClick={() => void push.subscribe(user.id)}>{push.isLoading ? 'Enabling…' : 'Enable notifications'}</Button>}
      {push.error && <p role="alert" className="text-sm text-destructive">{push.error}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">Push alerts need an internet connection. iOS controls delivery and Focus settings. Android Home Screen widgets and exact offline lesson alarms are unavailable here.</p>
    </div>
    <div className="space-y-3 border-t pt-4">
      <h3 className="font-medium">Problem report</h3>
      <p className="text-sm text-muted-foreground">Share a bug identifier and technical events. Reports exclude pupil records, passwords and sign-in tokens.</p>
      <Button variant="outline" className="min-h-11 gap-2" onClick={() => void shareReport()}><Share2 className="h-4 w-4" aria-hidden="true" />Share problem report</Button>
      {report && <><label className="block text-sm" htmlFor="pwa-problem-report">Problem report text</label><textarea id="pwa-problem-report" readOnly value={report} className="h-40 w-full rounded-lg border bg-background p-3 text-base" /><Button variant="outline" className="min-h-11 gap-2" onClick={saveReport}><Download className="h-4 w-4" aria-hidden="true" />Save report file</Button></>}
    </div>
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </section>;
}

export function HomeScreenSettings() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'hidden' | 'install' | 'app'>('hidden');
  useEffect(() => { if (!window.TrinityOffline && isAppleMobile()) setMode(hasBrowserOfflineWorkspace() ? 'app' : 'install'); }, []);
  return mode === 'app' ? <InstalledSettings /> : mode === 'install' ? <HomeScreenInstallGuide always settingsPath={user?.role === 'Parent' ? '/parent/settings' : '/settings/account'} /> : null;
}
