"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { FileUp, Loader2, Lock, Minus, Plus, Scissors, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { importStudioPdfPages, MAX_PDF_IMPORT_PAGES, openStudioPdf, parsePdfPageRange, type StudioPdfDocument } from './studio-pdf';
import { makeStudioId, normalizePdfCutout, type CustomPhotoPage, type PdfArtwork, type PdfCutout, type StudioPdfSource } from './custom-photo-types';

export function StudioPdfImport({ onImport, suspended = false, onMinimize, triggerContainer }: { onImport: (pages: CustomPhotoPage[], source: StudioPdfSource, replace: boolean) => void; suspended?: boolean; onMinimize?: () => void; triggerContainer?: HTMLElement | null }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [count, setCount] = useState(0);
  const [range, setRange] = useState('1');
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const documentRef = useRef<StudioPdfDocument | null>(null);
  const requestRef = useRef(0);
  useEffect(() => () => { requestRef.current++; void documentRef.current?.destroy(); }, []);
  const close = (value: boolean) => {
    if (busy) return;
    setOpen(value);
    if (!value) { requestRef.current++; void documentRef.current?.destroy(); documentRef.current = null; setFile(undefined); setCount(0); setError(''); }
  };
  const inspect = async (next?: File) => {
    if (!next) return;
    const request = ++requestRef.current;
    setBusy(true); setError(''); setCount(0); setFile(undefined); setProgress('Reading PDF…');
    try {
      await documentRef.current?.destroy(); documentRef.current = null;
      const doc = await openStudioPdf(next);
      if (request !== requestRef.current) { await doc.destroy(); return; }
      documentRef.current = doc; setFile(next); setCount(doc.numPages); setRange(doc.numPages > 1 ? `1-${Math.min(doc.numPages, MAX_PDF_IMPORT_PAGES)}` : '1');
    } catch (reason) { if (request === requestRef.current) setError(reason instanceof Error ? reason.message : 'Could not open PDF.'); }
    finally { if (request === requestRef.current) { setBusy(false); setProgress(''); } }
  };
  const importPages = async () => {
    if (!file || !documentRef.current) return;
    const request = requestRef.current;
    setBusy(true); setError('');
    try {
      const numbers = parsePdfPageRange(range, count);
      const result = await importStudioPdfPages(documentRef.current, file, numbers, value => { if (request === requestRef.current) setProgress(value); });
      if (request !== requestRef.current) return;
      onImport(result.pages, result.source, replace);
      const doc = documentRef.current; documentRef.current = null;
      setOpen(false); setFile(undefined); setCount(0);
      void doc.destroy().catch(() => { /* Artwork and source have already been retained. */ });
    } catch (reason) { if (request === requestRef.current) setError(reason instanceof Error ? reason.message : 'PDF import failed.'); }
    finally { if (request === requestRef.current) { setBusy(false); setProgress(''); } }
  };
  const trigger = <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="mb-3 w-full gap-2"><FileUp className="h-4 w-4" />Import PDF</Button></DialogTrigger>;
  return <Dialog open={open && !suspended} onOpenChange={close}>
    {triggerContainer === undefined ? trigger : triggerContainer ? createPortal(trigger, triggerContainer) : null}
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Import PDF artwork</DialogTitle><DialogDescription className="sr-only">Local PDF import.</DialogDescription></DialogHeader>
      <label className="space-y-2 text-sm font-medium">PDF file · no fixed file-size limit<Input aria-label="PDF file" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => { void inspect(event.target.files?.[0]); event.target.value = ''; }} /></label>

      {count > 0 && <>
        <p className="text-sm text-muted-foreground">{file?.name} · {count} {count === 1 ? 'page' : 'pages'}</p>
        <label className="space-y-2 text-sm font-medium">Pages to import<Input aria-label="Pages to import" value={range} onChange={event => setRange(event.target.value)} disabled={busy} placeholder="1-3, 5" /><span className="block text-xs text-muted-foreground">Up to {MAX_PDF_IMPORT_PAGES} pages per import. Each page keeps its original dimensions.</span></label>
        <label className="space-y-2 text-sm font-medium">Add to template<select aria-label="PDF import destination" value={replace ? 'replace' : 'append'} onChange={event => setReplace(event.target.value === 'replace')} disabled={busy} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="append">Add as new pages</option><option value="replace">Replace current page (including its elements)</option></select></label>
      </>}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {onMinimize && <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Minimize Photo Studio" onClick={onMinimize}><Minus className="h-4 w-4" /></Button>}
      <div className="flex flex-wrap items-center justify-end gap-2"><span role="status" className="mr-auto text-xs text-muted-foreground">{progress}</span><Button variant="outline" disabled={busy} onClick={() => close(false)}>Cancel</Button><Button disabled={!count || busy} onClick={() => void importPages()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}Import pages</Button></div>
    </DialogContent>
  </Dialog>;
}

export function StudioPdfSourceDownload({ source }: { source: StudioPdfSource }) {
  const [href, setHref] = useState<string>();
  useEffect(() => {
    const localUrl = source.blob ? URL.createObjectURL(source.blob) : undefined;
    setHref(localUrl || source.dataUrl);
    return () => { if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [source.blob, source.dataUrl]);
  return href ? <a className="mt-2 block text-center text-xs font-semibold text-violet-700 underline" href={href} download={source.name}>Download unchanged source PDF</a> : null;
}

export function StudioPdfArtwork({ artwork }: { artwork: PdfArtwork }) {
  const maskId = `pdf-mask-${useId().replace(/:/g, '')}`;
  return <svg aria-label={`Protected PDF artwork, page ${artwork.pageNumber}`} className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1 }} viewBox="0 0 1000 1000" preserveAspectRatio="none">
    <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000" style={{ maskType: 'luminance' }}>
      <rect width="1000" height="1000" fill="white" />
      {artwork.cutouts.map(value => { const c = normalizePdfCutout(value); return c.shape === 'oval' ? <ellipse key={c.id} cx={(c.x + c.width / 2) * 1000} cy={(c.y + c.height / 2) * 1000} rx={c.width * 500} ry={c.height * 500} fill="black" /> : <rect key={c.id} x={c.x * 1000} y={c.y * 1000} width={c.width * 1000} height={c.height * 1000} fill="black" />; })}
    </mask></defs>
    <image href={artwork.image} width="1000" height="1000" preserveAspectRatio="none" mask={`url(#${maskId})`} />
  </svg>;
}

export function StudioPdfCutouts({ artwork, onChange, editing, setEditing }: { artwork: PdfArtwork; onChange: (cutouts: PdfCutout[]) => void; editing: boolean; setEditing: (value: boolean) => void }) {
  return <section className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-slate-800">
    <p className="flex items-center gap-2 text-xs font-bold"><Lock className="h-3.5 w-3.5" />Protected PDF · page {artwork.pageNumber}</p>

    <div className="flex flex-wrap gap-2"><Button size="sm" variant={editing ? 'secondary' : 'outline'} onClick={() => setEditing(!editing)} className="gap-1 text-xs"><Scissors className="h-3.5 w-3.5" />{editing ? 'Finish cutouts' : 'Edit cutouts'}</Button><Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { onChange([...artwork.cutouts, { id: makeStudioId('cutout'), shape: 'rectangle', x: 0.3, y: 0.3, width: 0.4, height: 0.4 }]); setEditing(true); }}><Plus className="h-3.5 w-3.5" />Add cutout</Button></div>
    {editing && artwork.cutouts.map((cutout, index) => <div key={cutout.id} className="space-y-2 rounded-lg border border-amber-200 bg-white p-2">
      <div className="flex items-center gap-2"><span className="text-xs font-bold">Opening {index + 1}</span><select aria-label={`Opening ${index + 1} shape`} className="min-w-0 flex-1 rounded border bg-white p-1 text-xs" value={cutout.shape} onChange={event => onChange(artwork.cutouts.map(c => c.id === cutout.id ? { ...c, shape: event.target.value as PdfCutout['shape'] } : c))}><option value="rectangle">Rectangle</option><option value="oval">Oval</option></select><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Delete opening ${index + 1}`} onClick={() => onChange(artwork.cutouts.filter(c => c.id !== cutout.id))}><Trash2 className="h-3.5 w-3.5" /></Button></div>
      <div className="grid grid-cols-2 gap-2">{(['x', 'y', 'width', 'height'] as const).map(key => <label key={key} className="text-[10px] capitalize">{key} %<Input aria-label={`Opening ${index + 1} ${key} percent`} className="h-8 text-xs" type="number" step="0.1" min={key === 'width' || key === 'height' ? 0.5 : 0} max="100" value={Number((cutout[key] * 100).toFixed(2))} onChange={event => { if (event.target.value !== '') onChange(artwork.cutouts.map(c => c.id === cutout.id ? normalizePdfCutout({ ...c, [key]: Number(event.target.value) / 100 }) : c)); }} /></label>)}</div>
    </div>)}
  </section>;
}

export function StudioCutoutHandles({ artwork, onChange, onGroup }: { artwork: PdfArtwork; onChange: (cutouts: PdfCutout[]) => void; onGroup: (active: boolean) => void }) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const begin = (event: PointerEvent<HTMLElement>, cutout: PdfCutout, resize: boolean) => {
    event.preventDefault(); event.stopPropagation();
    const page = event.currentTarget.closest('[data-studio-canvas]');
    if (!page) return;
    cleanup.current?.();
    const bounds = page.getBoundingClientRect(), x = event.clientX, y = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId); onGroup(true);
    const move = (next: globalThis.PointerEvent) => {
      const dx = (next.clientX - x) / bounds.width, dy = (next.clientY - y) / bounds.height;
      const changed = resize ? { ...cutout, width: cutout.width + dx, height: cutout.height + dy } : { ...cutout, x: Math.max(0, Math.min(1 - cutout.width, cutout.x + dx)), y: Math.max(0, Math.min(1 - cutout.height, cutout.y + dy)) };
      onChange(artwork.cutouts.map(c => c.id === cutout.id ? normalizePdfCutout(changed) : c));
    };
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); onGroup(false); cleanup.current = null; };
    cleanup.current = end;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  };
  return <div className="pointer-events-none absolute inset-0" style={{ zIndex: 20 }}>{artwork.cutouts.map((c, i) => <div key={c.id} aria-label={`Move opening ${i + 1}`} className="pointer-events-auto absolute cursor-move touch-none border-2 border-dashed border-amber-500" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.width * 100}%`, height: `${c.height * 100}%`, borderRadius: c.shape === 'oval' ? '50%' : 0 }} onPointerDown={event => begin(event, c, false)}><span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-amber-600 px-1 text-[10px] text-white">Opening {i + 1}</span><button type="button" aria-label={`Resize opening ${i + 1}`} className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize touch-none rounded-full border-2 border-white bg-amber-600" onPointerDown={event => begin(event, c, true)} /></div>)}</div>;
}
