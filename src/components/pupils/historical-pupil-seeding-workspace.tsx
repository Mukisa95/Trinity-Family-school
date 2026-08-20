'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, CircleAlert, Loader2, Plus, Search, Sprout, Trash2, UserRoundPlus } from 'lucide-react';
import type { PupilAcademicYearHistoryEntry, PupilStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useClasses } from '@/lib/hooks/use-classes';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useCreateHistoricalPupilSeed, useHistoricalPupilSeeds } from '@/lib/hooks/use-historical-pupil-seeding';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

type DraftHistoryRow = {
  id: string;
  academicYearId: string;
  classId: string;
  status: '' | PupilStatus;
  notes: string;
};

type FormDraft = {
  firstName: string;
  lastName: string;
  otherNames: string;
  admissionNumber: string;
  gender: '' | 'Male' | 'Female';
  dateOfBirth: string;
  registrationDate: string;
  section: '' | 'Day' | 'Boarding';
  previousSchool: string;
  history: DraftHistoryRow[];
};

const initialDraft = (): FormDraft => ({
  firstName: '',
  lastName: '',
  otherNames: '',
  admissionNumber: '',
  gender: '',
  dateOfBirth: '',
  registrationDate: '',
  section: '',
  previousSchool: '',
  history: [],
});

const selectClassName = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50';
const statusOptions: Array<Exclude<PupilStatus, ''>> = ['Active', 'Suspended', 'Inactive', 'Graduated', 'Transferred', 'Pending'];

function displayDate(value?: string) {
  if (!value) return 'Not recorded';
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'd MMM yyyy');
}

function statusClass(status: PupilStatus) {
  if (status === 'Active') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'Graduated') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'Pending') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

interface HistoricalPupilSeedingWorkspaceProps {
  canCreate: boolean;
}

export function HistoricalPupilSeedingWorkspace({ canCreate }: HistoricalPupilSeedingWorkspaceProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const { data: pupils = [] } = usePupils();
  const { data: seedRecords = [], isLoading: seedsLoading } = useHistoricalPupilSeeds();
  const createSeed = useCreateHistoricalPupilSeed();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [draft, setDraft] = React.useState<FormDraft>(initialDraft);
  const validationFields = React.useMemo(() => [
    createFieldValidation('seed-name', draft.firstName, 'Pupil name', true, {
      message: 'Enter the pupil\u2019s known name.',
    }),
    createFieldValidation('seed-history', draft.history, 'Academic history', false, {
      focusTargetId: draft.history[0]?.id ? `${draft.history[0].id}-year` : undefined,
      validate: (value) => {
        const rows = value as DraftHistoryRow[];
        return new Set(rows.map((entry) => entry.academicYearId)).size === rows.length
          ? undefined
          : 'Choose each academic year only once.';
      },
    }),
  ], [draft.firstName, draft.history]);
  const formValidation = useFormValidation(validationFields);

  const sortedAcademicYears = React.useMemo(
    () => [...academicYears].sort((a, b) => Number(a.name) - Number(b.name)),
    [academicYears]
  );
  const pupilsById = React.useMemo(() => new Map(pupils.map((pupil) => [pupil.id, pupil])), [pupils]);
  const seededPupils = React.useMemo(() => seedRecords
    .flatMap((record) => {
      const pupil = pupilsById.get(record.pupilId);
      return pupil ? [{ record, pupil }] : [];
    })
    .filter(({ pupil }) => `${pupil.firstName} ${pupil.lastName} ${pupil.admissionNumber}`.toLowerCase().includes(search.trim().toLowerCase())),
    [pupilsById, search, seedRecords]
  );

  const resetAndCloseForm = () => {
    setDraft(initialDraft());
    formValidation.resetValidation();
    setIsFormOpen(false);
  };

  const addHistoryRow = () => {
    const nextYear = sortedAcademicYears.find((year) => !draft.history.some((entry) => entry.academicYearId === year.id));
    if (!nextYear) {
      toast({ title: 'No academic years available', description: 'Each academic year can only be added once.' });
      return;
    }

    setDraft((current) => ({
      ...current,
      history: [...current.history, {
        id: `history-${Date.now()}-${current.history.length}`,
        academicYearId: nextYear.id,
        classId: '',
        status: '',
        notes: '',
      }],
    }));
  };

  const updateHistoryRow = (rowId: string, updates: Partial<DraftHistoryRow>) => {
    setDraft((current) => ({
      ...current,
      history: current.history.map((row) => row.id === rowId ? { ...row, ...updates } : row),
    }));
  };

  const removeHistoryRow = (rowId: string) => {
    setDraft((current) => ({ ...current, history: current.history.filter((row) => row.id !== rowId) }));
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) {
      toast({ variant: 'destructive', title: 'Creation access required', description: 'Your account can view this workspace but cannot add historical pupils.' });
      return;
    }
    if (!formValidation.validateAll().isValid) return;

    const academicYearHistory: PupilAcademicYearHistoryEntry[] = draft.history.map((entry) => {
      const academicYear = sortedAcademicYears.find((year) => year.id === entry.academicYearId);
      const selectedClass = classes.find((schoolClass) => schoolClass.id === entry.classId);
      if (!academicYear) throw new Error('An academic year in this form is no longer available.');

      return {
        id: `academic-history-${entry.id}`,
        academicYearId: academicYear.id,
        academicYearName: academicYear.name,
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
        ...(selectedClass && {
          classId: selectedClass.id,
          className: selectedClass.name,
          classCode: selectedClass.code,
        }),
        ...(entry.status && { status: entry.status }),
        ...(entry.notes.trim() && { notes: entry.notes.trim() }),
      };
    });

    try {
      await createSeed.mutateAsync({
        firstName: draft.firstName,
        lastName: draft.lastName,
        otherNames: draft.otherNames,
        admissionNumber: draft.admissionNumber,
        gender: draft.gender,
        dateOfBirth: draft.dateOfBirth,
        registrationDate: draft.registrationDate,
        section: draft.section,
        previousSchool: draft.previousSchool,
        academicYearHistory,
        createdById: user?.id,
        createdByName: user?.username,
      });
      toast({ title: 'Historical pupil added', description: 'The pupil and their selected academic history are now available throughout the system.' });
      resetAndCloseForm();
    } catch (error) {
      formValidation.setSubmissionError(error instanceof Error ? error.message : 'Please try again.');
      toast({
        variant: 'destructive',
        title: 'Could not add pupil',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Sprout className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700">Historical pupil records</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950">Seeding workspace</h1>
            <p className="mt-1 text-sm text-slate-600">Add only what you know. A pupil name is the only required field.</p>
          </div>
        </div>
        {canCreate ? (
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" /> Add historical pupil
          </Button>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600">View-only access</p>
        )}
      </section>

      <Card>
        <CardHeader className="gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Seeded pupils</CardTitle>
            <CardDescription>These pupils appear as ordinary pupil records everywhere else in the system.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search pupils" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {seedsLoading ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading pupils…</div>
          ) : seededPupils.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center px-6 py-10 text-center">
              <UserRoundPlus className="mb-3 h-9 w-9 text-slate-300" aria-hidden="true" />
              <h2 className="font-semibold text-slate-900">No historical pupils yet</h2>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Use the add button to create a pupil and capture the academic years you know.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {seededPupils.map(({ record, pupil }) => (
                <div key={record.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{`${pupil.firstName} ${pupil.lastName}`.trim()}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">Registered: {displayDate(pupil.registrationDate)} · {pupil.className || 'No class recorded'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(pupil.status)}`}>{pupil.status || 'Pending'}</span>
                    <span className="text-xs text-muted-foreground">{record.academicYearIds.length} year{record.academicYearIds.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => open ? setIsFormOpen(true) : resetAndCloseForm()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add historical pupil</DialogTitle>
            <DialogDescription>All fields are optional apart from the pupil’s known name. Add academic years only where you have reliable information.</DialogDescription>
          </DialogHeader>

          <form className="space-y-6" onSubmit={handleCreate} noValidate>
            <FormErrorSummary
              errors={formValidation.errors}
              submissionError={formValidation.submissionError}
              onSelectError={(fieldId) => void formValidation.focusField(fieldId)}
            />
            <section className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div>
                <h2 className="font-semibold text-slate-900">Pupil details</h2>
                <p className="mt-1 text-sm text-muted-foreground">Leave any unknown details blank.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="seed-name" className={formValidation.getFieldError('seed-name') ? 'text-destructive' : undefined}>Pupil name <span className="text-destructive">*</span></Label><Input id="seed-name" value={draft.firstName} onChange={(event) => { setDraft((current) => ({ ...current, firstName: event.target.value })); formValidation.handleFieldChange('seed-name'); }} placeholder="Known first or full name" {...formValidation.getFieldProps('seed-name')} /><FieldError error={formValidation.getFieldError('seed-name')} /></div>
                <div className="space-y-2"><Label htmlFor="seed-surname">Surname</Label><Input id="seed-surname" value={draft.lastName} onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="seed-other-names">Other names</Label><Input id="seed-other-names" value={draft.otherNames} onChange={(event) => setDraft((current) => ({ ...current, otherNames: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="seed-admission">Admission number</Label><Input id="seed-admission" value={draft.admissionNumber} onChange={(event) => setDraft((current) => ({ ...current, admissionNumber: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="seed-registration">Registration date</Label><Input id="seed-registration" type="date" value={draft.registrationDate} onChange={(event) => setDraft((current) => ({ ...current, registrationDate: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="seed-dob">Date of birth</Label><Input id="seed-dob" type="date" value={draft.dateOfBirth} onChange={(event) => setDraft((current) => ({ ...current, dateOfBirth: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="seed-gender">Gender</Label><select id="seed-gender" className={selectClassName} value={draft.gender} onChange={(event) => setDraft((current) => ({ ...current, gender: event.target.value as FormDraft['gender'] }))}><option value="">Not recorded</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
                <div className="space-y-2"><Label htmlFor="seed-section">Section</Label><select id="seed-section" className={selectClassName} value={draft.section} onChange={(event) => setDraft((current) => ({ ...current, section: event.target.value as FormDraft['section'] }))}><option value="">Not recorded</option><option value="Day">Day</option><option value="Boarding">Boarding</option></select></div>
                <div className="space-y-2"><Label htmlFor="seed-previous-school">Previous school</Label><Input id="seed-previous-school" value={draft.previousSchool} onChange={(event) => setDraft((current) => ({ ...current, previousSchool: event.target.value }))} /></div>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Academic history</h2>
                  <p className="mt-1 text-sm text-muted-foreground">A selected status carries into future years until you choose another one.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-2 self-start" onClick={addHistoryRow} disabled={academicYearsLoading}>
                  <Plus className="h-4 w-4" /> Add year
                </Button>
              </div>
              <FieldError error={formValidation.getFieldError('seed-history')} />

              {academicYearsLoading || classesLoading ? (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading academic years and classes…</div>
              ) : draft.history.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-5 text-sm text-muted-foreground">No academic years added. This pupil can still be saved with only their name.</div>
              ) : (
                <div className="space-y-3">
                  {draft.history.map((row, index) => {
                    const carriedStatus = draft.history.slice(0, index + 1).reduce<PupilStatus>((status, current) => current.status || status, 'Active');
                    return (
                      <div key={row.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1.05fr_1.2fr_1fr_1.2fr_auto] md:items-end">
                        <div className="space-y-2"><Label htmlFor={`${row.id}-year`}>Academic year</Label><select id={`${row.id}-year`} className={selectClassName} value={row.academicYearId} onChange={(event) => { updateHistoryRow(row.id, { academicYearId: event.target.value }); formValidation.handleFieldChange('seed-history'); }}>{sortedAcademicYears.map((year) => <option key={year.id} value={year.id} disabled={draft.history.some((item) => item.id !== row.id && item.academicYearId === year.id)}>{year.name}</option>)}</select></div>
                        <div className="space-y-2"><Label>Class attended</Label><select className={selectClassName} value={row.classId} onChange={(event) => updateHistoryRow(row.id, { classId: event.target.value })}><option value="">Not recorded</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.code ? `${schoolClass.code} — ${schoolClass.name}` : schoolClass.name}</option>)}</select></div>
                        <div className="space-y-2"><Label>Status change</Label><select className={selectClassName} value={row.status} onChange={(event) => updateHistoryRow(row.id, { status: event.target.value as DraftHistoryRow['status'] })}><option value="">Carry forward</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                        <div className="space-y-2"><Label>Notes</Label><Input value={row.notes} onChange={(event) => updateHistoryRow(row.id, { notes: event.target.value })} placeholder="Optional" /></div>
                        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeHistoryRow(row.id)} aria-label="Remove academic year"><Trash2 className="h-4 w-4" /></Button>
                        <div className="md:col-span-5 flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Status after this year: <span className="font-semibold text-slate-700">{carriedStatus}</span></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={resetAndCloseForm} disabled={createSeed.isPending}>Cancel</Button>
              <Button type="submit" className="gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={createSeed.isPending}>
                {createSeed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleAlert className="h-4 w-4" />}
                {createSeed.isPending ? 'Saving pupil…' : 'Save historical pupil'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
