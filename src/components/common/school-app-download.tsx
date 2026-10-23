'use client';

import { useEffect, useId, useRef, useState, type ComponentProps, type MouseEvent } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { Copy, Share2 } from 'lucide-react';
import { useAppPlatform } from '@/lib/hooks/use-app-platform';
import { appDownloadPageUrl } from '@/lib/app-platform';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export function AppDownloadQr({ url }: { url: string }) {
  const inputId = useId();
  const [message, setMessage] = useState('');
  const linkInput = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setMessage('Download link copied.'); }
    catch { linkInput.current?.focus(); linkInput.current?.select(); setMessage('Select and copy the download link below.'); }
  };
  const share = async () => {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: 'Get the school app', url }); setMessage('Download link shared.'); }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) await copy(); }
  };
  return <div className="space-y-4">
    <div className="mx-auto w-fit max-w-full rounded-2xl border border-slate-200 bg-white p-8" data-app-download-qr={url}>
      <QRCode value={url} size={208} level="M" bgColor="#ffffff" fgColor="#000000" role="img" aria-label="Scan to open the school app download page" style={{ maxWidth: '100%', height: 'auto' }} />
    </div>
    <p className="text-center text-sm leading-6 text-muted-foreground">Scan with a phone camera to open the download page. No sign-in needed to download.</p>
    <div className="space-y-2"><label htmlFor={inputId} className="text-xs font-medium">Public download link</label><input ref={linkInput} id={inputId} readOnly value={url} onFocus={event => event.currentTarget.select()} className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
    <div className="flex flex-wrap justify-center gap-2">
      <Button variant="outline" className="min-h-11" onClick={() => void copy()}><Copy className="mr-2 h-4 w-4" aria-hidden="true" />Copy link</Button>
      <Button variant="outline" className="min-h-11" onClick={() => void share()}><Share2 className="mr-2 h-4 w-4" aria-hidden="true" />Share app</Button>
    </div>
    {message && <p role="status" className="text-center text-sm">{message}</p>}
  </div>;
}

export function AppDownloadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { setUrl(appDownloadPageUrl(window.location.origin)); }, []);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogTitle className="pr-8">Get the school app</DialogTitle>
    <DialogDescription>Use your phone to download the school’s Android app.</DialogDescription>
    {url && <AppDownloadQr url={url} />}
    <Link href="/download" className="flex min-h-11 items-center justify-center rounded-lg text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open download page on this device</Link>
  </DialogContent></Dialog>;
}

export function useSchoolAppDownload() {
  const platform = useAppPlatform();
  const [open, setOpen] = useState(false);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!platform || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (!platform.mobile) { event.preventDefault(); setOpen(true); }
  };
  return { visible: Boolean(platform && !platform.installed), open, setOpen, onClick };
}

/** For ordinary links. Menus keep the dialog outside their dismissing content. */
export function SchoolAppDownloadLink({ children, ...props }: Omit<ComponentProps<typeof Link>, 'href' | 'onClick'>) {
  const download = useSchoolAppDownload();
  if (!download.visible) return null;
  return <><Link {...props} href="/download" onClick={download.onClick}>{children}</Link><AppDownloadDialog open={download.open} onOpenChange={download.setOpen} /></>;
}
