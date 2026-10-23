'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppDownloadQr } from '@/components/common/school-app-download';
import { useAppPlatform } from '@/lib/hooks/use-app-platform';
import { appDownloadPageUrl } from '@/lib/app-platform';
import { APP_VERSION } from '@/lib/constants/version';
import type { AndroidNotificationState } from '@/lib/offline/android-notifications';

type ReleaseInfo = { appName: string; versionName: string; versionCode: number; minAndroid: string };

export function AboutApp({ android, state }: { android: boolean; state: AndroidNotificationState | null }) {
  const platform = useAppPlatform();
  const [url, setUrl] = useState('');
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  useEffect(() => {
    setUrl(appDownloadPageUrl(window.location.origin));
    const controller = new AbortController();
    void fetch('/api/android/release', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (!controller.signal.aborted && typeof data.appName === 'string' && typeof data.versionName === 'string' && typeof data.versionCode === 'number' && typeof data.minAndroid === 'string') setRelease(data);
    }).catch(() => { /* Installed details and sharing remain available while offline. */ });
    return () => controller.abort();
  }, []);
  const installed = android && state?.appVersion;
  return <div className="space-y-3">
    <dl className="space-y-3 rounded-2xl border border-border/70 bg-card/75 p-4 text-[13px]">
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">App name</dt><dd className="font-medium">{state?.appName || release?.appName || 'School app'}</dd></div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">Platform</dt><dd className="font-medium">{android ? 'Android app' : !platform ? 'Checking…' : platform.installed ? platform.os === 'ios' ? 'iPhone / iPad web app' : 'Installed web app' : platform.os === 'ios' ? 'iPhone / iPad browser' : platform.os === 'android' ? 'Android browser' : 'Desktop browser'}</dd></div>
      {android && <div className="space-y-1"><dt className="text-muted-foreground">Installed Android version</dt><dd className="font-medium">{installed ? `${installed}${state?.appBuild !== undefined ? ` (build ${state.appBuild})` : ''}` : 'Not reported'}</dd>{!installed && <p className="text-xs text-muted-foreground">See Android App info.</p>}</div>}
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">Web experience version</dt><dd className="font-medium">{APP_VERSION}</dd></div>
      {release && <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">Available Android download</dt><dd className="font-medium">{release.versionName} · Android {release.minAndroid}+</dd></div>}
      {url && <div className="space-y-1"><dt className="text-muted-foreground">School website</dt><dd><a className="break-all font-medium text-primary underline underline-offset-4" href={new URL(url).origin}>{new URL(url).hostname}</a></dd></div>}
    </dl>
    <div className="space-y-3 pt-2"><h3 className="text-[13px] font-semibold">Share the app</h3>{url && <AppDownloadQr url={url} compact />}</div>
    <Link href="/changelog" className="inline-flex min-h-9 items-center rounded-full text-xs font-medium text-primary underline underline-offset-4">What’s new</Link>
  </div>;
}
