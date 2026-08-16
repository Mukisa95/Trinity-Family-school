import type { Pupil } from '@/types';
import type { PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';

export type DocumentOrientation = 'portrait' | 'landscape';
export type BackgroundFit = 'cover' | 'contain' | 'stretch';
export type LayerKind = 'avatar' | 'text' | 'image';
export type FrameShape = 'rectangle' | 'rounded' | 'circle' | 'oval' | 'diamond' | 'hexagon';
export type TextAlign = 'left' | 'center' | 'right';
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
  | 'totalFees';

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
  borderWidth: number;
  borderColor: string;
  imageZoom: number;
  imageOffsetX: number;
  imageOffsetY: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  textAlign: TextAlign;
  lineHeight: number;
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
  aspectWidth: number;
  aspectHeight: number;
  pages: CustomPhotoPage[];
  updatedAt: string;
}

export interface CustomPhotoOutputSettings {
  orientation: DocumentOrientation;
  cardsPerPage: number;
  marginMm: number;
  gapMm: number;
  showCutLines: boolean;
}

export interface RenderPupilData {
  pupil: Pupil;
  fees?: PupilFeesInfo;
}

export const DYNAMIC_FIELD_OPTIONS: Array<{ value: DynamicField; label: string; sample: string }> = [
  { value: 'name', label: 'Full name', sample: 'AARON KASULE' },
  { value: 'firstName', label: 'First name', sample: 'AARON' },
  { value: 'lastName', label: 'Last name', sample: 'KASULE' },
  { value: 'class', label: 'Class', sample: 'Primary Two' },
  { value: 'section', label: 'Section', sample: 'Blue' },
  { value: 'age', label: 'Age', sample: '8 years' },
  { value: 'admissionNumber', label: 'Admission number', sample: 'TFS/0241' },
  { value: 'payCode', label: 'Pay code', sample: '204185' },
  { value: 'feeBalance', label: 'Fee balance', sample: 'UGX 250,000' },
  { value: 'totalPaid', label: 'Total paid', sample: 'UGX 750,000' },
  { value: 'totalFees', label: 'Total fees', sample: 'UGX 1,000,000' },
];

export const FEE_FIELDS: DynamicField[] = ['feeBalance', 'totalPaid', 'totalFees'];

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
    borderWidth: 0,
    borderColor: '#ffffff',
    imageZoom: 1,
    imageOffsetX: 0,
    imageOffsetY: 0,
    fontSize: 42,
    fontFamily: 'Arial',
    fontWeight: 800,
    color: '#0f172a',
    backgroundColor: 'transparent',
    textAlign: 'center',
    lineHeight: 1.1,
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

export function createImageLayer(kind: 'avatar' | 'image', source?: string): CustomPhotoLayer {
  return {
    id: makeStudioId(kind),
    kind,
    label: kind === 'avatar' ? 'Pupil photo' : 'Photo art',
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
    borderWidth: 0,
    borderColor: '#ffffff',
    imageZoom: 1,
    imageOffsetX: 0,
    imageOffsetY: 0,
    fontSize: 32,
    fontFamily: 'Arial',
    fontWeight: 700,
    color: '#0f172a',
    backgroundColor: 'transparent',
    textAlign: 'center',
    lineHeight: 1.1,
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
    aspectWidth: 4,
    aspectHeight: 5,
    pages: [createBlankPage(0)],
    updatedAt: new Date().toISOString(),
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
  const { pupil, fees } = data;
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
    default: return '';
  }
}

export function templateUsesFees(template: CustomPhotoTemplate) {
  return template.pages.some((page) => page.layers.some((layer) => layer.kind === 'text' && layer.field && FEE_FIELDS.includes(layer.field)));
}
