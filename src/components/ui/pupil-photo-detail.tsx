"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import type { Area, Point } from "react-easy-crop";
import {
  Camera,
  Upload,
  X,
  Plus,
  Edit,
  Download,
  RefreshCw,
  ArrowLeft,
  Maximize2,
} from "lucide-react";
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle, ModernDialogTrigger } from "@/components/ui/modern-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhotoCropEditor } from "@/components/ui/photo-crop-editor";
import { createSquareCropCanvas, readFileAsDataUrl } from "@/components/ui/photo-editor-utils";
import type { Pupil } from "@/types";
import Image from "next/image";

interface PupilPhotoDetailProps {
  pupil?: Pupil | null;
  pupilPhoto?: string;
  pupilName?: string;
  onPhotoChange: (photo: string | undefined) => void;
  className?: string;
  ringColor?: string;
  isLoading?: boolean;
}

const TARGET_BLOB_SIZE_BYTES = 200 * 1024;

function compressImage(canvas: HTMLCanvasElement, initialQuality = 0.92): Promise<string> {
  return new Promise((resolve, reject) => {
    let currentQuality = initialQuality;

    const attemptCompression = () => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to convert canvas to blob."));
          return;
        }

        if (blob.size <= TARGET_BLOB_SIZE_BYTES) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("FileReader error during compression."));
          reader.readAsDataURL(blob);
          return;
        }

        if (currentQuality > 0.35) {
          const sizeRatio = blob.size / TARGET_BLOB_SIZE_BYTES;
          const qualityReduction = sizeRatio > 2 ? 0.12 : 0.08;
          currentQuality = Math.max(0.35, currentQuality - qualityReduction);
          attemptCompression();
          return;
        }

        const newCanvas = document.createElement("canvas");
        const ctx = newCanvas.getContext("2d");
        const scaleFactor = Math.sqrt(TARGET_BLOB_SIZE_BYTES / blob.size) * 0.88;
        const minDimension = 600;

        newCanvas.width = Math.max(minDimension, Math.round(canvas.width * scaleFactor));
        newCanvas.height = Math.max(minDimension, Math.round(canvas.height * scaleFactor));

        if (!ctx) {
          reject(new Error("Failed to resize image for compression."));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);

        currentQuality = 0.85;
        canvas = newCanvas;
        attemptCompression();
      }, "image/jpeg", currentQuality);
    };

    attemptCompression();
  });
}

function downloadImage(dataUrl: string, filename: string) {
  try {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
  } catch (error) {
    console.error("Error downloading image:", error);

    try {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<img src="${dataUrl}" alt="Pupil Photo" />`);
        newWindow.document.title = filename;
      } else {
        alert("Please allow pop-ups to download the photo");
      }
    } catch (fallbackError) {
      console.error("Fallback download also failed:", fallbackError);
      alert("Unable to download photo. Please check your browser settings.");
    }
  }
}

export function PupilPhotoDetail({
  pupil,
  pupilPhoto,
  pupilName,
  onPhotoChange,
  className,
  ringColor,
  isLoading = false,
}: PupilPhotoDetailProps) {
  const derivedName = useMemo(() => {
    if (pupilName?.trim()) {
      return pupilName.trim();
    }

    const names = [pupil?.firstName, pupil?.lastName].filter(Boolean).join(" ").trim();
    return names || "Pupil";
  }, [pupil?.firstName, pupil?.lastName, pupilName]);

  const effectiveSrc = useMemo(() => {
    const candidate = pupilPhoto ?? pupil?.photo;
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
  }, [pupil?.photo, pupilPhoto]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "crop" | "view" | "actions">(effectiveSrc ? "actions" : "select");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
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
    setMode(effectiveSrc ? "actions" : "select");
    setImgSrc(null);
    resetCropState();
    clearInputs();
  }, [clearInputs, effectiveSrc, resetCropState]);

  const handleSelectedFile = useCallback(
    async (file?: File) => {
      if (!file) {
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        setImgSrc(dataUrl.trim() || null);
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

  const handleDownload = () => {
    if (!effectiveSrc) {
      alert("No photo available to download");
      return;
    }

    const filename = `${derivedName.toUpperCase().replace(/\s+/g, "_")}_PHOTO.jpg`;
    downloadImage(effectiveSrc, filename);
  };

  const handleSave = useCallback(async () => {
    if (!imgSrc || !croppedAreaPixels) {
      return;
    }

    setIsProcessing(true);

    try {
      const canvas = await createSquareCropCanvas(imgSrc, croppedAreaPixels, {
        minOutputSize: 400,
        maxOutputSize: 1200,
      });
      const compressedDataUrl = await compressImage(canvas);
      onPhotoChange(compressedDataUrl);
      setIsDialogOpen(false);
      resetDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process the selected image.";
      console.error("Error processing image:", error);
      alert(`Image compression failed: ${message}. Please try a different image or check its format.`);
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imgSrc, onPhotoChange, resetDialog]);

  const handlePhotoClick = () => {
    setMode(effectiveSrc ? "actions" : "select");
    setIsDialogOpen(true);
  };

  const getInitials = () => {
    const names = derivedName.split(" ").filter((name) => name.length > 0);
    return names.length >= 2 ? `${names[0][0]}${names[1][0]}` : names[0]?.[0] || "P";
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
          <ModernDialogTrigger asChild>
            <div
              className={`relative cursor-pointer ${className || "h-24 w-24"}`}
              onClick={handlePhotoClick}
              style={{ contain: "layout style paint", flexShrink: 0 }}
            >
              <Avatar
                className={`${className || "h-24 w-24"} cursor-pointer rounded-full border-4 transition-opacity duration-300 hover:opacity-80`}
                style={{ borderColor: ringColor || "transparent" }}
              >
                {effectiveSrc ? (
                  <AvatarImage
                    src={effectiveSrc}
                    alt={derivedName}
                    className={`${isLoading ? "opacity-30" : "opacity-100"} object-cover transition-opacity duration-500`}
                  />
                ) : null}
                <AvatarFallback
                  className={`text-lg font-bold ${
                    isLoading
                      ? "bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 text-gray-400"
                      : "bg-gradient-to-br from-blue-500 to-cyan-500 text-white"
                  }`}
                >
                  {getInitials()}
                </AvatarFallback>
              </Avatar>

              {isLoading && (
                <div
                  className="pointer-events-none absolute inset-[-4px] rounded-full border-2 border-dashed border-blue-400 opacity-50"
                  style={{ animation: "spin 2s linear infinite" }}
                />
              )}

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors duration-200 hover:bg-black/20">
                <div className="pointer-events-auto rounded-full bg-white/90 p-2 opacity-0 transition-opacity duration-200 hover:opacity-100">
                  {effectiveSrc ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
              </div>
            </div>
          </ModernDialogTrigger>

          {mode === "crop" && imgSrc ? (
            <ModernDialogContent size="full" noPadding className="mx-0 h-[100vh] max-h-[100vh] w-screen max-w-none rounded-none border-0">
              <PhotoCropEditor
                imageSrc={imgSrc}
                title={`${derivedName}'s Photo`}
                crop={crop}
                zoom={zoom}
                isProcessing={isProcessing}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                onCancel={() => {
                  setMode(effectiveSrc ? "actions" : "select");
                  setImgSrc(null);
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
                <ModernDialogTitle>
                  {mode === "select" && "Choose Photo Source"}
                  {mode === "view" && `${derivedName}'s Photo`}
                  {mode === "actions" && "Photo Actions"}
                </ModernDialogTitle>
              </ModernDialogHeader>

              <div className="space-y-3">
                {mode === "select" && (
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
                )}

                {mode === "actions" && effectiveSrc && (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <Image
                        src={effectiveSrc}
                        alt={`${derivedName} - Current Photo`}
                        width={640}
                        height={640}
                        unoptimized
                        className="max-h-80 max-w-full cursor-pointer rounded-lg object-contain shadow-lg transition-transform duration-200 hover:scale-[1.02]"
                        onClick={() => setMode("view")}
                      />
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setMode("view")} className="flex items-center gap-1">
                        <Maximize2 className="h-4 w-4" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setImgSrc(effectiveSrc);
                          resetCropState();
                          setMode("crop");
                        }}
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setMode("select")} className="flex items-center gap-1">
                        <RefreshCw className="h-4 w-4" />
                        Change
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownload} className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                )}

                {mode === "view" && effectiveSrc && (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <Image
                        src={effectiveSrc}
                        alt={`${derivedName} - Full Screen Photo`}
                        width={900}
                        height={900}
                        unoptimized
                        className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-lg"
                      />
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${derivedName}'s photo?`)) {
                            onPhotoChange(undefined);
                            setIsDialogOpen(false);
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Delete
                      </Button>
                      <Button variant="default" size="sm" onClick={handleDownload} className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setMode("actions")} className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                    </div>
                  </div>
                )}
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
