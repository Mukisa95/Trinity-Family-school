"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Cropper, { type Area, type Point, type Size } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import { ExternalPhotoEditor } from "./external-photo-editor";
import { PhotoZoomControl } from "./photo-zoom-control";
import { RotateCcw, Check, X, Circle, Square, ArrowLeft, Crop, SlidersHorizontal, Palette, Eraser, Eye, AlertTriangle, Loader2 } from "lucide-react";
import { createEnhancedPupilPhoto, createImage } from "./photo-editor-utils";
import { PhotoToolsClient } from "@/lib/photo/photo-tools-client";
import { DEFAULT_PHOTO_SETTINGS, PHOTO_FILTERS, findHeadTop, suggestFaceCrop, type PhotoFace, type PhotoSettings, type PassportFraming } from "@/lib/photo/photo-processing";

type EditorPanel = "crop" | "enhance" | "filters" | "background";
const PANELS = [{ id: "crop", label: "Crop", icon: Crop }, { id: "enhance", label: "Enhance", icon: SlidersHorizontal },
  { id: "filters", label: "Filters", icon: Palette }, { id: "background", label: "Background", icon: Eraser }] as const;
const ADJUSTMENTS = [['brightness', 'Brightness', -30, 30], ['contrast', 'Contrast', -30, 30],
  ['shadows', 'Shadows', -40, 40], ['highlights', 'Highlights', -40, 40], ['saturation', 'Saturation', -30, 30],
  ['warmth', 'Warmth', -20, 20], ['tint', 'Tint', -20, 20], ['sharpness', 'Sharpness', 0, 50], ['smoothing', 'Smoothing', 0, 50]] as const;

interface PhotoCropEditorProps {
  imageSrc: string;
  title: string;
  crop: Point;
  zoom: number;
  isProcessing?: boolean;
  onCropChange: (crop: Point) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void;
  onCancel: () => void;
  onReset: () => void;
  onSave: (photo: string) => void;
  onImportEdited?: (file?: File) => Promise<void>;
}

export function PhotoCropEditor({ imageSrc, title, crop, zoom, isProcessing = false,
  onCropChange, onZoomChange, onCropComplete, onCancel, onReset, onSave, onImportEdited }: PhotoCropEditorProps) {
  const id = useId();
  const [panel, setPanel] = useState<EditorPanel>("crop");
  const [framing, setFraming] = useState<PassportFraming>("standard");
  const framingRef = useRef<PassportFraming>("standard");
  const [guide, setGuide] = useState<"circle" | "square">("circle");
  const [qualityOpen, setQualityOpen] = useState(false);
  const panelScroll = useRef<HTMLDivElement>(null);
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number }>();
  const [headTop, setHeadTop] = useState<number>();
  const tools = useRef<PhotoToolsClient | null>(null);
  const userPositioned = useRef(false);
  const [settings, setSettings] = useState({ ...DEFAULT_PHOTO_SETTINGS });
  const [area, setArea] = useState<Area | null>(null);
  const [stage, setStage] = useState<"crop" | "review">("crop");
  const [cropSize, setCropSize] = useState<Size>();
  const [interacting, setInteracting] = useState(false);
  const [face, setFace] = useState<PhotoFace>();
  const [initialArea, setInitialArea] = useState<Area>();
  const [revision, setRevision] = useState(0);
  const [faceStatus, setFaceStatus] = useState("Preparing automatic framing…");
  const [prepared, setPrepared] = useState<(Awaited<ReturnType<typeof createEnhancedPupilPhoto>> & {
    source: string; area: Area; settings: typeof settings; face?: PhotoFace;
  }) | null>(null);
  const [error, setError] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [retry, setRetry] = useState(0);
  const [isPreparing, setIsPreparing] = useState(true);
  const generation = useRef(0);

  useEffect(() => { if (panelScroll.current) panelScroll.current.scrollTop = 0; }, [panel]);

  useEffect(() => {
    let active = true;
    const client = new PhotoToolsClient(); tools.current = client;
    userPositioned.current = false;
    setPrepared(null); setFace(undefined); setInitialArea(undefined); setHeadTop(undefined); setSourceSize(undefined);
    setSettings({ ...DEFAULT_PHOTO_SETTINGS }); setStage("crop"); setShowOriginal(false);
    setFaceStatus("Framing…"); setPanel("crop"); setGuide("circle"); setFraming("standard"); framingRef.current = "standard"; setQualityOpen(false);
    void (async () => {
      const image = await createImage(imageSrc);
      if (!active) return;
      setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
      const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      const faces = await client.detect(canvas);
      if (!active) return;
      if (faces.length !== 1) {
        setFaceStatus(faces.length ? "Several faces found" : "Face not found");
        return;
      }
      const detected = faces[0];
      const sourceFace = { x: detected.x / scale, y: detected.y / scale, width: detected.width / scale,
        height: detected.height / scale, eyesY: detected.eyesY === undefined ? undefined : detected.eyesY / scale };
      setFace(sourceFace);
      // The silhouette can locate the crown more accurately than face bounds.
      // A missing model leaves the face-based passport crop available.
      let measuredHeadTop: number | undefined;
      try {
        const mask = await client.segment(canvas);
        const top = findHeadTop(mask, detected, canvas.width, canvas.height);
        if (top !== undefined) measuredHeadTop = top / scale;
      } catch { /* Manual framing and normal enhancements remain available. */ }
      if (!active) return;
      setHeadTop(measuredHeadTop);
      const suggested = { ...suggestFaceCrop(sourceFace, image.naturalWidth, image.naturalHeight, measuredHeadTop, framingRef.current) } as Area;
      if (!userPositioned.current) { setInitialArea(suggested); setRevision(value => value + 1); }
      setFaceStatus(sourceFace.height < 160 ? "Low face detail" : "Ready");
    })().catch(() => { if (active) setFaceStatus("Auto framing unavailable"); });
    return () => { active = false; generation.current++; client.dispose(); tools.current = null; };
  }, [imageSrc]);

  useEffect(() => {
    const request = ++generation.current;
    setPrepared(null); setError(""); setIsPreparing(true);
    if (!area) return;
    const timer = setTimeout(() => {
      const client = tools.current;
      if (!client) return;
      void createEnhancedPupilPhoto(imageSrc, area, settings, client, face).then(result => {
        if (request === generation.current) { setPrepared({ ...result, source: imageSrc, area, settings, face }); setIsPreparing(false); }
      }).catch(cause => {
        if (request === generation.current) { setError(cause instanceof Error ? cause.message : "Unable to prepare photo."); setIsPreparing(false); }
      });
    }, 250);
    return () => { clearTimeout(timer); generation.current++; };
  }, [imageSrc, area, settings, face, retry]);

  function applyFraming(value: PassportFraming) {
    setFraming(value); framingRef.current = value; setShowOriginal(false);
    if (face && sourceSize) {
      userPositioned.current = true;
      setInitialArea(suggestFaceCrop(face, sourceSize.width, sourceSize.height, headTop, value) as Area);
      setRevision(previous => previous + 1);
    }
  }
  function reset() {
    userPositioned.current = true;
    setSettings({ ...DEFAULT_PHOTO_SETTINGS }); setShowOriginal(false); setStage("crop"); setPanel("crop");
    setFraming("standard"); framingRef.current = "standard";
    setInitialArea(face && sourceSize ? suggestFaceCrop(face, sourceSize.width, sourceSize.height, headTop) as Area : undefined);
    setRevision(value => value + 1); onReset();
  }
  const busy = isPreparing || isProcessing;
  const preview = prepared?.source === imageSrc && prepared.area === area && prepared.settings === settings && prepared.face === face ? prepared : null;
  const issues = [...(preview?.warnings ?? [])];
  if (faceStatus !== "Ready" && faceStatus !== "Framing…" && !faceStatus.startsWith("Preparing")) issues.push({ code: "framing", message: faceStatus });
  const secondary = "min-h-11 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white focus-visible:ring-sky-400";
  const selected = "border-sky-400/80 bg-sky-400/15 text-sky-100";
  function update(key: keyof PhotoSettings, value: number | boolean | string) {
    setShowOriginal(false); setSettings(previous => ({ ...previous, [key]: value }));
  }
  function openCrop() { setInitialArea(area ?? undefined); setStage("crop"); setPanel("crop"); }
  function slider(key: keyof PhotoSettings, label: string, min: number, max: number) {
    const value = Number(settings[key] ?? 0);
    return <label key={key} htmlFor={`${id}-${key}`} className="block">
      <span className="flex items-center justify-between text-sm"><span>{label}</span><output className="tabular-nums text-slate-300">{value > 0 && min < 0 ? "+" : ""}{value}</output></span>
      <input id={`${id}-${key}`} type="range" min={min} max={max} step={1} value={value} disabled={isProcessing} aria-label={label}
        onChange={event => update(key, Number(event.target.value))} className="block h-11 w-full cursor-pointer accent-sky-400" />
    </label>;
  }

  return (
    <div className="pupil-photo-editor flex h-[100dvh] min-h-0 flex-col bg-slate-950 text-white">
      <style>{`@media (min-width: 960px), (max-height: 500px) and (min-width: 600px) {
        .pupil-photo-editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(290px, 360px); grid-template-rows: auto minmax(0, 1fr) auto; }
        .pupil-photo-editor > .photo-editor-header, .pupil-photo-editor > .photo-editor-actions { grid-column: 1 / -1; }
        .pupil-photo-editor > .photo-editor-controls { height: auto; min-height: 0; border-top: 0; border-left: 1px solid rgb(255 255 255 / .1); }
      }`}</style>
      <header className="photo-editor-header shrink-0 border-b border-white/10 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          {stage === "review" && <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={openCrop} disabled={isProcessing} aria-label="Back to crop"><ArrowLeft className="h-5 w-5" /></Button>}
          <div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2></div>
          <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 rounded-xl text-slate-200 hover:bg-white/10 hover:text-white"
            aria-label={showOriginal ? "Show enhanced" : "Compare original"} aria-pressed={showOriginal} disabled={!preview || isProcessing} onClick={() => setShowOriginal(value => !value)}><Eye className="h-5 w-5" /></Button>
          <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 rounded-xl text-slate-200 hover:bg-white/10 hover:text-white"
            onClick={onCancel} disabled={isProcessing} aria-label="Close photo editor"><X className="h-5 w-5" /></Button>
        </div>
      </header>

      <div className="photo-editor-preview relative min-h-0 flex-1 overflow-hidden bg-slate-900">
        {stage === "crop" ? <div className="relative h-full w-full" onPointerDown={() => { userPositioned.current = true; }}>
          <Cropper key={revision} image={imageSrc} crop={crop} zoom={zoom} maxZoom={16} aspect={1} cropShape={guide === "circle" ? "round" : "rect"}
            showGrid initialCroppedAreaPixels={initialArea} onCropChange={onCropChange} onZoomChange={onZoomChange} onCropSizeChange={setCropSize}
            onInteractionStart={() => setInteracting(true)} onInteractionEnd={() => setInteracting(false)}
            onCropAreaChange={(_percentages, pixels) => {
              setArea(previous => previous && previous.x === pixels.x && previous.y === pixels.y && previous.width === pixels.width && previous.height === pixels.height ? previous : pixels);
            }}
            onCropComplete={(percentages, pixels) => {
              onCropComplete(percentages, pixels);
              setArea(previous => previous && previous.x === pixels.x && previous.y === pixels.y && previous.width === pixels.width && previous.height === pixels.height ? previous : pixels);
            }} />
          {preview && cropSize && !interacting && <div className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden ${guide === "circle" ? "rounded-full" : "rounded-none"}`}
            style={{ width: cropSize.width, height: cropSize.height }}>
            <img src={showOriginal ? preview.original : preview.photo} alt={showOriginal ? "Original crop preview" : "Enhanced crop preview"} className="h-full w-full" />
            <div aria-hidden="true" className="absolute inset-0 grid grid-cols-3 grid-rows-3 border border-white/50">{Array.from({ length: 9 }, (_, index) => <span key={index} className="border border-white/20" />)}</div>
          </div>}
        </div> : <div className="flex h-full items-center justify-center p-4" aria-busy={isPreparing}>
          {preview ? <img src={showOriginal ? preview.original : preview.photo} alt={showOriginal ? "Original cropped photo" : "Finished pupil photo"} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" /> : null}
        </div>}
        <span role="status" className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-slate-950/90 px-3 py-1.5 text-xs text-slate-200">
          {busy && !interacting && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}
          {interacting ? "Adjusting…" : error ? "Preview unavailable" : !preview ? "Processing…" : showOriginal ? "Original" : stage === "review" ? "500 × 500 · JPEG" : "Preview"}
        </span>
        {issues.length > 0 && <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
          <Button type="button" variant="outline" className="min-h-11 rounded-xl border-amber-300/30 bg-slate-950/95 text-amber-200 hover:bg-slate-900 hover:text-amber-100"
            aria-label={`Photo quality: ${issues.length} ${issues.length === 1 ? "issue" : "issues"}`} aria-expanded={qualityOpen} aria-controls={`${id}-quality`} onClick={() => setQualityOpen(value => !value)}><AlertTriangle className="h-4 w-4" />{issues.length}</Button>
          {qualityOpen && <aside id={`${id}-quality`} aria-label="Photo quality issues" className="max-h-44 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-amber-300/20 bg-slate-950/95 p-3 shadow-xl"><ul className="space-y-2 text-sm text-amber-100">{issues.map(issue => <li key={issue.code}>{issue.message}</li>)}</ul></aside>}
        </div>}
        {error && <div role="alert" className="absolute inset-x-3 bottom-12 z-20 rounded-xl border border-red-300/20 bg-slate-950/95 p-3 text-sm text-red-200">{error}<Button type="button" variant="ghost" className="ml-2 min-h-11 text-white" onClick={() => setRetry(value => value + 1)}>Try again</Button></div>}
      </div>

      <section className="photo-editor-controls flex h-[clamp(264px,38dvh,320px)] shrink-0 flex-col overflow-hidden border-t border-white/10 bg-slate-950" aria-label="Photo tools">
        <div role="tablist" aria-label="Photo tools" className="grid shrink-0 grid-cols-4 gap-1 border-b border-white/10 p-2">
          {PANELS.map(({ id: value, label, icon: Icon }, index) => <button key={value} id={`${id}-tab-${value}`} type="button" role="tab" aria-selected={panel === value} aria-controls={`${id}-panel`} tabIndex={panel === value ? 0 : -1} disabled={isProcessing}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50 ${panel === value ? "bg-sky-400/15 text-sky-200" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
            onClick={() => { setPanel(value); if (value === "crop" && stage === "review") openCrop(); }}
            onKeyDown={event => {
              const next = event.key === "ArrowRight" ? (index + 1) % 4 : event.key === "ArrowLeft" ? (index + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : undefined;
              if (next === undefined) return;
              event.preventDefault(); const value = PANELS[next].id; setPanel(value); if (value === "crop" && stage === "review") openCrop(); document.getElementById(`${id}-tab-${value}`)?.focus();
            }}><Icon aria-hidden className="h-4 w-4" /><span>{label}</span></button>)}
        </div>
        <div ref={panelScroll} role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${panel}`} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {panel === "crop" && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {([['auto', 'Auto enhance'], ['removeBackground', 'Remove background']] as const).map(([key, label]) => <label key={key} className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border px-2 text-xs font-medium ${settings[key] ? selected : 'border-white/15 bg-white/5 text-slate-200'}`}>
                <span>{label}</span><input type="checkbox" checked={!!settings[key]} disabled={isProcessing} onChange={event => update(key, event.target.checked)} className="h-4 w-4 shrink-0 accent-sky-400" />
              </label>)}
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Passport framing">
              {([['tight', 'Tight'], ['standard', 'Standard'], ['headroom', 'Headroom']] as const).map(([value, label]) => <Button key={value} type="button" variant="outline" aria-pressed={framing === value} disabled={isProcessing} className={`${secondary} px-2 ${framing === value ? selected : ""}`} onClick={() => applyFraming(value)}>{label}</Button>)}
            </div>
            <div className="flex items-center gap-3">
              <PhotoZoomControl zoom={zoom} disabled={isProcessing} onInteraction={setInteracting} onChange={value => { userPositioned.current = true; onZoomChange(value); }} />
              <div className="flex shrink-0 gap-2" role="group" aria-label="Crop guide">
                {([['circle', 'Circle', Circle], ['square', 'Square', Square]] as const).map(([value, label, Icon]) => <Button key={value} type="button" variant="outline" className={`${secondary} w-11 px-0 ${guide === value ? selected : ""}`} aria-label={`${label} crop guide`} aria-pressed={guide === value} disabled={isProcessing} onClick={() => setGuide(value)}><Icon aria-hidden className="h-5 w-5" /></Button>)}
              </div>
            </div>
          </div>}
          {panel === "enhance" && <div className="space-y-3">
            {ADJUSTMENTS.map(([key, label, min, max]) => slider(key, label, min, max))}
          </div>}
          {panel === "filters" && <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Photo filters">
            {PHOTO_FILTERS.map(filter => <button key={filter.id} type="button" disabled={isProcessing} aria-pressed={settings.filter === filter.id} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50 ${settings.filter === filter.id ? selected : "border-white/10 bg-white/5 hover:bg-white/10"}`} onClick={() => update("filter", filter.id)}>
              <span aria-hidden className={`h-7 w-7 rounded-full ${filter.id === 'warm' ? 'bg-gradient-to-br from-amber-200 to-rose-300' : filter.id === 'bright' ? 'bg-gradient-to-br from-sky-100 to-amber-100' : filter.id === 'vivid' ? 'bg-gradient-to-br from-rose-300 to-sky-300' : filter.id === 'beauty' ? 'bg-gradient-to-br from-stone-100 to-rose-100' : filter.id === 'portrait' ? 'bg-gradient-to-br from-rose-200 to-amber-100' : filter.id === 'clean' ? 'bg-gradient-to-br from-sky-100 to-white' : 'bg-gradient-to-br from-amber-100 to-stone-300'}`} />{filter.label}
            </button>)}
            </div>
            {slider("filterIntensity", "Filter strength", 0, 100)}
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm"><span>Preserve skin tones</span><input type="checkbox" checked={settings.protectSkin !== false} disabled={isProcessing} onChange={event => update("protectSkin", event.target.checked)} className="h-5 w-5 accent-sky-400" /></label>
          </div>}
          {panel === "background" && <div className="space-y-3">
            <fieldset disabled={!settings.removeBackground || isProcessing} className="space-y-3 disabled:opacity-40">
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Background colour">{([['white', 'White', 'bg-white'], ['grey', 'Grey', 'bg-slate-200'], ['blue', 'Blue', 'bg-sky-100']] as const).map(([value, label, color]) => <Button key={value} type="button" variant="outline" aria-pressed={settings.backgroundColor === value} className={`${secondary} gap-2 px-2 ${settings.backgroundColor === value ? selected : ""}`} onClick={() => update("backgroundColor", value)}><span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${color}`} />{label}</Button>)}</div>
              {slider("backgroundEdge", "Edge", -20, 20)}{slider("backgroundFeather", "Feather", 0, 100)}
            </fieldset>
          </div>}
          {onImportEdited && <div className="mt-4 border-t border-white/10 pt-3"><ExternalPhotoEditor imageSrc={imageSrc} onImport={onImportEdited} disabled={isProcessing} /></div>}
        </div>
      </section>

      <footer className="photo-editor-actions shrink-0 border-t border-white/10 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <Button type="button" variant="outline" className={`${secondary} min-w-0 whitespace-normal px-3 text-center text-xs leading-tight sm:text-sm`} onClick={onCancel} disabled={isProcessing}>Retake / upload</Button>
          <div className="flex shrink-0 gap-2"><Button type="button" variant="outline" className={`${secondary} w-11 px-0`} onClick={reset} disabled={isProcessing} aria-label="Reset photo adjustments"><RotateCcw className="h-4 w-4" /></Button>
            <Button type="button" disabled={busy || !preview} className="min-h-11 rounded-xl bg-sky-400 px-3 text-sm font-semibold text-slate-950 hover:bg-sky-300" onClick={() => { userPositioned.current = true; if (stage === "crop") setStage("review"); else if (preview) onSave(preview.photo); }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}{busy ? "Processing…" : stage === "crop" ? "Review photo" : "Save photo"}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
