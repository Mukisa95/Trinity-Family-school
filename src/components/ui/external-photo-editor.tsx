"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { createImage } from "./photo-editor-utils";
import { canSharePhoto, hasNativePhotoBridge, isPhotoActionCancelled, nativePhotoRequest } from "@/lib/photo/external-photo-apps";

export function ExternalPhotoEditor({ imageSrc, onImport, disabled }: { imageSrc: string; onImport: (file?: File) => Promise<void>; disabled: boolean }) {
  const [prepared, setPrepared] = useState<{ source: string; file: File; dataUrl: string; url: string }>();
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const lifetime = useRef<AbortController>();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController(); lifetime.current = controller;
    let url: string | undefined;
    setPrepared(undefined); setMessage(""); setSharing(false);
    void createImage(imageSrc).then(image => {
      if (controller.signal.aborted) return;
      // Export the uncropped source so another editor has all the head detail.
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare the photo for another editor.");
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      return fetch(dataUrl, { signal: controller.signal }).then(response => response.blob()).then(blob => {
        if (controller.signal.aborted) return;
        if (blob.size > 30 * 1024 * 1024) throw new Error("This source photo is too large to send. Open it directly in your editor, then import the exported JPEG.");
        url = URL.createObjectURL(blob);
        setPrepared({ source: imageSrc, file: new File([blob], "portrait-source.jpg", { type: "image/jpeg" }), dataUrl, url });
      });
    }).catch(cause => { if (!controller.signal.aborted) setMessage(cause.message || "Unable to prepare this photo."); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [imageSrc, enabled]);
  const ready = prepared?.source === imageSrc ? prepared : undefined;
  async function share() {
    if (!ready || !lifetime.current) return;
    const signal = lifetime.current.signal;
    setSharing(true); setMessage("");
    try {
      // The file is prepared ahead of time: share() runs in the click gesture.
      if (hasNativePhotoBridge()) await nativePhotoRequest("share", { dataUrl: ready.dataUrl }, signal);
      else await navigator.share({ files: [ready.file], title: "Edit photo" });
      if (!signal.aborted) setMessage("Ready to import your edited photo.");
    } catch (cause) {
      if (!signal.aborted && !isPhotoActionCancelled(cause)) setMessage("Could not open an editor. Download the photo instead.");
    } finally { if (!signal.aborted) setSharing(false); }
  }
  return <details className="rounded-xl border border-white/10 px-3" onToggle={event => { if (event.currentTarget.open) setEnabled(true); }}>
    <summary className="flex min-h-11 cursor-pointer items-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">Use another editor</summary>
    <div className="space-y-2 pb-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11 w-full rounded-lg border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" disabled={disabled || sharing || !ready || !canSharePhoto(ready.file)} onClick={share}>{sharing ? "Opening…" : "Open in another editor"}</Button>
        <Button type="button" variant="outline" className="min-h-11 w-full rounded-lg border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" disabled={disabled || sharing} onClick={() => input.current?.click()}>Import edited photo</Button>
        {ready && !hasNativePhotoBridge() && <a href={ready.url} download="portrait-source.jpg" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm underline">Download source photo</a>}
      </div>
      {(message || !ready || !canSharePhoto(ready.file)) && <p role="status" className="text-xs text-slate-300">{message || (!ready ? "Preparing photo…" : "Photo sharing unavailable")}</p>}
    </div>
    <input ref={input} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void onImport(file); }} />
  </details>;
}
