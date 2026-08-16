"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  ChevronsUpDown,
  ChevronLeft,
  CircleUserRound,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FileImage,
  FilePlus2,
  ImagePlus,
  ImageUp,
  Layers3,
  LayoutGrid,
  Loader2,
  Lock,
  Maximize2,
  PanelRight,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Type,
  Unlock,
  Users,
  WandSparkles,
  X,
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
  DYNAMIC_FIELD_OPTIONS,
  PAPER_SIZE_OPTIONS,
  createBlankPage,
  createBlankTemplate,
  createCustomTextLayer,
  createImageLayer,
  createTextLayer,
  makeStudioId,
  getPaperDimensions,
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
    ? (layer.field && data ? resolvePupilField(layer.field, data) : layer.text || 'Your message here')
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
        transform: `rotate(${layer.rotation}deg)`,
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
            className="absolute inset-0 overflow-hidden bg-slate-200"
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
                style={{ objectFit: layer.imageFit, transform: `scale(${layer.imageZoom}) translate(${layer.imageOffsetX * 20}%, ${layer.imageOffsetY * 20}%)` }}
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
  const [stage, setStage] = useState<'design' | 'output'>('design');
  const [template, setTemplate] = useState<CustomPhotoTemplate>(() => createBlankTemplate());
  const [activePageId, setActivePageId] = useState<string>(() => template.pages[0].id);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(() => template.pages[0].layers[0]?.id || null);
  const [savedTemplates, setSavedTemplates] = useState<CustomPhotoTemplate[]>([]);
  const [selectedPupilIds, setSelectedPupilIds] = useState<Set<string>>(new Set());
  const [pupilSearch, setPupilSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [output, setOutput] = useState<CustomPhotoOutputSettings>({
    paperSize: 'a4',
    orientation: 'portrait',
    cardsPerPage: 2,
    marginMm: 8,
    gapMm: 3,
    showCutLines: true,
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
  const previewPupil = selectedPupils[0] || pupils.find((pupil) => pupil.status === 'Active') || pupils[0];
  const previewData = previewPupil ? { pupil: previewPupil, fees: feesByPupil[previewPupil.id], school: schoolInfo } : undefined;
  const usesFees = templateUsesFees(template);
  const classOptions = useMemo(() => Array.from(new Map(
    pupils.filter((pupil) => pupil.classId).map((pupil) => [pupil.classId, pupil.className || pupil.classCode || 'Unnamed class']),
  ).entries()).sort((a, b) => a[1].localeCompare(b[1])), [pupils]);
  const filteredPupils = useMemo(() => {
    const query = pupilSearch.trim().toLowerCase();
    return pupils.filter((pupil) => {
      if (classFilter !== 'all' && pupil.classId !== classFilter) return false;
      if (statusFilter !== 'all' && pupil.status !== statusFilter) return false;
      if (!query) return true;
      return `${pupilDisplayName(pupil)} ${pupil.admissionNumber || ''} ${pupil.className || ''}`.toLowerCase().includes(query);
    });
  }, [classFilter, pupilSearch, pupils, statusFilter]);
  const allFilteredSelected = filteredPupils.length > 0 && filteredPupils.every((pupil) => selectedPupilIds.has(pupil.id));
  const estimatedPages = estimatePdfPageCount(selectedPupils.length, template.pages.length, output.cardsPerPage);
  const marginXPercent = clamp(template.pageMarginMm / Math.max(1, template.aspectWidth) * 100, 0, 45);
  const marginYPercent = clamp(template.pageMarginMm / Math.max(1, template.aspectHeight) * 100, 0, 45);

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
  };

  const removeSelectedLayer = () => {
    if (!selectedLayerId) return;
    updateCurrentPage((page) => ({ ...page, layers: page.layers.filter((layer) => layer.id !== selectedLayerId) }));
    setSelectedLayerId(null);
  };

  const duplicateSelectedLayer = () => {
    if (!selectedLayer) return;
    const copy = { ...selectedLayer, id: makeStudioId(selectedLayer.kind), label: `${selectedLayer.label} copy`, x: clamp(selectedLayer.x + 0.03, 0, 0.94), y: clamp(selectedLayer.y + 0.03, 0, 0.94) };
    addLayer(copy);
  };

  const moveLayerOrder = (direction: -1 | 1) => {
    if (!selectedLayerId) return;
    updateCurrentPage((page) => {
      const index = page.layers.findIndex((layer) => layer.id === selectedLayerId);
      const next = clamp(index + direction, 0, page.layers.length - 1);
      if (index < 0 || index === next) return page;
      const layers = [...page.layers];
      const [layer] = layers.splice(index, 1);
      layers.splice(next, 0, layer);
      return { ...page, layers };
    });
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
          width: clamp(initial.width + dx, 0.04, maxWidth),
          height: clamp(initial.height + dy, 0.04, maxHeight),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
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
  };

  const duplicatePage = () => {
    if (!currentPage) return;
    const copy = cloneTemplate({ ...template, pages: [currentPage] }).pages[0];
    copy.id = makeStudioId('page');
    copy.name = `${currentPage.name} copy`;
    copy.layers = copy.layers.map((layer) => ({ ...layer, id: makeStudioId(layer.kind) }));
    setTemplate((previous) => ({ ...previous, pages: [...previous.pages, copy], updatedAt: new Date().toISOString() }));
    setActivePageId(copy.id);
    setSelectedLayerId(copy.layers[0]?.id || null);
  };

  const removePage = () => {
    if (template.pages.length <= 1 || !currentPage) return;
    const remaining = template.pages.filter((page) => page.id !== currentPage.id);
    setTemplate((previous) => ({ ...previous, pages: remaining, updatedAt: new Date().toISOString() }));
    setActivePageId(remaining[0].id);
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
      const blob = await createCustomPhotoPdf(template, selectedPupils, feesByPupil, output, schoolInfo, (completed, total) => {
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
      <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-slate-100 text-slate-900" role="dialog" aria-modal="true" aria-label="DocX Custom Photo Studio">
        <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-white/80 bg-white/85 px-3 py-2 shadow-sm backdrop-blur-2xl sm:px-5">
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
          <Button onClick={saveTemplate} variant="outline" size="sm" className="rounded-full"><Save className="mr-1.5 h-3.5 w-3.5" />Save</Button>
          <Button onClick={() => setStage('output')} size="sm" className="rounded-full bg-violet-700 hover:bg-violet-800">Create documents <PanelRight className="ml-1.5 h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full"><X className="h-4 w-4" /><span className="sr-only">Close editor</span></Button>
        </header>

        {stage === 'design' ? (
          <main className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[250px_minmax(460px,1fr)_300px] lg:overflow-hidden">
            <aside className="border-r border-slate-200 bg-white/75 p-3 lg:overflow-y-auto">
              <div className="mb-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-3">
                <div className="mb-2 flex items-start gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-violet-700 shadow-sm"><ImageUp className="h-4 w-4" /></span>
                  <div><p className="text-xs font-black text-violet-950">Start with your artwork</p><p className="mt-0.5 text-[10px] leading-4 text-violet-700">Import any JPG, PNG or WebP image as this page’s template background.</p></div>
                </div>
                <Button type="button" onClick={() => backgroundInputRef.current?.click()} className="h-9 w-full bg-violet-700 text-xs font-bold hover:bg-violet-800"><ImagePlus className="mr-1.5 h-4 w-4" />Import template image</Button>
              </div>
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-xs font-black text-slate-800">Pages</p><p className="text-[10px] text-slate-500">Each becomes a front, back, or follow-on page.</p></div>
                <Button size="icon" variant="outline" onClick={addPage} className="h-8 w-8 rounded-lg"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="space-y-1.5">
                {template.pages.map((page, index) => (
                  <button key={page.id} type="button" onClick={() => setActivePageId(page.id)} className={cn('flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors', activePageId === page.id ? 'border-violet-300 bg-violet-50 text-violet-900' : 'border-transparent bg-slate-50 text-slate-600 hover:border-slate-200')}>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[10px] font-black shadow-sm">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{page.name}</span>
                    {page.background && <FileImage className="h-3.5 w-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={duplicatePage} className="h-8 flex-1 text-[10px]"><Copy className="mr-1 h-3 w-3" />Duplicate</Button>
                <Button size="sm" variant="ghost" disabled={template.pages.length <= 1} onClick={removePage} className="h-8 text-[10px] text-rose-600"><Trash2 className="h-3 w-3" /></Button>
              </div>

              <div className="my-4 h-px bg-slate-200" />
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5"><p className="text-xs font-black text-slate-800">Layers</p><Badge variant="secondary" className="text-[9px]">{currentPage?.layers.length || 0}</Badge></div>
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
                      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">{DYNAMIC_FIELD_OPTIONS.filter((field) => field.group === 'pupil').map((field) => <DropdownMenuItem key={field.value} onSelect={() => addLayer(createTextLayer(field.value))}>{field.label}</DropdownMenuItem>)}</DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><Building2 className="mr-2 h-4 w-4" />School information</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>{DYNAMIC_FIELD_OPTIONS.filter((field) => field.group === 'school').map((field) => <DropdownMenuItem key={field.value} onSelect={() => addLayer(createTextLayer(field.value))}>{field.label}</DropdownMenuItem>)}</DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1">
                {[...(currentPage?.layers || [])].reverse().map((layer) => (
                  <button key={layer.id} type="button" onClick={() => setSelectedLayerId(layer.id)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left', selectedLayerId === layer.id ? 'bg-violet-100 text-violet-900' : 'text-slate-600 hover:bg-slate-100')}>
                    {layer.kind === 'avatar' ? <CircleUserRound className="h-3.5 w-3.5" /> : layer.kind === 'schoolLogo' ? <Building2 className="h-3.5 w-3.5" /> : layer.kind === 'image' ? <FileImage className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{layer.label}</span>
                    {layer.hidden && <EyeOff className="h-3 w-3" />}
                    {layer.locked && <Lock className="h-3 w-3" />}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                <Button variant="outline" size="icon" className="h-8 w-full" disabled={!selectedLayer} onClick={() => moveLayerOrder(1)} title="Bring forward"><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-full" disabled={!selectedLayer} onClick={() => moveLayerOrder(-1)} title="Send backward"><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-full" disabled={!selectedLayer} onClick={duplicateSelectedLayer} title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-full text-rose-600" disabled={!selectedLayer} onClick={removeSelectedLayer} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </aside>

            <section className="flex min-h-[650px] min-w-0 flex-col bg-[radial-gradient(circle_at_top,#ede9fe_0%,#f8fafc_42%,#e2e8f0_100%)] lg:min-h-0">
              <div className="flex flex-wrap items-center justify-center gap-1.5 border-b border-white/70 bg-white/55 p-2 backdrop-blur-xl">
                <Button size="sm" variant="outline" onClick={() => backgroundInputRef.current?.click()} className="h-8 rounded-full border-violet-200 bg-violet-50 text-[10px] text-violet-700"><ImageUp className="mr-1 h-3.5 w-3.5" />Import template</Button>
                <Button size="sm" variant="outline" onClick={() => addLayer(createImageLayer('avatar'))} className="h-8 rounded-full text-[10px]"><CircleUserRound className="mr-1 h-3.5 w-3.5" />Pupil photo</Button>
                <Button size="sm" variant="outline" onClick={() => addLayer(createImageLayer('schoolLogo'))} className="h-8 rounded-full text-[10px]"><Building2 className="mr-1 h-3.5 w-3.5" />School badge</Button>
                <Button size="sm" variant="outline" onClick={() => addLayer(createCustomTextLayer())} className="h-8 rounded-full text-[10px]"><Type className="mr-1 h-3.5 w-3.5" />Text box</Button>
                <Button size="sm" variant="outline" onClick={() => imageLayerInputRef.current?.click()} className="h-8 rounded-full text-[10px]"><FilePlus2 className="mr-1 h-3.5 w-3.5" />Photo art</Button>
                <input ref={backgroundInputRef} type="file" accept="image/*" hidden onChange={(event) => { void importBackground(event.target.files?.[0]); event.target.value = ''; }} />
                <input ref={imageLayerInputRef} type="file" accept="image/*" hidden onChange={(event) => { void importImageLayer(event.target.files?.[0]); event.target.value = ''; }} />
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-5 sm:p-8">
                <div
                  ref={canvasRef}
                  onClick={() => setSelectedLayerId(null)}
                  className="relative max-h-full max-w-full overflow-hidden bg-white shadow-[0_24px_80px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/10"
                  style={{
                    width: template.aspectWidth >= template.aspectHeight ? 'min(78vw, 800px)' : 'min(58vw, 620px)',
                    aspectRatio: `${template.aspectWidth}/${template.aspectHeight}`,
                    backgroundColor: currentPage?.backgroundColor,
                    containerType: 'inline-size',
                  }}
                >
                  {currentPage?.background && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentPage.background} alt="Imported page artwork" draggable={false} className={cn('pointer-events-none absolute inset-0 h-full w-full', currentPage.backgroundFit === 'cover' ? 'object-cover' : currentPage.backgroundFit === 'contain' ? 'object-contain' : 'object-fill')} />
                  )}
                  {template.pageMarginMm > 0 && (
                    <div
                      className="pointer-events-none absolute border border-dashed border-violet-500/65"
                      style={{ left: `${marginXPercent}%`, right: `${marginXPercent}%`, top: `${marginYPercent}%`, bottom: `${marginYPercent}%` }}
                    >
                      <span className="absolute -top-4 left-0 rounded bg-violet-600/85 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-white">Safe margin</span>
                    </div>
                  )}
                  {currentPage?.layers.map((layer) => (
                    <StudioLayer
                      key={layer.id}
                      layer={layer}
                      data={previewData}
                      selected={selectedLayerId === layer.id}
                      onSelect={() => setSelectedLayerId(layer.id)}
                      onPointerDown={(event) => beginTransform(event, layer, 'move')}
                      onResizePointerDown={(event) => beginTransform(event, layer, 'resize')}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/70 bg-white/60 px-4 py-2 text-[10px] text-slate-500 backdrop-blur-xl">
                <span>Drag layers freely. Use the corner handle to resize.</span>
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
                      <NumberInput label="Width" value={selectedLayer.width * 100} min={4} max={150} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { width: value / 100 })} />
                      <NumberInput label="Height" value={selectedLayer.height * 100} min={4} max={150} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { height: value / 100 })} />
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
                      <div><div className="mb-1.5 flex justify-between text-[10px] font-semibold text-slate-500"><span>Crop zoom</span><span>{selectedLayer.imageZoom.toFixed(2)}×</span></div><Slider value={[selectedLayer.imageZoom]} min={1} max={3} step={0.01} onValueChange={([value]) => updateLayer(selectedLayer.id, { imageZoom: value })} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberInput label="Crop X" value={selectedLayer.imageOffsetX * 100} min={-100} max={100} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { imageOffsetX: value / 100 })} />
                        <NumberInput label="Crop Y" value={selectedLayer.imageOffsetY * 100} min={-100} max={100} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { imageOffsetY: value / 100 })} />
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <div className="mb-1.5 flex justify-between text-[10px] font-semibold text-slate-600"><span>Feather around shape</span><span>{selectedLayer.feather}%</span></div>
                        <Slider value={[selectedLayer.feather]} min={0} max={100} step={1} onValueChange={([value]) => updateLayer(selectedLayer.id, { feather: value })} />
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
              {savedTemplates.length > 0 && <div className="mt-3"><p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Saved on this device</p><Select onValueChange={loadTemplate}><SelectTrigger className="h-8 bg-white text-[10px]"><SelectValue placeholder="Open saved template" /></SelectTrigger><SelectContent>{savedTemplates.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>}
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
              <div><p className="text-sm font-black text-slate-900">Collage & page output</p><p className="text-[10px] text-slate-500">Choose the print sheet and how many personalised designs appear on it.</p></div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Print sheet size</span><Select value={output.paperSize} onValueChange={(value) => setOutput((previous) => ({ ...previous, paperSize: value as PaperSize }))}><SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent>{PAPER_SIZE_OPTIONS.filter((size) => size.value !== 'custom').map((size) => <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>)}</SelectContent></Select></label>
                <label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Page orientation</span><Select value={output.orientation} onValueChange={(value) => setOutput((previous) => ({ ...previous, orientation: value as CustomPhotoOutputSettings['orientation'] }))}><SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="portrait">Portrait</SelectItem><SelectItem value="landscape">Landscape</SelectItem></SelectContent></Select></label>
                <label className="space-y-1 text-[10px] font-semibold text-slate-500"><span>Designs per sheet</span><Select value={String(output.cardsPerPage)} onValueChange={(value) => setOutput((previous) => ({ ...previous, cardsPerPage: Number(value) }))}><SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 6, 8, 9, 12].map((count) => <SelectItem key={count} value={String(count)}>{count} per page</SelectItem>)}</SelectContent></Select></label>
                <NumberInput label="Page margin" value={output.marginMm} min={0} max={30} suffix="mm" onChange={(value) => setOutput((previous) => ({ ...previous, marginMm: value }))} />
                <NumberInput label="Gap" value={output.gapMm} min={0} max={20} suffix="mm" onChange={(value) => setOutput((previous) => ({ ...previous, gapMm: value }))} />
              </div>
              <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-[10px] font-semibold text-slate-600"><Checkbox checked={output.showCutLines} onCheckedChange={(checked) => setOutput((previous) => ({ ...previous, showCutLines: checked === true }))} />Show dotted trimming lines</label>

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
