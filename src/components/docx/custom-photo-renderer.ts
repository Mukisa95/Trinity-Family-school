import jsPDF from 'jspdf';
import type { Pupil } from '@/types';
import type { PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';
import {
  applyTextCase,
  getLayerColumnIndex,
  isPupilDataLayer,
  pupilDisplayName,
  resolvePupilField,
  getPaperDimensions,
  PAPER_SIZE_OPTIONS,
  type CustomPhotoLayer,
  type CustomPhotoOutputSettings,
  type CustomPhotoPage,
  type CustomPhotoTemplate,
  type FrameShape,
  type RenderPupilData,
  type SchoolDocumentInfo,
} from './custom-photo-types';
import { createCanvasPaint, drawStyledShape, drawStyledText } from './custom-photo-appearance';

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
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight) * Math.max(0.1, zoom);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  const x = (width - drawnWidth) / 2 + offsetX * Math.max(width, drawnWidth) * 0.2;
  const y = (height - drawnHeight) / 2 + offsetY * Math.max(height, drawnHeight) * 0.2;
  context.drawImage(image, x, y, drawnWidth, drawnHeight);
}

function makeShapePath(context: CanvasRenderingContext2D, shape: FrameShape, width: number, height: number, inset = 0) {
  const left = inset;
  const top = inset;
  const right = Math.max(left, width - inset);
  const bottom = Math.max(top, height - inset);
  const innerWidth = Math.max(1, right - left);
  const innerHeight = Math.max(1, bottom - top);
  context.beginPath();
  if (shape === 'circle' || shape === 'oval') {
    context.ellipse(width / 2, height / 2, innerWidth / 2, innerHeight / 2, 0, 0, Math.PI * 2);
    return;
  }
  if (shape === 'diamond') {
    context.moveTo(width / 2, top);
    context.lineTo(right, height / 2);
    context.lineTo(width / 2, bottom);
    context.lineTo(left, height / 2);
    context.closePath();
    return;
  }
  if (shape === 'hexagon') {
    context.moveTo(left + innerWidth * 0.25, top);
    context.lineTo(left + innerWidth * 0.75, top);
    context.lineTo(right, height / 2);
    context.lineTo(left + innerWidth * 0.75, bottom);
    context.lineTo(left + innerWidth * 0.25, bottom);
    context.lineTo(left, height / 2);
    context.closePath();
    return;
  }
  if (shape === 'rounded') {
    context.roundRect(left, top, innerWidth, innerHeight, Math.min(innerWidth, innerHeight) * 0.12);
    return;
  }
  context.rect(left, top, innerWidth, innerHeight);
}

function applyDirectionalFeather(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  side: 'top' | 'right' | 'bottom' | 'left',
  amount: number,
) {
  if (amount <= 0) return;
  const normalized = Math.min(0.75, amount / 100 * 0.75);
  let gradient: CanvasGradient;
  if (side === 'top') {
    gradient = context.createLinearGradient(0, 0, 0, height * normalized);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
  } else if (side === 'bottom') {
    gradient = context.createLinearGradient(0, height * (1 - normalized), 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
  } else if (side === 'left') {
    gradient = context.createLinearGradient(0, 0, width * normalized, 0);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
  } else {
    gradient = context.createLinearGradient(width * (1 - normalized), 0, width, 0);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
  }
  context.save();
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function createPhotoMaskCanvas(width: number, height: number, layer: CustomPhotoLayer) {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = Math.max(2, Math.round(width));
  maskCanvas.height = Math.max(2, Math.round(height));
  const maskContext = maskCanvas.getContext('2d');
  if (!maskContext) return maskCanvas;
  const blur = Math.min(maskCanvas.width, maskCanvas.height) * Math.min(100, Math.max(0, layer.feather || 0)) / 100 * 0.16;
  maskContext.save();
  if (blur > 0.5) maskContext.filter = `blur(${blur}px)`;
  makeShapePath(maskContext, layer.shape, maskCanvas.width, maskCanvas.height, blur > 0.5 ? blur * 1.35 : 0);
  maskContext.fillStyle = '#ffffff';
  maskContext.fill();
  maskContext.restore();
  applyDirectionalFeather(maskContext, maskCanvas.width, maskCanvas.height, 'top', layer.featherTop || 0);
  applyDirectionalFeather(maskContext, maskCanvas.width, maskCanvas.height, 'right', layer.featherRight || 0);
  applyDirectionalFeather(maskContext, maskCanvas.width, maskCanvas.height, 'bottom', layer.featherBottom || 0);
  applyDirectionalFeather(maskContext, maskCanvas.width, maskCanvas.height, 'left', layer.featherLeft || 0);
  return maskCanvas;
}

export function createPhotoMaskDataUrl(layer: CustomPhotoLayer, width = 180, height = 180) {
  if (typeof document === 'undefined') return undefined;
  return createPhotoMaskCanvas(width, height, layer).toDataURL('image/png');
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

  const source = layer.kind === 'avatar' ? data.pupil.photo : layer.kind === 'schoolLogo' ? data.school?.logo : layer.source;
  if (source) {
    try {
      const image = await loadImage(source);
      layerContext.save();
      try {
        layerContext.translate(pixelWidth / 2, pixelHeight / 2);
        layerContext.rotate(layer.rotation * Math.PI / 180);
        layerContext.translate(-pixelWidth / 2, -pixelHeight / 2);
        if (layer.imageFit === 'contain') drawContainedImage(layerContext, image, pixelWidth, pixelHeight, layer.imageZoom, layer.imageOffsetX, layer.imageOffsetY);
        else drawCoverImage(layerContext, image, pixelWidth, pixelHeight, layer.imageZoom, layer.imageOffsetX, layer.imageOffsetY);
      } finally {
        layerContext.restore();
      }
    } catch {
      if (layer.kind === 'avatar') drawInitials(layerContext, data.pupil, pixelWidth, pixelHeight);
    }
  } else if (layer.kind === 'avatar') {
    drawInitials(layerContext, data.pupil, pixelWidth, pixelHeight);
  }
  const maskCanvas = createPhotoMaskCanvas(pixelWidth, pixelHeight, layer);
  layerContext.save();
  layerContext.globalCompositeOperation = 'destination-in';
  layerContext.drawImage(maskCanvas, 0, 0);
  layerContext.restore();

  const appearance = layer.appearance;
  if (appearance.shadow.enabled && appearance.shadow.kind === 'outer') {
    context.save();
    makeShapePath(context, layer.shape, width, height);
    context.shadowColor = appearance.shadow.color;
    context.shadowBlur = appearance.shadow.blur * Math.max(0.45, width / 500);
    context.shadowOffsetX = appearance.shadow.offsetX * Math.max(0.45, width / 500);
    context.shadowOffsetY = appearance.shadow.offsetY * Math.max(0.45, width / 500);
    context.globalAlpha = appearance.shadow.opacity;
    context.strokeStyle = appearance.shadow.color;
    context.lineWidth = Math.max(1, appearance.stroke.width * Math.max(0.45, width / 500), width / 900);
    context.stroke();
    context.restore();
  }
  context.drawImage(layerCanvas, 0, 0, width, height);
  const stroke = appearance.stroke;
  if (appearance.bevel.enabled && appearance.bevel.depth > 0) {
    const radians = (appearance.bevel.angle - 90) * Math.PI / 180;
    const scale = Math.max(0.45, width / 500);
    const depth = appearance.bevel.depth * scale;
    context.save();
    context.globalAlpha = appearance.bevel.opacity;
    context.translate(-Math.cos(radians) * depth * 0.4, -Math.sin(radians) * depth * 0.4);
    makeShapePath(context, layer.shape, width, height, depth / 2);
    context.strokeStyle = appearance.bevel.highlightColor;
    context.lineWidth = Math.max(1, depth);
    context.stroke();
    context.restore();
    context.save();
    context.globalAlpha = appearance.bevel.opacity;
    context.translate(Math.cos(radians) * depth * 0.4, Math.sin(radians) * depth * 0.4);
    makeShapePath(context, layer.shape, width, height, depth / 2);
    context.strokeStyle = appearance.bevel.shadowColor;
    context.lineWidth = Math.max(1, depth);
    context.stroke();
    context.restore();
  }
  if (stroke.enabled && stroke.width > 0) {
    context.save();
    const lineWidth = stroke.width * Math.max(0.5, width / 500);
    makeShapePath(context, layer.shape, width, height, lineWidth / 2);
    context.globalAlpha = stroke.opacity;
    context.strokeStyle = createCanvasPaint(context, stroke.paint, width, height);
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();
  }
  if (appearance.shine.enabled) {
    const radians = (appearance.shine.angle - 90) * Math.PI / 180;
    const span = Math.max(width, height) * appearance.shine.width;
    const offset = (appearance.shine.position - 0.5) * Math.max(width, height);
    const gradient = context.createLinearGradient(
      width / 2 - Math.sin(radians) * span + Math.cos(radians) * offset,
      height / 2 + Math.cos(radians) * span + Math.sin(radians) * offset,
      width / 2 + Math.sin(radians) * span + Math.cos(radians) * offset,
      height / 2 - Math.cos(radians) * span + Math.sin(radians) * offset,
    );
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, `rgba(255,255,255,${appearance.shine.opacity})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.save();
    makeShapePath(context, layer.shape, width, height, Math.max(0.5, appearance.stroke.width * Math.max(0.45, width / 500) / 2));
    context.strokeStyle = gradient;
    context.lineWidth = Math.max(1, appearance.stroke.width * Math.max(0.45, width / 500), width / 900);
    context.stroke();
    context.restore();
  }
}

function renderShapeLayer(
  context: CanvasRenderingContext2D,
  layer: CustomPhotoLayer,
  width: number,
  height: number,
) {
  drawStyledShape(context, layer.shape, layer.appearance, width, height);
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
  const text = applyTextCase(layer.field ? resolvePupilField(layer.field, data) : (layer.text || ''), layer.textCase);
  const fontSize = Math.max(7, layer.fontSize * cardWidth / 1000);
  const fontFamily = `"${(layer.fontFamily || 'Arial').replaceAll('"', '\\"')}"`;
  context.font = `${layer.fontStyle || 'normal'} ${layer.fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = layer.textAlign;
  context.textBaseline = 'middle';
  const lines = wrapText(context, text, Math.max(1, width - fontSize * 0.35));
  const lineHeight = fontSize * layer.lineHeight;
  const totalHeight = lines.length * lineHeight;
  const startY = (height - totalHeight) / 2 + lineHeight / 2;
  const x = layer.textAlign === 'left' ? fontSize * 0.18 : layer.textAlign === 'right' ? width - fontSize * 0.18 : width / 2;
  const drawFill = (target: CanvasRenderingContext2D) => {
    lines.forEach((line, index) => target.fillText(line, x, startY + index * lineHeight));
  };
  const drawStroke = (target: CanvasRenderingContext2D) => {
    lines.forEach((line, index) => target.strokeText(line, x, startY + index * lineHeight));
  };
  drawStyledText(context, layer.appearance, width, height, drawFill, drawStroke);
  if (layer.underline) {
    context.save();
    context.strokeStyle = createCanvasPaint(context, layer.appearance.fill, width, height);
    context.lineWidth = Math.max(1, fontSize * 0.055);
    lines.forEach((line, index) => {
      if (!line) return;
      const y = startY + index * lineHeight;
      const lineWidth = context.measureText(line).width;
      const startX = layer.textAlign === 'left' ? x : layer.textAlign === 'right' ? x - lineWidth : x - lineWidth / 2;
      context.beginPath();
      context.moveTo(startX, y + fontSize * 0.38);
      context.lineTo(startX + lineWidth, y + fontSize * 0.38);
      context.stroke();
    });
    context.restore();
  }
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
  if (layer.kind === 'text' || layer.kind === 'shape') context.rotate(layer.rotation * Math.PI / 180);
  context.translate(-width / 2, -height / 2);
  if (layer.kind === 'text') renderTextLayer(context, layer, data, width, height, cardWidth);
  else if (layer.kind === 'shape') renderShapeLayer(context, layer, width, height);
  else await renderImageLayer(context, layer, data, width, height);
  context.restore();
}

async function renderDesignCard(
  context: CanvasRenderingContext2D,
  page: CustomPhotoPage,
  data: RenderPupilData[],
  pageColumns: number,
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
  const primaryData = data[0];
  for (const layer of page.layers) {
    const pupilBound = isPupilDataLayer(layer);
    const layerData = pupilBound && layer.pupilDataMode === 'follow'
      ? data[getLayerColumnIndex(layer, pageColumns)]
      : primaryData;
    if (!layerData) continue;
    await renderLayer(context, layer, layerData, width, height);
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
  pageWidthMm: number,
  pageHeightMm: number,
) {
  const pixelsPerMm = 5.9;
  const width = Math.round(pageWidthMm * pixelsPerMm);
  const height = Math.round(pageHeightMm * pixelsPerMm);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not start the document renderer.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  const pxPerMm = width / pageWidthMm;
  const margin = settings.marginMm * pxPerMm;
  const gap = settings.gapMm * pxPerMm;
  const grid = calculateGrid(settings.cardsPerPage, width, height, template.aspectWidth, template.aspectHeight, margin, gap);
  const pageColumns = Math.max(1, template.pageColumns || 1);
  const cardCount = Math.ceil(pupils.length / pageColumns);

  for (let index = 0; index < cardCount; index += 1) {
    const column = index % grid.columns;
    const row = Math.floor(index / grid.columns);
    const x = grid.startX + column * (grid.cardWidth + grid.gap);
    const y = grid.startY + row * (grid.cardHeight + grid.gap);
    const cardPupils = pupils.slice(index * pageColumns, (index + 1) * pageColumns);
    await renderDesignCard(context, designPage, cardPupils, pageColumns, x, y, grid.cardWidth, grid.cardHeight);
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
  school?: SchoolDocumentInfo,
  onProgress?: (completed: number, total: number) => void,
) {
  if (pupils.length === 0) throw new Error('Select at least one pupil.');
  if (template.pages.length === 0) throw new Error('Add at least one design page.');
  const orientation = settings.orientation;
  const preset = PAPER_SIZE_OPTIONS.find((option) => option.value === settings.paperSize) || PAPER_SIZE_OPTIONS[1];
  const format: [number, number] = settings.paperSize === 'custom'
    ? [template.aspectWidth, template.aspectHeight]
    : [preset.widthMm, preset.heightMm];
  const expectedDimensions = settings.paperSize === 'custom'
    ? { widthMm: template.aspectWidth, heightMm: template.aspectHeight }
    : getPaperDimensions(settings.paperSize, orientation);
  const pdf = new jsPDF({ orientation, unit: 'mm', format, compress: true });
  const pageWidthMm = pdf.internal.pageSize.getWidth() || expectedDimensions.widthMm;
  const pageHeightMm = pdf.internal.pageSize.getHeight() || expectedDimensions.heightMm;
  const groups: Pupil[][] = [];
  const pupilsPerSheet = Math.max(1, settings.cardsPerPage) * Math.max(1, template.pageColumns || 1);
  for (let index = 0; index < pupils.length; index += pupilsPerSheet) {
    groups.push(pupils.slice(index, index + pupilsPerSheet));
  }
  const totalPages = groups.length * template.pages.length;
  let completed = 0;
  let isFirstPage = true;

  for (const group of groups) {
    const renderData = group.map((pupil) => ({ pupil, fees: feesByPupil[pupil.id], school }));
    for (const designPage of template.pages) {
      if (!isFirstPage) pdf.addPage(format, orientation);
      const canvas = await renderOutputSheet(designPage, renderData, template, settings, pageWidthMm, pageHeightMm);
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

export function estimatePdfPageCount(pupilCount: number, pageCount: number, cardsPerPage: number, pageColumns = 1) {
  return Math.ceil(pupilCount / (Math.max(1, cardsPerPage) * Math.max(1, pageColumns))) * pageCount;
}

export { pupilDisplayName };
