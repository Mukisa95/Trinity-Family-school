"use client";

import type { Area } from "react-easy-crop";
import type { PhotoToolsClient } from "@/lib/photo/photo-tools-client";
import { applyWhiteBackground, type PhotoFace, type PhotoSettings } from "@/lib/photo/photo-processing";

export interface CropCanvasOptions {
  outputSize: number;
  minimumSourceSize?: number;
}

export const PUPIL_PHOTO_OUTPUT_SIZE = 500;
export const PUPIL_PHOTO_MAX_BYTES = 180 * 1024;

const PUPIL_PHOTO_INITIAL_QUALITY = 0.92;
const PUPIL_PHOTO_MINIMUM_QUALITY = 0.72;
const PUPIL_PHOTO_QUALITY_STEP = 0.04;

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = () => reject(new Error("Failed to read selected image."));
    reader.readAsDataURL(file);
  });
}

export async function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Failed to load image for cropping.")));
    image.src = src;
  });
}

export async function createSquareCropCanvas(
  imageSrc: string,
  croppedAreaPixels: Area,
  options: CropCanvasOptions,
): Promise<HTMLCanvasElement> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to prepare image editor.");
  }

  const cropSize = Math.floor(Math.min(croppedAreaPixels.width, croppedAreaPixels.height));
  if (!Number.isFinite(cropSize) || cropSize <= 0) {
    throw new Error("The selected crop is invalid. Please reposition the photo and try again.");
  }

  if (options.minimumSourceSize && cropSize < options.minimumSourceSize) {
    throw new Error(
      `The selected area is only ${cropSize} pixels wide. Zoom out or choose a clearer photo so at least ${options.minimumSourceSize} pixels are available.`,
    );
  }

  if (!Number.isFinite(croppedAreaPixels.x) || !Number.isFinite(croppedAreaPixels.y) ||
      croppedAreaPixels.x < -1 || croppedAreaPixels.y < -1 ||
      croppedAreaPixels.x + cropSize > image.naturalWidth + 1 ||
      croppedAreaPixels.y + cropSize > image.naturalHeight + 1) {
    throw new Error("The crop extends outside the photo. Reposition it and try again.");
  }

  canvas.width = options.outputSize;
  canvas.height = options.outputSize;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    image,
    Math.max(0, croppedAreaPixels.x),
    Math.max(0, croppedAreaPixels.y),
    cropSize,
    cropSize,
    0,
    0,
    options.outputSize,
    options.outputSize,
  );

  return canvas;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode the cropped photo."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = () => reject(new Error("Failed to prepare the cropped photo for saving."));
    reader.readAsDataURL(blob);
  });
}

async function verifyBlobDimensions(blob: Blob, expectedSize: number): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await createImage(objectUrl);
    if (image.naturalWidth !== expectedSize || image.naturalHeight !== expectedSize) {
      throw new Error(
        `Photo verification failed: expected ${expectedSize} x ${expectedSize}, received ${image.naturalWidth} x ${image.naturalHeight}.`,
      );
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function createPupilPhotoDataUrl(
  imageSrc: string,
  croppedAreaPixels: Area,
): Promise<string> {
  const canvas = await createSquareCropCanvas(imageSrc, croppedAreaPixels, {
    outputSize: PUPIL_PHOTO_OUTPUT_SIZE,
    minimumSourceSize: PUPIL_PHOTO_OUTPUT_SIZE,
  });

  return encodePupilPhotoCanvas(canvas);
}

export async function encodePupilPhotoCanvas(canvas: HTMLCanvasElement): Promise<string> {

  let quality = PUPIL_PHOTO_INITIAL_QUALITY;
  let blob = await canvasToJpegBlob(canvas, quality);

  while (blob.size > PUPIL_PHOTO_MAX_BYTES && quality > PUPIL_PHOTO_MINIMUM_QUALITY) {
    quality = Math.max(PUPIL_PHOTO_MINIMUM_QUALITY, quality - PUPIL_PHOTO_QUALITY_STEP);
    blob = await canvasToJpegBlob(canvas, quality);
  }

  if (blob.size > PUPIL_PHOTO_MAX_BYTES) {
    throw new Error(
      "The cropped photo could not be reduced to a safe file size without sacrificing clarity. Please choose a less detailed photo.",
    );
  }

  await verifyBlobDimensions(blob, PUPIL_PHOTO_OUTPUT_SIZE);
  const dataUrl = await blobToDataUrl(blob);
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error("The cropped photo was not encoded as a JPEG.");
  }

  return dataUrl;
}

export async function createEnhancedPupilPhoto(
  imageSrc: string, area: Area, settings: PhotoSettings, tools: PhotoToolsClient, face?: PhotoFace,
) {
  const canvas = await createSquareCropCanvas(imageSrc, area, {
    outputSize: PUPIL_PHOTO_OUTPUT_SIZE, minimumSourceSize: PUPIL_PHOTO_OUTPUT_SIZE,
  });
  const ctx = canvas.getContext("2d")!;
  const original = await encodePupilPhotoCanvas(canvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const scale = canvas.width / Math.min(area.width, area.height);
  const region = face ? { x: (face.x - area.x) * scale, y: (face.y - area.y) * scale,
    width: face.width * scale, height: face.height * scale } : undefined;
  const result = await tools.enhance(imageData.data, canvas.width, canvas.height, settings, region);
  if (settings.removeBackground) {
    try {
      const mask = await tools.segment(canvas, { source: imageSrc, area });
      result.pixels = applyWhiteBackground(result.pixels, canvas.width, canvas.height, mask);
    } catch {
      throw new Error("Background removal is unavailable. Connect and try again, or turn off Remove background to keep editing.");
    }
  }
  if (face && (face.x < area.x || face.y < area.y || face.x + face.width > area.x + area.width || face.y + face.height > area.y + area.height)) {
    result.warnings.push({ code: "face-cut-off", message: "Part of the face is outside the crop. Reposition the photo before saving." });
  }
  imageData.data.set(result.pixels);
  ctx.putImageData(imageData, 0, 0);
  return { photo: await encodePupilPhotoCanvas(canvas), original, warnings: result.warnings };
}
