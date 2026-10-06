"use client";

import React, { useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point, type Size } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check, X, ScanFace, ArrowLeft } from "lucide-react";
import { createEnhancedPupilPhoto, createImage } from "./photo-editor-utils";
import { PhotoToolsClient } from "@/lib/photo/photo-tools-client";
import { DEFAULT_PHOTO_SETTINGS, suggestFaceCrop, type PhotoFace } from "@/lib/photo/photo-processing";

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
}

export function PhotoCropEditor({ imageSrc, title, crop, zoom, isProcessing = false,
  onCropChange, onZoomChange, onCropComplete, onCancel, onReset, onSave }: PhotoCropEditorProps) {
  const tools = useRef<PhotoToolsClient | null>(null);
  const userPositioned = useRef(false);
  const [settings, setSettings] = useState({ ...DEFAULT_PHOTO_SETTINGS });
  const [area, setArea] = useState<Area | null>(null);
  const [stage, setStage] = useState<"crop" | "review">("crop");
  const [cropSize, setCropSize] = useState<Size>();
  const [interacting, setInteracting] = useState(false);
  const [face, setFace] = useState<PhotoFace>();
  const [suggested, setSuggested] = useState<Area>();
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

  useEffect(() => {
    let active = true;
    const client = new PhotoToolsClient(); tools.current = client;
    userPositioned.current = false;
    setPrepared(null); setFace(undefined); setSuggested(undefined); setInitialArea(undefined);
    setSettings({ ...DEFAULT_PHOTO_SETTINGS }); setStage("crop"); setShowOriginal(false);
    setFaceStatus("Preparing automatic framing…");
    void (async () => {
      const image = await createImage(imageSrc);
      const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      const faces = await client.detect(canvas);
      if (!active) return;
      if (faces.length !== 1) {
        setFaceStatus(faces.length ? "Several faces found. Frame only the pupil you want." : "No clear face found. Position the photo manually.");
        return;
      }
      const detected = faces[0];
      const sourceFace = { x: detected.x / scale, y: detected.y / scale, width: detected.width / scale,
        height: detected.height / scale, eyesY: detected.eyesY === undefined ? undefined : detected.eyesY / scale };
      setFace(sourceFace);
      const framing = { ...suggestFaceCrop(sourceFace, image.naturalWidth, image.naturalHeight) } as Area;
      setSuggested(framing);
      if (!userPositioned.current) { setInitialArea(framing); setRevision(value => value + 1); }
      setFaceStatus(sourceFace.height < 160 ? "The face has little source detail. A closer retake may be clearer." : "Head framing ready. Check that all hair and the crown fit inside the circle.");
    })().catch(() => { if (active) setFaceStatus("Automatic framing is unavailable. You can still crop and enhance this photo."); });
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

  function reset() {
    userPositioned.current = true;
    setSettings({ ...DEFAULT_PHOTO_SETTINGS }); setShowOriginal(false); setStage("crop");
    setInitialArea(undefined); setRevision(value => value + 1); onReset();
  }
  const busy = isPreparing || isProcessing;
  // Save must never use a preview made for an earlier crop or adjustment.
  const preview = prepared?.source === imageSrc && prepared.area === area && prepared.settings === settings && prepared.face === face ? prepared : null;
  const secondary = "min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white";

  return (
    <div className="pupil-photo-editor flex h-[100dvh] min-h-0 flex-col bg-slate-950 text-white">
      <style>{`@media (max-height: 500px) and (min-width: 600px) {
        .pupil-photo-editor { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto minmax(0, 1fr) auto; }
        .pupil-photo-editor > .photo-editor-header, .pupil-photo-editor > .photo-editor-actions { grid-column: 1 / -1; }
        .pupil-photo-editor > .photo-editor-controls { max-height: none; min-height: 0; }
      }`}</style>
      <div className="photo-editor-header shrink-0 border-b border-white/10 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold sm:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-slate-300">{stage === "crop" ? "Frame the whole head and some shoulders." : "Check the finished JPEG before saving."}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} disabled={isProcessing}
            className="h-11 w-11 shrink-0 text-white hover:bg-white/10 hover:text-white" aria-label="Close photo editor">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-900">
        {stage === "crop" ? (
          <div className="relative h-full w-full" onPointerDown={() => { userPositioned.current = true; }}>
            <Cropper key={revision} image={imageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round"
              showGrid objectFit="contain" minZoom={1} maxZoom={8} restrictPosition
              initialCroppedAreaPixels={initialArea} onCropChange={onCropChange} onZoomChange={onZoomChange}
              onCropSizeChange={setCropSize}
              onInteractionStart={() => setInteracting(true)} onInteractionEnd={() => setInteracting(false)}
              onCropAreaChange={(_percentages, pixels) => {
                setArea(previous => previous && previous.x === pixels.x && previous.y === pixels.y && previous.width === pixels.width && previous.height === pixels.height ? previous : pixels);
              }}
              onCropComplete={(percentages, pixels) => {
                onCropComplete(percentages, pixels);
                setArea(previous => previous && previous.x === pixels.x && previous.y === pixels.y && previous.width === pixels.width && previous.height === pixels.height ? previous : pixels);
              }} />
            {/* Keep the original image and its coordinates for dragging. Display
                the exact processed JPEG over the settled crop for live feedback. */}
            {preview && cropSize && !interacting && <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
              style={{ width: cropSize.width, height: cropSize.height }}>
              <img src={showOriginal ? preview.original : preview.photo} alt={showOriginal ? "Original crop preview" : "Enhanced crop preview"} className="h-full w-full" />
              <div aria-hidden="true" className="absolute inset-0 grid grid-cols-3 grid-rows-3 border border-white/50">
                {Array.from({ length: 9 }, (_, index) => <span key={index} className="border border-white/20" />)}
              </div>
            </div>}
            <span role="status" className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950/90 px-3 py-1 text-xs">
              {interacting ? "Adjusting crop…" : !preview ? "Preparing preview…" : showOriginal ? "Original crop" : "Enhanced preview"}
            </span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-4" aria-busy={isPreparing}>
            {preview ? <img src={showOriginal ? preview.original : preview.photo} alt={showOriginal ? "Original cropped photo" : "Finished pupil photo"}
              className="max-h-full max-w-full rounded-xl object-contain" /> : <p role="status" className="text-sm text-slate-300">{error ? "Photo preview unavailable" : "Preparing photo…"}</p>}
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/90 px-3 py-1 text-xs">{showOriginal ? "Original crop" : "Finished JPEG · 500 × 500"}</span>
          </div>
        )}
      </div>

      <div className="photo-editor-controls max-h-[45dvh] shrink-0 overflow-y-auto border-t border-white/10 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-3">
          {stage === "crop" ? <>
            <div className="flex items-center gap-3">
              <label htmlFor="photo-zoom" className="text-sm">Zoom</label>
              <input id="photo-zoom" type="range" min={1} max={8} step={0.01} value={zoom} disabled={isProcessing}
                onChange={event => { userPositioned.current = true; onZoomChange(Number(event.target.value)); }} className="h-11 min-w-0 flex-1 accent-blue-400" />
              <Button type="button" variant="outline" className={secondary} disabled={!suggested || isProcessing}
                onClick={() => { userPositioned.current = true; setInitialArea(suggested); setRevision(value => value + 1); }}>
                <ScanFace className="h-4 w-4" /><span>Frame head</span>
              </Button>
            </div>
            <p role="status" className="text-xs leading-relaxed text-slate-300">{faceStatus}</p>
          </> : null}
          <div className="flex flex-wrap gap-2">
            {stage === "review" && <Button type="button" variant="outline" className={secondary} disabled={isProcessing} onClick={() => { setInitialArea(area ?? undefined); setStage("crop"); }}><ArrowLeft className="h-4 w-4" />Adjust crop</Button>}
            <Button type="button" variant="outline" className={secondary} aria-pressed={showOriginal} disabled={!preview || isProcessing}
              onClick={() => setShowOriginal(value => !value)}>{showOriginal ? "Show enhanced" : "Compare original"}</Button>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={settings.auto} disabled={isProcessing} onChange={event => { setShowOriginal(false); setSettings(value => ({ ...value, auto: event.target.checked })); }} className="h-5 w-5 accent-blue-400" />
            Auto enhance <span className="text-xs text-slate-300">Light, colour and gentle smoothing</span>
          </label>
          <details className="rounded-lg border border-white/10 px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm">Photo adjustments</summary>
            <div className="grid gap-2 pb-2 sm:grid-cols-2">
              {([['brightness', 'Brightness', 30], ['warmth', 'Warmth', 20]] as const).map(([key, label, limit]) => <label key={key} className="text-sm">
                <span>{label} <span className="text-slate-300">{settings[key] > 0 ? '+' : ''}{settings[key]}</span></span>
                <input type="range" min={-limit} max={limit} step={1} value={settings[key]} disabled={isProcessing} aria-label={label}
                  onChange={event => { setShowOriginal(false); setSettings(value => ({ ...value, [key]: Number(event.target.value) })); }} className="block h-11 w-full accent-blue-400" />
              </label>)}
            </div>
          </details>
          {preview?.warnings.length ? <ul className="space-y-1 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100" aria-label="Photo quality suggestions">
            {preview.warnings.map(warning => <li key={warning.code}>{warning.message}</li>)}
          </ul> : null}
          {error && <div role="alert" className="text-sm text-red-200">{error} <Button type="button" variant="ghost" className="min-h-11 text-white" onClick={() => setRetry(value => value + 1)}>Try again</Button></div>}
        </div>
      </div>

      <div className="photo-editor-actions shrink-0 border-t border-white/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" className={secondary} onClick={onCancel} disabled={isProcessing}>Retake / upload</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className={secondary + " px-3"} onClick={reset} disabled={isProcessing} aria-label="Reset photo adjustments"><RotateCcw className="h-4 w-4" /></Button>
            <Button type="button" disabled={busy || !preview} className="min-h-11 bg-blue-500 px-3 text-white hover:bg-blue-400"
              onClick={() => { userPositioned.current = true; if (stage === "crop") setStage("review"); else if (preview) onSave(preview.photo); }}>
              <Check className="h-4 w-4" />{busy ? "Processing…" : stage === "crop" ? "Review photo" : "Save photo"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
