import type { Pupil } from '@/types';
import type { PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';

export type DocumentOrientation = 'portrait' | 'landscape';
export type PaperSize = 'a3' | 'a4' | 'a5' | 'letter' | 'legal' | 'square' | 'custom';
export type BackgroundFit = 'cover' | 'contain' | 'stretch';
export type LayerKind = 'avatar' | 'schoolLogo' | 'text' | 'image' | 'shape';
export type FrameShape = 'rectangle' | 'rounded' | 'circle' | 'oval' | 'diamond' | 'hexagon';
export type TextAlign = 'left' | 'center' | 'right';
export type TextCase = 'original' | 'uppercase' | 'lowercase' | 'sentence' | 'title';
export type PupilDataMode = 'duplicate' | 'follow';
export type PaintKind = 'solid' | 'linear' | 'radial';

export interface GradientStop {
  color: string;
  position: number;
}

export interface LayerPaint {
  kind: PaintKind;
  color: string;
  stops: GradientStop[];
  angle: number;
  centerX: number;
  centerY: number;
  radius: number;
}

export interface LayerAppearance {
  fill: LayerPaint;
  stroke: {
    enabled: boolean;
    width: number;
    opacity: number;
    paint: LayerPaint;
  };
  shadow: {
    enabled: boolean;
    kind: 'outer' | 'inner';
    color: string;
    opacity: number;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  bevel: {
    enabled: boolean;
    depth: number;
    softness: number;
    angle: number;
    highlightColor: string;
    shadowColor: string;
    opacity: number;
  };
  shine: {
    enabled: boolean;
    angle: number;
    position: number;
    width: number;
    opacity: number;
  };
  extrusion: {
    enabled: boolean;
    depth: number;
    angle: number;
    color: string;
    opacity: number;
  };
}
export type DynamicField =
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'class'
  | 'section'
  | 'age'
  | 'admissionNumber'
  | 'payCode'
  | 'feeBalance'
  | 'totalPaid'
  | 'totalFees'
  | 'schoolName'
  | 'schoolMotto'
  | 'schoolPhone'
  | 'schoolEmail'
  | 'schoolWebsite'
  | 'schoolAddress'
  | 'schoolPostalAddress';

export interface SchoolDocumentInfo {
  name?: string;
  logo?: string;
  motto?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  postalAddress?: string;
}

export const PAPER_SIZE_OPTIONS: Array<{ value: PaperSize; label: string; widthMm: number; heightMm: number }> = [
  { value: 'a3', label: 'A3', widthMm: 297, heightMm: 420 },
  { value: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
  { value: 'a5', label: 'A5', widthMm: 148, heightMm: 210 },
  { value: 'letter', label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  { value: 'legal', label: 'Legal', widthMm: 215.9, heightMm: 355.6 },
  { value: 'square', label: 'Square', widthMm: 210, heightMm: 210 },
  { value: 'custom', label: 'Custom', widthMm: 200, heightMm: 200 },
];

export interface CustomPhotoLayer {
  id: string;
  kind: LayerKind;
  label: string;
  field?: DynamicField;
  text?: string;
  source?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  constrainToPage: boolean;
  shape: FrameShape;
  feather: number;
  featherTop: number;
  featherRight: number;
  featherBottom: number;
  featherLeft: number;
  borderWidth: number;
  borderColor: string;
  imageZoom: number;
  imageFit: 'cover' | 'contain';
  imageOffsetX: number;
  imageOffsetY: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  underline: boolean;
  textCase: TextCase;
  pupilDataMode: PupilDataMode;
  color: string;
  backgroundColor: string;
  textAlign: TextAlign;
  lineHeight: number;
  appearance: LayerAppearance;
}

export interface CustomPhotoPage {
  id: string;
  name: string;
  background?: string;
  backgroundFit: BackgroundFit;
  backgroundColor: string;
  layers: CustomPhotoLayer[];
}

export interface CustomPhotoTemplate {
  version: 1;
  id: string;
  name: string;
  paperSize: PaperSize;
  pageOrientation: DocumentOrientation;
  pageMarginMm: number;
  pageColumns: number;
  aspectWidth: number;
  aspectHeight: number;
  pages: CustomPhotoPage[];
  updatedAt: string;
}

export interface CustomPhotoOutputSettings {
  paperSize: PaperSize;
  orientation: DocumentOrientation;
  cardsPerPage: number;
  marginMm: number;
  gapMm: number;
  showCutLines: boolean;
}

export interface RenderPupilData {
  pupil: Pupil;
  fees?: PupilFeesInfo;
  school?: SchoolDocumentInfo;
}

export const DYNAMIC_FIELD_OPTIONS: Array<{ value: DynamicField; label: string; sample: string; group: 'pupil' | 'school' }> = [
  { value: 'name', label: 'Full name', sample: 'AARON KASULE', group: 'pupil' },
  { value: 'firstName', label: 'First name', sample: 'AARON', group: 'pupil' },
  { value: 'lastName', label: 'Last name', sample: 'KASULE', group: 'pupil' },
  { value: 'class', label: 'Class', sample: 'Primary Two', group: 'pupil' },
  { value: 'section', label: 'Section', sample: 'Blue', group: 'pupil' },
  { value: 'age', label: 'Age', sample: '8 years', group: 'pupil' },
  { value: 'admissionNumber', label: 'Admission number', sample: 'TFS/0241', group: 'pupil' },
  { value: 'payCode', label: 'Pay code', sample: '204185', group: 'pupil' },
  { value: 'feeBalance', label: 'Fee balance', sample: 'UGX 250,000', group: 'pupil' },
  { value: 'totalPaid', label: 'Total paid', sample: 'UGX 750,000', group: 'pupil' },
  { value: 'totalFees', label: 'Total fees', sample: 'UGX 1,000,000', group: 'pupil' },
  { value: 'schoolName', label: 'School name', sample: 'Trinity Family Nursery & Primary School', group: 'school' },
  { value: 'schoolMotto', label: 'School motto', sample: 'Strive to Excel', group: 'school' },
  { value: 'schoolPhone', label: 'School contacts', sample: '+256 700 000000', group: 'school' },
  { value: 'schoolEmail', label: 'School email', sample: 'school@example.com', group: 'school' },
  { value: 'schoolWebsite', label: 'School website', sample: 'www.school.example', group: 'school' },
  { value: 'schoolAddress', label: 'Physical address', sample: 'Kampala, Uganda', group: 'school' },
  { value: 'schoolPostalAddress', label: 'Postal address', sample: 'P.O. Box 000, Kampala', group: 'school' },
];

export const FEE_FIELDS: DynamicField[] = ['feeBalance', 'totalPaid', 'totalFees'];

const clampAppearanceNumber = (value: unknown, minimum: number, maximum: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
};

export function createLayerPaint(color = '#0f172a'): LayerPaint {
  return {
    kind: 'solid',
    color,
    stops: [
      { color, position: 0 },
      { color, position: 1 },
    ],
    angle: 90,
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.75,
  };
}

export function createLayerAppearance(color = '#0f172a', borderColor = '#ffffff', borderWidth = 0): LayerAppearance {
  return {
    fill: createLayerPaint(color),
    stroke: { enabled: borderWidth > 0, width: borderWidth, opacity: 1, paint: createLayerPaint(borderColor) },
    shadow: { enabled: false, kind: 'outer', color: '#0f172a', opacity: 0.28, blur: 8, offsetX: 0, offsetY: 4 },
    bevel: { enabled: false, depth: 2, softness: 1, angle: 315, highlightColor: '#ffffff', shadowColor: '#0f172a', opacity: 0.55 },
    shine: { enabled: false, angle: 115, position: 0.32, width: 0.22, opacity: 0.42 },
    extrusion: { enabled: false, depth: 5, angle: 90, color: '#0f172a', opacity: 0.5 },
  };
}

function normalizePaint(paint: Partial<LayerPaint> | undefined, fallbackColor: string): LayerPaint {
  const base = createLayerPaint(fallbackColor);
  const candidateStops = Array.isArray(paint?.stops) ? paint.stops : base.stops;
  const stops = candidateStops
    .filter(Boolean)
    .slice(0, 8)
    .map((stop, index) => ({
      color: typeof stop.color === 'string' && stop.color ? stop.color : fallbackColor,
      position: clampAppearanceNumber(stop.position, 0, 1, index / Math.max(1, candidateStops.length - 1)),
    }))
    .sort((a, b) => a.position - b.position);
  return {
    kind: paint?.kind === 'linear' || paint?.kind === 'radial' ? paint.kind : 'solid',
    color: typeof paint?.color === 'string' && paint.color ? paint.color : fallbackColor,
    stops: stops.length >= 2 ? stops : base.stops,
    angle: clampAppearanceNumber(paint?.angle, -360, 360, base.angle),
    centerX: clampAppearanceNumber(paint?.centerX, 0, 1, base.centerX),
    centerY: clampAppearanceNumber(paint?.centerY, 0, 1, base.centerY),
    radius: clampAppearanceNumber(paint?.radius, 0.05, 2, base.radius),
  };
}

export function normalizeLayerAppearance(appearance: Partial<LayerAppearance> | undefined, color = '#0f172a', borderColor = '#ffffff', borderWidth = 0): LayerAppearance {
  const base = createLayerAppearance(color, borderColor, borderWidth);
  return {
    fill: normalizePaint(appearance?.fill, color),
    stroke: {
      enabled: typeof appearance?.stroke?.enabled === 'boolean' ? appearance.stroke.enabled : borderWidth > 0,
      width: clampAppearanceNumber(appearance?.stroke?.width, 0, 40, borderWidth),
      opacity: clampAppearanceNumber(appearance?.stroke?.opacity, 0, 1, 1),
      paint: normalizePaint(appearance?.stroke?.paint, borderColor),
    },
    shadow: {
      enabled: Boolean(appearance?.shadow?.enabled),
      kind: appearance?.shadow?.kind === 'inner' ? 'inner' : 'outer',
      color: typeof appearance?.shadow?.color === 'string' && appearance.shadow.color ? appearance.shadow.color : base.shadow.color,
      opacity: clampAppearanceNumber(appearance?.shadow?.opacity, 0, 1, base.shadow.opacity),
      blur: clampAppearanceNumber(appearance?.shadow?.blur, 0, 80, base.shadow.blur),
      offsetX: clampAppearanceNumber(appearance?.shadow?.offsetX, -80, 80, base.shadow.offsetX),
      offsetY: clampAppearanceNumber(appearance?.shadow?.offsetY, -80, 80, base.shadow.offsetY),
    },
    bevel: {
      enabled: Boolean(appearance?.bevel?.enabled),
      depth: clampAppearanceNumber(appearance?.bevel?.depth, 0, 30, base.bevel.depth),
      softness: clampAppearanceNumber(appearance?.bevel?.softness, 0, 30, base.bevel.softness),
      angle: clampAppearanceNumber(appearance?.bevel?.angle, -360, 360, base.bevel.angle),
      highlightColor: typeof appearance?.bevel?.highlightColor === 'string' && appearance.bevel.highlightColor ? appearance.bevel.highlightColor : base.bevel.highlightColor,
      shadowColor: typeof appearance?.bevel?.shadowColor === 'string' && appearance.bevel.shadowColor ? appearance.bevel.shadowColor : base.bevel.shadowColor,
      opacity: clampAppearanceNumber(appearance?.bevel?.opacity, 0, 1, base.bevel.opacity),
    },
    shine: {
      enabled: Boolean(appearance?.shine?.enabled),
      angle: clampAppearanceNumber(appearance?.shine?.angle, -360, 360, base.shine.angle),
      position: clampAppearanceNumber(appearance?.shine?.position, 0, 1, base.shine.position),
      width: clampAppearanceNumber(appearance?.shine?.width, 0.02, 1, base.shine.width),
      opacity: clampAppearanceNumber(appearance?.shine?.opacity, 0, 1, base.shine.opacity),
    },
    extrusion: {
      enabled: Boolean(appearance?.extrusion?.enabled),
      depth: clampAppearanceNumber(appearance?.extrusion?.depth, 0, 40, base.extrusion.depth),
      angle: clampAppearanceNumber(appearance?.extrusion?.angle, -360, 360, base.extrusion.angle),
      color: typeof appearance?.extrusion?.color === 'string' && appearance.extrusion.color ? appearance.extrusion.color : base.extrusion.color,
      opacity: clampAppearanceNumber(appearance?.extrusion?.opacity, 0, 1, base.extrusion.opacity),
    },
  };
}

export const APPEARANCE_PRESETS: Array<{ id: string; label: string; appearance: LayerAppearance }> = [
  { id: 'flat', label: 'Flat', appearance: createLayerAppearance('#0f172a') },
  { id: 'polished-gold', label: 'Polished gold', appearance: {
    ...createLayerAppearance('#d99000', '#fff0a6', 1.5),
    fill: { kind: 'linear', color: '#d99000', angle: 112, centerX: 0.5, centerY: 0.5, radius: 0.75, stops: [{ color: '#7a4300', position: 0 }, { color: '#f4bd31', position: 0.23 }, { color: '#fff6b3', position: 0.47 }, { color: '#e19a07', position: 0.7 }, { color: '#754000', position: 1 }] },
    stroke: { enabled: true, width: 1.5, opacity: 0.92, paint: { ...createLayerPaint('#fff3a2'), kind: 'linear', angle: 90, stops: [{ color: '#7b4700', position: 0 }, { color: '#fff4a8', position: 0.5 }, { color: '#9f5c00', position: 1 }] } },
    bevel: { enabled: true, depth: 2, softness: 1, angle: 315, highlightColor: '#fff8c8', shadowColor: '#5f3400', opacity: 0.65 },
    shine: { enabled: true, angle: 115, position: 0.3, width: 0.2, opacity: 0.38 },
    shadow: { enabled: true, kind: 'outer', color: '#392100', opacity: 0.32, blur: 6, offsetX: 0, offsetY: 3 },
  } },
  { id: 'deep-navy', label: 'Deep navy gloss', appearance: {
    ...createLayerAppearance('#062b72', '#dca72b', 1.2),
    fill: { kind: 'linear', color: '#062b72', angle: 125, centerX: 0.5, centerY: 0.5, radius: 0.75, stops: [{ color: '#010d35', position: 0 }, { color: '#0d3c94', position: 0.38 }, { color: '#174eae', position: 0.56 }, { color: '#031442', position: 1 }] },
    stroke: { enabled: true, width: 1.2, opacity: 0.9, paint: { ...createLayerPaint('#e9c66b'), kind: 'linear', angle: 90, stops: [{ color: '#87610c', position: 0 }, { color: '#ffe790', position: 0.5 }, { color: '#9a6c08', position: 1 }] } },
    bevel: { enabled: true, depth: 2, softness: 1, angle: 300, highlightColor: '#91b7ff', shadowColor: '#010722', opacity: 0.58 },
    shine: { enabled: true, angle: 120, position: 0.28, width: 0.18, opacity: 0.26 },
    shadow: { enabled: true, kind: 'outer', color: '#010722', opacity: 0.38, blur: 8, offsetX: 0, offsetY: 4 },
  } },
  { id: 'silver-chrome', label: 'Silver chrome', appearance: {
    ...createLayerAppearance('#b7c4d2', '#ffffff', 1.2),
    fill: { kind: 'linear', color: '#b7c4d2', angle: 90, centerX: 0.5, centerY: 0.5, radius: 0.75, stops: [{ color: '#3d4a5b', position: 0 }, { color: '#ecf5ff', position: 0.28 }, { color: '#8c9caf', position: 0.5 }, { color: '#ffffff', position: 0.7 }, { color: '#526171', position: 1 }] },
    bevel: { enabled: true, depth: 2, softness: 1, angle: 315, highlightColor: '#ffffff', shadowColor: '#263240', opacity: 0.58 },
    shine: { enabled: true, angle: 90, position: 0.28, width: 0.17, opacity: 0.35 },
    shadow: { enabled: true, kind: 'outer', color: '#15202b', opacity: 0.28, blur: 5, offsetX: 0, offsetY: 3 },
  } },
];

export function getAppearancePreset(id: string) {
  return APPEARANCE_PRESETS.find((preset) => preset.id === id);
}

export function isPupilDataLayer(layer: Pick<CustomPhotoLayer, 'kind' | 'field'>) {
  if (layer.kind === 'avatar') return true;
  if (layer.kind !== 'text' || !layer.field) return false;
  return DYNAMIC_FIELD_OPTIONS.some((option) => option.value === layer.field && option.group === 'pupil');
}

export function getLayerColumnIndex(layer: Pick<CustomPhotoLayer, 'x' | 'width'>, pageColumns: number) {
  const columns = Math.max(1, Math.round(pageColumns));
  return Math.min(columns - 1, Math.max(0, Math.floor((layer.x + layer.width / 2) * columns)));
}

export function makeStudioId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createTextLayer(field: DynamicField = 'name'): CustomPhotoLayer {
  const option = DYNAMIC_FIELD_OPTIONS.find((item) => item.value === field);
  return {
    id: makeStudioId('text'),
    kind: 'text',
    label: option?.label || 'Pupil text',
    field,
    x: 0.12,
    y: 0.72,
    width: 0.76,
    height: 0.1,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    constrainToPage: true,
    shape: 'rectangle',
    feather: 0,
    featherTop: 0,
    featherRight: 0,
    featherBottom: 0,
    featherLeft: 0,
    borderWidth: 0,
    borderColor: '#ffffff',
    imageZoom: 1,
    imageFit: 'cover',
    imageOffsetX: 0,
    imageOffsetY: 0,
    fontSize: 42,
    fontFamily: 'Arial',
    fontWeight: 800,
    fontStyle: 'normal',
    underline: false,
    textCase: 'original',
    pupilDataMode: 'follow',
    color: '#0f172a',
    backgroundColor: 'transparent',
    textAlign: 'center',
    lineHeight: 1.1,
    appearance: createLayerAppearance('#0f172a'),
  };
}

export function createCustomTextLayer(): CustomPhotoLayer {
  return {
    ...createTextLayer('name'),
    id: makeStudioId('custom-text'),
    label: 'Custom text',
    field: undefined,
    text: 'Your message here',
  };
}

export function createImageLayer(kind: 'avatar' | 'schoolLogo' | 'image', source?: string): CustomPhotoLayer {
  return {
    id: makeStudioId(kind),
    kind,
    label: kind === 'avatar' ? 'Pupil photo' : kind === 'schoolLogo' ? 'School badge' : 'Photo art',
    source,
    x: 0.25,
    y: 0.12,
    width: 0.5,
    height: 0.5,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    constrainToPage: true,
    shape: kind === 'avatar' ? 'circle' : 'rectangle',
    feather: 0,
    featherTop: 0,
    featherRight: 0,
    featherBottom: 0,
    featherLeft: 0,
    borderWidth: 0,
    borderColor: '#ffffff',
    imageZoom: 1,
    imageFit: kind === 'schoolLogo' ? 'contain' : 'cover',
    imageOffsetX: 0,
    imageOffsetY: 0,
    fontSize: 32,
    fontFamily: 'Arial',
    fontWeight: 700,
    fontStyle: 'normal',
    underline: false,
    textCase: 'original',
    pupilDataMode: 'follow',
    color: '#0f172a',
    backgroundColor: 'transparent',
    textAlign: 'center',
    lineHeight: 1.1,
    appearance: createLayerAppearance('#0f172a', '#ffffff'),
  };
}

export function createShapeLayer(shape: FrameShape = 'rounded'): CustomPhotoLayer {
  const appearance = createLayerAppearance('#0f766e', '#ffffff', 0);
  return {
    ...createImageLayer('image'),
    id: makeStudioId('shape'),
    kind: 'shape',
    label: 'Shape',
    source: undefined,
    x: 0.22,
    y: 0.22,
    width: 0.56,
    height: 0.24,
    shape,
    imageFit: 'cover',
    appearance,
    color: appearance.fill.color,
    backgroundColor: 'transparent',
  };
}

export function createBlankPage(index = 0): CustomPhotoPage {
  const avatar = createImageLayer('avatar');
  const name = createTextLayer('name');
  return {
    id: makeStudioId('page'),
    name: `Page ${index + 1}`,
    backgroundFit: 'cover',
    backgroundColor: '#ffffff',
    layers: [avatar, name],
  };
}

export function createBlankTemplate(): CustomPhotoTemplate {
  return {
    version: 1,
    id: makeStudioId('template'),
    name: 'Untitled pupil design',
    paperSize: 'a4',
    pageOrientation: 'portrait',
    pageMarginMm: 10,
    pageColumns: 1,
    aspectWidth: 210,
    aspectHeight: 297,
    pages: [createBlankPage(0)],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeCustomPhotoTemplate(template: Partial<CustomPhotoTemplate>): CustomPhotoTemplate {
  const fallback = createBlankTemplate();
  const paperSize = template.paperSize || 'custom';
  const pageOrientation = template.pageOrientation || (Number(template.aspectWidth) > Number(template.aspectHeight) ? 'landscape' : 'portrait');
  return {
    ...fallback,
    ...template,
    version: 1,
    id: template.id || fallback.id,
    name: template.name || fallback.name,
    paperSize,
    pageOrientation,
    pageMarginMm: Number.isFinite(template.pageMarginMm) ? Number(template.pageMarginMm) : 10,
    pageColumns: Math.min(6, Math.max(1, Math.round(Number(template.pageColumns) || 1))),
    aspectWidth: Number(template.aspectWidth) || fallback.aspectWidth,
    aspectHeight: Number(template.aspectHeight) || fallback.aspectHeight,
    pages: (template.pages?.length ? template.pages : fallback.pages).map((page, pageIndex) => ({
      ...createBlankPage(pageIndex),
      ...page,
      layers: page.layers.map((layer) => ({
        ...(layer.kind === 'text'
          ? createTextLayer(layer.field || 'name')
          : layer.kind === 'shape'
            ? createShapeLayer(layer.shape || 'rounded')
            : createImageLayer(layer.kind === 'avatar' || layer.kind === 'schoolLogo' ? layer.kind : 'image')),
        ...layer,
        featherTop: Number(layer.featherTop) || 0,
        featherRight: Number(layer.featherRight) || 0,
        featherBottom: Number(layer.featherBottom) || 0,
        featherLeft: Number(layer.featherLeft) || 0,
        appearance: normalizeLayerAppearance(layer.appearance, layer.color || '#0f172a', layer.borderColor || '#ffffff', Number(layer.borderWidth) || 0),
      })),
    })),
    updatedAt: template.updatedAt || new Date().toISOString(),
  };
}

function formatCurrency(value = 0) {
  return `UGX ${Math.round(value).toLocaleString('en-UG')}`;
}

function calculateAge(dateOfBirth?: string | Date) {
  if (!dateOfBirth) return '—';
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return `${Math.max(0, age)} ${age === 1 ? 'year' : 'years'}`;
}

export function pupilDisplayName(pupil: Pupil) {
  return [pupil.firstName, pupil.lastName, pupil.otherNames].filter(Boolean).join(' ').trim();
}

export function resolvePupilField(field: DynamicField | undefined, data: RenderPupilData) {
  const { pupil, fees, school } = data;
  switch (field) {
    case 'name': return pupilDisplayName(pupil) || 'Unnamed pupil';
    case 'firstName': return pupil.firstName || '—';
    case 'lastName': return pupil.lastName || '—';
    case 'class': return pupil.className || pupil.classCode || '—';
    case 'section': return pupil.section || '—';
    case 'age': return calculateAge(pupil.dateOfBirth);
    case 'admissionNumber': return pupil.admissionNumber || '—';
    case 'payCode': return pupil.payCode || '—';
    case 'feeBalance': return fees ? formatCurrency(fees.balance) : 'Fee data unavailable';
    case 'totalPaid': return fees ? formatCurrency(fees.totalPaid) : 'Fee data unavailable';
    case 'totalFees': return fees ? formatCurrency(fees.totalFees) : 'Fee data unavailable';
    case 'schoolName': return school?.name || 'School name';
    case 'schoolMotto': return school?.motto || 'School motto';
    case 'schoolPhone': return school?.phone || 'School contacts';
    case 'schoolEmail': return school?.email || 'School email';
    case 'schoolWebsite': return school?.website || 'School website';
    case 'schoolAddress': return school?.address || 'School address';
    case 'schoolPostalAddress': return school?.postalAddress || 'School postal address';
    default: return '';
  }
}

export function applyTextCase(value: string, textCase: TextCase = 'original') {
  if (textCase === 'uppercase') return value.toUpperCase();
  if (textCase === 'lowercase') return value.toLowerCase();
  if (textCase === 'title') {
    return value.toLowerCase().replace(/(^|[\s\-–—/])([\p{L}\p{N}])/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  }
  if (textCase === 'sentence') {
    return value.toLowerCase().replace(/(^|[.!?]\s+|\n+)([\p{L}\p{N}])/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  }
  return value;
}

export function getPaperDimensions(paperSize: PaperSize, orientation: DocumentOrientation) {
  const preset = PAPER_SIZE_OPTIONS.find((option) => option.value === paperSize) || PAPER_SIZE_OPTIONS[1];
  return orientation === 'landscape'
    ? { widthMm: preset.heightMm, heightMm: preset.widthMm }
    : { widthMm: preset.widthMm, heightMm: preset.heightMm };
}

export function templateUsesFees(template: CustomPhotoTemplate) {
  return template.pages.some((page) => page.layers.some((layer) => layer.kind === 'text' && layer.field && FEE_FIELDS.includes(layer.field)));
}
