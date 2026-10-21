import { doc, getDoc, runTransaction } from '@/lib/access/scoped-firestore';
import { db } from '@/lib/firebase';
import { normaliseExams } from '@/lib/cache/exam-cache';
import type { Exam, ExamResult, GradingScaleItem } from '@/types';
import { ExamsService } from './exams.service';
import { ExamLeaseService, type ExamLeaseToken } from './exam-lease.service';
import { bumpExamDefinitionRevisionsInBatch, bumpExamResultRevisionInBatch } from './dashboard-cache-revisions.service';
import { examStackKey, isIndependentScale, latestStackPolicy, regradeExamResults, resolveStackScale, scaleSignature, validateGradingScale } from '@/lib/utils/stack-grading-scale';

export type StackGradingSnapshot = {
  exams: Exam[];
  results: (ExamResult | null)[];
  scale: GradingScaleItem[];
  version: string;
};
export type SaveStackGradingInput = {
  snapshot: StackGradingSnapshot;
  mode: 'stack' | 'independent' | 'inherit';
  examId?: string;
  scale: GradingScaleItem[];
  actor: { id: string; name: string };
};

function version(exams: Exam[], results: (ExamResult | null)[]): string {
  return JSON.stringify(exams.map((exam, index) => [exam.id, exam.stackGradingPolicy?.revision || '',
    exam.gradingScaleOverride?.length ? scaleSignature(exam.gradingScaleOverride) : '',
    results[index]?.gradingScaleSource || '', results[index] ? scaleSignature(results[index]?.gradingScale) : null,
  ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function snapshot(exams: Exam[], results: (ExamResult | null)[]): StackGradingSnapshot {
  if (!exams.length || exams.some(exam => examStackKey(exam) !== examStackKey(exams[0]))) throw new Error('The stack has changed. Close this view and open it again.');
  return { exams, results, scale: resolveStackScale(exams, results), version: version(exams, results) };
}

export class ExamStackGradingService {
  static async load(exams: Exam[]): Promise<StackGradingSnapshot> {
    const shared = ExamsService.getSharedExamSnapshot();
    const members = exams[0] && shared?.filter(exam => examStackKey(exam) === examStackKey(exams[0]));
    if (members?.length) exams = members;
    const definitions = await Promise.all(exams.map(async exam => {
      const value = await getDoc(doc(db, 'exams', exam.id));
      if (!value.exists()) throw new Error('An exam was removed. Refresh the stack before continuing.');
      return normaliseExams([{ ...exam, ...value.data(), id: exam.id } as Exam])[0];
    }));
    const results = await Promise.all(definitions.map(exam => ExamsService.getExamResultByExamId(exam.id)));
    return snapshot(definitions, results);
  }

  static async save(input: SaveStackGradingInput): Promise<{ exams: Exam[]; results: ExamResult[] }> {
    const scale = validateGradingScale(input.scale);
    const model = input.snapshot;
    if (!model.exams.length || !input.actor.id) throw new Error('Open a stack before saving.');
    if (model.exams.length > 240) throw new Error('This stack is too large for one atomic update (maximum 240 exams).');
    if (input.mode !== 'stack' && !model.exams.some(exam => exam.id === input.examId)) throw new Error('Choose an exam from this stack.');
    const shared = ExamsService.getSharedExamSnapshot();
    const members = shared?.filter(exam => examStackKey(exam) === examStackKey(model.exams[0]));
    if (members?.length && JSON.stringify(members.map(exam => exam.id).sort()) !== JSON.stringify(model.exams.map(exam => exam.id).sort())) throw new Error('The exams in this stack changed. Reload the stack before saving.');
    if (input.mode !== 'stack' && model.exams.find(exam => exam.id === input.examId)?.assessmentMode === 'nursery_commentary') throw new Error('This exam uses commentary assessment rather than a marks scale.');
    const leases = new Map<string, ExamLeaseToken>();
    try {
      for (let index = 0; index < model.exams.length; index++) {
        const exam = model.exams[index];
        const changesResult = input.mode === 'stack'
          ? !isIndependentScale(exam, model.results[index], model.scale)
          : exam.id === input.examId;
        if (!changesResult || exam.assessmentMode === 'nursery_commentary') continue;
        const leaseId = crypto.randomUUID();
        const lease = await ExamLeaseService.acquire(exam.id, input.actor, leaseId);
        if (!lease.acquired) throw new Error(`${exam.name} is being edited by ${lease.holder?.lockedByName || 'another user'}. Nothing was changed.`);
        leases.set(exam.id, { lockedByUid: input.actor.id, leaseId });
      }
      return await runTransaction(db, async transaction => {
        // Read every document and lease before writing, so a conflict cannot
        // leave only some classes on the new scale or overwrite newer marks.
        const examDocs = await Promise.all(model.exams.map(exam => transaction.get(doc(db, 'exams', exam.id))));
        const resultRefs = model.exams.map((exam, index) => doc(db, 'examResults', model.results[index]?.id || exam.id));
        const resultDocs = await Promise.all(resultRefs.map(ref => transaction.get(ref)));
        for (const [examId, lease] of leases) await ExamLeaseService.verifyForSave(examId, lease, transaction);
        const exams = examDocs.map((value, index) => {
          if (!value.exists()) throw new Error('An exam was removed. Reload the stack.');
          return normaliseExams([{ ...value.data(), id: model.exams[index].id } as Exam])[0];
        });
        const results = resultDocs.map((value, index) => {
          if (!value.exists()) return null;
          const data = value.data();
          const iso = (date: any) => date?.toDate?.()?.toISOString() || date;
          return { ...data, id: resultRefs[index].id, recordedAt: iso(data.recordedAt) || '', ...(data.lastUpdatedAt ? { lastUpdatedAt: iso(data.lastUpdatedAt) } : {}), ...(data.releasedAt ? { releasedAt: iso(data.releasedAt) } : {}) } as ExamResult;
        });
        const current = snapshot(exams, results);
        if (current.version !== model.version) throw new Error('A grading scale changed while this view was open. Reload the stack before saving.');
        const stamp = new Date().toISOString();
        const initializeDefault = !latestStackPolicy(exams);
        const policy = { key: examStackKey(exams[0]), revision: crypto.randomUUID(), updatedAt: stamp, scale: input.mode === 'stack' ? scale : validateGradingScale(current.scale) };
        const changedExams: Exam[] = [], changedResults: ExamResult[] = [];
        const periods = new Map<string, { year: string; term: string }>();
        exams.forEach((exam, index) => {
          const selected = input.mode === 'stack' || exam.id === input.examId;
          if (!selected && !initializeDefault) return;
          const result = results[index];
          const independent = isIndependentScale(exam, result, current.scale);
          const patch: Partial<Exam> = {
            ...(input.mode === 'stack' || initializeDefault ? { stackGradingPolicy: policy } : {}),
            ...(input.mode !== 'stack' && selected ? { gradingScaleOverride: input.mode === 'independent' ? scale : null } : {}),
          };
          // Persist detected legacy exceptions so a later reset/default edit
          // cannot accidentally adopt their scale as the stack's new default.
          if (input.mode === 'stack' && independent && !exam.gradingScaleOverride?.length) patch.gradingScaleOverride = result?.gradingScale || current.scale;
          transaction.update(doc(db, 'exams', exam.id), { ...patch, updatedAt: stamp });
          changedExams.push({ ...exam, ...patch, updatedAt: stamp });
          if (!selected || !result || exam.assessmentMode === 'nursery_commentary' || result.assessmentMode === 'nursery_commentary' || (input.mode === 'stack' && independent)) return;
          const applied = input.mode === 'inherit' ? current.scale : scale;
          const year = exam.academicYearId || result.academicYearId || '', term = exam.termId || result.termId || '';
          const resultPatch: Partial<ExamResult> = {
            academicYearId: year, termId: term,
            gradingScale: applied,
            gradingScaleSource: input.mode === 'independent' ? 'independent' : 'stack',
            stackGradingScaleRevision: input.mode === 'stack' || initializeDefault ? policy.revision : exam.stackGradingPolicy?.revision || '',
            results: regradeExamResults(result, applied), lastUpdatedAt: stamp,
          };
          transaction.update(resultRefs[index], resultPatch);
          periods.set(JSON.stringify([year, term]), { year, term });
          changedResults.push({ ...model.results[index]!, ...result, ...resultPatch });
        });
        bumpExamDefinitionRevisionsInBatch(transaction, { affectsEvents: false });
        for (const { year, term } of periods.values()) bumpExamResultRevisionInBatch(transaction, year, term);
        return { exams: changedExams, results: changedResults };
      });
    } finally {
      await Promise.allSettled([...leases].map(([examId, lease]) => ExamLeaseService.release(examId, lease)));
    }
  }
}
