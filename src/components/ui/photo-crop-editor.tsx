"use client";

import React from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check, X, ZoomIn } from "lucide-react";

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
  onSave: () => void;
}

export function PhotoCropEditor({
  imageSrc,
  title,
  crop,
  zoom,
  isProcessing = false,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onCancel,
  onReset,
  onSave,
}: PhotoCropEditorProps) {
  return (
    <div className="flex h-[90vh] flex-col bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-950/95 px-4 pb-3 pt-6 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Photo Editor</p>
            <h2 className="mt-1 text-lg font-semibold sm:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-slate-300">
              The full photo is fitted first. Zoom only when you need a tighter crop.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-10 w-10 rounded-full text-white hover:bg-white/10 hover:text-white"
            aria-label="Close photo editor"
            title="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.24),_transparent_38%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative h-full w-full">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            objectFit="contain"
            minZoom={1}
            maxZoom={3}
            restrictPosition
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropComplete}
          />
        </div>
      </div>

      <div className="border-t border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <ZoomIn className="h-4 w-4" />
                <span>Zoom</span>
              </div>
              <span className="text-xs font-medium text-slate-300">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => onZoomChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-blue-400"
              aria-label="Photo zoom"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              className="h-11 min-w-11 border-white/15 bg-white/5 px-3 text-white hover:bg-white/10 hover:text-white sm:h-10 sm:min-w-0"
              aria-label="Reset crop"
              title="Reset"
            >
              <RotateCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="hidden sm:inline-flex h-10 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={isProcessing}
              className="h-11 min-w-11 bg-blue-500 px-3 text-white hover:bg-blue-400 sm:h-10 sm:min-w-0"
              aria-label={isProcessing ? "Processing photo" : "Save photo"}
              title={isProcessing ? "Processing..." : "Save"}
            >
              <Check className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{isProcessing ? "Processing..." : "Save Photo"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
