import type { Pupil } from '@/types';
import type { PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';

export type DocumentOrientation = 'portrait' | 'landscape';
export type PaperSize = 'a3' | 'a4' | 'a5' | 'letter' | 'legal' | 'square' | 'custom';
export type BackgroundFit = 'cover' | 'contain' | 'stretch';
export type LayerKind = 'avatar' | 'schoolLogo' | 'text' | 'image';
export type FrameShape = 'rectangle' | 'rounded' | 'circle' | 'oval' | 'diamond' | 'hexagon';
export type TextAlign = 'left' | 'center' | 'right';
export type TextCase = 'original' | 'uppercase' | 'lowercase' | 'sentence' | 'title';
export type PupilDataMode = 'duplicate' | 'follow';
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
          : createImageLayer(layer.kind === 'avatar' || layer.kind === 'schoolLogo' ? layer.kind : 'image')),
        ...layer,
        featherTop: Number(layer.featherTop) || 0,
        featherRight: Number(layer.featherRight) || 0,
        featherBottom: Number(layer.featherBottom) || 0,
        featherLeft: Number(layer.featherLeft) || 0,
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
