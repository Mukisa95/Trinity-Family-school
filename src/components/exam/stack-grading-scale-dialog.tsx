'use client';

import { useEffect, useRef, useState } from 'react';
import type { Class, Exam, GradingScaleItem } from '@/types';
import type { SaveStackGradingInput, StackGradingSnapshot } from '@/lib/services/exam-stack-grading.service';
import { isIndependentScale, latestStackPolicy, validateGradingScale } from '@/lib/utils/stack-grading-scale';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type StackGradingTarget = { label: string; exams: Exam[] };

function ScaleTable({ scale }: { scale: GradingScaleItem[] }) {
  return <table className="w-full text-left text-sm"><thead><tr className="border-b"><th scope="col" className="py-2">Grade</th><th scope="col" className="py-2">Marks</th><th scope="col" className="py-2 text-right">Aggregate</th></tr></thead><tbody>{[...scale].sort((a, b) => b.minMark - a.minMark).map((band, index) => <tr key={index} className="border-b"><th scope="row" className="py-2">{band.grade}</th><td>{band.minMark}–{band.maxMark}</td><td className="text-right">{band.aggregates ?? '—'}</td></tr>)}</tbody></table>;
}

export function StackGradingScaleDialog({ target, classes, canEdit, onClose, onLoad, onSave }: {
  target: StackGradingTarget | null; classes: Class[]; canEdit: boolean; onClose: () => void;
  onLoad: (exams: Exam[]) => Promise<StackGradingSnapshot>;
  onSave: (input: Omit<SaveStackGradingInput, 'actor'>) => Promise<unknown>;
}) {
  const [model, setModel] = useState<StackGradingSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [editor, setEditor] = useState<'stack' | Exam['id'] | null>(null);
  const [viewExamId, setViewExamId] = useState('');
  const [draft, setDraft] = useState<GradingScaleItem[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const selectedScaleRef = useRef<HTMLElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [editor]);
  const viewScale = (id: string) => {
    setViewExamId(id);
    requestAnimationFrame(() => {
      selectedScaleRef.current?.focus({ preventScroll: true });
      selectedScaleRef.current?.scrollIntoView({ block: 'nearest' });
    });
  };
  useEffect(() => {
    let active = true;
    setModel(null); setEditor(null); setViewExamId(''); setError('');
    if (target) {
      setBusy(true);
      onLoad(target.exams).then(value => { if (active) setModel(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load this stack.'); }).finally(() => { if (active) setBusy(false); });
    }
    return () => { active = false; };
  }, [target, onLoad]);
  const classLabel = (exam: Exam) => {
    const item = classes.find(item => item.id === exam.classId);
    return item?.code || item?.name || exam.classId;
  };
  const actualScale = (index: number) => model!.results[index]?.gradingScale?.length
    ? model!.results[index]!.gradingScale! : model!.exams[index].gradingScaleOverride?.length ? model!.exams[index].gradingScaleOverride! : model!.scale;
  const edit = (id: 'stack' | string) => {
    if (!model) return;
    setError(''); setEditor(id);
    setDraft((id === 'stack' ? model.scale : actualScale(model.exams.findIndex(exam => exam.id === id))).map(item => ({ ...item })));
  };
  const refresh = async () => {
    if (!target) return;
    setBusy(true);setError('');
    try { setModel(await onLoad(target.exams));setEditor(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load this stack.'); } finally { setBusy(false); }
  };
  const save = async (mode: SaveStackGradingInput['mode'], examId?: string) => {
    if (!model || !target || !canEdit) return;
    setError('');setBusy(true);
    try {
      const scale = validateGradingScale(mode === 'inherit' ? model.scale : draft);
      await onSave({ snapshot: model, mode, examId, scale });
      setModel(await onLoad(target.exams));setEditor(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The scale could not be saved.'); } finally { setBusy(false); }
  };
  const viewIndex = model?.exams.findIndex(exam => exam.id === viewExamId) ?? -1;
  const cat = target?.exams[0]?.examTypeId === 'et_cat';
  return <Dialog open={!!target} onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogHeader className="shrink-0 border-b p-4 pr-10 text-left"><DialogTitle>{editor ? editor === 'stack' ? 'Edit stack grading scale' : 'Edit independent exam scale' : 'Stack grading scale'}</DialogTitle><DialogDescription className="break-words">{target?.label}. {cat ? 'The shared scale also applies to future CAT sets in this assessment and academic period.' : 'The shared scale applies to the exams in this stack.'} Independent overrides stay separate.</DialogDescription></DialogHeader>
    <div ref={bodyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
    {error && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm"><p>{error}</p><Button variant="outline" size="sm" disabled={busy} onClick={refresh} className="mt-2">Reload stack</Button></div>}
    {busy && !model && <p role="status">Loading grading scales and exams…</p>}
    {model && !editor && <>
      <section aria-label="Shared stack scale"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Shared stack scale</h3>{canEdit && <Button variant="outline" disabled={busy} onClick={() => edit('stack')}>Edit stack scale</Button>}</div><ScaleTable scale={model.scale} />
        {!latestStackPolicy(model.exams) && <p className="mt-2 text-xs text-muted-foreground">This stack has no saved shared default yet. The view shows the most common existing scale. Save the stack scale to set its future default.</p>}
      </section>
      <section aria-label="Exams and classes"><h3 className="mb-2 font-semibold">Exams and classes ({model.exams.length})</h3><ul className="space-y-2">{model.exams.map((exam, index) => {
        const nursery = exam.assessmentMode === 'nursery_commentary' || model.results[index]?.assessmentMode === 'nursery_commentary';
        const independent = isIndependentScale(exam, model.results[index], model.scale);
        return <li key={exam.id} className="rounded-xl border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold">{classLabel(exam)} · {exam.name}</p><p className="mt-1 text-xs text-muted-foreground">{exam.startDate} – {exam.endDate}</p></div><Badge variant={independent ? 'outline' : 'secondary'}>{nursery ? 'Commentary assessment' : independent ? 'Independent override' : 'Follows stack'}</Badge></div>
          {!model.results[index] && <p className="mt-1 text-xs text-muted-foreground">No results yet; the selected scale will be used when results are created.</p>}
          {!nursery && <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={busy} onClick={() => viewScale(exam.id)} aria-label={`View scale for ${classLabel(exam)} ${exam.name}`}>View scale</Button>{canEdit && <Button size="sm" variant="outline" disabled={busy} onClick={() => edit(exam.id)} aria-label={`Edit scale for ${classLabel(exam)} ${exam.name}`}>Edit this exam</Button>}{canEdit && independent && <Button size="sm" variant="outline" disabled={busy} onClick={() => save('inherit', exam.id)} aria-label={`Use stack scale for ${classLabel(exam)} ${exam.name}`}>Use stack scale</Button>}</div>}
        </li>;
      })}</ul></section>
      {viewIndex >= 0 && <section ref={selectedScaleRef} tabIndex={-1} aria-label="Selected exam scale" className="rounded-xl border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><h3 className="break-words font-semibold">{classLabel(model.exams[viewIndex])} · {model.exams[viewIndex].name}</h3><ScaleTable scale={actualScale(viewIndex)} /></section>}
    </>}
    {model && editor && <section aria-label="Grading scale editor" className="space-y-3"><p className="text-sm text-muted-foreground">{editor === 'stack' ? 'This updates exams following the stack and its future default. Independent exam scales are preserved.' : `Only ${classLabel(model.exams.find(exam => exam.id === editor)!)} · ${model.exams.find(exam => exam.id === editor)!.name} will change. The stack default and future CAT sets keep their shared scale.`}</p>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => setDraft(DEFAULT_GRADING_SCALE.map(item => ({ ...item })))}>Reset to school default</Button>
      {draft.map((band, index) => <fieldset key={index} className="grid grid-cols-2 gap-3 rounded-xl border p-3 sm:grid-cols-4"><legend className="px-1 text-xs text-muted-foreground">Band {index + 1}</legend>{(['minMark', 'maxMark', 'grade', 'aggregates'] as const).map(field => <label key={field} className="text-xs">{({ minMark: 'Min mark', maxMark: 'Max mark', grade: 'Grade', aggregates: 'Aggregate' })[field]}<Input disabled={busy} aria-label={`Band ${index + 1} ${field}`} className="mt-1" type={field === 'grade' ? 'text' : 'number'} value={typeof band[field] === 'number' && !Number.isFinite(band[field]) ? '' : band[field] ?? ''} onChange={event => { const value = field === 'grade' ? event.target.value.toUpperCase() : event.target.value === '' ? NaN : Number(event.target.value);setDraft(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)); }} /></label>)}</fieldset>)}
    </section>}
    </div>
    <DialogFooter className="shrink-0 gap-2 border-t p-4"><Button variant="outline" disabled={busy} onClick={() => editor ? setEditor(null) : onClose()}>{editor ? 'Back to view' : 'Close'}</Button>{editor && canEdit && <Button disabled={busy} onClick={() => save(editor === 'stack' ? 'stack' : 'independent', editor === 'stack' ? undefined : editor)}>{busy ? 'Saving…' : editor === 'stack' ? 'Save shared scale' : 'Save this exam only'}</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}
