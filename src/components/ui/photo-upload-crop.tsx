"use client";

import React, { useCallback, useRef, useState } from "react";
import type { Area, Point } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogTrigger,
} from "@/components/ui/modern-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, X } from "lucide-react";
import Image from "next/image";
import { PhotoCropEditor } from "@/components/ui/photo-crop-editor";
import { createPupilPhotoDataUrl, readFileAsDataUrl } from "@/components/ui/photo-editor-utils";

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

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const clearInputs = useCallback(() => {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }, []);

  const resetCropState = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, []);

  const resetDialog = useCallback(() => {
    setMode("select");
    setImgSrc("");
    resetCropState();
    clearInputs();
  }, [clearInputs, resetCropState]);

  const handleSelectedFile = useCallback(
    async (file?: File) => {
      if (!file) {
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        setImgSrc(dataUrl);
        resetCropState();
        setMode("crop");
      } catch (error) {
        console.error("Error reading selected image:", error);
      }
    },
    [resetCropState],
  );

  const handleInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      await handleSelectedFile(event.target.files?.[0]);
    },
    [handleSelectedFile],
  );

  const handleSave = useCallback(async () => {
    if (!imgSrc || !croppedAreaPixels) {
      return;
    }

    setIsProcessing(true);

    try {
      const compressedDataUrl = await createPupilPhotoDataUrl(imgSrc, croppedAreaPixels);
      onPhotoChange(compressedDataUrl);
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
                className="relative overflow-hidden rounded-full border-4 border-dashed border-blue-200 hover:border-blue-500 hover:bg-blue-50/50 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800 transition-all duration-300 w-[150px] h-[150px] flex items-center justify-center cursor-pointer shadow-sm"
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
                    <Camera className="h-8 w-8 text-blue-500/75 group-hover:text-blue-600 group-hover:scale-110 transition-all duration-300 mb-1" />
                    <span className="text-[10px] font-bold text-blue-600/90 group-hover:text-blue-700 transition-colors duration-300">ADD PHOTO</span>
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
            <ModernDialogContent size="full" noPadding className="mx-0 h-[100vh] max-h-[100vh] w-screen max-w-none rounded-none border-0">
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
                  setMode("select");
                  setImgSrc("");
                  resetCropState();
                  clearInputs();
                }}
                onReset={resetCropState}
                onSave={handleSave}
              />
            </ModernDialogContent>
          ) : (
            <ModernDialogContent size="lg" className="compact-camera-dialog">
              <ModernDialogHeader className="pb-2">
                <ModernDialogTitle>Choose Photo Source</ModernDialogTitle>
              </ModernDialogHeader>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <Card
                    className="cursor-pointer border-blue-100 transition-colors hover:bg-blue-50 dark:hover:bg-gray-800"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <Camera className="mb-2 h-12 w-12 text-blue-600" />
                      <span className="font-medium">Take Photo</span>
                      <span className="text-center text-sm text-gray-500">Open your device camera</span>
                    </CardContent>
                  </Card>
                  <Card
                    className="cursor-pointer border-green-100 transition-colors hover:bg-green-50 dark:hover:bg-gray-800"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <Upload className="mb-2 h-12 w-12 text-green-600" />
                      <span className="font-medium">Upload File</span>
                      <span className="text-center text-sm text-gray-500">Choose from device</span>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </ModernDialogContent>
          )}
        </ModernDialog>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          className="hidden"
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
