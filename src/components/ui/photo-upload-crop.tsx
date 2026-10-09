"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Area, Point } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogTrigger,
} from "@/components/ui/modern-dialog";
import { PhotoSourcePicker } from "@/components/ui/photo-source-picker";
import { Camera, X } from "lucide-react";
import Image from "next/image";
import { PhotoCropEditor } from "@/components/ui/photo-crop-editor";
import { createImage, readFileAsDataUrl } from "@/components/ui/photo-editor-utils";

interface PhotoUploadCropProps {
  onPhotoChange: (photo: string | undefined) => void;
  currentPhoto?: string;
  className?: string;
}

export function PhotoUploadCrop({ onPhotoChange, currentPhoto, className }: PhotoUploadCropProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "crop">("select");
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectionGeneration = useRef(0);
  useEffect(() => { selectionGeneration.current++; return () => { selectionGeneration.current++; }; }, [isDialogOpen]);

  const resetCropState = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, []);

  const resetDialog = useCallback(() => {
    selectionGeneration.current++;
    setMode("select");
    setImgSrc("");
    resetCropState();
  }, [resetCropState]);

  const handleSelectedFile = useCallback(
    async (file?: File) => {
      if (!file) {
        return;
      }

      const request = ++selectionGeneration.current;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        await createImage(dataUrl);
        if (request !== selectionGeneration.current) return;
        setImgSrc(dataUrl);
        resetCropState();
        setMode("crop");
      } catch (error) {
        if (request !== selectionGeneration.current) return;
        console.error("Error reading selected image:", error);
        alert("Unable to open this photo. Choose a supported image or take another photo.");
      }
    },
    [resetCropState],
  );

  const handleSave = useCallback(async (preparedPhoto: string) => {
    if (!imgSrc || !croppedAreaPixels) {
      return;
    }

    setIsProcessing(true);

    try {
      onPhotoChange(preparedPhoto);
      setIsDialogOpen(false);
      resetDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process the selected image.";
      console.error("Error processing image:", error);
      alert(`Photo processing failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imgSrc, onPhotoChange, resetDialog]);

  const removePhoto = () => {
    onPhotoChange(undefined);
  };

  return (
    <div className={className}>
      <div className="flex flex-col items-center">
        <ModernDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              resetDialog();
            }
          }}
        >
          <div className="relative group">
            <ModernDialogTrigger asChild>
              <div 
                className="relative overflow-hidden rounded-full border-4 border-dashed border-brand-200 hover:border-brand-500 hover:bg-brand-surface-50/50 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800 transition-all duration-300 w-[150px] h-[150px] flex items-center justify-center cursor-pointer shadow-sm"
              >
                {currentPhoto ? (
                  <>
                    <Image
                      src={currentPhoto}
                      alt="Pupil photo"
                      width={150}
                      height={150}
                      className="rounded-full object-cover w-full h-full"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white rounded-full">
                      <Camera className="h-6 w-6 mb-1 text-white" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white">Change Photo</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center w-full h-full">
                    <Camera className="h-8 w-8 text-brand-ink-500/75 group-hover:text-brand-ink-600 group-hover:scale-110 transition-all duration-300 mb-1" />
                    <span className="text-[10px] font-bold text-brand-ink-600/90 group-hover:text-brand-ink-700 transition-colors duration-300">ADD PHOTO</span>
                  </div>
                )}
              </div>
            </ModernDialogTrigger>

            {currentPhoto && (
              <Button
                variant="destructive"
                size="sm"
                className="absolute -right-1 -top-1 h-7 w-7 rounded-full p-0 shadow-md hover:scale-105 active:scale-95 z-10 border border-white dark:border-gray-800"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removePhoto();
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {mode === "crop" && imgSrc ? (
            <ModernDialogContent size="full" noPadding className="mx-0 h-[100vh] max-h-[100vh] w-screen max-w-none rounded-none border-0 [&>button]:hidden">
              <PhotoCropEditor
                imageSrc={imgSrc}
                title="Crop Photo"
                crop={crop}
                zoom={zoom}
                isProcessing={isProcessing}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                onCancel={() => {
                  selectionGeneration.current++;
                  setMode("select");
                  setImgSrc("");
                  resetCropState();
                }}
                onReset={resetCropState}
                onSave={handleSave}
                onImportEdited={handleSelectedFile}
              />
            </ModernDialogContent>
          ) : (
            <ModernDialogContent size="lg" className="compact-camera-dialog">
              <ModernDialogHeader className="pb-2">
                <ModernDialogTitle>Choose Photo Source</ModernDialogTitle>
              </ModernDialogHeader>

              <div className="space-y-3">
                <PhotoSourcePicker onFile={handleSelectedFile} />
              </div>
            </ModernDialogContent>
          )}
        </ModernDialog>
      </div>
    </div>
  );
}
