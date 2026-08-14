"use client";

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Files,
  ImageOff,
  ListFilter,
  Loader2,
  Printer,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { Pupil } from '@/types';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { PageHeader } from '@/components/common/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const FRONT_ARTWORK = '/Document%20Macro/0d6ff135-4b7e-487e-b10a-137ae9782773.png';
const BACK_ARTWORK = '/Document%20Macro/64503b0c-d32f-4dfc-a07f-d595a28ee3a4.png';
const FALLBACK_BADGE = '/icons/trinity-badge-72.png';

type CardPair = [Pupil, Pupil?];
type PrintSide = 'front' | 'back';

function pupilName(pupil: Pupil) {
  return [pupil.firstName, pupil.lastName, pupil.otherNames].filter(Boolean).join(' ');
}

function pupilInitials(pupil: Pupil) {
  return `${pupil.firstName?.[0] || ''}${pupil.lastName?.[0] || ''}`.toUpperCase();
}

function pairPupils(pupils: Pupil[]): CardPair[] {
  const pairs: CardPair[] = [];
  for (let index = 0; index < pupils.length; index += 2) {
    pairs.push([pupils[index], pupils[index + 1]]);
  }
  return pairs;
}

function ThankYouCardFace({
  pupil,
  schoolBadge,
  side,
}: {
  pupil?: Pupil;
  schoolBadge: string;
  side: PrintSide;
}) {
  if (!pupil) {
    return <div className="docx-card-side docx-card-blank" aria-label="Unused card position" />;
  }

  if (side === 'back') {
    return (
      <div className="docx-card-side" aria-label={`Reverse of ${pupilName(pupil)}'s thank-you card`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="docx-card-artwork" src={BACK_ARTWORK} alt="Thank-you card reverse artwork" />
      </div>
    );
  }

  return (
    <div className="docx-card-side" aria-label={`${pupilName(pupil)}'s thank-you card front`}>
      <div className="docx-photo-window">
        {pupil.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="docx-pupil-photo" src={pupil.photo} alt={pupilName(pupil)} />
        ) : (
          <div className="docx-photo-fallback" aria-label={`${pupilName(pupil)} has no photo`}>
            <span>{pupilInitials(pupil)}</span>
          </div>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="docx-card-artwork" src={FRONT_ARTWORK} alt="Thank-you card front artwork" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="docx-school-badge" src={schoolBadge} alt="School badge" />
      <div className="docx-pupil-name" title={pupilName(pupil)}>{pupilName(pupil)}</div>
    </div>
  );
}

function A4Sheet({
  pair,
  schoolBadge,
  side,
  pageNumber,
}: {
  pair: CardPair;
  schoolBadge: string;
  side: PrintSide;
  pageNumber: number;
}) {
  return (
    <section className="docx-sheet-block" aria-label={`Page ${pageNumber}, ${side}`}>
      <div className="docx-sheet-label docx-screen-only">
        <span>Page {pageNumber}</span>
        <Badge variant="outline" className={side === 'front' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}>
          {side === 'front' ? 'Fronts' : 'Reverse sides'}
        </Badge>
      </div>
      <div className="docx-a4-sheet">
        <ThankYouCardFace pupil={pair[0]} schoolBadge={schoolBadge} side={side} />
        <div className="docx-cut-line" aria-hidden="true" />
        <ThankYouCardFace pupil={pair[1]} schoolBadge={schoolBadge} side={side} />
      </div>
    </section>
  );
}

async function waitForPrintableImages(root: ParentNode = document) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('#docx-print-root img'));
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  }));
}

async function createDuplexPdfBlob() {
  const sheets = Array.from(document.querySelectorAll<HTMLElement>('#docx-print-root .docx-a4-sheet'));
  if (sheets.length === 0) throw new Error('There are no DocX pages to preview.');

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: 'DocX Thank You Cards', subject: 'Personalised duplex pupil thank-you cards' });

  for (let index = 0; index < sheets.length; index += 1) {
    const sheet = sheets[index];
    const bounds = sheet.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      throw new Error('A DocX page could not be measured for the print preview.');
    }
    const captureScale = Math.min(3, Math.max(2, 2244 / bounds.width));
    const canvas = await html2canvas(sheet, {
      scale: captureScale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 20_000,
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });

    if (index > 0) pdf.addPage('a4', 'landscape');
    const pageWidth = 297;
    const pageHeight = 210;
    const canvasAspect = canvas.width / canvas.height;
    let renderedWidth = pageWidth;
    let renderedHeight = renderedWidth / canvasAspect;
    if (renderedHeight > pageHeight) {
      renderedHeight = pageHeight;
      renderedWidth = renderedHeight * canvasAspect;
    }
    const offsetX = (pageWidth - renderedWidth) / 2;
    const offsetY = (pageHeight - renderedHeight) / 2;
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.98),
      'JPEG',
      offsetX,
      offsetY,
      renderedWidth,
      renderedHeight,
      undefined,
      'FAST',
    );
    canvas.width = 0;
    canvas.height = 0;
  }

  return pdf.output('blob');
}

export function ThankYouCardStudio() {
  const { data: pupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: schoolSettings, isLoading: settingsLoading } = useSchoolSettings();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [genderFilter, setGenderFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [photoFilter, setPhotoFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const pdfViewer = usePDFViewer();
  const { toast } = useToast();

  const schoolBadge = schoolSettings?.generalInfo?.logo || FALLBACK_BADGE;
  const isUsingFallbackBadge = !settingsLoading && !schoolSettings?.generalInfo?.logo;

  const classOptions = useMemo(() => {
    const labels = new Map<string, string>();
    pupils.forEach((pupil) => {
      if (pupil.classId) labels.set(pupil.classId, pupil.className || pupil.classCode || pupil.classId);
    });
    return Array.from(labels, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [pupils]);

  const filteredPupils = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return pupils
      .filter((pupil) => statusFilter === 'all' || pupil.status === statusFilter)
      .filter((pupil) => classFilter === 'all' || pupil.classId === classFilter)
      .filter((pupil) => genderFilter === 'all' || pupil.gender === genderFilter)
      .filter((pupil) => sectionFilter === 'all' || pupil.section === sectionFilter)
      .filter((pupil) => photoFilter === 'all' || (photoFilter === 'with' ? Boolean(pupil.photo) : !pupil.photo))
      .filter((pupil) => {
        if (!normalizedSearch) return true;
        return `${pupilName(pupil)} ${pupil.admissionNumber} ${pupil.className || ''}`
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) => pupilName(left).localeCompare(pupilName(right)));
  }, [classFilter, genderFilter, photoFilter, pupils, search, sectionFilter, statusFilter]);

  const selectedPupils = useMemo(() => {
    const byId = new Map(pupils.map((pupil) => [pupil.id, pupil]));
    return selectedIds.map((id) => byId.get(id)).filter((pupil): pupil is Pupil => Boolean(pupil));
  }, [pupils, selectedIds]);

  const pairs = useMemo(() => pairPupils(selectedPupils), [selectedPupils]);
  const missingPhotoCount = selectedPupils.filter((pupil) => !pupil.photo).length;
  const allVisibleSelected = filteredPupils.length > 0 && filteredPupils.every((pupil) => selectedIds.includes(pupil.id));
  const someVisibleSelected = filteredPupils.some((pupil) => selectedIds.includes(pupil.id));
  const activeFiltersCount = [
    Boolean(search.trim()),
    classFilter !== 'all',
    statusFilter !== 'Active',
    genderFilter !== 'all',
    sectionFilter !== 'all',
    photoFilter !== 'all',
  ].filter(Boolean).length;

  const togglePupil = (pupilId: string) => {
    setSelectedIds((current) => current.includes(pupilId)
      ? current.filter((id) => id !== pupilId)
      : [...current, pupilId]);
  };

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const visibleIds = new Set(filteredPupils.map((pupil) => pupil.id));
      if (allVisibleSelected) return current.filter((id) => !visibleIds.has(id));
      const next = [...current];
      filteredPupils.forEach((pupil) => {
        if (!next.includes(pupil.id)) next.push(pupil.id);
      });
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setClassFilter('all');
    setStatusFilter('Active');
    setGenderFilter('all');
    setSectionFilter('all');
    setPhotoFilter('all');
  };

  const handlePrint = async () => {
    if (selectedPupils.length === 0 || missingPhotoCount > 0) return;
    setIsPreparingPrint(true);
    try {
      await document.fonts?.ready;
      await waitForPrintableImages();
      const pdfBlob = await createDuplexPdfBlob();
      const dateStamp = new Date().toISOString().slice(0, 10);
      pdfViewer.openPDFFromBlob(pdfBlob, `docx-thank-you-cards-${dateStamp}.pdf`, 'DocX Thank You Cards');
    } catch (error) {
      console.error('Unable to prepare DocX print preview:', error);
      toast({
        variant: 'destructive',
        title: 'Print preview could not be prepared',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsPreparingPrint(false);
    }
  };

  return (
    <div className="docx-studio min-h-screen bg-slate-50/70 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px]">
        <PageHeader
          title="DocX"
          description="Create personalised pupil documents, beginning with the duplex Thank You card."
          actions={(
            <Button
              onClick={handlePrint}
              disabled={selectedPupils.length === 0 || missingPhotoCount > 0 || isPreparingPrint}
              className="min-h-11 bg-emerald-700 px-5 text-white shadow-sm hover:bg-emerald-800"
              title={missingPhotoCount > 0 ? 'Every selected pupil needs a photo before printing.' : undefined}
            >
              {isPreparingPrint ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Print duplex set
            </Button>
          )}
        />

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Sparkles className="h-5 w-5" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Template</p><p className="font-bold text-slate-900">Thank You card</p></div>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-700"><Users className="h-5 w-5" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected</p><p className="font-bold text-slate-900">{selectedPupils.length} pupil{selectedPupils.length === 1 ? '' : 's'}</p></div>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><Files className="h-5 w-5" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Output</p><p className="font-bold text-slate-900">{pairs.length * 2} A4 page{pairs.length * 2 === 1 ? '' : 's'}</p></div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-5">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-white pb-4">
                <CardTitle className="text-lg">Choose pupils</CardTitle>
                <CardDescription>Selection order determines how pupils are paired on each sheet.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 bg-white p-4">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
                  <div className="relative md:col-span-2 xl:col-span-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, admission number or class" className="h-11 pl-9" aria-label="Search pupils" />
                  </div>
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="h-11" aria-label="Filter by class"><SelectValue placeholder="All classes" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All classes</SelectItem>{classOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11" aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Graduated">Graduated</SelectItem><SelectItem value="all">All statuses</SelectItem></SelectContent>
                  </Select>
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger className="h-11" aria-label="Filter by gender"><SelectValue placeholder="Gender" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All genders</SelectItem><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                  </Select>
                  <Select value={sectionFilter} onValueChange={setSectionFilter}>
                    <SelectTrigger className="h-11" aria-label="Filter by section"><SelectValue placeholder="Section" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All sections</SelectItem><SelectItem value="Day">Day</SelectItem><SelectItem value="Boarding">Boarding</SelectItem></SelectContent>
                  </Select>
                  <Select value={photoFilter} onValueChange={setPhotoFilter}>
                    <SelectTrigger className="h-11" aria-label="Filter by photo availability"><SelectValue placeholder="Photo" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All photos</SelectItem><SelectItem value="with">With photo</SelectItem><SelectItem value="without">Without photo</SelectItem></SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-800">{filteredPupils.length} pupil{filteredPupils.length === 1 ? '' : 's'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-medium text-emerald-700">{selectedPupils.length} selected</span>
                    {activeFiltersCount > 0 && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'}</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFiltersCount > 0 && <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-slate-600"><ListFilter className="mr-1.5 h-4 w-4" />Clear filters</Button>}
                    {selectedPupils.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="h-9 text-slate-600"><X className="mr-1.5 h-4 w-4" />Clear selection</Button>}
                    <Button variant="outline" size="sm" onClick={toggleVisible} disabled={filteredPupils.length === 0} className="h-9 border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                      {allVisibleSelected ? 'Deselect filtered' : 'Select filtered'}
                    </Button>
                  </div>
                </div>

                <div className="max-h-[520px] overflow-auto rounded-xl border border-indigo-100">
                  {pupilsLoading ? (
                    <div className="grid min-h-64 place-items-center text-sm text-slate-500"><div className="text-center"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading pupils…</div></div>
                  ) : filteredPupils.length === 0 ? (
                    <div className="grid min-h-64 place-items-center px-8 text-center text-sm text-slate-500">No pupils match these filters.</div>
                  ) : (
                    <table className="min-w-[900px] w-full divide-y divide-indigo-100 text-sm">
                      <thead className="sticky top-0 z-10 border-b-2 border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        <tr>
                          <th className="w-12 px-3 py-3 text-center">
                            <Checkbox
                              checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                              onCheckedChange={toggleVisible}
                              aria-label="Select all filtered pupils"
                            />
                          </th>
                          <th className="min-w-[250px] px-3 py-3 text-left">Pupil details</th>
                          <th className="px-3 py-3 text-left">Admission no.</th>
                          <th className="px-3 py-3 text-left">Class</th>
                          <th className="px-3 py-3 text-left">Gender</th>
                          <th className="px-3 py-3 text-left">Section</th>
                          <th className="px-3 py-3 text-left">Status</th>
                          <th className="px-3 py-3 text-center">Photo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredPupils.map((pupil) => {
                          const selected = selectedIds.includes(pupil.id);
                          const selectionNumber = selectedIds.indexOf(pupil.id) + 1;
                          return (
                            <tr
                              key={pupil.id}
                              onClick={() => togglePupil(pupil.id)}
                              className={cn('cursor-pointer transition-colors hover:bg-indigo-50/60', selected && 'bg-emerald-50/80 hover:bg-emerald-50')}
                            >
                              <td className="px-3 py-2.5 text-center" onClick={(event) => event.stopPropagation()}>
                                <Checkbox checked={selected} onCheckedChange={() => togglePupil(pupil.id)} aria-label={`Select ${pupilName(pupil)}`} />
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10 border border-white shadow-sm"><AvatarImage src={pupil.photo} alt={pupilName(pupil)} /><AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-600">{pupilInitials(pupil)}</AvatarFallback></Avatar>
                                  <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{pupilName(pupil)}</p>{selected && <p className="text-xs font-medium text-emerald-700">Print position {selectionNumber}</p>}</div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">{pupil.admissionNumber}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{pupil.className || pupil.classCode || '—'}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{pupil.gender || '—'}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{pupil.section || '—'}</td>
                              <td className="whitespace-nowrap px-3 py-2.5"><Badge variant="outline" className={pupil.status === 'Active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>{pupil.status}</Badge></td>
                              <td className="px-3 py-2.5 text-center">{pupil.photo ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" aria-label="Photo available" /> : <ImageOff className="mx-auto h-4 w-4 text-amber-500" aria-label="Photo missing" />}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>

            {selectedPupils.length > 0 && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Print set</CardTitle><Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="h-8 text-slate-500"><X className="mr-1 h-3.5 w-3.5" />Clear</Button></div></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {pairs.map((pair, index) => (
                    <div key={pair[0].id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Sheet pair {index + 1}</p><p className="truncate text-sm font-medium text-slate-800">{pupilName(pair[0])}</p><p className="truncate text-sm font-medium text-slate-800">{pair[1] ? pupilName(pair[1]) : 'Second position left blank'}</p></div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-white">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><CardTitle>Print preview</CardTitle><CardDescription>A4 landscape · two A5 cards · fronts followed by matching reverse sides</CardDescription></div>
                <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50 text-slate-600">Scale 100% · margins none</Badge>
              </div>
            </CardHeader>
            <CardContent className="bg-slate-200/70 p-3 sm:p-6">
              {isUsingFallbackBadge && (
                <div className="docx-screen-only mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>The school profile has no logo, so the small system badge fallback is being used. Add a high-resolution logo in About School for sharper printing.</span></div>
              )}
              {missingPhotoCount > 0 && (
                <div className="docx-screen-only mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ImageOff className="mt-0.5 h-4 w-4 shrink-0" /><span>{missingPhotoCount} selected pupil{missingPhotoCount === 1 ? ' is' : 's are'} missing a photo. Printing is paused until every selected pupil has an avatar.</span></div>
              )}

              {pairs.length === 0 ? (
                <div className="docx-screen-only grid min-h-[520px] place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 p-8 text-center">
                  <div><span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Files className="h-7 w-7" /></span><h2 className="text-lg font-bold text-slate-900">Your duplex preview will appear here</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Select pupils from the filtered list above. DocX will pair them automatically and place their photos behind the transparent cut-shape artwork.</p></div>
                </div>
              ) : (
                <div id="docx-print-root" className="space-y-6">
                  {pairs.flatMap((pair, pairIndex) => [
                    <A4Sheet key={`${pair[0].id}-front`} pair={pair} schoolBadge={schoolBadge} side="front" pageNumber={pairIndex * 2 + 1} />,
                    <A4Sheet key={`${pair[0].id}-back`} pair={pair} schoolBadge={schoolBadge} side="back" pageNumber={pairIndex * 2 + 2} />,
                  ])}
                </div>
              )}

              {pairs.length > 0 && missingPhotoCount === 0 && (
                <div className="docx-screen-only mt-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Ready for duplex printing</p><p className="mt-1 text-emerald-800">Choose A4 landscape, two-sided printing, flip on the long edge, 100% scale, and no margins. Print one test pair before the full batch.</p></div></div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={pdfViewer.closePDF}
        pdfBlob={pdfViewer.pdfBlob}
        fileName={pdfViewer.fileName}
        title={pdfViewer.title}
        showDownload
        showPrint
      />

      <style jsx global>{`
        .docx-sheet-block { width: 100%; }
        .docx-sheet-label { display: flex; align-items: center; justify-content: space-between; margin: 0 auto 8px; max-width: 297mm; font-size: 12px; font-weight: 700; color: #475569; }
        .docx-a4-sheet { position: relative; display: grid; grid-template-columns: 1fr 1fr; width: 100%; max-width: 297mm; aspect-ratio: 297 / 210; margin: 0 auto; overflow: hidden; background: white; box-shadow: 0 18px 50px rgba(15, 23, 42, .18); }
        .docx-card-side { position: relative; min-width: 0; height: 100%; overflow: hidden; background: white; }
        .docx-card-artwork { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; object-fit: fill; }
        .docx-photo-window { position: absolute; z-index: 1; top: 5.5%; right: 0; width: 56.5%; height: 62.5%; overflow: hidden; background: #f8fafc; }
        .docx-pupil-photo { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 24%; }
        .docx-photo-fallback { display: grid; width: 100%; height: 100%; place-items: center; background: linear-gradient(145deg, #d1fae5, #fef3c7 55%, #fee2e2); color: #047857; font-size: clamp(28px, 5vw, 72px); font-weight: 900; }
        .docx-school-badge { position: absolute; z-index: 3; top: 4.2%; left: 4.7%; width: 34%; height: 36%; object-fit: contain; object-position: top left; filter: drop-shadow(0 2px 2px rgba(15, 23, 42, .08)); }
        .docx-pupil-name { position: absolute; z-index: 3; top: 49.1%; left: 3.4%; display: flex; width: 47.6%; height: 3.5%; align-items: flex-end; justify-content: center; overflow: hidden; padding: 0 1.5% .35%; color: #047a43; font-size: clamp(8px, 1.3vw, 18px); font-weight: 800; line-height: 1; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
        .docx-cut-line { position: absolute; z-index: 5; top: 0; bottom: 0; left: 50%; border-left: .2mm dashed rgba(15, 23, 42, .35); pointer-events: none; }
        .docx-card-blank { background: white; }

        @media (prefers-reduced-motion: reduce) {
          .docx-studio *, .docx-studio *::before, .docx-studio *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
        }

        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { width: 297mm !important; min-width: 297mm !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          #docx-print-root, #docx-print-root * { visibility: visible !important; }
          #docx-print-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 297mm !important; margin: 0 !important; padding: 0 !important; }
          #docx-print-root.space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 0 !important; }
          .docx-screen-only, .docx-sheet-label { display: none !important; }
          .docx-sheet-block { width: 297mm !important; height: 210mm !important; margin: 0 !important; break-after: page !important; page-break-after: always !important; overflow: hidden !important; }
          .docx-sheet-block:last-child { break-after: auto !important; page-break-after: auto !important; }
          .docx-a4-sheet { width: 297mm !important; max-width: none !important; height: 210mm !important; aspect-ratio: auto !important; margin: 0 !important; box-shadow: none !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          .docx-cut-line { border-left-color: rgba(15, 23, 42, .28) !important; }
        }
      `}</style>
    </div>
  );
}
