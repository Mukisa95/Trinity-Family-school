import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { ExamsService } from '../services/exams.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { Exam, ExamResult, CreateExamData, UpdateExamData } from '@/types';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { bumpExamDefinitionRevisionsInBatch } from '@/lib/services/dashboard-cache-revisions.service';
import {
  getExamCacheScope,
  normaliseExams,
  readExamCache,
  writeExamCache,
} from '@/lib/cache/exam-cache';
import {
  deleteExamResultCache,
  getExamResultCacheScope,
  pruneExamResultCache,
  readExamResultCache,
  writeExamResultCache,
} from '@/lib/cache/exam-result-cache';
import { useDashboardDataRevisions } from './use-school-settings';
import { dashboardRevisionKeys } from '@/lib/services/dashboard-cache-revisions.service';
import { useAcademicYears } from './use-academic-years';
import type { ExamLeaseToken } from '@/lib/services/exam-lease.service';

export const examKeys = {
  all: ['exams'] as const,
  lists: () => [...examKeys.all, 'list'] as const,
  list: (scope: string) => [...examKeys.lists(), scope] as const,
  details: () => [...examKeys.all, 'detail'] as const,
  detail: (scope: string, id: string) => [...examKeys.details(), scope, id] as const,
  pupilHistory: (scope: string, pupilId: string) => [...examKeys.all, 'pupilHistory', scope, pupilId] as const,
};

export const examResultKeys = {
  all: ['examResults'] as const,
  lists: () => [...examResultKeys.all, 'list'] as const,
  details: () => [...examResultKeys.all, 'detail'] as const,
  detail: (scope: string, id: string) => [...examResultKeys.details(), scope, id] as const,
  byExam: (scope: string, examId: string, revision?: number) =>
    [...examResultKeys.all, 'byExam', scope, examId, revision ?? 'pending'] as const,
};

function patchExamSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: string,
  patch: (current: Exam[]) => Exam[],
) {
  if (!scope) return;
  const queryKey = examKeys.list(scope);
  const current = queryClient.getQueryData<Exam[]>(queryKey) ?? readExamCache(scope)?.data ?? [];
  const next = normaliseExams(patch(current));
  queryClient.setQueryData(queryKey, next);
  ExamsService.hydrateSharedExams(next);
  // The settings revision confirms the server state. -1 is deliberately not a
  // server revision, so a later reconciliation cannot be skipped accidentally.
  writeExamCache(scope, -1, next);
}

/** Cache-only selector. The global bootstrap is the sole full-list reader. */
export function useExams() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getExamCacheScope(user?.id, user?.role) : '';
  const queryKey = examKeys.list(scope);
  const inMemory = queryClient.getQueryData<Exam[]>(queryKey);
  const persisted = inMemory === undefined ? readExamCache(scope) : null;
  const initialData = inMemory ?? persisted?.data;

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => queryClient.getQueryData<Exam[]>(queryKey) ?? [],
    enabled: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    initialData,
    initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
    placeholderData: previousData => previousData,
  });

  return {
    ...queryResult,
    isLoading: !!scope && queryResult.data === undefined,
  };
}

export function useExamsOptimized(options?: {
  academicYearId?: string;
  termId?: string;
  enabled?: boolean;
  includeAll?: boolean;
}) {
  const examsQuery = useExams();
  const data = useMemo(() => {
    if (options?.enabled === false) return undefined;
    const exams = examsQuery.data ?? [];
    if (options?.includeAll || (!options?.academicYearId && !options?.termId)) return exams;
    return exams.filter(exam =>
      (!options.academicYearId || exam.academicYearId === options.academicYearId) &&
      (!options.termId || exam.termId === options.termId),
    );
  }, [examsQuery.data, options?.academicYearId, options?.enabled, options?.includeAll, options?.termId]);

  return { ...examsQuery, data, isLoading: options?.enabled !== false && examsQuery.isLoading };
}

export function useExam(id: string) {
  const examsQuery = useExams();
  const data = useMemo(() => examsQuery.data?.find(exam => exam.id === id), [examsQuery.data, id]);
  return { ...examsQuery, data, isLoading: !!id && examsQuery.isLoading };
}

export function useExamsByClass(classId: string, options?: { enabled?: boolean }) {
  const examsQuery = useExams();
  const enabled = options?.enabled !== false && !!classId;
  const data = useMemo(
    () => enabled ? (examsQuery.data ?? []).filter(exam => exam.classId === classId) : undefined,
    [classId, enabled, examsQuery.data],
  );
  return { ...examsQuery, data, isLoading: enabled && examsQuery.isLoading };
}

export function useExamsByAcademicYear(academicYearId: string) {
  const examsQuery = useExams();
  const data = useMemo(
    () => academicYearId ? (examsQuery.data ?? []).filter(exam => exam.academicYearId === academicYearId) : undefined,
    [academicYearId, examsQuery.data],
  );
  return { ...examsQuery, data, isLoading: !!academicYearId && examsQuery.isLoading };
}

export function useExamsByBatch(batchId: string) {
  const examsQuery = useExams();
  const data = useMemo(
    () => batchId ? (examsQuery.data ?? []).filter(exam => exam.batchId === batchId) : undefined,
    [batchId, examsQuery.data],
  );
  return { ...examsQuery, data, isLoading: !!batchId && examsQuery.isLoading };
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getExamCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: async (data: CreateExamData) => {
      const examId = await ExamsService.createExam(data);
      if (user) {
        await signAction('exam_creation', examId, 'created', {
          examName: data.name,
          classId: data.classId,
          examType: data.examTypeName || 'Unknown',
          maxMarks: data.maxMarks,
          startDate: data.startDate,
          academicYearId: data.academicYearId,
          termId: data.termId,
        });
      }
      return examId;
    },
    onSuccess: (examId, data) => {
      patchExamSnapshot(queryClient, scope, current => [
        ...current,
        { ...data, id: examId, createdAt: new Date().toISOString() } as Exam,
      ]);
    },
  });
}

export function useCreateMultipleExams() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getExamCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: async (data: CreateExamData[]) => {
      const examIds = await ExamsService.createMultipleExams(data);
      if (user) {
        for (let index = 0; index < examIds.length; index += 1) {
          const examData = data[index];
          await signAction('exam_creation', examIds[index], 'created', {
            examName: examData.name,
            classId: examData.classId,
            examType: examData.examTypeName || 'Unknown',
            maxMarks: examData.maxMarks,
            startDate: examData.startDate,
            academicYearId: examData.academicYearId,
            termId: examData.termId,
            batchId: examData.batchId,
          });
        }
      }
      return examIds;
    },
    onSuccess: (examIds, data) => {
      patchExamSnapshot(queryClient, scope, current => [
        ...current,
        ...data.map((exam, index) => ({
          ...exam,
          id: examIds[index],
          createdAt: new Date().toISOString(),
        }) as Exam),
      ]);
    },
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getExamCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateExamData }) => {
      const examDocRef = doc(db, 'exams', id);
      const examDoc = await getDoc(examDocRef);
      let linkedEvent: { ref: DocumentReference; data: Record<string, unknown> } | undefined;

      if (examDoc.exists() && examDoc.data()?.batchId) {
        const eventsSnapshot = await getDocs(query(
          collection(db, 'events'),
          where('isExamEvent', '==', true),
          where('examIntegration.examIds', 'array-contains', id),
        ));
        if (!eventsSnapshot.empty) {
          const eventUpdateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
          if (data.name !== undefined) eventUpdateData.title = data.name;
          if (data.startDate !== undefined) eventUpdateData.startDate = data.startDate;
          if (data.endDate !== undefined) eventUpdateData.endDate = data.endDate;
          if (data.startTime !== undefined) eventUpdateData.startTime = data.startTime;
          if (data.endTime !== undefined) eventUpdateData.endTime = data.endTime;
          if (data.instructions !== undefined) eventUpdateData.description = data.instructions;
          linkedEvent = { ref: eventsSnapshot.docs[0].ref, data: eventUpdateData };
        }
      }

      await ExamsService.updateExam(id, data, { linkedEvent });
      return id;
    },
    onSuccess: (id, { data }) => {
      patchExamSnapshot(queryClient, scope, current => current.map(exam =>
        exam.id === id ? { ...exam, ...data, id, updatedAt: new Date().toISOString() } : exam,
      ));
      toast({ title: 'Success', description: 'Exam and associated event updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update exam', variant: 'destructive' });
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getExamCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: async (examId: string) => {
      const examDocRef = doc(db, 'exams', examId);
      const examDoc = await getDoc(examDocRef);
      if (!examDoc.exists()) throw new Error('Exam not found');

      const batch = writeBatch(db);
      batch.delete(examDocRef);
      if (examDoc.data()?.batchId) {
        const eventsSnapshot = await getDocs(query(
          collection(db, 'events'),
          where('isExamEvent', '==', true),
          where('examIntegration.examIds', 'array-contains', examId),
        ));
        if (!eventsSnapshot.empty) {
          const eventDoc = eventsSnapshot.docs[0];
          const examIds = eventDoc.data().examIntegration?.examIds || [];
          const remainingExamIds = examIds.filter((id: string) => id !== examId);
          if (remainingExamIds.length === 0) batch.delete(eventDoc.ref);
          else batch.update(eventDoc.ref, {
            'examIntegration.examIds': remainingExamIds,
            updatedAt: serverTimestamp(),
          });
        }
      }
      bumpExamDefinitionRevisionsInBatch(batch);
      await batch.commit();
      return examId;
    },
    onSuccess: examId => {
      patchExamSnapshot(queryClient, scope, current => current.filter(exam => exam.id !== examId));
      toast({ title: 'Success', description: 'Exam and associated event updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete exam', variant: 'destructive' });
    },
  });
}

function retainedExamResultTerms(years: Array<{ id: string; terms: Array<{ id: string; startDate: string; endDate: string }> }>) {
  const now = new Date();
  const terms = years.flatMap(year => year.terms.map(term => ({
    academicYearId: year.id,
    termId: term.id,
    start: new Date(term.startDate),
    end: new Date(term.endDate),
  }))).filter(term => !Number.isNaN(term.start.getTime()) && !Number.isNaN(term.end.getTime()))
    .sort((left, right) => left.start.getTime() - right.start.getTime());
  if (terms.length === 0) return new Set<string>();
  const currentIndex = terms.findIndex(term => now >= term.start && now <= term.end);
  const effectiveIndex = currentIndex >= 0
    ? currentIndex
    : Math.max(0, terms.reduce((latest, term, index) => term.start <= now ? index : latest, 0));
  return new Set(terms.slice(Math.max(0, effectiveIndex - 2), effectiveIndex + 1)
    .map(term => `${term.academicYearId}:${term.termId}`));
}

function patchExamResultSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: string,
  examId: string,
  academicYearId: string,
  termId: string,
  patch: Partial<ExamResult> | ExamResult | null,
) {
  const matchingQueries = queryClient.getQueriesData<ExamResult | null>({
    predicate: cachedQuery =>
      cachedQuery.queryKey[0] === 'examResults'
      && cachedQuery.queryKey[1] === 'byExam'
      && cachedQuery.queryKey[2] === scope
      && cachedQuery.queryKey[3] === examId,
  });
  const currentRevision = matchingQueries
    .map(([queryKey]) => queryKey[4])
    .find((revision): revision is number => typeof revision === 'number');
  queryClient.setQueriesData<ExamResult | null>(
    {
      predicate: cachedQuery =>
        cachedQuery.queryKey[0] === 'examResults'
        && cachedQuery.queryKey[1] === 'byExam'
        && cachedQuery.queryKey[2] === scope
        && cachedQuery.queryKey[3] === examId,
    },
    current => {
      if (patch === null) return null;
      if (!current) return current;
      return { ...current, ...patch, id: patch.id ?? current.id, examId };
    },
  );

  const current = queryClient.getQueriesData<ExamResult | null>({
    predicate: cachedQuery =>
      cachedQuery.queryKey[0] === 'examResults'
      && cachedQuery.queryKey[1] === 'byExam'
      && cachedQuery.queryKey[2] === scope
      && cachedQuery.queryKey[3] === examId,
  })[0]?.[1];
  // The settings update is in the same commit as the result write. When the
  // current term revision is known, stamp its expected successor so the saving
  // device does not immediately re-read its own successful write.
  const observedRevision = typeof currentRevision === 'number' ? currentRevision + 1 : -1;
  if (scope) void writeExamResultCache(scope, examId, academicYearId, termId, observedRevision, current ?? null);
}

/** The app never preloads this collection; individual results are on-demand only. */
export function useExamResults() {
  return useQuery({
    queryKey: examResultKeys.lists(),
    queryFn: async () => [],
    enabled: false,
    staleTime: Infinity,
  });
}

export function useExamResult(id: string) {
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getExamResultCacheScope(user?.id, user?.role) : '';
  return useQuery({
    queryKey: examResultKeys.detail(scope, id),
    queryFn: () => ExamsService.getExamResultById(id),
    enabled: !!id,
  });
}

export function useExamResultByExamId(examId: string) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const examsQuery = useExams();
  const revisionsQuery = useDashboardDataRevisions();
  const { data: academicYears = [] } = useAcademicYears();
  const scope = isAuthenticated ? getExamResultCacheScope(user?.id, user?.role) : '';
  // A parent result view keeps its existing direct, pupil-authorized read and
  // is deliberately never persisted as a class-wide result cache.
  const queryScope = scope || `projection:${user?.id ?? 'anonymous'}:${user?.role ?? 'unknown'}`;
  const exam = useMemo(() => examsQuery.data?.find(item => item.id === examId), [examId, examsQuery.data]);
  const academicYearId = exam?.academicYearId;
  const termId = exam?.termId;
  const termKey = academicYearId && termId
    ? dashboardRevisionKeys.examResults(academicYearId, termId)
    : undefined;
  const termRevision = termKey ? revisionsQuery.data?.examResults?.[termKey] : undefined;
  const [cacheState, setCacheState] = useState<{ key: string; ready: boolean; matching: boolean }>({
    key: '', ready: false, matching: false,
  });

  useEffect(() => {
    const cacheKey = `${scope}:${examId}:${academicYearId ?? ''}:${termId ?? ''}:${termRevision ?? 'pending'}`;
    let cancelled = false;
    if (!scope || !examId || !academicYearId || !termId || typeof termRevision !== 'number') {
      setCacheState({ key: cacheKey, ready: true, matching: false });
      return;
    }

    setCacheState({ key: cacheKey, ready: false, matching: false });
    void readExamResultCache(scope, examId).then(cached => {
      if (cancelled) return;
      const matching = !!cached
        && cached.academicYearId === academicYearId
        && cached.termId === termId
        && cached.observedTermRevision === termRevision;
      if (cached) {
        queryClient.setQueryData(examResultKeys.byExam(queryScope, examId, termRevision), cached.data);
      }
      setCacheState({ key: cacheKey, ready: true, matching });
    });

    return () => { cancelled = true; };
  }, [academicYearId, examId, queryClient, queryScope, scope, termId, termRevision]);

  useEffect(() => {
    if (!scope || academicYears.length === 0) return;
    void pruneExamResultCache(scope, retainedExamResultTerms(academicYears));
  }, [academicYears, scope]);

  const cacheKey = `${scope}:${examId}:${academicYearId ?? ''}:${termId ?? ''}:${termRevision ?? 'pending'}`;
  const cacheReady = cacheState.key === cacheKey && cacheState.ready;
  const cacheMatches = cacheState.key === cacheKey && cacheState.matching;

  const queryResult = useQuery({
    queryKey: examResultKeys.byExam(queryScope, examId, termRevision),
    queryFn: async () => {
      const result = await ExamsService.getExamResultByExamId(examId);
      if (scope && academicYearId && termId && typeof termRevision === 'number') {
        await writeExamResultCache(scope, examId, academicYearId, termId, termRevision, result);
      }
      return result;
    },
    enabled: !!examId && (
      !scope || (!!academicYearId && !!termId && typeof termRevision === 'number' && cacheReady && !cacheMatches)
    ),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: previousData => previousData,
  });

  return {
    ...queryResult,
    isLoading: !!examId && queryResult.data === undefined && (scope ? !cacheReady || queryResult.isLoading : queryResult.isLoading),
  };
}

export function useCreateExamResult() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<ExamResult, 'id'>) => {
      const result = await ExamsService.createExamResult(data);
      if (user) {
        await signAction('exam_result', result.id, 'recorded', {
          examId: data.examId,
          classId: data.classId,
          pupilCount: data.pupilSnapshots?.length || 0,
          subjectCount: data.subjectSnapshots?.length || 0,
          isPublished: data.isPublished || false,
        });
      }
      return result;
    },
    onSuccess: result => {
      const scope = getExamResultCacheScope(user?.id, user?.role);
      if (scope && result.academicYearId && result.termId) {
        patchExamResultSnapshot(queryClient, scope, result.examId, result.academicYearId, result.termId, result);
        void writeExamResultCache(scope, result.examId, result.academicYearId, result.termId, -1, result);
      }
    },
  });
}

export function useUpdateExamResult() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ id, data, lease }: { id: string; data: Partial<ExamResult>; lease?: ExamLeaseToken }) =>
      ExamsService.updateExamResult(id, data, { lease }),
    onSuccess: receipt => {
      const scope = getExamResultCacheScope(user?.id, user?.role);
      if (scope) {
        patchExamResultSnapshot(
          queryClient,
          scope,
          receipt.examId,
          receipt.academicYearId,
          receipt.termId,
          receipt.patch,
        );
      }
    },
  });
}

export function useDeleteExamResult() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => ExamsService.deleteExamResult(id),
    onSuccess: receipt => {
      const scope = getExamResultCacheScope(user?.id, user?.role);
      if (!scope) return;
      patchExamResultSnapshot(queryClient, scope, receipt.examId, receipt.academicYearId, receipt.termId, null);
      void deleteExamResultCache(scope, receipt.examId);
    },
  });
}

export function usePupilExamHistory(
  pupilId: string,
  options?: { enabled?: boolean; currentExamId?: string; academicYearId?: string; termId?: string },
) {
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getExamCacheScope(user?.id, user?.role) : '';
  return useQuery({
    queryKey: [...examKeys.pupilHistory(scope, pupilId), {
      academicYearId: options?.academicYearId,
      termId: options?.termId,
    }],
    queryFn: () => ExamsService.getPupilExamHistory(pupilId, options?.currentExamId),
    enabled: !!pupilId && options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error?.message?.includes('offline') ||
        error?.message?.includes('Could not reach Cloud Firestore') ||
        (error as any)?.code === 'unavailable') return false;
      return failureCount < 2;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
