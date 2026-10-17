"use client";

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Copy, Eraser, Loader2, MousePointer2, Redo2, Scissors, Undo2, WandSparkles, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoToolsClient } from '@/lib/photo/photo-tools-client';
import { StudioObjectClient } from '@/lib/photo/studio-object-client';
import type { PersonMask } from '@/lib/photo/photo-processing';
import { combineSelection, extractSelectedPixels, MAX_SELECTION_FEATHER, normalizeSelectionFeather, paintSelectionStroke, refineSelection, selectConnectedColour, selectPolygon, selectRegion, type SelectionMode, type SelectionPoint } from './studio-selection';

export type StudioPixelAction = 'mask' | 'copy' | 'cut';
export interface StudioPixelResult { action: StudioPixelAction; selected: string; remainder?: string }
type Tool = 'object' | 'wand' | 'polygon' | 'rectangle' | 'ellipse' | 'addBrush' | 'eraseBrush' | 'pan';
const TOOLS: Array<{ value: Tool; label: string }> = [
  { value: 'object', label: 'AI object' }, { value: 'wand', label: 'Colour wand' }, { value: 'polygon', label: 'Polygon' },
  { value: 'rectangle', label: 'Rectangle' }, { value: 'ellipse', label: 'Ellipse' }, { value: 'addBrush', label: 'Add brush' }, { value: 'eraseBrush', label: 'Subtract brush' },
  { value: 'pan', label: 'Pan / scroll' },
];

function confidenceSelection(value: PersonMask, width: number, height: number) {
  const small = document.createElement('canvas'); small.width = value.width; small.height = value.height;
  const ctx = small.getContext('2d')!, data = ctx.createImageData(small.width, small.height);
  for (let i = 0; i < value.confidence.length; i++) {
    const confidence = Math.max(0, Math.min(1, (value.confidence[i] - 0.05) / 0.9));
    data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = 255;
    data.data[i * 4 + 3] = confidence * 255;
  }
  ctx.putImageData(data, 0, 0);
  const large = document.createElement('canvas'); large.width = width; large.height = height;
  const out = large.getContext('2d', { willReadFrequently: true })!;
  out.imageSmoothingEnabled = true; out.imageSmoothingQuality = 'high'; out.drawImage(small, 0, 0, width, height);
  const pixels = out.getImageData(0, 0, width, height).data;
  const result = new Uint8ClampedArray(width * height);
  for (let i = 0; i < result.length; i++) result[i] = pixels[i * 4 + 3];
  return result;
}

export function StudioLayerEditor({ source, label, pupilName, onClose, onApply }: { source: HTMLCanvasElement; label: string; pupilName?: string; onClose: () => void; onApply: (result: StudioPixelResult) => void }) {
  const { width, height } = source;
  const original = useMemo(() => source.getContext('2d')!.getImageData(0, 0, width, height), [source, width, height]);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const personRef = useRef<PhotoToolsClient>();
  const objectRef = useRef<StudioObjectClient>();
  const alive = useRef(true);
  const [tool, setTool] = useState<Tool>('object');
  const [mode, setMode] = useState<SelectionMode>('replace');
  const [mask, setMask] = useState<Uint8ClampedArray>(() => new Uint8ClampedArray(width * height));
  const maskRef = useRef(mask); maskRef.current = mask;
  const [revision, setRevision] = useState(0);
  const [past, setPast] = useState<Uint8ClampedArray[]>([]), [future, setFuture] = useState<Uint8ClampedArray[]>([]);
  const [points, setPoints] = useState<SelectionPoint[]>([]);
  const [gesture, setGesture] = useState<{ start: SelectionPoint; last: SelectionPoint; base: Uint8ClampedArray; working?: Uint8ClampedArray }>();
  const [brush, setBrush] = useState(32), [tolerance, setTolerance] = useState(15);
  const [feather, setFeather] = useState(0), [shift, setShift] = useState(0);
  const [view, setView] = useState<'selection' | 'result' | 'original'>('selection');
  const changeFeather = (value: number) => { setFeather(normalizeSelectionFeather(value)); setView('result'); };
  const [backdrop, setBackdrop] = useState('checker');
  const [zoom, setZoom] = useState(1);
  const [showTools, setShowTools] = useState(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const frameRef = useRef<number>();
  useEffect(() => { alive.current = true; return () => { alive.current = false; personRef.current?.dispose(); objectRef.current?.dispose(); personRef.current = undefined; objectRef.current = undefined; if (frameRef.current) cancelAnimationFrame(frameRef.current); }; }, []);
  const refined = useMemo(() => refineSelection(mask, width, height, feather, shift), [mask, width, height, feather, shift, revision]);
  const hasSelection = refined.some((value, index) => value > 0 && original.data[index * 4 + 3] > 0);
  useEffect(() => {
    // Radix mounts portal content after this component's first effect. Observe
    // the canvas node so its initial pixels are also drawn on that later mount.
    const canvas = previewCanvas; if (!canvas) return;
    const context = canvas.getContext('2d')!, result = new Uint8ClampedArray(original.data);
    if (view === 'result') result.set(extractSelectedPixels(original.data, refined));
    if (view === 'selection') for (let i = 0; i < refined.length; i++) {
      const alpha = refined[i] / 255 * 0.45;
      result[i * 4] = result[i * 4] * (1 - alpha);
      result[i * 4 + 1] = result[i * 4 + 1] * (1 - alpha) + 200 * alpha;
      result[i * 4 + 2] = result[i * 4 + 2] * (1 - alpha) + 255 * alpha;
    }
    context.putImageData(new ImageData(result, width, height), 0, 0);
  }, [previewCanvas, original, refined, view, width, height, revision]);

  const commit = (next: Uint8ClampedArray, combine = true) => {
    setPast(items => [...items, maskRef.current].slice(-12)); setFuture([]);
    setMask(combine ? combineSelection(maskRef.current, next, mode) : next); setError('');
  };
  const undo = () => { const previous = past.at(-1); if (!previous) return; setFuture(items => [maskRef.current, ...items].slice(0, 12)); setPast(items => items.slice(0, -1)); setMask(previous); };
  const redo = () => { const next = future[0]; if (!next) return; setPast(items => [...items, maskRef.current].slice(-12)); setFuture(items => items.slice(1)); setMask(next); };
  const runAi = async (point?: SelectionPoint) => {
    if (busy) return;
    setBusy(point ? 'Selecting the object…' : 'Separating the person from the background…'); setError('');
    try {
      let result: PersonMask;
      if (point) { objectRef.current ||= new StudioObjectClient(); result = await objectRef.current.select(source, point); }
      else { personRef.current ||= new PhotoToolsClient(); result = await personRef.current.segment(source); }
      if (!alive.current) return;
      if (!point) {
        setBusy('Refining hair and subject edges…');
        objectRef.current ||= new StudioObjectClient();
        result = await objectRef.current.refine(source, result);
        if (!alive.current) return;
      }
      const selected = confidenceSelection(result, width, height);
      if (!selected.some((v, i) => v > 128 && original.data[i * 4 + 3] > 0)) throw new Error('No clear subject was found. Click inside an object or use the brush and polygon tools.');
      commit(selected); if (!point) setView('result');
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Automatic selection failed. Manual tools remain available.'); }
    finally { if (alive.current) setBusy(''); }
  };
  const pointFrom = (event: ReactPointerEvent<HTMLCanvasElement>): SelectionPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
  };
  const updateBrush = (working: Uint8ClampedArray, from: SelectionPoint, to: SelectionPoint) => {
    paintSelectionStroke(working, width, height, from, to, brush / 2, tool === 'eraseBrush');
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => { frameRef.current = undefined; setRevision(value => value + 1); });
  };
  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (busy || tool === 'pan' || event.button !== 0) return;
    const point = pointFrom(event); event.preventDefault(); setError('');
    if (tool === 'object') { void runAi(point); return; }
    if (tool === 'wand') { commit(selectConnectedColour(original.data, width, height, point, tolerance)); return; }
    if (tool === 'polygon') { setPoints(current => [...current, point]); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'addBrush' || tool === 'eraseBrush') {
      const working = new Uint8ClampedArray(maskRef.current);
      setPast(items => [...items, maskRef.current].slice(-12)); setFuture([]); setMask(working);
      updateBrush(working, point, point); setGesture({ start: point, last: point, base: maskRef.current, working });
    } else setGesture({ start: point, last: point, base: maskRef.current });
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!gesture || busy) return;
    const point = pointFrom(event);
    if (gesture.working) updateBrush(gesture.working, gesture.last, point);
    setGesture({ ...gesture, last: point });
  };
  const finishGesture = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!gesture) return;
    if (!gesture.working) commit(selectRegion(width, height, gesture.start, pointFrom(event), tool === 'ellipse'));
    else setMask(new Uint8ClampedArray(gesture.working));
    setGesture(undefined);
  };
  const finishPolygon = () => { if (points.length >= 3) { commit(selectPolygon(width, height, points)); setPoints([]); } };
  const apply = (action: StudioPixelAction) => {
    if (!hasSelection || busy || points.length) return;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.putImageData(new ImageData(extractSelectedPixels(original.data, refined), width, height), 0, 0);
    const selected = canvas.toDataURL('image/png');
    let remainder: string | undefined;
    if (action === 'cut') { context.putImageData(new ImageData(extractSelectedPixels(original.data, refined, false), width, height), 0, 0); remainder = canvas.toDataURL('image/png'); }
    onApply({ action, selected, remainder });
  };
  const numberControl = (label: string, value: number, min: number, max: number, change: (value: number) => void) => <label className="space-y-1 text-xs font-medium"><span>{label}: {value}</span><input className="w-full accent-violet-600" type="range" aria-label={label} value={value} min={min} max={max} onChange={event => change(Number(event.target.value))} disabled={!!busy} /></label>;
  return <Dialog.Root open onOpenChange={value => { if (!value) onClose(); }}><Dialog.Portal><Dialog.Content asChild onEscapeKeyDown={event => { if (points.length) { event.preventDefault(); setPoints([]); } }}>
    <div className="fixed inset-0 z-[70] isolate flex flex-col bg-slate-100 pb-[env(safe-area-inset-bottom)] text-slate-900 print:hidden [&_button]:min-h-11" aria-label="Layer selection workspace" onKeyDown={event => {
      const editing = (event.target as HTMLElement).closest('input,select,textarea');
      if ((event.ctrlKey || event.metaKey) && ['z', 'y', 'j'].includes(event.key.toLowerCase())) {
        event.stopPropagation(); if (editing) return; event.preventDefault(); if (busy) return;
        if (event.key.toLowerCase() === 'j') apply(event.shiftKey ? 'cut' : 'copy'); else if (event.shiftKey || event.key.toLowerCase() === 'y') redo(); else undo();
      }
      if (event.key === 'Enter' && !editing && points.length >= 3) { event.preventDefault(); finishPolygon(); }
    }}>
      <header className="grid max-h-[35dvh] shrink-0 grid-cols-[40px_minmax(0,1fr)_64px] items-center gap-2 overflow-auto border-b border-slate-200 bg-white px-4 py-3 lg:flex lg:gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><MousePointer2 className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><Dialog.Title className="truncate text-sm font-bold">Select & refine · {label}</Dialog.Title><Dialog.Description className="mt-1 truncate text-xs text-slate-500">{pupilName ? `${pupilName} · template-only photo edit` : 'Select an object, refine its edges and keep, copy or cut it into a layer.'}</Dialog.Description></div>
        <Button variant="outline" size="sm" className="col-span-2 col-start-1 row-start-2 lg:shrink-0" aria-label="Remove photo background" disabled={!!busy} onClick={() => void runAi()}><WandSparkles className="mr-2 h-4 w-4 shrink-0" /><span className="lg:hidden">Remove background</span><span className="hidden lg:inline">Remove photo background</span></Button>
        <Button variant="outline" size="sm" className="col-start-3 row-start-2 px-2 lg:hidden" aria-label="Tools & refine" aria-expanded={showTools} onClick={() => setShowTools(value => !value)}>Tools</Button>
        <Button variant="ghost" size="icon" className="col-start-3 row-start-1 justify-self-end lg:shrink-0" aria-label="Close selection workspace" onClick={onClose}><X className="h-5 w-5" /></Button>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[260px_minmax(0,1fr)] lg:overflow-hidden">
        <aside className={`${showTools ? 'block' : 'hidden'} space-y-4 border-r border-slate-200 bg-white p-4 lg:block lg:overflow-auto`}>
          <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Selection tools</p><div className="grid grid-cols-2 gap-2">{TOOLS.map(item => <Button key={item.value} size="sm" variant={tool === item.value ? 'secondary' : 'outline'} disabled={!!busy} aria-pressed={tool === item.value} onClick={() => { setTool(item.value); setPoints([]); setGesture(undefined); if (innerWidth < 1024) setShowTools(false); }} className="h-10 px-2 text-xs">{item.label}</Button>)}</div></div>
          <label className="block space-y-1 text-xs font-medium">Selection mode<select aria-label="Selection mode" className="h-10 w-full rounded-md border border-slate-200 bg-white px-2" value={mode} onChange={event => setMode(event.target.value as SelectionMode)} disabled={!!busy}><option value="replace">Replace selection</option><option value="add">Add to selection</option><option value="subtract">Subtract from selection</option></select></label>
          <p className="text-xs leading-relaxed text-slate-500">{tool === 'pan' ? 'Swipe to scroll the image on a touchscreen. You can also use the scrollbars or a trackpad while zoomed in.' : tool === 'object' ? 'Click or tap inside the object to select it automatically. Use brushes to restore or remove fine details.' : tool === 'polygon' ? 'Mark points around the object, then close the polygon or press Enter.' : tool === 'wand' ? 'Tap a colour to select its connected region. Increase tolerance for similar colours.' : tool === 'addBrush' || tool === 'eraseBrush' ? 'Paint across the image. Each stroke is one undo step.' : 'Drag across the image to mark a selection.'}</p>
          {tool === 'polygon' && <Button className="w-full" variant="outline" disabled={points.length < 3 || !!busy} onClick={finishPolygon}>Close polygon ({points.length} points)</Button>}
          {(tool === 'addBrush' || tool === 'eraseBrush') && numberControl('Brush size', brush, 2, 200, setBrush)}
          {tool === 'wand' && numberControl('Colour tolerance', tolerance, 0, 100, setTolerance)}
          <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" disabled={!!busy} onClick={() => commit(new Uint8ClampedArray(width * height).fill(255), false)}>Select all</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => commit(mask.map(value => 255 - value), false)}>Invert</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => commit(new Uint8ClampedArray(width * height), false)}>Clear</Button><div className="flex gap-1"><Button size="icon" variant="outline" disabled={!past.length || !!busy} aria-label="Undo selection" onClick={undo}><Undo2 className="h-4 w-4" /></Button><Button size="icon" variant="outline" disabled={!future.length || !!busy} aria-label="Redo selection" onClick={redo}><Redo2 className="h-4 w-4" /></Button></div></div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold">Refine edge</p>{numberControl('Expand or contract edge', shift, -12, 12, setShift)}<p className="text-[11px] text-slate-500">Use the feather control above the preview to soften the cut. Preview on light and dark backgrounds to check hair, outlines and fine edges.</p></div>
          <p className="text-[11px] leading-relaxed text-slate-500">Automatic person and object masks are estimates. Brush and polygon tools give manual control. Photos stay on this device; the first AI use downloads the processing tools.</p>
        </aside>
        <section className="flex min-h-[500px] min-w-0 flex-col lg:min-h-0">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3"><label className="text-xs">Preview<select aria-label="Selection preview" className="ml-2 h-9 rounded-md border bg-white px-2" value={view} onChange={event => setView(event.target.value as typeof view)}><option value="selection">Selection overlay</option><option value="result">Transparent result</option><option value="original">Original layer</option></select></label><label className="text-xs">Backdrop<select aria-label="Selection backdrop" className="ml-2 h-9 rounded-md border bg-white px-2" value={backdrop} onChange={event => setBackdrop(event.target.value)}><option value="checker">Transparency grid</option><option value="#ffffff">White</option><option value="#111827">Dark</option><option value="#10b981">Green</option></select></label><div className="ml-auto flex items-center gap-1"><Button size="icon" variant="ghost" aria-label="Zoom selection out" onClick={() => setZoom(value => Math.max(0.25, value - 0.25))}><ZoomOut className="h-4 w-4" /></Button><span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span><Button size="icon" variant="ghost" aria-label="Zoom selection in" onClick={() => setZoom(value => Math.min(4, value + 0.25))}><ZoomIn className="h-4 w-4" /></Button></div></div>
          <div className="shrink-0 space-y-1 border-b border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-3">
              <label className="flex shrink-0 items-center gap-2 text-xs font-semibold">Feather
                <input type="number" aria-label="Feather amount" aria-describedby="studio-feather-help" className="h-11 w-16 rounded-md border border-slate-200 bg-white px-2 font-normal tabular-nums" min={0} max={MAX_SELECTION_FEATHER} step={1} value={feather} onChange={event => changeFeather(event.currentTarget.valueAsNumber)} disabled={!!busy} />
                <span className="font-normal text-slate-500">px</span>
              </label>
              <input type="range" aria-label="Feather edge" aria-describedby="studio-feather-help" className="h-11 min-w-0 flex-1 accent-violet-600" min={0} max={MAX_SELECTION_FEATHER} step={1} value={feather} onChange={event => changeFeather(Number(event.currentTarget.value))} disabled={!!busy} />
            </div>
            <p id="studio-feather-help" className="text-[11px] leading-relaxed text-slate-500">0–{MAX_SELECTION_FEATHER} image pixels · Applies to background removal, cut and copy. Zero adds no softening; AI hair detail is preserved.</p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5"><div className="relative mx-auto shadow-xl" style={{ width: `min(${zoom * 100}%, ${Math.min(width, 900) * zoom}px)`, minWidth: zoom > 1 ? `${zoom * 85}%` : undefined, background: backdrop === 'checker' ? 'conic-gradient(#cbd5e1 25%, #fff 0 50%, #cbd5e1 0 75%, #fff 0) 0 0 / 20px 20px' : backdrop }}>
            <canvas ref={setPreviewCanvas} aria-label="Layer selection canvas" width={width} height={height} className="block h-auto w-full touch-none" style={{ cursor: tool === 'pan' ? 'grab' : tool.includes('Brush') ? 'cell' : 'crosshair', touchAction: tool === 'pan' ? 'pan-x pan-y' : 'none' }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finishGesture} onPointerCancel={() => { if (gesture) { setMask(gesture.base); setGesture(undefined); } }} />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              {points.length > 0 && <polyline points={points.map(point => `${point.x * 1000},${point.y * 1000}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
              {gesture && !gesture.working && (tool === 'ellipse' ? <ellipse cx={(gesture.start.x + gesture.last.x) * 500} cy={(gesture.start.y + gesture.last.y) * 500} rx={Math.abs(gesture.start.x - gesture.last.x) * 500} ry={Math.abs(gesture.start.y - gesture.last.y) * 500} fill="none" stroke="#06b6d4" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : <rect x={Math.min(gesture.start.x, gesture.last.x) * 1000} y={Math.min(gesture.start.y, gesture.last.y) * 1000} width={Math.abs(gesture.start.x - gesture.last.x) * 1000} height={Math.abs(gesture.start.y - gesture.last.y) * 1000} fill="none" stroke="#06b6d4" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
            </svg>
          </div></div>
          {(busy || error) && <div className="shrink-0 border-t bg-white px-4 py-3">{busy && <p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" />{busy}</p>}{error && <p role="alert" className="text-xs text-red-700">{error}</p>}</div>}
        </section>
      </main>
      <footer className="flex max-h-[30dvh] shrink-0 flex-wrap items-center justify-end gap-2 overflow-auto border-t border-slate-200 bg-white px-4 py-3"><span className="mr-auto text-xs text-slate-500">PNG transparency · original record unchanged{pupilName ? ` · ${pupilName} only` : ''}</span><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="outline" disabled={!hasSelection || !!busy || !!gesture || !!points.length} onClick={() => apply('copy')}><Copy className="mr-2 h-4 w-4" />Layer via copy</Button><Button variant="outline" disabled={!hasSelection || !!busy || !!gesture || !!points.length} onClick={() => apply('cut')}><Scissors className="mr-2 h-4 w-4" />Layer via cut</Button><Button className="h-auto whitespace-normal text-left" disabled={!hasSelection || !!busy || !!gesture || !!points.length} onClick={() => apply('mask')}><Eraser className="mr-2 h-4 w-4 shrink-0" />Keep selection / remove background</Button></footer>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
