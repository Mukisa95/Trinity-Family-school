import jsPDF from 'jspdf';
import type { Pupil } from '@/types';
import type { PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';
import {
  pupilDisplayName,
  resolvePupilField,
  type CustomPhotoLayer,
  type CustomPhotoOutputSettings,
  type CustomPhotoPage,
  type CustomPhotoTemplate,
  type FrameShape,
  type RenderPupilData,
} from './custom-photo-types';

const PORTRAIT_WIDTH = 1240;
const PORTRAIT_HEIGHT = 1754;

interface GridLayout {
  columns: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  startX: number;
  startY: number;
  gap: number;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(source: string) {
  const cached = imageCache.get(source);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load an image used by the design.`));
    image.src = source;
  });
  imageCache.set(source, promise);
  return promise;
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The document page could not be encoded. Check that imported images allow printing.'));
    }, 'image/jpeg', 0.92);
  });
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * Math.max(0.1, zoom);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  const travelX = Math.max(0, (drawnWidth - width) / 2);
  const travelY = Math.max(0, (drawnHeight - height) / 2);
  const x = (width - drawnWidth) / 2 + offsetX * travelX;
  const y = (height - drawnHeight) / 2 + offsetY * travelY;
  context.drawImage(image, x, y, drawnWidth, drawnHeight);
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function makeShapePath(context: CanvasRenderingContext2D, shape: FrameShape, width: number, height: number) {
  context.beginPath();
  if (shape === 'circle' || shape === 'oval') {
    context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    return;
  }
  if (shape === 'diamond') {
    context.moveTo(width / 2, 0);
    context.lineTo(width, height / 2);
    context.lineTo(width / 2, height);
    context.lineTo(0, height / 2);
    context.closePath();
    return;
  }
  if (shape === 'hexagon') {
    context.moveTo(width * 0.25, 0);
    context.lineTo(width * 0.75, 0);
    context.lineTo(width, height / 2);
    context.lineTo(width * 0.75, height);
    context.lineTo(width * 0.25, height);
    context.lineTo(0, height / 2);
    context.closePath();
    return;
  }
  if (shape === 'rounded') {
    context.roundRect(0, 0, width, height, Math.min(width, height) * 0.12);
    return;
  }
  context.rect(0, 0, width, height);
}

function drawInitials(context: CanvasRenderingContext2D, pupil: Pupil, width: number, height: number) {
  context.fillStyle = '#e2e8f0';
  context.fillRect(0, 0, width, height);
  const initials = `${pupil.firstName?.[0] || ''}${pupil.lastName?.[0] || ''}`.toUpperCase() || '?';
  context.fillStyle = '#475569';
  context.font = `800 ${Math.max(16, Math.min(width, height) * 0.3)}px Arial`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(initials, width / 2, height / 2);
}

async function renderImageLayer(
  context: CanvasRenderingContext2D,
  layer: CustomPhotoLayer,
  data: RenderPupilData,
  width: number,
  height: number,
) {
  const pixelWidth = Math.max(2, Math.round(width));
  const pixelHeight = Math.max(2, Math.round(height));
  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = pixelWidth;
  layerCanvas.height = pixelHeight;
  const layerContext = layerCanvas.getContext('2d');
  if (!layerContext) return;

  layerContext.save();
  makeShapePath(layerContext, layer.shape, pixelWidth, pixelHeight);
  layerContext.clip();
  const source = layer.kind === 'avatar' ? data.pupil.photo : layer.source;
  if (source) {
    try {
      const image = await loadImage(source);
      drawCoverImage(layerContext, image, pixelWidth, pixelHeight, layer.imageZoom, layer.imageOffsetX, layer.imageOffsetY);
    } catch {
      if (layer.kind === 'avatar') drawInitials(layerContext, data.pupil, pixelWidth, pixelHeight);
    }
  } else if (layer.kind === 'avatar') {
    drawInitials(layerContext, data.pupil, pixelWidth, pixelHeight);
  }
  layerContext.restore();

  if (layer.feather > 0) {
    layerContext.save();
    layerContext.globalCompositeOperation = 'destination-in';
    const feather = Math.min(0.48, layer.feather / 100 * 0.48);
    const gradient = layerContext.createRadialGradient(
      pixelWidth / 2,
      pixelHeight / 2,
      Math.min(pixelWidth, pixelHeight) * (0.5 - feather),
      pixelWidth / 2,
      pixelHeight / 2,
      Math.max(pixelWidth, pixelHeight) * 0.72,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(Math.max(0.05, 1 - feather * 2), 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    layerContext.fillStyle = gradient;
    layerContext.fillRect(0, 0, pixelWidth, pixelHeight);
    layerContext.restore();
  }

  context.drawImage(layerCanvas, 0, 0, width, height);
  if (layer.borderWidth > 0) {
    context.save();
    makeShapePath(context, layer.shape, width, height);
    context.strokeStyle = layer.borderColor;
    context.lineWidth = layer.borderWidth * Math.max(0.5, width / 500);
    context.stroke();
    context.restore();
  }
}

function wrapText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const paragraphs = value.split('\n');
  const lines: string[] = [];
  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      return;
    }
    let line = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const candidate = `${line} ${words[index]}`;
      if (context.measureText(candidate).width <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = words[index];
      }
    }
    lines.push(line);
  });
  return lines;
}

function renderTextLayer(
  context: CanvasRenderingContext2D,
  layer: CustomPhotoLayer,
  data: RenderPupilData,
  width: number,
  height: number,
  cardWidth: number,
) {
  if (layer.backgroundColor && layer.backgroundColor !== 'transparent') {
    context.fillStyle = layer.backgroundColor;
    context.fillRect(0, 0, width, height);
  }
  const text = layer.field ? resolvePupilField(layer.field, data) : (layer.text || '');
  const fontSize = Math.max(7, layer.fontSize * cardWidth / 1000);
  context.fillStyle = layer.color;
  context.font = `${layer.fontWeight} ${fontSize}px ${layer.fontFamily}`;
  context.textAlign = layer.textAlign;
  context.textBaseline = 'middle';
  const lines = wrapText(context, text, Math.max(1, width - fontSize * 0.35));
  const lineHeight = fontSize * layer.lineHeight;
  const totalHeight = lines.length * lineHeight;
  const startY = (height - totalHeight) / 2 + lineHeight / 2;
  const x = layer.textAlign === 'left' ? fontSize * 0.18 : layer.textAlign === 'right' ? width - fontSize * 0.18 : width / 2;
  lines.forEach((line, index) => context.fillText(line, x, startY + index * lineHeight));
}

async function renderLayer(
  context: CanvasRenderingContext2D,
  layer: CustomPhotoLayer,
  data: RenderPupilData,
  cardWidth: number,
  cardHeight: number,
) {
  if (layer.hidden) return;
  const x = layer.x * cardWidth;
  const y = layer.y * cardHeight;
  const width = layer.width * cardWidth;
  const height = layer.height * cardHeight;
  context.save();
  context.globalAlpha = layer.opacity;
  context.translate(x + width / 2, y + height / 2);
  context.rotate(layer.rotation * Math.PI / 180);
  context.translate(-width / 2, -height / 2);
  if (layer.kind === 'text') renderTextLayer(context, layer, data, width, height, cardWidth);
  else await renderImageLayer(context, layer, data, width, height);
  context.restore();
}

async function renderDesignCard(
  context: CanvasRenderingContext2D,
  page: CustomPhotoPage,
  data: RenderPupilData,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.save();
  context.translate(x, y);
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  context.fillStyle = page.backgroundColor || '#ffffff';
  context.fillRect(0, 0, width, height);
  if (page.background) {
    try {
      const background = await loadImage(page.background);
      if (page.backgroundFit === 'contain') drawContainedImage(context, background, width, height);
      else if (page.backgroundFit === 'stretch') context.drawImage(background, 0, 0, width, height);
      else drawCoverImage(context, background, width, height);
    } catch {
      // Keep the page background colour when an imported image is no longer available.
    }
  }
  for (const layer of page.layers) {
    await renderLayer(context, layer, data, width, height);
  }
  context.restore();
}

function calculateGrid(
  count: number,
  pageWidth: number,
  pageHeight: number,
  aspectWidth: number,
  aspectHeight: number,
  margin: number,
  gap: number,
): GridLayout {
  let best: GridLayout | null = null;
  const ratio = aspectWidth / aspectHeight;
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const slotWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
    const slotHeight = (pageHeight - margin * 2 - gap * (rows - 1)) / rows;
    const cardWidth = Math.min(slotWidth, slotHeight * ratio);
    const cardHeight = cardWidth / ratio;
    const area = cardWidth * cardHeight;
    if (!best || area > best.cardWidth * best.cardHeight) {
      const gridWidth = columns * cardWidth + (columns - 1) * gap;
      const gridHeight = rows * cardHeight + (rows - 1) * gap;
      best = {
        columns,
        rows,
        cardWidth,
        cardHeight,
        startX: (pageWidth - gridWidth) / 2,
        startY: (pageHeight - gridHeight) / 2,
        gap,
      };
    }
  }
  return best as GridLayout;
}

async function renderOutputSheet(
  designPage: CustomPhotoPage,
  pupils: RenderPupilData[],
  template: CustomPhotoTemplate,
  settings: CustomPhotoOutputSettings,
) {
  const portrait = settings.orientation === 'portrait';
  const width = portrait ? PORTRAIT_WIDTH : PORTRAIT_HEIGHT;
  const height = portrait ? PORTRAIT_HEIGHT : PORTRAIT_WIDTH;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not start the document renderer.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  const pxPerMm = width / (portrait ? 210 : 297);
  const margin = settings.marginMm * pxPerMm;
  const gap = settings.gapMm * pxPerMm;
  const grid = calculateGrid(settings.cardsPerPage, width, height, template.aspectWidth, template.aspectHeight, margin, gap);

  for (let index = 0; index < pupils.length; index += 1) {
    const column = index % grid.columns;
    const row = Math.floor(index / grid.columns);
    const x = grid.startX + column * (grid.cardWidth + grid.gap);
    const y = grid.startY + row * (grid.cardHeight + grid.gap);
    await renderDesignCard(context, designPage, pupils[index], x, y, grid.cardWidth, grid.cardHeight);
    if (settings.showCutLines) {
      context.save();
      context.strokeStyle = 'rgba(100,116,139,0.7)';
      context.lineWidth = 1;
      context.setLineDash([8, 6]);
      context.strokeRect(x, y, grid.cardWidth, grid.cardHeight);
      context.restore();
    }
  }
  return canvas;
}

export async function createCustomPhotoPdf(
  template: CustomPhotoTemplate,
  pupils: Pupil[],
  feesByPupil: Record<string, PupilFeesInfo>,
  settings: CustomPhotoOutputSettings,
  onProgress?: (completed: number, total: number) => void,
) {
  if (pupils.length === 0) throw new Error('Select at least one pupil.');
  if (template.pages.length === 0) throw new Error('Add at least one design page.');
  const orientation = settings.orientation;
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
  const pageWidthMm = orientation === 'portrait' ? 210 : 297;
  const pageHeightMm = orientation === 'portrait' ? 297 : 210;
  const groups: Pupil[][] = [];
  for (let index = 0; index < pupils.length; index += settings.cardsPerPage) {
    groups.push(pupils.slice(index, index + settings.cardsPerPage));
  }
  const totalPages = groups.length * template.pages.length;
  let completed = 0;
  let isFirstPage = true;

  for (const group of groups) {
    const renderData = group.map((pupil) => ({ pupil, fees: feesByPupil[pupil.id] }));
    for (const designPage of template.pages) {
      if (!isFirstPage) pdf.addPage('a4', orientation);
      const canvas = await renderOutputSheet(designPage, renderData, template, settings);
      const blob = await canvasToBlob(canvas);
      const imageData = await blob.arrayBuffer();
      pdf.addImage(new Uint8Array(imageData), 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
      completed += 1;
      onProgress?.(completed, totalPages);
      isFirstPage = false;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }
  return pdf.output('blob');
}

export function estimatePdfPageCount(pupilCount: number, pageCount: number, cardsPerPage: number) {
  return Math.ceil(pupilCount / Math.max(1, cardsPerPage)) * pageCount;
}

export { pupilDisplayName };
