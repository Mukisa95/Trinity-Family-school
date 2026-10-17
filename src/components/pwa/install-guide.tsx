'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Smartphone, Share2, CheckCircle2 } from 'lucide-react';
import { isAppleMobile, isHomeScreenApp } from '@/lib/pwa/platform';

export function HomeScreenInstallGuide({ always = false, nonApple = false, settingsPath = '/settings/account' }: { always?: boolean; nonApple?: boolean; settingsPath?: string }) {
  const [state, setState] = useState({ apple: false, installed: false });
  useEffect(() => { setState({ apple: isAppleMobile(), installed: isHomeScreenApp() }); }, []);
  if (!always && !state.apple) return null;
  if (nonApple && state.apple) return null;
  return <section aria-labelledby="home-screen-install-title" className="mt-6 rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
    <div className="flex items-center gap-3"><Smartphone className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" /><h2 id="home-screen-install-title" className="text-xl font-semibold">Your school, on iPhone</h2></div>
    {state.installed ? <p className="mt-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />You’re using the Home Screen app.</p> : <>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Install this school website for an app window without the browser address bar. No App Store download or paid Apple account is needed.</p>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
        <li>Open this school’s website in <strong>Safari</strong> on your iPhone.</li>
        <li>Tap <Share2 className="inline h-4 w-4" aria-hidden="true" /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>. You may need to scroll through the actions.</li>
        <li>Leave <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li>
        <li>Open the new school icon and sign in online. Keep it open until Account settings shows your offline sections as saved.</li>
      </ol>
    </>}
    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Web notifications need iOS 16.4 or newer and must be enabled from the installed app. Check your version in iPhone Settings → General → About.</p>
    <Link href={settingsPath} className="mt-3 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Account settings</Link>
  </section>;
}
