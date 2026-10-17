import type { CustomPhotoTemplate, StudioPupilPhotoTreatment, StudioSelectionStep } from './custom-photo-types';
import { combineSelection, paintSelectionStroke, selectConnectedColour, selectPolygon, selectRegion } from './studio-selection';

/** Explicit document-wide application can replace old one-pupil snapshots atomically. */
export function applyStudioSharedSelection(template: CustomPhotoTemplate, pageId: string, layerId: string, settings: StudioPupilPhotoTreatment, replaceIndividualEdits: boolean, pupilId?: string) {
  return { ...template, pupilPhotoTreatment: settings, pages: template.pages.map(page => ({ ...page, layers: page.layers.map(layer => {
    const selected = page.id === pageId && layer.id === layerId;
    if (layer.kind !== 'avatar' || (!selected && (!replaceIndividualEdits || layer.photoSelection))) return layer;
    const edits = { ...layer.pupilImageEdits };
    if (pupilId) delete edits[pupilId];
    return { ...layer, rasterOverride: undefined, pupilImageEdits: replaceIndividualEdits ? undefined : edits, ...(selected ? { photoSelection: undefined } : {}) };
  }) })) };
}

/** Replay geometry at normalized positions; AI and colour tools inspect this photo's pixels. */
export async function replayStudioSelection(width: number, height: number, pixels: Uint8ClampedArray, steps: StudioSelectionStep[], infer: (step: StudioSelectionStep) => Promise<Uint8ClampedArray>) {
  let mask: Uint8ClampedArray = new Uint8ClampedArray(width * height);
  for (const step of steps) {
    if (step.tool === 'invert') { mask = mask.map(value => 255 - value); continue; }
    if (step.tool === 'clear') { mask.fill(0); continue; }
    let next: Uint8ClampedArray;
    if (step.tool === 'all') next = new Uint8ClampedArray(width * height).fill(255);
    else if (step.tool === 'object' || step.tool === 'person') next = await infer(step);
    else if (step.tool === 'wand') next = selectConnectedColour(pixels, width, height, step.point, step.tolerance || 0);
    else if (step.tool === 'polygon') next = selectPolygon(width, height, step.points);
    else if (step.tool === 'brush') {
      next = new Uint8ClampedArray(mask);
      for (let i = 0; i < step.points.length; i++) paintSelectionStroke(next, width, height, step.points[Math.max(0, i - 1)], step.points[i], (step.radius || 0.01) * Math.max(width, height), step.erase);
      mask = next; continue;
    } else if (step.tool === 'rectangle' || step.tool === 'ellipse') next = selectRegion(width, height, step.points[0], step.points[1], step.tool === 'ellipse');
    else throw new Error('This saved selection contains an unsupported tool. Open the selector and apply it again.');
    mask = combineSelection(mask, next, step.mode);
  }
  return mask;
}
