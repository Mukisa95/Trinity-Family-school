"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { Button } from "./button";
import { captureWithCamera, hasNativePhotoBridge, isPhotoActionCancelled, nativePhotoRequest, type CameraApp } from "@/lib/photo/external-photo-apps";

const PREFERENCE = "trinity-preferred-camera-v1";

export function PhotoSourcePicker({ onFile }: { onFile: (file?: File) => Promise<void> }) {
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const lifetime = useRef<AbortController>();
  const [native, setNative] = useState(false);
  const [apps, setApps] = useState<CameraApp[]>([]);
  const [preferred, setPreferred] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    const available = hasNativePhotoBridge(); setNative(available);
    if (available) void nativePhotoRequest("cameras", {}, controller.signal).then(reply => {
      if (controller.signal.aborted) return;
      if (reply.apiVersion !== 1 || !Array.isArray(reply.cameras)) throw new Error("Update the Android companion to choose a camera.");
      const cameras = reply.cameras.filter(app => typeof app.id === "string" && typeof app.label === "string");
      setApps(cameras);
      let saved = ""; try { saved = localStorage.getItem(PREFERENCE) || ""; } catch { /* Storage is optional. */ }
      setPreferred(cameras.some(app => app.id === saved) ? saved : "");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, []);

  async function takePhoto() {
    if (!native) { camera.current?.click(); return; }
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted) return;
    setBusy(true); setError("");
    try {
      const file = await captureWithCamera(preferred, controller.signal);
      if (file && !controller.signal.aborted) await onFile(file);
    } catch (cause) {
      if (!controller.signal.aborted && !isPhotoActionCancelled(cause)) setError(cause instanceof Error ? cause.message : "Unable to open that camera. Choose another or upload its saved photo.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <Button type="button" variant="outline" disabled={busy} onClick={takePhoto} className="h-auto min-h-28 flex-col gap-2 whitespace-normal p-4 text-foreground">
        <Camera className="h-9 w-9 text-brand-ink-600" /><span>{busy ? "Waiting for camera…" : "Take Photo"}</span>
        <span className="text-xs text-muted-foreground">{preferred ? apps.find(app => app.id === preferred)?.label : "Device camera"}</span>
      </Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => upload.current?.click()} className="h-auto min-h-28 flex-col gap-2 whitespace-normal p-4 text-foreground">
        <Upload className="h-9 w-9 text-green-600" /><span>Upload File</span><span className="text-xs text-muted-foreground">Include photos from other apps</span>
      </Button>
    </div>
    <details className="rounded-lg border p-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Choose camera app</summary>
      {native ? <div className="space-y-2">
        <label className="block text-sm">Preferred camera
          <select aria-label="Preferred camera" value={preferred} disabled={busy} className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 text-foreground" onChange={event => {
            const value = event.target.value; setPreferred(value);
            try { localStorage.setItem(PREFERENCE, value); } catch { /* Storage is optional. */ }
          }}><option value="">Device default</option>{apps.map(app => <option key={app.id} value={app.id}>{app.label}</option>)}</select>
        </label>
        <p className="text-xs text-muted-foreground">Take Photo opens this camera and returns its full-size image. Only apps that support Android photo capture appear here. For other apps, save their photo and choose Upload File.</p>
      </div> : <p className="text-sm text-muted-foreground">Direct camera selection is available in the Trinity Android companion. In a browser, take the photo in your preferred camera app, then choose Upload File here.</p>}
    </details>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void onFile(file); }} />
    <input ref={upload} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void onFile(file); }} />
  </div>;
}
