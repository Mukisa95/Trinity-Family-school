'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2, ShieldCheck, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SetupTask } from '@/lib/startup/workspace-setup';

const tips = [
  'We’re loading the school records available to your account and organising your workspace.',
  'Where supported, a local copy helps your next visit open faster and keeps saved records available.',
  'Large record collections and slower connections can make this first setup take a little longer.',
  'You can leave this screen open. Your workspace will appear automatically when setup is complete.',
];

export function WorkspaceSetupScreen({ tasks, completed, total, percent, failed, online, slow, fading, retry }: {
  tasks: SetupTask[]; completed: number; total: number; percent: number;
  failed: boolean; online: boolean; slow: boolean; fading: boolean; retry: () => void;
}) {
  const [tip, setTip] = useState(0);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    surface.current?.focus();
    const interval = setInterval(() => setTip(value => (value + 1) % tips.length), 6500);
    return () => { clearInterval(interval); previous?.focus(); };
  }, []);
  const message = fading ? 'Your workspace is ready.' : !online ? 'Waiting for your connection…'
    : failed ? 'Some records could not be downloaded.' : slow ? 'Still setting things up. Thank you for your patience.' : tips[tip];
  const activeTask = tasks.find(task => task.state === 'loading')?.id;

  return <div ref={surface} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="workspace-setup-title"
    aria-describedby="workspace-setup-description"
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const button = surface.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
      event.preventDefault();
      (button || surface.current)?.focus();
    }}
    className={`fixed inset-0 z-[110] overflow-y-auto bg-background text-foreground outline-none transition-opacity duration-300 motion-reduce:transition-none print:hidden ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:p-8">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-lg sm:p-9">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.png" alt="Trinity Family School" className="h-12 w-12 object-contain" />
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trinity Family School</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Your secure school workspace</p></div>
        </div>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {!online ? <WifiOff className="h-5 w-5" /> : fading ? <Check className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </div>
        <h1 id="workspace-setup-title" className="text-2xl font-semibold tracking-tight">Setting up your workspace</h1>
        <p id="workspace-setup-description" className="mt-3 text-sm leading-relaxed text-muted-foreground">This is a one-time setup for your account on this device. It may take a while, so please wait while we download your initial data and get everything ready.</p>
        <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground"><span>{completed} of {total} tasks ready</span><span className="font-semibold text-foreground">{percent}%</span></div>
        <div role="progressbar" aria-label="Workspace setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          aria-valuetext={`${completed} of ${total} setup tasks ready`} className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
        <p role="status" aria-live="polite" aria-atomic="true" className="mt-4 min-h-[4rem] text-sm leading-relaxed text-muted-foreground">{message}</p>
        <ul className="mt-2 grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {tasks.map(task => <li key={task.id} className="flex items-center gap-2 text-xs">
            {task.state === 'ready' ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
              : <Loader2 aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted-foreground ${online && task.id === activeTask ? 'animate-spin motion-reduce:animate-none' : ''}`} />}
            <span className={task.state === 'ready' ? 'text-foreground' : 'text-muted-foreground'}>{task.label}<span className="sr-only"> — {task.state === 'ready' ? 'Ready' : task.state === 'error' ? 'Retry needed' : 'Waiting'}</span></span>
          </li>)}
        </ul>
        {(failed || !online || slow) && <div className="mt-6 border-t border-border pt-4">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{!online ? 'Reconnect to continue. Completed tasks are kept where possible.' : 'The connection may be slow or a download may need another attempt. Retrying keeps data already saved on this device.'}</p>
          <Button onClick={retry} variant="outline" disabled={!online}>Retry setup</Button>
        </div>}
        <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Next time, you’ll use the normal quick startup. Setup may run again if this device’s app data is cleared or you use another account.</p>
      </section>
    </div>
  </div>;
}
