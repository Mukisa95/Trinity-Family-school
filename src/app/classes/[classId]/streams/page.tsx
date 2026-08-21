"use client";

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  GitBranch,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useClassDetail } from '@/lib/hooks/use-class-detail';
import { usePupils } from '@/lib/hooks/use-pupils';
import { pupilsKeys } from '@/lib/hooks/use-pupils';
import { classesKeys } from '@/lib/hooks/use-classes';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useToast } from '@/hooks/use-toast';
import { getPupilClassDisplay } from '@/lib/utils/class-streams';
import type { Class, ClassStream, ClassStreamConfiguration, Pupil } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlassPageTopBar } from '@/components/common/glass-page-top-bar';

function updateClassConfiguration(
  schoolClass: Class,
  academicYearId: string,
  activeStreamIds: string[],
  version: number,
): Class {
  const next: ClassStreamConfiguration = {
    academicYearId,
    activeStreamIds,
    enabled: true,
    version,
    configuredAt: new Date().toISOString(),
  };
  return {
    ...schoolClass,
    streamConfigurations: [
      ...(schoolClass.streamConfigurations || []).filter(item => item.academicYearId !== academicYearId),
      next,
    ],
  };
}

export default function ClassStreamSetupPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const classId = String(params?.classId || '');
  const { data: schoolClass, isLoading: classLoading } = useClassDetail(classId);
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: activeAcademicYear, isLoading: academicYearLoading } = useActiveAcademicYear();
  const activePupils = React.useMemo(
    () => allPupils
      .filter(pupil => pupil.classId === classId && pupil.status === 'Active')
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),
    [allPupils, classId],
  );
  const definitions = schoolClass?.streams || [];
  const [activeStreamIds, setActiveStreamIds] = React.useState<string[]>([]);
  const [assignments, setAssignments] = React.useState<Record<string, string>>({});
  const [focusStreamId, setFocusStreamId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [errors, setErrors] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const initialisedForRef = React.useRef('');

  const currentConfiguration = React.useMemo(
    () => schoolClass?.streamConfigurations?.find(configuration => configuration.academicYearId === activeAcademicYear?.id),
    [activeAcademicYear?.id, schoolClass?.streamConfigurations],
  );

  React.useEffect(() => {
    if (!schoolClass || !activeAcademicYear || pupilsLoading) return;
    const key = `${schoolClass.id}:${activeAcademicYear.id}:${currentConfiguration?.version || 0}`;
    if (initialisedForRef.current === key) return;
    initialisedForRef.current = key;

    const initialActiveIds = currentConfiguration?.enabled
      ? currentConfiguration.activeStreamIds.filter(id => definitions.some(stream => stream.id === id))
      : definitions.map(stream => stream.id);
    setActiveStreamIds(initialActiveIds);
    setFocusStreamId(initialActiveIds[1] || initialActiveIds[0] || '');
    const initialAssignments: Record<string, string> = {};
    activePupils.forEach(pupil => {
      initialAssignments[pupil.id] = pupil.streamId && initialActiveIds.includes(pupil.streamId)
        ? pupil.streamId
        : initialActiveIds.length === 1
          ? initialActiveIds[0]
          : initialActiveIds.length === 2
            ? initialActiveIds[0]
            : '';
    });
    setAssignments(initialAssignments);
  }, [activeAcademicYear, activePupils, currentConfiguration, definitions, pupilsLoading, schoolClass]);

  const activeStreams = React.useMemo(
    () => activeStreamIds
      .map(id => definitions.find(stream => stream.id === id))
      .filter((stream): stream is ClassStream => Boolean(stream)),
    [activeStreamIds, definitions],
  );

  React.useEffect(() => {
    if (!activePupils.length) return;
    setAssignments(current => {
      const next = { ...current };
      if (activeStreamIds.length === 1) {
        activePupils.forEach(pupil => { next[pupil.id] = activeStreamIds[0]; });
      } else if (activeStreamIds.length === 2) {
        const fallback = activeStreamIds[0];
        activePupils.forEach(pupil => {
          if (!activeStreamIds.includes(next[pupil.id])) next[pupil.id] = fallback;
        });
      } else {
        activePupils.forEach(pupil => {
          if (!activeStreamIds.includes(next[pupil.id])) next[pupil.id] = '';
        });
      }
      return next;
    });
    if (!activeStreamIds.includes(focusStreamId)) {
      setFocusStreamId(activeStreamIds[1] || activeStreamIds[0] || '');
    }
  }, [activePupils, activeStreamIds, focusStreamId]);

  const filteredPupils = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return activePupils;
    return activePupils.filter(pupil => (
      `${pupil.firstName} ${pupil.lastName} ${pupil.otherNames || ''} ${pupil.admissionNumber}`
        .toLocaleLowerCase()
        .includes(query)
    ));
  }, [activePupils, search]);

  const counts = React.useMemo(() => {
    const result: Record<string, number> = Object.fromEntries(activeStreamIds.map(id => [id, 0]));
    Object.values(assignments).forEach(streamId => {
      if (streamId in result) result[streamId] += 1;
    });
    return result;
  }, [activeStreamIds, assignments]);

  const assignedCount = activePupils.filter(pupil => activeStreamIds.includes(assignments[pupil.id])).length;
  const assignmentProgress = activePupils.length ? Math.round((assignedCount / activePupils.length) * 100) : 100;

  const toggleActiveStream = (streamId: string, checked: boolean) => {
    setErrors([]);
    setActiveStreamIds(current => checked
      ? [...current, streamId]
      : current.length === 1 ? current : current.filter(id => id !== streamId));
  };

  const toggleTwoStreamPupil = (pupilId: string, checked: boolean) => {
    if (activeStreamIds.length !== 2 || !focusStreamId) return;
    const otherStreamId = activeStreamIds.find(id => id !== focusStreamId) || activeStreamIds[0];
    setAssignments(current => ({ ...current, [pupilId]: checked ? focusStreamId : otherStreamId }));
    setErrors([]);
  };

  const validate = () => {
    const nextErrors: string[] = [];
    if (!activeAcademicYear) nextErrors.push('An active academic year is required.');
    if (activeStreamIds.length === 0) nextErrors.push('Choose at least one active stream.');
    const unassigned = activePupils.filter(pupil => !activeStreamIds.includes(assignments[pupil.id]));
    if (unassigned.length) nextErrors.push(`Assign all active pupils. ${unassigned.length} still need a stream.`);
    activeStreams.forEach(stream => {
      if (!counts[stream.id]) nextErrors.push(`${stream.name} must contain at least one pupil.`);
    });
    setErrors(nextErrors);
    if (nextErrors.length) {
      requestAnimationFrame(() => document.getElementById('stream-error-summary')?.focus());
    }
    return nextErrors.length === 0;
  };

  const save = async () => {
    if (!schoolClass || !activeAcademicYear || !validate()) return;
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setErrors(['Your session has expired. Sign in again before saving.']);
      return;
    }
    setIsSaving(true);
    try {
      const token = await firebaseUser.getIdToken();
      const operationId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `streams-${Date.now()}`;
      const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/streams`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          academicYearId: activeAcademicYear.id,
          activeStreamIds,
          assignments: activePupils.map(pupil => ({ pupilId: pupil.id, streamId: assignments[pupil.id] })),
          expectedVersion: currentConfiguration?.version || 0,
          operationId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save stream setup.');

      const definitionById = new Map(definitions.map(stream => [stream.id, stream]));
      queryClient.setQueriesData<Pupil[]>({ queryKey: pupilsKeys.all }, current => current?.map(pupil => {
        if (pupil.classId !== classId || pupil.status !== 'Active') return pupil;
        const stream = definitionById.get(assignments[pupil.id]);
        if (!stream) return pupil;
        const display = getPupilClassDisplay({
          ...pupil,
          streamId: stream.id,
          streamName: stream.name,
          streamCode: stream.code,
          streamClassId: classId,
        }, schoolClass);
        return {
          ...pupil,
          streamId: stream.id,
          streamName: stream.name,
          streamCode: stream.code,
          streamClassId: classId,
          streamAcademicYearId: activeAcademicYear.id,
          className: display.name,
          classCode: display.code,
        };
      }));
      queryClient.setQueriesData<Class[]>({ queryKey: classesKeys.all }, current => current?.map(item => (
        item.id === classId
          ? updateClassConfiguration(item, activeAcademicYear.id, activeStreamIds, payload.version)
          : item
      )));
      toast({ title: 'Stream setup saved', description: `${activePupils.length} pupils are assigned across ${activeStreamIds.length} stream${activeStreamIds.length === 1 ? '' : 's'}.` });
      router.push(`/class-detail?id=${encodeURIComponent(classId)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save stream setup.';
      setErrors([message]);
      requestAnimationFrame(() => document.getElementById('stream-error-summary')?.focus());
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = classLoading || pupilsLoading || academicYearLoading;
  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="mr-2 h-6 w-6 animate-spin text-cyan-700" /> Loading stream setup…</div>;
  }
  if (!schoolClass) {
    return <div className="p-6 text-center"><p className="mb-4">Class not found.</p><Button asChild><Link href="/classes">Back to Classes</Link></Button></div>;
  }
  if (!definitions.length) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Card className="border-2 border-cyan-200">
          <CardHeader><CardTitle>No streams created</CardTitle><CardDescription>Create stream names and codes from the Edit dialog on Class Details first.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild><Link href={`/class-detail?id=${encodeURIComponent(classId)}&edit=1`}>Open Class Edit</Link></Button>
            <Button asChild variant="outline"><Link href={`/class-detail?id=${encodeURIComponent(classId)}`}>Back to Class Details</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 pb-24 sm:p-5 lg:p-6">
      <GlassPageTopBar
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
            Stream Setup
          </span>
        }
        title={schoolClass.name}
        subtitle={`Assign every active pupil for ${activeAcademicYear?.name || 'the active academic year'}.`}
        backHref={`/class-detail?id=${encodeURIComponent(classId)}`}
        backLabel="Back to class details"
        meta={
          <span
            className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-800"
            aria-label={`Assignment progress ${assignedCount} of ${activePupils.length}`}
            title={`Assignment progress: ${assignedCount}/${activePupils.length}`}
          >
            <span className="hidden sm:inline">Assigned</span>
            <strong className="tabular-nums text-cyan-950">{assignedCount}/{activePupils.length}</strong>
          </span>
        }
        className="mx-0 mb-0 sm:mx-0"
        contentClassName="px-3 py-2 sm:px-4 lg:px-5"
      />

      {errors.length ? (
        <Alert id="stream-error-summary" variant="destructive" tabIndex={-1} role="alert" className="scroll-mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Stream setup needs attention</AlertTitle>
          <AlertDescription><ul className="mt-1 list-disc space-y-1 pl-5">{errors.map(error => <li key={error}>{error}</li>)}</ul></AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Active streams</CardTitle><CardDescription>Uncheck a stream to disable it for this academic year.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {definitions.map(stream => {
                const isActive = activeStreamIds.includes(stream.id);
                return (
                  <label key={stream.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${isActive ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <Checkbox checked={isActive} onCheckedChange={checked => toggleActiveStream(stream.id, checked === true)} aria-label={`${isActive ? 'Disable' : 'Enable'} ${stream.name}`} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{stream.name}</span><span className="text-xs">Code: {stream.code}</span></span>
                    <Badge variant="outline" className="tabular-nums">{counts[stream.id] || 0}</Badge>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 font-semibold text-emerald-950"><ShieldCheck className="h-4 w-4" /> Safe save</div>
              <p className="text-xs leading-5 text-emerald-900">Nothing changes until Save Stream Setup succeeds. The class configuration and all pupil assignments are saved together.</p>
              <Progress value={assignmentProgress} className="h-2" />
            </CardContent>
          </Card>
        </aside>

        <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80 pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-cyan-700" /> Pupil assignments</CardTitle>
                <CardDescription className="mt-1">
                  {activeStreams.length === 2
                    ? 'Choose pupils for one stream; every unchecked pupil automatically goes to the other.'
                    : activeStreams.length > 2
                      ? 'Choose one stream for every pupil before saving.'
                      : 'All active pupils will be assigned to the selected stream.'}
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input aria-label="Search pupils" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search pupils…" className="h-11 bg-white pl-9" />
              </div>
            </div>
            {activeStreams.length === 2 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-2">
                <Label htmlFor="focus-stream" className="px-1 text-sm text-cyan-950">Choose pupils for</Label>
                <Select value={focusStreamId} onValueChange={setFocusStreamId}>
                  <SelectTrigger id="focus-stream" className="h-10 w-48 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{activeStreams.map(stream => <SelectItem key={stream.id} value={stream.id}>{stream.name} ({stream.code})</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-xs text-cyan-900">The remainder go to {activeStreams.find(stream => stream.id !== focusStreamId)?.name}.</span>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {activePupils.length === 0 ? (
              <div className="p-10 text-center text-slate-500">No active pupils are currently enrolled in this class.</div>
            ) : (
              <div className="max-h-[62vh] divide-y overflow-y-auto">
                {filteredPupils.map((pupil, index) => {
                  const assignedStreamId = assignments[pupil.id] || '';
                  const assignedStream = definitions.find(stream => stream.id === assignedStreamId);
                  const focusChecked = assignedStreamId === focusStreamId;
                  return (
                    <div key={pupil.id} className="grid min-h-16 items-center gap-3 px-3 py-2 hover:bg-slate-50 sm:grid-cols-[2.25rem_minmax(0,1fr)_15rem] sm:px-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold tabular-nums text-slate-600">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{pupil.firstName} {pupil.lastName} {pupil.otherNames || ''}</p>
                        <p className="truncate text-xs text-slate-500">{pupil.admissionNumber}</p>
                      </div>
                      {activeStreams.length === 2 ? (
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3">
                          <Checkbox checked={focusChecked} onCheckedChange={checked => toggleTwoStreamPupil(pupil.id, checked === true)} aria-label={`Assign ${pupil.firstName} ${pupil.lastName} to ${activeStreams.find(stream => stream.id === focusStreamId)?.name}`} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{assignedStream?.name || 'Choose stream'}</span>
                          {assignedStream ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                        </label>
                      ) : activeStreams.length > 2 ? (
                        <Select value={assignedStreamId || undefined} onValueChange={value => { setAssignments(current => ({ ...current, [pupil.id]: value })); setErrors([]); }}>
                          <SelectTrigger className="h-11 bg-white" aria-label={`Choose stream for ${pupil.firstName} ${pupil.lastName}`} aria-invalid={!assignedStreamId}><SelectValue placeholder="Choose stream" /></SelectTrigger>
                          <SelectContent>{activeStreams.map(stream => <SelectItem key={stream.id} value={stream.id}>{stream.name} ({stream.code})</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <div className="flex min-h-11 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900">{assignedStream?.name || activeStreams[0]?.name || 'No stream active'}</div>
                      )}
                    </div>
                  );
                })}
                {filteredPupils.length === 0 ? <div className="p-10 text-center text-slate-500">No pupils match your search.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div
        className="fixed z-40 flex items-center gap-3"
        style={{
          bottom: 'max(1rem, env(safe-area-inset-bottom))',
          right: 'max(1rem, env(safe-area-inset-right))',
        }}
        aria-label="Stream setup actions"
      >
        <Button
          asChild
          variant="outline"
          className="flex h-16 w-16 flex-col gap-1 rounded-full border-slate-300 bg-white/95 p-0 text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.18)] backdrop-blur transition-[background-color,border-color,box-shadow] hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-slate-500"
        >
          <Link href={`/class-detail?id=${encodeURIComponent(classId)}`} aria-label="Cancel stream setup and return to class details">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-bold leading-none">Cancel</span>
          </Link>
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={isSaving || activePupils.length === 0}
          aria-label={isSaving ? 'Saving stream setup' : 'Save stream setup'}
          className="flex h-16 w-16 flex-col gap-1 rounded-full bg-cyan-700 p-0 text-white shadow-[0_12px_30px_rgba(14,116,144,0.35)] transition-[background-color,box-shadow] hover:bg-cyan-800 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:shadow-none"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Save className="h-5 w-5" aria-hidden="true" />}
          <span className="text-[10px] font-bold leading-none">{isSaving ? 'Saving' : 'Save'}</span>
        </Button>
      </div>
    </main>
  );
}
