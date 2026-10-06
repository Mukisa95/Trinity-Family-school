"use client";

import React, { useEffect, useId, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

/** Equal thumb travel means equal proportional zoom instead of large jumps at 1x. */
export function PhotoZoomControl({ zoom, disabled, onChange, onInteraction }: {
  zoom: number; disabled: boolean; onChange: (zoom: number) => void; onInteraction: (active: boolean) => void;
}) {
  const id = useId(), frame = useRef<number>(), pending = useRef(zoom), change = useRef(onChange);
  change.current = onChange;
  useEffect(() => () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); }, []);
  function setZoom(value: number) {
    pending.current = Math.max(1, Math.min(16, value));
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => { frame.current = undefined; change.current(pending.current); });
  }
  function finishInteraction() {
    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current); frame.current = undefined; change.current(pending.current);
    }
    onInteraction(false);
  }
  return <div className="min-w-0 flex-1">
    <div className="flex items-center justify-between text-xs text-slate-300"><label htmlFor={id}>Zoom</label><output className="tabular-nums">{zoom.toFixed(3)}×</output></div>
    <div className="flex items-center gap-1">
    <button type="button" aria-label="Zoom out slightly" disabled={disabled || zoom <= 1} onClick={() => setZoom(zoom / 1.002)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-30"><Minus aria-hidden className="h-4 w-4" /></button>
    <input id={id} aria-label="Zoom" aria-valuetext={`${zoom.toFixed(3)} times`} type="range" min={0} max={1} step={0.0001}
      value={Math.log(Math.max(1, Math.min(16, zoom))) / Math.log(16)} disabled={disabled}
      className="block h-11 min-w-0 flex-1 cursor-pointer accent-sky-400"
      onPointerDown={() => onInteraction(true)} onPointerUp={finishInteraction} onPointerCancel={finishInteraction} onBlur={finishInteraction}
      onInput={event => setZoom(16 ** Number(event.currentTarget.value))}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); setZoom((frame.current === undefined ? zoom : pending.current) + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1) * (event.shiftKey ? 0.01 : 0.001));
      }} />
    <button type="button" aria-label="Zoom in slightly" disabled={disabled || zoom >= 16} onClick={() => setZoom(zoom * 1.002)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-30"><Plus aria-hidden className="h-4 w-4" /></button>
    </div>
  </div>;
}
