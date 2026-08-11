"use client";

import type { Area } from "react-easy-crop";

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

async function createImage(src: string): Promise<HTMLImageElement> {
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

  canvas.width = options.outputSize;
  canvas.height = options.outputSize;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
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
