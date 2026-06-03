"use client";

import type { Area } from "react-easy-crop";

export interface CropCanvasOptions {
  minOutputSize: number;
  maxOutputSize: number;
}

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

  const cropSize = Math.min(croppedAreaPixels.width, croppedAreaPixels.height);
  let outputSize = Math.round(cropSize);

  if (outputSize < options.minOutputSize) {
    outputSize = options.minOutputSize;
  } else if (outputSize > options.maxOutputSize) {
    outputSize = options.maxOutputSize;
  }

  canvas.width = outputSize;
  canvas.height = outputSize;

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
    outputSize,
    outputSize,
  );

  return canvas;
}
