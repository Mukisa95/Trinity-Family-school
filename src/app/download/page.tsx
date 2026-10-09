import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { Download, ArrowLeft, CalendarDays, BellRing, WifiOff } from 'lucide-react';
import { androidReleaseForSite, androidRequestOrigin, websiteFirebaseProjectId } from '@/lib/android/download';

export const metadata = { title: 'Download Android app', robots: { index: false, follow: true } };
export const dynamic = 'force-dynamic';
export default async function AndroidDownloadPage() {
  const requestHeaders = await headers();
  const development = process.env.NODE_ENV === 'development';
  const release = androidReleaseForSite(androidRequestOrigin(requestHeaders, '', development), websiteFirebaseProjectId(), development);
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:py-16 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-xl">
        <Link href="/login" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-emerald-400 dark:hover:bg-slate-900"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to school website</Link>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          {release ? <>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"><Image src={release.iconUrl} alt="School crest" width={64} height={64} /></div>
              <div><p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Your school, on Android</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{release.appName}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Version {release.versionName} · {(release.bytes / 1_000_000).toFixed(2)} MB · Android {release.minAndroid}+</p></div>
            </div>
            <p className="mt-6 text-base leading-relaxed text-slate-600 dark:text-slate-300">Use your existing school login. Keep your dashboard, timetables and pupil details available offline, with home-screen widgets and lesson reminders.</p>
            <a href="/api/android/download" download={release.filename} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"><Download className="h-5 w-5" aria-hidden="true" />Download {release.appName}</a>
            <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">An Android app file (APK), ready for this school.</p>
            <div className="mt-7 grid grid-cols-3 gap-2 border-y border-slate-100 py-4 text-center text-sm dark:border-slate-800">
              {[{ Icon: CalendarDays, label: 'Timetable widgets' }, { Icon: BellRing, label: 'Lesson reminders' }, { Icon: WifiOff, label: 'Offline access' }].map(({ Icon, label }) => <div key={label} className="flex flex-col items-center gap-2"><Icon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" /><span>{label}</span></div>)}
            </div>
            <h2 className="mt-6 text-lg font-semibold">Install in three steps</h2>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <li>Download the APK and open it from your browser’s downloads.</li>
              <li>If Android asks, allow this browser to install the app, then tap Install.</li>
              <li>Open {release.appName} and sign in with your school account. Your school is already configured.</li>
            </ol>
            <p className="mt-5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Sign in online first to prepare offline access. Notification and reminder timing permissions can be enabled in the app. Parent accounts retain their existing access.</p>
          </> : <><h1 className="text-2xl font-bold">Android app</h1><p className="mt-4 text-slate-600 dark:text-slate-300">The Android download is not available for this school yet.</p></>}
        </section>
      </div>
    </main>
  );
}
