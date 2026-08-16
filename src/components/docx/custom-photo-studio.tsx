"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Copy,
  Columns2,
  Crop,
  Eye,
  EyeOff,
  FileImage,
  FilePlus2,
  ImagePlus,
  Italic,
  Layers3,
  LayoutGrid,
  Loader2,
  Lock,
  Maximize2,
  PanelRight,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Type,
  Underline,
  Undo2,
  Unlock,
  Users,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { AcademicYear, Pupil } from '@/types';
import type { SchoolSettings } from '@/types';
import type { PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';
import { useProgressiveFees } from '@/lib/hooks/use-progressive-fees';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DOCX_FONT_FACE_CSS,
  DOCX_FONT_OPTIONS,
  ensureDocXTemplateFontsLoaded,
  getDocXFontOption,
} from './docx-fonts';
import {
  createCustomPhotoPdf,
  createPhotoMaskDataUrl,
  estimatePdfPageCount,
  pupilDisplayName,
} from './custom-photo-renderer';
import {
  applyTextCase,
  DYNAMIC_FIELD_OPTIONS,
  PAPER_SIZE_OPTIONS,
  createBlankPage,
  createBlankTemplate,
  createCustomTextLayer,
  createImageLayer,
  createTextLayer,
  makeStudioId,
  getPaperDimensions,
  getLayerColumnIndex,
  isPupilDataLayer,
  normalizeCustomPhotoTemplate,
  resolvePupilField,
  templateUsesFees,
  type CustomPhotoLayer,
  type CustomPhotoOutputSettings,
  type CustomPhotoPage,
  type CustomPhotoTemplate,
  type DynamicField,
  type FrameShape,
  type PaperSize,
  type RenderPupilData,
  type SchoolDocumentInfo,
  type TextCase,
} from './custom-photo-types';

const TEMPLATE_STORAGE_KEY = 'trinity-docx-custom-photo-templates-v1';
const SHAPE_OPTIONS: Array<{ value: FrameShape; label: string }> = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
  { value: 'oval', label: 'Oval' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'hexagon', label: 'Hexagon' },
];

interface CustomPhotoStudioProps {
  pupils: Pupil[];
  schoolSettings?: SchoolSettings | null;
  schoolBadge?: string;
  onClose: () => void;
}

interface TemplateHistoryState {
  past: CustomPhotoTemplate[];
  present: CustomPhotoTemplate;
  future: CustomPhotoTemplate[];
}

interface FeeDataBridgeProps {
  pupils: Pupil[];
  selectedYear: AcademicYear | null;
  selectedTermId: string;
  academicYears: AcademicYear[];
  onChange: (fees: Record<string, PupilFeesInfo>, processing: boolean, status: string) => void;
}

function FeeDataBridge({ pupils, selectedYear, selectedTermId, academicYears, onChange }: FeeDataBridgeProps) {
  const fees = useProgressiveFees({
    pupils,
    selectedYear,
    selectedTermId,
    academicYears,
    enabled: pupils.length > 0 && Boolean(selectedYear && selectedTermId),
  });

  useEffect(() => {
    onChange(fees.pupilFeesInfo, fees.isProcessing || fees.isLoading, fees.processingStatus);
  }, [fees.isLoading, fees.isProcessing, fees.processingStatus, fees.pupilFeesInfo, onChange]);
  return null;
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cloneTemplate(template: CustomPhotoTemplate): CustomPhotoTemplate {
  return JSON.parse(JSON.stringify(template)) as CustomPhotoTemplate;
}

function shapeClipPath(shape: FrameShape) {
  if (shape === 'circle' || shape === 'oval') return 'ellipse(50% 50% at 50% 50%)';
  if (shape === 'diamond') return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  if (shape === 'hexagon') return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
  if (shape === 'rounded') return 'inset(0 round 12%)';
  return 'inset(0)';
}

function pupilInitials(pupil?: Pupil) {
  if (!pupil) return 'P';
  return `${pupil.firstName?.[0] || ''}${pupil.lastName?.[0] || ''}`.toUpperCase() || 'P';
}

function ShapeBorder({ shape, width, color }: { shape: FrameShape; width: number; color: string }) {
  if (width <= 0) return null;
  const common = { fill: 'none', stroke: color, strokeWidth: width, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {(shape === 'circle' || shape === 'oval') && <ellipse cx="50" cy="50" rx="49" ry="49" {...common} />}
      {shape === 'rounded' && <rect x="1" y="1" width="98" height="98" rx="12" ry="12" {...common} />}
      {shape === 'rectangle' && <rect x="1" y="1" width="98" height="98" {...common} />}
      {shape === 'diamond' && <polygon points="50,1 99,50 50,99 1,50" {...common} />}
      {shape === 'hexagon' && <polygon points="25,1 75,1 99,50 75,99 25,99 1,50" {...common} />}
    </svg>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-[10px] font-semibold text-slate-500">
      <span>{label}</span>
      <span className="relative block">
        <Input
          type="number"
          value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-8 rounded-lg bg-white/80 pr-8 text-xs"
        />
        {suffix && <span className="pointer-events-none absolute right-2 top-2 text-[10px] text-slate-400">{suffix}</span>}
      </span>
    </label>
  );
}

function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = getDocXFontOption(value);

  return (
    <div className="space-y-1 text-[10px] font-semibold text-slate-500">
      <span>Font</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-11 w-full justify-between rounded-lg bg-white px-2.5 text-left font-normal"
          >
            <span className="min-w-0">
              <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {selected?.category || 'Saved font'}
              </span>
              <span className="block truncate text-sm text-slate-800" style={{ fontFamily: value }}>
                {selected?.label || value}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-[min(360px,calc(100vw-24px))] p-0">
          <Command>
            <CommandInput placeholder="Search fonts…" className="text-xs" />
            <CommandList className="max-h-[min(440px,65vh)]">
              <CommandEmpty>No matching font found.</CommandEmpty>
              <CommandGroup heading={`${DOCX_FONT_OPTIONS.length} available fonts`}>
                {DOCX_FONT_OPTIONS.map((option) => (
                  <CommandItem
                    key={option.family}
                    value={`${option.label} ${option.category}`}
                    onSelect={() => {
                      onChange(option.family);
                      setOpen(false);
                    }}
                    className="gap-2 rounded-lg px-2.5 py-2"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-base text-slate-700" style={{ fontFamily: option.family }}>
                      Aa
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[10px] font-semibold text-slate-500">{option.label}</span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-400">{option.category}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-base leading-5 text-slate-900" style={{ fontFamily: option.family }}>
                        Thank You, Trinity!
                      </span>
                    </span>
                    <Check className={cn('h-4 w-4 shrink-0 text-violet-600', value === option.family ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function StudioLayer({
  layer,
  data,
  selected,
  onSelect,
  onPointerDown,
  onResizePointerDown,
}: {
  layer: CustomPhotoLayer;
  data?: RenderPupilData;
  selected: boolean;
  onSelect: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const mask = useMemo(
    () => layer.kind === 'text' ? undefined : createPhotoMaskDataUrl(layer),
    [layer.feather, layer.featherBottom, layer.featherLeft, layer.featherRight, layer.featherTop, layer.kind, layer.shape],
  );
  if (layer.hidden) return null;
  const source = layer.kind === 'avatar' ? data?.pupil.photo : layer.kind === 'schoolLogo' ? data?.school?.logo : layer.source;
  const value = layer.kind === 'text'
    ? applyTextCase(layer.field && data ? resolvePupilField(layer.field, data) : layer.text || 'Your message here', layer.textCase)
    : '';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={layer.label}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      onPointerDown={onPointerDown}
      className={cn(
        'absolute touch-none select-none overflow-visible outline-none',
        selected && 'ring-2 ring-violet-500 ring-offset-1',
        layer.locked ? 'cursor-not-allowed' : 'cursor-move',
      )}
      style={{
        left: `${layer.x * 100}%`,
        top: `${layer.y * 100}%`,
        width: `${layer.width * 100}%`,
        height: `${layer.height * 100}%`,
        transform: layer.kind === 'text' ? `rotate(${layer.rotation}deg)` : undefined,
        opacity: layer.opacity,
      }}
    >
      {layer.kind === 'text' ? (
        <div
          className="flex h-full w-full items-center overflow-hidden px-[1.5%]"
          style={{
            justifyContent: layer.textAlign === 'left' ? 'flex-start' : layer.textAlign === 'right' ? 'flex-end' : 'center',
            color: layer.color,
            background: layer.backgroundColor,
            fontFamily: layer.fontFamily,
            fontSize: `${layer.fontSize / 10}cqw`,
            fontWeight: layer.fontWeight,
            fontStyle: layer.fontStyle,
            textDecoration: layer.underline ? 'underline' : 'none',
            lineHeight: layer.lineHeight,
            textAlign: layer.textAlign,
            whiteSpace: 'pre-wrap',
          }}
        >
          {value}
        </div>
      ) : (
        <div className="relative h-full w-full overflow-visible">
          <div
            className={cn('absolute inset-0 overflow-hidden', source ? 'bg-transparent' : 'bg-slate-200')}
            style={{
              clipPath: mask ? undefined : shapeClipPath(layer.shape),
              maskImage: mask ? `url(${mask})` : undefined,
              WebkitMaskImage: mask ? `url(${mask})` : undefined,
              maskSize: '100% 100%',
              WebkitMaskSize: '100% 100%',
            }}
          >
            {source ? (
              // Imported and pupil images may be remote; browser rendering handles their display while Canvas handles print CORS.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={source}
                alt=""
                draggable={false}
                className="h-full w-full"
                style={{ objectFit: layer.imageFit, transform: `translate(${layer.imageOffsetX * 20}%, ${layer.imageOffsetY * 20}%) scale(${layer.imageZoom}) rotate(${layer.rotation}deg)` }}
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-slate-200 text-[5cqw] font-black text-slate-500">
                {layer.kind === 'avatar' ? pupilInitials(data?.pupil) : <ImagePlus className="h-8 w-8" />}
              </div>
            )}
          </div>
          <ShapeBorder shape={layer.shape} width={layer.borderWidth} color={layer.borderColor} />
        </div>
      )}
      {selected && !layer.locked && (
        <button
          type="button"
          aria-label="Resize layer"
          onPointerDown={onResizePointerDown}
          className="absolute -bottom-2 -right-2 grid h-5 w-5 cursor-se-resize place-items-center rounded-full border-2 border-white bg-violet-600 text-white shadow-md"
        >
          <Maximize2 className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

export function CustomPhotoStudio({ pupils, schoolSettings, schoolBadge, onClose }: CustomPhotoStudioProps) {
  const { toast } = useToast();
  const pdfViewer = usePDFViewer();
  const canvasRef = useRef<HTMLDivElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const imageLayerInputRef = useRef<HTMLInputElement>(null);
  const historyGroupRef = useRef(false);
  const historyGroupRecordedRef = useRef(false);
  const [stage, setStage] = useState<'design' | 'output'>('design');
  const [templateHistory, setTemplateHistory] = useState<TemplateHistoryState>(() => ({
    past: [],
    present: createBlankTemplate(),
    future: [],
  }));
  const template = templateHistory.present;
  const setTemplate = useCallback<Dispatch<SetStateAction<CustomPhotoTemplate>>>((action) => {
    setTemplateHistory((history) => {
      const next = typeof action === 'function'
        ? (action as (previous: CustomPhotoTemplate) => CustomPhotoTemplate)(history.present)
        : action;
      if (next === history.present) return history;
      const recordSnapshot = !historyGroupRef.current || !historyGroupRecordedRef.current;
      if (historyGroupRef.current) historyGroupRecordedRef.current = true;
      return {
        past: recordSnapshot ? [...history.past, history.present].slice(-80) : history.past,
        present: next,
        future: [],
      };
    });
  }, []);
  const [activePageId, setActivePageId] = useState<string>(() => template.pages[0].id);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(() => template.pages[0].layers[0]?.id || null);
  const [expandedPageIds, setExpandedPageIds] = useState<Set<string>>(() => new Set([template.pages[0].id]));
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [savedTemplates, setSavedTemplates] = useState<CustomPhotoTemplate[]>([]);
  const [selectedPupilIds, setSelectedPupilIds] = useState<Set<string>>(new Set());
  const [pupilSearch, setPupilSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [photoFilter, setPhotoFilter] = useState<'all' | 'with' | 'without'>('all');
  const [output, setOutput] = useState<CustomPhotoOutputSettings>({
    paperSize: template.paperSize,
    orientation: template.pageOrientation,
    cardsPerPage: 1,
    marginMm: 0,
    gapMm: 0,
    showCutLines: false,
  });
  const [feesByPupil, setFeesByPupil] = useState<Record<string, PupilFeesInfo>>({});
  const [feesProcessing, setFeesProcessing] = useState(false);
  const [feesStatus, setFeesStatus] = useState('Ready');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const { effectiveTerm, academicYears } = useTermStatus();
  const schoolInfo = useMemo<SchoolDocumentInfo>(() => ({
    name: schoolSettings?.generalInfo?.name,
    logo: schoolSettings?.generalInfo?.logo || schoolBadge,
    motto: schoolSettings?.generalInfo?.motto,
    phone: [schoolSettings?.contact?.phone, schoolSettings?.contact?.alternativePhone].filter(Boolean).join(' / '),
    email: schoolSettings?.contact?.email,
    website: schoolSettings?.contact?.website,
    address: [schoolSettings?.address?.physical, schoolSettings?.address?.city, schoolSettings?.address?.country].filter(Boolean).join(', '),
    postalAddress: schoolSettings?.address?.poBox || schoolSettings?.address?.postal,
  }), [schoolBadge, schoolSettings]);

  const currentPage = template.pages.find((page) => page.id === activePageId) || template.pages[0];
  const selectedLayer = currentPage?.layers.find((layer) => layer.id === selectedLayerId) || null;
  const selectedYear = academicYears.find((year) => year.id === selectedYearId) || null;
  const selectedPupils = useMemo(
    () => pupils.filter((pupil) => selectedPupilIds.has(pupil.id)),
    [pupils, selectedPupilIds],
  );
  const previewPupils = useMemo(() => {
    const fallbackPupils = pupils.filter((pupil) => pupil.status === 'Active');
    const source = selectedPupils.length > 0 ? selectedPupils : (fallbackPupils.length > 0 ? fallbackPupils : pupils);
    return source.slice(0, Math.max(1, template.pageColumns || 1));
  }, [pupils, selectedPupils, template.pageColumns]);
  const previewPupil = previewPupils[0];
  const previewRenderData = previewPupils.map((pupil) => ({ pupil, fees: feesByPupil[pupil.id], school: schoolInfo }));
  const usesFees = templateUsesFees(template);
  const classOptions = useMemo(() => Array.from(new Map(
    pupils.filter((pupil) => pupil.classId).map((pupil) => [pupil.classId, pupil.className || pupil.classCode || 'Unnamed class']),
  ).entries()).sort((a, b) => a[1].localeCompare(b[1])), [pupils]);
  const filteredPupils = useMemo(() => {
    const query = pupilSearch.trim().toLowerCase();
    return pupils.filter((pupil) => {
      if (classFilter !== 'all' && pupil.classId !== classFilter) return false;
      if (statusFilter !== 'all' && pupil.status !== statusFilter) return false;
      const hasPhoto = Boolean(pupil.photo?.trim());
      if (photoFilter === 'with' && !hasPhoto) return false;
      if (photoFilter === 'without' && hasPhoto) return false;
      if (!query) return true;
      return `${pupilDisplayName(pupil)} ${pupil.admissionNumber || ''} ${pupil.className || ''}`.toLowerCase().includes(query);
    });
  }, [classFilter, photoFilter, pupilSearch, pupils, statusFilter]);
  const allFilteredSelected = filteredPupils.length > 0 && filteredPupils.every((pupil) => selectedPupilIds.has(pupil.id));
  const estimatedPages = estimatePdfPageCount(selectedPupils.length, template.pages.length, output.cardsPerPage, template.pageColumns);
  const exactOutputSettings = useMemo<CustomPhotoOutputSettings>(() => ({
    ...output,
    paperSize: template.paperSize,
    orientation: template.pageOrientation,
    marginMm: 0,
  }), [output, template.pageOrientation, template.paperSize]);
  const marginXPercent = clamp(template.pageMarginMm / Math.max(1, template.aspectWidth) * 100, 0, 45);
  const marginYPercent = clamp(template.pageMarginMm / Math.max(1, template.aspectHeight) * 100, 0, 45);

  const undoTemplate = useCallback(() => {
    setTemplateHistory((history) => {
      const previous = history.past.at(-1);
      if (!previous) return history;
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future].slice(0, 80),
      };
    });
  }, []);

  const redoTemplate = useCallback(() => {
    setTemplateHistory((history) => {
      const next = history.future[0];
      if (!next) return history;
      return {
        past: [...history.past, history.present].slice(-80),
        present: next,
        future: history.future.slice(1),
      };
    });
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (stored) setSavedTemplates((JSON.parse(stored) as Partial<CustomPhotoTemplate>[]).map(normalizeCustomPhotoTemplate));
    } catch {
      // A malformed old local template should not prevent the editor from opening.
    }
  }, []);

  useEffect(() => {
    if (effectiveTerm.academicYear && !selectedYearId) {
      setSelectedYearId(effectiveTerm.academicYear.id);
      setSelectedTermId(effectiveTerm.term?.id || effectiveTerm.academicYear.terms[0]?.id || '');
    }
  }, [effectiveTerm.academicYear, effectiveTerm.term, selectedYearId]);

  useEffect(() => {
    if (!currentPage) return;
    if (selectedLayerId && !currentPage.layers.some((layer) => layer.id === selectedLayerId)) {
      setSelectedLayerId(currentPage.layers[0]?.id || null);
    }
  }, [currentPage, selectedLayerId]);

  useEffect(() => {
    if (!template.pages.some((page) => page.id === activePageId)) {
      setActivePageId(template.pages[0].id);
      setSelectedLayerId(template.pages[0].layers[0]?.id || null);
    }
  }, [activePageId, template.pages]);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      event.preventDefault();
      if (key === 'y' || event.shiftKey) redoTemplate();
      else undoTemplate();
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [redoTemplate, undoTemplate]);

  const updateCurrentPage = useCallback((updater: (page: CustomPhotoPage) => CustomPhotoPage) => {
    setTemplate((previous) => ({
      ...previous,
      pages: previous.pages.map((page) => page.id === activePageId ? updater(page) : page),
      updatedAt: new Date().toISOString(),
    }));
  }, [activePageId]);

  const updateLayer = useCallback((id: string, changes: Partial<CustomPhotoLayer>) => {
    updateCurrentPage((page) => ({
      ...page,
      layers: page.layers.map((layer) => layer.id === id ? { ...layer, ...changes } : layer),
    }));
  }, [updateCurrentPage]);

  const applyPageFormat = (paperSize: PaperSize, orientation: CustomPhotoTemplate['pageOrientation']) => {
    const dimensions = paperSize === 'custom'
      ? (orientation === template.pageOrientation
        ? { widthMm: template.aspectWidth, heightMm: template.aspectHeight }
        : { widthMm: template.aspectHeight, heightMm: template.aspectWidth })
      : getPaperDimensions(paperSize, orientation);
    setTemplate((previous) => ({
      ...previous,
      paperSize,
      pageOrientation: orientation,
      aspectWidth: dimensions.widthMm,
      aspectHeight: dimensions.heightMm,
      updatedAt: new Date().toISOString(),
    }));
  };

  const addLayer = (layer: CustomPhotoLayer) => {
    updateCurrentPage((page) => ({ ...page, layers: [...page.layers, layer] }));
    setSelectedLayerId(layer.id);
    setExpandedPageIds((previous) => new Set(previous).add(activePageId));
  };

  const updatePageById = useCallback((pageId: string, updater: (page: CustomPhotoPage) => CustomPhotoPage) => {
    setTemplate((previous) => ({
      ...previous,
      pages: previous.pages.map((page) => page.id === pageId ? updater(page) : page),
      updatedAt: new Date().toISOString(),
    }));
  }, [setTemplate]);

  const removeLayer = (pageId: string, layerId: string) => {
    updatePageById(pageId, (page) => ({ ...page, layers: page.layers.filter((layer) => layer.id !== layerId) }));
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const duplicateLayer = (pageId: string, layerId: string) => {
    const page = template.pages.find((item) => item.id === pageId);
    const layer = page?.layers.find((item) => item.id === layerId);
    if (!layer) return;
    const copy = { ...layer, id: makeStudioId(layer.kind), label: `${layer.label} copy`, x: clamp(layer.x + 0.03, 0, 0.94), y: clamp(layer.y + 0.03, 0, 0.94), ...(isPupilDataLayer(layer) ? { pupilDataMode: 'follow' as const } : {}) };
    updatePageById(pageId, (item) => ({ ...item, layers: [...item.layers, copy] }));
    setActivePageId(pageId);
    setSelectedLayerId(copy.id);
    setExpandedPageIds((previous) => new Set(previous).add(pageId));
  };

  const moveLayerOrder = (pageId: string, layerId: string, direction: -1 | 1) => {
    updatePageById(pageId, (page) => {
      const index = page.layers.findIndex((layer) => layer.id === layerId);
      const next = clamp(index + direction, 0, page.layers.length - 1);
      if (index < 0 || index === next) return page;
      const layers = [...page.layers];
      const [layer] = layers.splice(index, 1);
      layers.splice(next, 0, layer);
      return { ...page, layers };
    });
  };

  const setLayerPupilDataMode = (pageId: string, layerId: string, pupilDataMode: CustomPhotoLayer['pupilDataMode']) => {
    updatePageById(pageId, (page) => ({
      ...page,
      layers: page.layers.map((layer) => layer.id === layerId ? { ...layer, pupilDataMode } : layer),
    }));
    setActivePageId(pageId);
    setSelectedLayerId(layerId);
  };

  const beginTransform = (
    event: ReactPointerEvent<HTMLElement>,
    layer: CustomPhotoLayer,
    mode: 'move' | 'resize',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    if (layer.locked || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);
    historyGroupRef.current = true;
    historyGroupRecordedRef.current = false;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / bounds.width;
      const dy = (moveEvent.clientY - startY) / bounds.height;
      if (mode === 'move') {
        const maxX = layer.constrainToPage ? 1 - initial.width : 1.5;
        const maxY = layer.constrainToPage ? 1 - initial.height : 1.5;
        updateLayer(layer.id, {
          x: clamp(initial.x + dx, layer.constrainToPage ? 0 : -0.5, maxX),
          y: clamp(initial.y + dy, layer.constrainToPage ? 0 : -0.5, maxY),
        });
      } else {
        const maxWidth = layer.constrainToPage ? 1 - initial.x : 1.5;
        const maxHeight = layer.constrainToPage ? 1 - initial.y : 1.5;
        updateLayer(layer.id, {
          width: clamp(initial.width + dx, 0.005, maxWidth),
          height: clamp(initial.height + dy, 0.005, maxHeight),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      historyGroupRef.current = false;
      historyGroupRecordedRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });
  };

  const importBackground = async (file?: File) => {
    if (!file) return;
    try {
      const background = await readImageFile(file);
      updateCurrentPage((page) => ({ ...page, background }));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Image import failed', description: error instanceof Error ? error.message : 'Try another image.' });
    }
  };

  const importImageLayer = async (file?: File) => {
    if (!file) return;
    try {
      addLayer(createImageLayer('image', await readImageFile(file)));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Image import failed', description: error instanceof Error ? error.message : 'Try another image.' });
    }
  };

  const addPage = () => {
    const page = createBlankPage(template.pages.length);
    setTemplate((previous) => ({ ...previous, pages: [...previous.pages, page], updatedAt: new Date().toISOString() }));
    setActivePageId(page.id);
    setSelectedLayerId(page.layers[0]?.id || null);
    setExpandedPageIds((previous) => new Set(previous).add(page.id));
  };

  const duplicatePage = (pageId: string) => {
    const sourceIndex = template.pages.findIndex((page) => page.id === pageId);
    const source = template.pages[sourceIndex];
    if (!source) return;
    const copy = cloneTemplate({ ...template, pages: [source] }).pages[0];
    copy.id = makeStudioId('page');
    copy.name = `${source.name} copy`;
    copy.layers = copy.layers.map((layer) => ({ ...layer, id: makeStudioId(layer.kind) }));
    setTemplate((previous) => {
      const pages = [...previous.pages];
      pages.splice(sourceIndex + 1, 0, copy);
      return { ...previous, pages, updatedAt: new Date().toISOString() };
    });
    setActivePageId(copy.id);
    setSelectedLayerId(copy.layers[0]?.id || null);
    setExpandedPageIds((previous) => new Set(previous).add(copy.id));
  };

  const removePage = (pageId: string) => {
    if (template.pages.length <= 1) return;
    const removedIndex = template.pages.findIndex((page) => page.id === pageId);
    const remaining = template.pages.filter((page) => page.id !== pageId);
    setTemplate((previous) => ({ ...previous, pages: remaining, updatedAt: new Date().toISOString() }));
    if (activePageId === pageId) {
      const nextPage = remaining[Math.min(Math.max(removedIndex, 0), remaining.length - 1)];
      setActivePageId(nextPage.id);
      setSelectedLayerId(nextPage.layers[0]?.id || null);
    }
    setExpandedPageIds((previous) => {
      const next = new Set(previous);
      next.delete(pageId);
      return next;
    });
  };

  const movePageOrder = (pageId: string, direction: -1 | 1) => {
    setTemplate((previous) => {
      const index = previous.pages.findIndex((page) => page.id === pageId);
      const nextIndex = clamp(index + direction, 0, previous.pages.length - 1);
      if (index < 0 || index === nextIndex) return previous;
      const pages = [...previous.pages];
      const [page] = pages.splice(index, 1);
      pages.splice(nextIndex, 0, page);
      return { ...previous, pages, updatedAt: new Date().toISOString() };
    });
  };

  const saveTemplate = () => {
    const snapshot = normalizeCustomPhotoTemplate({ ...cloneTemplate(template), updatedAt: new Date().toISOString() });
    const next = [snapshot, ...savedTemplates.filter((item) => item.id !== snapshot.id)].slice(0, 12);
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(next));
      setSavedTemplates(next);
      toast({ title: 'Template saved', description: `${snapshot.name} is available on this device.` });
    } catch {
      toast({ variant: 'destructive', title: 'Template is too large to save locally', description: 'Use a smaller background image, or continue without saving.' });
    }
  };

  const loadTemplate = (id: string) => {
    const stored = savedTemplates.find((item) => item.id === id);
    if (!stored) return;
    const next = normalizeCustomPhotoTemplate(cloneTemplate(stored));
    setTemplate(next);
    setActivePageId(next.pages[0].id);
    setSelectedLayerId(next.pages[0].layers[0]?.id || null);
  };

  const togglePupil = (id: string) => {
    setSelectedPupilIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedPupilIds((previous) => {
      const next = new Set(previous);
      filteredPupils.forEach((pupil) => {
        if (allFilteredSelected) next.delete(pupil.id);
        else next.add(pupil.id);
      });
      return next;
    });
  };

  const handleFeeData = useCallback((fees: Record<string, PupilFeesInfo>, processing: boolean, status: string) => {
    setFeesByPupil(fees);
    setFeesProcessing(processing);
    setFeesStatus(status);
  }, []);

  const generatePdf = async () => {
    if (selectedPupils.length === 0) return;
    if (usesFees && feesProcessing) {
      toast({ title: 'Fee data is still loading', description: 'The print button will be ready as soon as all selected pupil balances are calculated.' });
      return;
    }
    setIsGenerating(true);
    setGenerationProgress({ completed: 0, total: estimatedPages });
    try {
      await ensureDocXTemplateFontsLoaded(template);
      const blob = await createCustomPhotoPdf(template, selectedPupils, feesByPupil, exactOutputSettings, schoolInfo, (completed, total) => {
        setGenerationProgress({ completed, total });
      });
      const date = new Date().toISOString().slice(0, 10);
      pdfViewer.openPDFFromBlob(blob, `docx-${template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${date}.pdf`, template.name);
    } catch (error) {
      console.error('Custom DocX generation failed:', error);
      toast({ variant: 'destructive', title: 'Document could not be generated', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <style>{DOCX_FONT_FACE_CSS}</style>
      <div className="fixed inset-0 z-40 isolate flex flex-col overflow-hidden bg-slate-100 text-slate-900" role="dialog" aria-modal="true" aria-label="DocX Custom Photo Studio">
        <header className="relative z-30 flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 shadow-sm sm:px-5">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full">
            <ChevronLeft className="mr-1.5 h-4 w-4" /> DocX
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-100 text-violet-700"><WandSparkles className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">Custom Photo Studio</p>
                <p className="truncate text-[10px] font-medium text-slate-500">Design once, personalise for every selected pupil</p>
              </div>
            </div>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-slate-100 p-1">
            <button type="button" onClick={() => setStage('design')} className={cn('rounded-full px-3 py-1.5 text-xs font-bold transition-colors', stage === 'design' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500')}>1. Design</button>
            <button type="button" onClick={() => setStage('output')} className={cn('rounded-full px-3 py-1.5 text-xs font-bold transition-colors', stage === 'output' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500')}>2. Pupils & output</button>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
            <Button type="button" variant="ghost" size="icon" disabled={templateHistory.past.length === 0} onClick={undoTemplate} className="h-8 w-8 rounded-full" title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" disabled={templateHistory.future.length === 0} onClick={redoTemplate} className="h-8 w-8 rounded-full" title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 className="h-3.5 w-3.5" /></Button>
          </div>
          <Button onClick={saveTemplate} variant="outline" size="sm" className="rounded-full"><Save className="mr-1.5 h-3.5 w-3.5" />Save</Button>
          <Button onClick={() => setStage('output')} size="sm" className="rounded-full bg-violet-700 hover:bg-violet-800">Create documents <PanelRight className="ml-1.5 h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full"><X className="h-4 w-4" /><span className="sr-only">Close editor</span></Button>
        </header>

        {stage === 'design' ? (
          <main className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[250px_minmax(460px,1fr)_300px] lg:overflow-hidden">
            <aside className="border-r border-slate-200 bg-white/75 p-3 lg:overflow-y-auto">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div><p className="text-xs font-black text-slate-800">Pages & layers</p><p className="text-[10px] text-slate-500">Arrange the document in one place.</p></div>
                <Button size="icon" variant="outline" onClick={addPage} className="h-8 w-8 shrink-0 rounded-lg" title="Add page" aria-label="Add page"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => backgroundInputRef.current?.click()} className="h-8 justify-start px-2 text-[10px]"><ImagePlus className="mr-1.5 h-3.5 w-3.5" />Template</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="sm" className="h-8 rounded-lg bg-violet-700 px-2.5 text-[10px] font-bold hover:bg-violet-800"><Plus className="mr-1 h-3.5 w-3.5" />Add layer</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Photos and artwork</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => addLayer(createImageLayer('avatar'))}><CircleUserRound className="mr-2 h-4 w-4" />Pupil photo</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => addLayer(createImageLayer('schoolLogo'))}><Building2 className="mr-2 h-4 w-4" />School badge</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => imageLayerInputRef.current?.click()}><FilePlus2 className="mr-2 h-4 w-4" />Imported photo or art</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => addLayer(createCustomTextLayer())}><Type className="mr-2 h-4 w-4" />Manual text box</DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><CircleUserRound className="mr-2 h-4 w-4" />Pupil information</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="z-[100000] max-h-72 overflow-y-auto">{DYNAMIC_FIELD_OPTIONS.filter((field) => field.group === 'pupil').map((field) => <DropdownMenuItem key={field.value} onSelect={() => addLayer(createTextLayer(field.value))}>{field.label}</DropdownMenuItem>)}</DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><Building2 className="mr-2 h-4 w-4" />School information</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="z-[100000]">{DYNAMIC_FIELD_OPTIONS.filter((field) => field.group === 'school').map((field) => <DropdownMenuItem key={field.value} onSelect={() => addLayer(createTextLayer(field.value))}>{field.label}</DropdownMenuItem>)}</DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                {template.pages.map((page, pageIndex) => {
                  const expanded = expandedPageIds.has(page.id);
                  return (
                    <div key={page.id} className={cn('overflow-hidden rounded-xl border transition-colors', activePageId === page.id ? 'border-violet-300 bg-violet-50/70' : 'border-slate-200 bg-white')}>
                      <div className="flex items-center gap-1 p-1.5">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setExpandedPageIds((previous) => { const next = new Set(previous); if (next.has(page.id)) next.delete(page.id); else next.add(page.id); return next; })} className="h-7 w-7 shrink-0" aria-label={expanded ? `Collapse ${page.name}` : `Expand ${page.name}`}>{expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</Button>
                        <button type="button" onClick={() => { setActivePageId(page.id); setSelectedLayerId(null); setExpandedPageIds((previous) => new Set(previous).add(page.id)); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-[10px] font-black shadow-sm">{pageIndex + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">{page.name}</span>
                          {page.background && <FileImage className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                        </button>
                        <div className="flex shrink-0 items-center">
                          <Button type="button" variant="ghost" size="icon" disabled={pageIndex === 0} onClick={() => movePageOrder(page.id, -1)} className="h-7 w-6" title="Move page up" aria-label="Move page up"><ArrowUp className="h-3 w-3" /></Button>
                          <Button type="button" variant="ghost" size="icon" disabled={pageIndex === template.pages.length - 1} onClick={() => movePageOrder(page.id, 1)} className="h-7 w-6" title="Move page down" aria-label="Move page down"><ArrowDown className="h-3 w-3" /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => duplicatePage(page.id)} className="h-7 w-6" title="Duplicate page" aria-label="Duplicate page"><Copy className="h-3 w-3" /></Button>
                          <Button type="button" variant="ghost" size="icon" disabled={template.pages.length <= 1} onClick={() => removePage(page.id)} className="h-7 w-6 text-rose-600" title="Delete page" aria-label="Delete page"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="space-y-1 border-t border-slate-200/80 bg-white/75 p-1.5">
                          {page.layers.length === 0 && <p className="px-2 py-2 text-center text-[10px] text-slate-400">No layers on this page</p>}
                          {[...page.layers].reverse().map((layer) => {
                            const layerIndex = page.layers.findIndex((item) => item.id === layer.id);
                            return (
                              <div key={layer.id} className={cn('flex items-center gap-1 rounded-lg px-1 py-1', activePageId === page.id && selectedLayerId === layer.id ? 'bg-violet-100 text-violet-900' : 'text-slate-600 hover:bg-slate-100')}>
                                <button type="button" onClick={() => { setActivePageId(page.id); setSelectedLayerId(layer.id); }} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                                  {layer.kind === 'avatar' ? <CircleUserRound className="h-3.5 w-3.5 shrink-0" /> : layer.kind === 'schoolLogo' ? <Building2 className="h-3.5 w-3.5 shrink-0" /> : layer.kind === 'image' ? <FileImage className="h-3.5 w-3.5 shrink-0" /> : <Type className="h-3.5 w-3.5 shrink-0" />}
                                  <span className="min-w-0 flex-1 truncate text-[10px] font-semibold">{layer.label}</span>
                                  {layer.hidden && <EyeOff className="h-3 w-3 shrink-0" />}
                                  {layer.locked && <Lock className="h-3 w-3 shrink-0" />}
                                </button>
                                {isPupilDataLayer(layer) && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button type="button" className={cn('rounded px-1.5 py-1 text-[8px] font-black uppercase ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1', layer.pupilDataMode === 'follow' ? 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200')} aria-label={`Pupil list behaviour: ${layer.pupilDataMode === 'follow' ? 'follow list' : 'duplicate'}`}>{layer.pupilDataMode === 'follow' ? 'Fol' : 'Dup'}</button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64">
                                      <DropdownMenuLabel className="normal-case">
                                        <span className="block text-xs font-black text-slate-800">Pupil list behaviour</span>
                                        <span className="mt-1 block text-[10px] font-medium leading-4 text-slate-500">This layer is in column {getLayerColumnIndex(layer, template.pageColumns) + 1}. Choose how its pupil data is filled.</span>
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onSelect={() => setLayerPupilDataMode(page.id, layer.id, 'follow')} className="gap-2">
                                        <span className="grid h-6 w-8 place-items-center rounded bg-cyan-100 text-[9px] font-black text-cyan-700">Fol</span>
                                        <span className="min-w-0 flex-1"><span className="block text-xs font-bold">Follow pupil list</span><span className="block text-[9px] text-slate-500">Use the pupil assigned to this column.</span></span>
                                        {layer.pupilDataMode === 'follow' && <Check className="h-3.5 w-3.5 text-cyan-700" />}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onSelect={() => setLayerPupilDataMode(page.id, layer.id, 'duplicate')} className="gap-2">
                                        <span className="grid h-6 w-8 place-items-center rounded bg-amber-100 text-[9px] font-black text-amber-700">Dup</span>
                                        <span className="min-w-0 flex-1"><span className="block text-xs font-bold">Duplicate first pupil</span><span className="block text-[9px] text-slate-500">Repeat the first pupil in every column.</span></span>
                                        {layer.pupilDataMode === 'duplicate' && <Check className="h-3.5 w-3.5 text-amber-700" />}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                                <div className="flex shrink-0 items-center">
                                  <Button type="button" variant="ghost" size="icon" disabled={layerIndex === page.layers.length - 1} onClick={() => moveLayerOrder(page.id, layer.id, 1)} className="h-6 w-5" title="Bring forward" aria-label="Bring layer forward"><ArrowUp className="h-3 w-3" /></Button>
                                  <Button type="button" variant="ghost" size="icon" disabled={layerIndex === 0} onClick={() => moveLayerOrder(page.id, layer.id, -1)} className="h-6 w-5" title="Send backward" aria-label="Send layer backward"><ArrowDown className="h-3 w-3" /></Button>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => duplicateLayer(page.id, layer.id)} className="h-6 w-5" title="Duplicate layer" aria-label="Duplicate layer"><Copy className="h-3 w-3" /></Button>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLayer(page.id, layer.id)} className="h-6 w-5 text-rose-600" title="Delete layer" aria-label="Delete layer"><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Page setup</p>
                <Input value={template.name} onChange={(event) => setTemplate((previous) => ({ ...previous, name: event.target.value }))} className="mb-2 h-8 bg-white text-xs font-bold" aria-label="Template name" />
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Document size</span><Select value={template.paperSize} onValueChange={(value) => applyPageFormat(value as PaperSize, template.pageOrientation)}><SelectTrigger className="h-8 bg-white text-[10px]"><SelectValue /></SelectTrigger><SelectContent>{PAPER_SIZE_OPTIONS.map((size) => <SelectItem key={size.value} value={size.value}>{size.label}{size.value !== 'custom' ? ` · ${size.widthMm} × ${size.heightMm} mm` : ''}</SelectItem>)}</SelectContent></Select></label>
                  <label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Orientation</span><Select value={template.pageOrientation} onValueChange={(value) => applyPageFormat(template.paperSize, value as CustomPhotoTemplate['pageOrientation'])}><SelectTrigger className="h-8 bg-white text-[10px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="portrait">Portrait</SelectItem><SelectItem value="landscape">Landscape</SelectItem></SelectContent></Select></label>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <NumberInput label="Safe margin" value={template.pageMarginMm} min={0} max={50} suffix="mm" onChange={(value) => setTemplate((previous) => ({ ...previous, pageMarginMm: value }))} />
                  <div className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1.5"><p className="text-[9px] font-semibold text-violet-500">Canvas</p><p className="mt-1 text-[10px] font-black text-violet-800">{template.aspectWidth} × {template.aspectHeight} mm</p></div>
                </div>
                {template.paperSize === 'custom' && <div className="mt-2 grid grid-cols-2 gap-2"><NumberInput label="Custom width" value={template.aspectWidth} min={20} max={1000} suffix="mm" onChange={(value) => setTemplate((previous) => ({ ...previous, aspectWidth: value }))} /><NumberInput label="Custom height" value={template.aspectHeight} min={20} max={1000} suffix="mm" onChange={(value) => setTemplate((previous) => ({ ...previous, aspectHeight: value }))} /></div>}
                <div className="mt-2 grid grid-cols-2 gap-2"><label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Background fit</span><Select value={currentPage?.backgroundFit} onValueChange={(value) => updateCurrentPage((page) => ({ ...page, backgroundFit: value as CustomPhotoPage['backgroundFit'] }))}><SelectTrigger className="h-8 bg-white text-[10px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cover">Cover</SelectItem><SelectItem value="contain">Contain</SelectItem><SelectItem value="stretch">Stretch</SelectItem></SelectContent></Select></label><label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Page colour</span><Input type="color" value={currentPage?.backgroundColor || '#ffffff'} onChange={(event) => updateCurrentPage((page) => ({ ...page, backgroundColor: event.target.value }))} className="h-8 bg-white p-1" /></label></div>
              </div>

              <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/80 p-3">
                <div className="mb-2 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-cyan-700 shadow-sm"><Columns2 className="h-3.5 w-3.5" /></span><div><p className="text-[10px] font-black uppercase tracking-wider text-cyan-900">Page splitter</p><p className="text-[9px] text-cyan-700">Equal pupil columns across every page</p></div></div>
                <div className="grid grid-cols-6 gap-1 rounded-lg bg-white/80 p-1">
                  {[1, 2, 3, 4, 5, 6].map((count) => <Button key={count} type="button" variant={template.pageColumns === count ? 'secondary' : 'ghost'} size="sm" onClick={() => setTemplate((previous) => ({ ...previous, pageColumns: count }))} className={cn('h-8 px-0 text-[10px] font-black', template.pageColumns === count && 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100')}>{count}</Button>)}
                </div>
                <p className="mt-2 text-[9px] leading-3.5 text-cyan-700">Place pupil layers inside a column, then choose <strong>Dup</strong> for the same pupil or <strong>Fol</strong> to follow the selected pupil list.</p>
              </div>

              {savedTemplates.length > 0 && <div className="mt-3"><p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Saved on this device</p><Select onValueChange={loadTemplate}><SelectTrigger className="h-8 bg-white text-[10px]"><SelectValue placeholder="Open saved template" /></SelectTrigger><SelectContent>{savedTemplates.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>}
              <input ref={backgroundInputRef} type="file" accept="image/*" hidden onChange={(event) => { void importBackground(event.target.files?.[0]); event.target.value = ''; }} />
              <input ref={imageLayerInputRef} type="file" accept="image/*" hidden onChange={(event) => { void importImageLayer(event.target.files?.[0]); event.target.value = ''; }} />
            </aside>

            <section className="flex min-h-[650px] min-w-0 flex-col bg-[radial-gradient(circle_at_top,#ede9fe_0%,#f8fafc_42%,#e2e8f0_100%)] lg:min-h-0">
              <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-8">
                <div className={cn('flex min-h-full min-w-full', canvasZoom > 1 ? 'items-start justify-start' : 'items-center justify-center')}>
                  <div
                    ref={canvasRef}
                    onClick={() => setSelectedLayerId(null)}
                    className="relative shrink-0 overflow-hidden bg-white shadow-[0_24px_80px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/10"
                    style={{
                      width: template.aspectWidth >= template.aspectHeight ? `min(${78 * canvasZoom}vw, ${800 * canvasZoom}px)` : `min(${58 * canvasZoom}vw, ${620 * canvasZoom}px)`,
                      aspectRatio: `${template.aspectWidth}/${template.aspectHeight}`,
                      backgroundColor: currentPage?.backgroundColor,
                      containerType: 'inline-size',
                    }}
                  >
                  {currentPage?.background && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentPage.background} alt="Imported page artwork" draggable={false} className={cn('pointer-events-none absolute inset-0 h-full w-full', currentPage.backgroundFit === 'cover' ? 'object-cover' : currentPage.backgroundFit === 'contain' ? 'object-contain' : 'object-fill')} />
                  )}
                  {template.pageColumns > 1 && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex">
                      {Array.from({ length: template.pageColumns }, (_, columnIndex) => (
                        <div key={columnIndex} className={cn('relative h-full flex-1', columnIndex > 0 && 'border-l border-dashed border-cyan-500/75')}>
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-cyan-600/90 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-white shadow-sm">Column {columnIndex + 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {template.pageMarginMm > 0 && (
                    <div
                      className="pointer-events-none absolute border border-dashed border-violet-500/65"
                      style={{ left: `${marginXPercent}%`, right: `${marginXPercent}%`, top: `${marginYPercent}%`, bottom: `${marginYPercent}%` }}
                    >
                      <span className="absolute -top-4 left-0 rounded bg-violet-600/85 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-white">Safe margin</span>
                    </div>
                  )}
                    {currentPage?.layers.map((layer) => {
                      const pupilBound = isPupilDataLayer(layer);
                      const layerData = pupilBound && layer.pupilDataMode === 'follow'
                        ? previewRenderData[getLayerColumnIndex(layer, template.pageColumns)]
                        : previewRenderData[0];
                      if (pupilBound && layer.pupilDataMode === 'follow' && !layerData) return null;
                      return (
                        <StudioLayer
                          key={layer.id}
                          layer={layer}
                          data={layerData}
                          selected={selectedLayerId === layer.id}
                          onSelect={() => setSelectedLayerId(layer.id)}
                          onPointerDown={(event) => beginTransform(event, layer, 'move')}
                          onResizePointerDown={(event) => beginTransform(event, layer, 'resize')}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/70 bg-white/60 px-4 py-1.5 text-[10px] text-slate-500 backdrop-blur-xl">
                <span>Drag layers freely. Use the corner handle to resize.</span>
                <div className="flex items-center rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                  <Button type="button" variant="ghost" size="icon" disabled={canvasZoom <= 0.25} onClick={() => setCanvasZoom((value) => clamp(Number((value - 0.1).toFixed(2)), 0.25, 4))} className="h-6 w-6 rounded-full" title="Zoom out" aria-label="Zoom out"><ZoomOut className="h-3 w-3" /></Button>
                  <button type="button" onClick={() => setCanvasZoom(1)} className="min-w-11 px-1 text-[9px] font-black tabular-nums text-slate-600" title="Reset canvas zoom">{Math.round(canvasZoom * 100)}%</button>
                  <Button type="button" variant="ghost" size="icon" disabled={canvasZoom >= 4} onClick={() => setCanvasZoom((value) => clamp(Number((value + 0.1).toFixed(2)), 0.25, 4))} className="h-6 w-6 rounded-full" title="Zoom in" aria-label="Zoom in"><ZoomIn className="h-3 w-3" /></Button>
                </div>
                <span className="font-semibold">Preview pupil: {previewPupil ? pupilDisplayName(previewPupil) : 'No pupils found'}</span>
              </div>
            </section>

            <aside className="border-l border-slate-200 bg-white/80 p-3 lg:overflow-y-auto">
              <div className="mb-3 flex items-center gap-2"><Crop className="h-4 w-4 text-violet-600" /><div><p className="text-xs font-black text-slate-800">Inspector</p><p className="text-[10px] text-slate-500">Precise size, mask and styling</p></div></div>
              {!selectedLayer ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"><Layers3 className="mx-auto mb-2 h-7 w-7 text-slate-400" /><p className="text-xs font-bold text-slate-600">Select a layer</p><p className="mt-1 text-[10px] text-slate-500">Click any item on the page or in the layer list.</p></div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <Input value={selectedLayer.label} onChange={(event) => updateLayer(selectedLayer.id, { label: event.target.value })} className="h-8 flex-1 bg-white text-xs font-bold" />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateLayer(selectedLayer.id, { hidden: !selectedLayer.hidden })}>{selectedLayer.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateLayer(selectedLayer.id, { locked: !selectedLayer.locked })}>{selectedLayer.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberInput label="X" value={selectedLayer.x * 100} min={-50} max={150} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { x: value / 100 })} />
                      <NumberInput label="Y" value={selectedLayer.y * 100} min={-50} max={150} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { y: value / 100 })} />
                      <NumberInput label="Width" value={selectedLayer.width * 100} min={0.5} max={150} step={0.1} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { width: value / 100 })} />
                      <NumberInput label="Height" value={selectedLayer.height * 100} min={0.5} max={150} step={0.1} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { height: value / 100 })} />
                      <NumberInput label="Rotation" value={selectedLayer.rotation} min={-180} max={180} suffix="°" onChange={(value) => updateLayer(selectedLayer.id, { rotation: value })} />
                      <NumberInput label="Opacity" value={selectedLayer.opacity * 100} min={0} max={100} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { opacity: value / 100 })} />
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-slate-600"><Checkbox checked={selectedLayer.constrainToPage} onCheckedChange={(checked) => updateLayer(selectedLayer.id, { constrainToPage: checked === true })} />Mask movement to page boundaries</label>
                  </div>

                  {selectedLayer.kind !== 'text' ? (
                    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Photo frame & crop</p>
                      <Label className="text-[10px]">Shape</Label>
                      <Select value={selectedLayer.shape} onValueChange={(value) => updateLayer(selectedLayer.id, { shape: value as FrameShape })}>
                        <SelectTrigger className="h-8 bg-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{SHAPE_OPTIONS.map((shape) => <SelectItem key={shape.value} value={shape.value}>{shape.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Photo fit</span><Select value={selectedLayer.imageFit} onValueChange={(value) => updateLayer(selectedLayer.id, { imageFit: value as CustomPhotoLayer['imageFit'] })}><SelectTrigger className="h-8 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cover">Fill frame (crop)</SelectItem><SelectItem value="contain">Fit whole photo</SelectItem></SelectContent></Select></label>
                      <NumberInput label="Crop zoom (no maximum)" value={selectedLayer.imageZoom} min={0.01} step={0.05} suffix="×" onChange={(value) => updateLayer(selectedLayer.id, { imageZoom: Math.max(0.01, value) })} />
                      <div className="grid grid-cols-2 gap-2">
                        <NumberInput label="Crop X" value={selectedLayer.imageOffsetX * 100} step={1} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { imageOffsetX: value / 100 })} />
                        <NumberInput label="Crop Y" value={selectedLayer.imageOffsetY * 100} step={1} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { imageOffsetY: value / 100 })} />
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <div className="mb-1.5 flex justify-between text-[10px] font-semibold text-slate-600"><span>Feather around shape</span><span>{selectedLayer.feather}%</span></div>
                        <Slider
                          value={[selectedLayer.feather]}
                          min={0}
                          max={100}
                          step={1}
                          onPointerDown={() => { historyGroupRef.current = true; historyGroupRecordedRef.current = false; }}
                          onPointerUp={() => { historyGroupRef.current = false; historyGroupRecordedRef.current = false; }}
                          onPointerCancel={() => { historyGroupRef.current = false; historyGroupRecordedRef.current = false; }}
                          onValueChange={([value]) => updateLayer(selectedLayer.id, { feather: value })}
                        />
                        <p className="mt-2 text-[9px] leading-3.5 text-slate-500">Softens the actual circle, oval, rounded or polygon edge.</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <NumberInput label="Top side" value={selectedLayer.featherTop || 0} min={0} max={100} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { featherTop: value })} />
                          <NumberInput label="Right side" value={selectedLayer.featherRight || 0} min={0} max={100} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { featherRight: value })} />
                          <NumberInput label="Bottom side" value={selectedLayer.featherBottom || 0} min={0} max={100} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { featherBottom: value })} />
                          <NumberInput label="Left side" value={selectedLayer.featherLeft || 0} min={0} max={100} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { featherLeft: value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2"><NumberInput label="Border" value={selectedLayer.borderWidth} min={0} max={30} suffix="px" onChange={(value) => updateLayer(selectedLayer.id, { borderWidth: value })} /><label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Border colour</span><Input type="color" value={selectedLayer.borderColor} onChange={(event) => updateLayer(selectedLayer.id, { borderColor: event.target.value })} className="h-8 bg-white p-1" /></label></div>
                      <Button variant="ghost" size="sm" className="h-8 w-full text-[10px]" onClick={() => updateLayer(selectedLayer.id, { imageZoom: 1, imageOffsetX: 0, imageOffsetY: 0, rotation: 0, feather: 0, featherTop: 0, featherRight: 0, featherBottom: 0, featherLeft: 0 })}><RotateCcw className="mr-1 h-3 w-3" />Reset photo treatment</Button>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Text & pupil data</p>
                      {selectedLayer.field ? (
                        <Select value={selectedLayer.field} onValueChange={(value) => updateLayer(selectedLayer.id, { field: value as DynamicField, label: DYNAMIC_FIELD_OPTIONS.find((item) => item.value === value)?.label || selectedLayer.label })}>
                          <SelectTrigger className="h-8 bg-white text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{DYNAMIC_FIELD_OPTIONS.map((field) => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Type text directly</span><Textarea value={selectedLayer.text || ''} onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })} rows={4} placeholder="Type the text that should appear on this document…" className="min-h-20 resize-y bg-white text-xs" /></label>
                      )}
                      <FontPicker value={selectedLayer.fontFamily} onChange={(value) => updateLayer(selectedLayer.id, { fontFamily: value })} />
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500">Letter case</Label>
                        <Select value={selectedLayer.textCase || 'original'} onValueChange={(value) => updateLayer(selectedLayer.id, { textCase: value as TextCase })}>
                          <SelectTrigger className="h-8 bg-white text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="original">As entered</SelectItem>
                            <SelectItem value="sentence">Sentence case</SelectItem>
                            <SelectItem value="lowercase">lowercase</SelectItem>
                            <SelectItem value="uppercase">UPPERCASE</SelectItem>
                            <SelectItem value="title">Title Case</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                        <Button type="button" variant={selectedLayer.fontWeight >= 600 ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateLayer(selectedLayer.id, { fontWeight: selectedLayer.fontWeight >= 600 ? 400 : 700 })} title="Bold" aria-label="Bold"><Bold className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant={selectedLayer.fontStyle === 'italic' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateLayer(selectedLayer.id, { fontStyle: selectedLayer.fontStyle === 'italic' ? 'normal' : 'italic' })} title="Italic" aria-label="Italic"><Italic className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant={selectedLayer.underline ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateLayer(selectedLayer.id, { underline: !selectedLayer.underline })} title="Underline" aria-label="Underline"><Underline className="h-3.5 w-3.5" /></Button>
                        <span className="mx-1 h-5 w-px bg-slate-200" />
                        <label className="flex h-8 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-[10px] font-semibold text-slate-600 hover:bg-white" title="Font colour">
                          <span className="h-4 w-4 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: selectedLayer.color }} />
                          Font colour
                          <Input type="color" value={selectedLayer.color} onChange={(event) => updateLayer(selectedLayer.id, { color: event.target.value })} className="sr-only" />
                        </label>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <NumberInput label="Size" value={selectedLayer.fontSize} min={8} max={200} suffix="px" onChange={(value) => updateLayer(selectedLayer.id, { fontSize: value })} />
                        <NumberInput label="Weight" value={selectedLayer.fontWeight} min={100} max={900} step={100} onChange={(value) => updateLayer(selectedLayer.id, { fontWeight: value })} />
                        <NumberInput label="Line height" value={selectedLayer.lineHeight} min={0.7} max={2.5} step={0.05} onChange={(value) => updateLayer(selectedLayer.id, { lineHeight: value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Text colour</span><Input type="color" value={selectedLayer.color} onChange={(event) => updateLayer(selectedLayer.id, { color: event.target.value })} className="h-8 bg-white p-1" /></label><label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Background</span><Input type="color" value={selectedLayer.backgroundColor === 'transparent' ? '#ffffff' : selectedLayer.backgroundColor} onChange={(event) => updateLayer(selectedLayer.id, { backgroundColor: event.target.value })} className="h-8 bg-white p-1" /></label></div>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                        {(['left', 'center', 'right'] as const).map((align) => { const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight; return <Button key={align} type="button" variant={selectedLayer.textAlign === align ? 'secondary' : 'ghost'} size="icon" className="h-7 w-full" onClick={() => updateLayer(selectedLayer.id, { textAlign: align })}><Icon className="h-3.5 w-3.5" /></Button>; })}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </aside>
          </main>
        ) : (
          <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 lg:grid-cols-[minmax(480px,1fr)_350px] lg:overflow-hidden lg:p-5">
            <section className="flex min-h-[540px] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/85 shadow-sm backdrop-blur-xl lg:min-h-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
                <div className="mr-auto"><p className="text-sm font-black text-slate-900">Choose pupils</p><p className="text-[10px] text-slate-500">The same design is personalised for everyone selected.</p></div>
                <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><Input value={pupilSearch} onChange={(event) => setPupilSearch(event.target.value)} placeholder="Search name or admission…" className="h-9 rounded-full bg-white pl-8 text-xs" /></div>
                <Select value={classFilter} onValueChange={setClassFilter}><SelectTrigger className="h-9 w-[150px] rounded-full bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All classes</SelectItem>{classOptions.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-9 w-[120px] rounded-full bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Graduated">Graduated</SelectItem></SelectContent></Select>
                <Select value={photoFilter} onValueChange={(value) => setPhotoFilter(value as 'all' | 'with' | 'without')}><SelectTrigger className="h-9 w-[132px] rounded-full bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All photos</SelectItem><SelectItem value="with">With photo</SelectItem><SelectItem value="without">Without photo</SelectItem></SelectContent></Select>
              </div>
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2"><Checkbox checked={allFilteredSelected} onCheckedChange={toggleAllFiltered} /><button type="button" onClick={toggleAllFiltered} className="text-[11px] font-bold text-slate-700">{allFilteredSelected ? 'Clear filtered pupils' : `Select all ${filteredPupils.length} filtered pupils`}</button><Badge className="ml-auto bg-violet-100 text-violet-700 hover:bg-violet-100">{selectedPupils.length} selected</Badge></div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {filteredPupils.map((pupil) => {
                  const selected = selectedPupilIds.has(pupil.id);
                  return <button key={pupil.id} type="button" onClick={() => togglePupil(pupil.id)} className={cn('mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors', selected ? 'border-violet-200 bg-violet-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50')}><Checkbox checked={selected} onCheckedChange={() => togglePupil(pupil.id)} onClick={(event) => event.stopPropagation()} /><Avatar className="h-9 w-9"><AvatarImage src={pupil.photo} /><AvatarFallback className="text-[10px] font-bold">{pupilInitials(pupil)}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-800">{pupilDisplayName(pupil)}</span><span className="block truncate text-[10px] text-slate-500">{pupil.admissionNumber || 'No admission number'} · {pupil.className || pupil.classCode || 'No class'}{pupil.section ? ` · ${pupil.section}` : ''}</span></span>{selected && <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-white"><Check className="h-3.5 w-3.5" /></span>}</button>;
                })}
                {filteredPupils.length === 0 && <div className="grid h-48 place-items-center text-center"><div><Users className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-xs font-bold text-slate-600">No pupils match these filters</p></div></div>}
              </div>
            </section>

            <aside className="space-y-3 overflow-y-auto rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-xl">
              <div><p className="text-sm font-black text-slate-900">Page output</p><p className="text-[10px] text-slate-500">Print uses the same page setup as the editing canvas.</p></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm"><Maximize2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-black text-emerald-900">Exact design page</p><p className="text-[10px] text-emerald-700">{PAPER_SIZE_OPTIONS.find((size) => size.value === template.paperSize)?.label || 'Custom'} · {template.pageOrientation} · {template.aspectWidth} × {template.aspectHeight} mm</p></div><Check className="h-4 w-4 text-emerald-700" /></div>
                <p className="mt-2 text-[9px] leading-3.5 text-emerald-700">Orientation, canvas proportions and the {template.pageMarginMm} mm safe margin remain owned by Page setup.</p>
              </div>
              <label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Design cards per sheet</span><Select value={String(output.cardsPerPage)} onValueChange={(value) => setOutput((previous) => ({ ...previous, cardsPerPage: Number(value), gapMm: Number(value) === 1 ? 0 : previous.gapMm }))}><SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 6, 8, 9, 12].map((count) => <SelectItem key={count} value={String(count)}>{count === 1 ? '1 · exact editing size' : `${count} · collage`}</SelectItem>)}</SelectContent></Select></label>
              {output.cardsPerPage > 1 && (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <p className="text-[9px] leading-3.5 text-amber-700">Collage mode intentionally scales the full design to fit multiple copies on the same sheet.</p>
                  <NumberInput label="Gap between designs" value={output.gapMm} min={0} max={20} suffix="mm" onChange={(value) => setOutput((previous) => ({ ...previous, gapMm: value }))} />
                  <label className="flex items-center gap-2 rounded-lg bg-white/70 p-2 text-[10px] font-semibold text-slate-600"><Checkbox checked={output.showCutLines} onCheckedChange={(checked) => setOutput((previous) => ({ ...previous, showCutLines: checked === true }))} />Show dotted trimming lines</label>
                </div>
              )}

              {usesFees && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-amber-800">Fee data period</p>
                  <p className="mb-2 text-[10px] text-amber-700">Balance, paid and total fields use this academic period.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={selectedYearId} onValueChange={(value) => { setSelectedYearId(value); setSelectedTermId(academicYears.find((year) => year.id === value)?.terms[0]?.id || ''); }}><SelectTrigger className="h-8 bg-white text-[10px]"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{academicYears.map((year) => <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={selectedTermId} onValueChange={setSelectedTermId}><SelectTrigger className="h-8 bg-white text-[10px]"><SelectValue placeholder="Term" /></SelectTrigger><SelectContent>{selectedYear?.terms.map((term) => <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <p className="mt-2 truncate text-[9px] font-medium text-amber-700">{feesProcessing ? feesStatus || 'Calculating balances…' : `${Object.keys(feesByPupil).length} pupil balances ready`}</p>
                </div>
              )}

              <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-3">
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-black text-violet-800">{selectedPupils.length}</p><p className="text-[9px] font-semibold uppercase text-violet-500">Pupils</p></div>
                  <div><p className="text-lg font-black text-violet-800">{template.pages.length}</p><p className="text-[9px] font-semibold uppercase text-violet-500">Design pages</p></div>
                  <div><p className="text-lg font-black text-violet-800">{estimatedPages}</p><p className="text-[9px] font-semibold uppercase text-violet-500">PDF pages</p></div>
                </div>
                <p className="text-[10px] leading-4 text-violet-700">For multipage designs, every pupil group gets page 1, page 2, and each additional design page in sequence.</p>
              </div>

              <Button onClick={generatePdf} disabled={selectedPupils.length === 0 || isGenerating || (usesFees && feesProcessing)} className="h-11 w-full rounded-xl bg-violet-700 font-bold hover:bg-violet-800">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                {isGenerating ? `Creating page ${generationProgress.completed} of ${generationProgress.total}…` : 'Open in-app print preview'}
              </Button>
              <Button variant="ghost" onClick={() => setStage('design')} className="w-full text-xs"><LayoutGrid className="mr-2 h-4 w-4" />Return to design</Button>
            </aside>
          </main>
        )}

        {usesFees && selectedPupils.length > 0 && selectedYear && selectedTermId && (
          <FeeDataBridge
            key={`${selectedYear.id}-${selectedTermId}-${selectedPupils.map((pupil) => pupil.id).sort().join('|')}`}
            pupils={selectedPupils}
            selectedYear={selectedYear}
            selectedTermId={selectedTermId}
            academicYears={academicYears}
            onChange={handleFeeData}
          />
        )}
      </div>

      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={pdfViewer.closePDF}
        pdfBlob={pdfViewer.pdfBlob}
        fileName={pdfViewer.fileName}
        title={pdfViewer.title}
      />
    </>
  );
}
