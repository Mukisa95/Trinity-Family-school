"use client";

import { useMemo, useState } from "react";
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClasses } from "@/lib/hooks/use-classes";
import { PupilsService } from "@/lib/services/pupils.service";
import { DormitoriesService } from "@/lib/services/dormitories.service";
import { useStaff } from "@/lib/hooks/use-staff";
import type { Class, Dormitory, Pupil, Staff } from "@/types";
import { Bed, Pencil, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DormitoriesPage() {
  const qc = useQueryClient();
  const { data: dormitories = [], isLoading } = useQuery({
    queryKey: ['dormitories'],
    queryFn: () => DormitoriesService.getAll(),
  });
  const { data: classes = [] } = useClasses();
  const { data: pupils = [] } = useQuery({
    queryKey: ['pupils:all'],
    queryFn: () => PupilsService.getAllPupils(),
  });
  const { data: staff = [] } = useStaff();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dormitory | null>(null);

  const classOptions: MultiSelectOption[] = useMemo(
    () => (classes as Class[]).map(c => ({ value: c.id, label: c.code || c.name })),
    [classes]
  );
  const staffOptions: MultiSelectOption[] = useMemo(
    () => (staff as Staff[]).map(s => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })),
    [staff]
  );

  const formatDormGender = (g: 'Male' | 'Female' | '') =>
    g === 'Male' ? 'Boys Dormitory' : g === 'Female' ? 'Girls Dormitory' : '';

  // Edit state
  const [editState, setEditState] = useState<{
    name: string;
    gender: 'Male' | 'Female' | '';
    classIds: string[];
    bedCapacity: string;
    patronStaffIds: string[];
    inChargePupilIds: string[];
  }>({
    name: '',
    gender: '',
    classIds: [],
    bedCapacity: '',
    patronStaffIds: [],
    inChargePupilIds: [],
  });

  const filteredPupilsForLeaders = useMemo(() => {
    const g = editing?.gender;
    const cls = editState.classIds;
    return (pupils as Pupil[]).filter(p =>
      ((p.section || '').toLowerCase() === 'boarding') &&
      (g ? p.gender === g : true) &&
      (cls.length ? cls.includes(p.classId) : true)
    );
  }, [pupils, editing?.gender, editState.classIds]);

  const pupilLeaderOptions: MultiSelectOption[] = useMemo(() => {
    const list = filteredPupilsForLeaders as Pupil[];
    return list.map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}`.trim() }));
  }, [filteredPupilsForLeaders]);

  const resetForm = () => {
    setEditState({
      name: '',
      gender: '',
      classIds: [],
      bedCapacity: '',
      patronStaffIds: [],
      inChargePupilIds: [],
    });
    setEditing(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: editState.name.trim(),
        gender: (editState.gender || 'Male') as 'Male' | 'Female',
        classIds: editState.classIds,
        bedCapacity: Number(editState.bedCapacity || 0),
        patronStaffIds: editState.patronStaffIds,
        inChargePupilIds: editState.inChargePupilIds,
        assignedPupilIds: [] as string[],
      };
      if (!payload.name) throw new Error('Name is required');
      if (!payload.gender) throw new Error('Gender is required');
      if (isNaN(payload.bedCapacity)) throw new Error('Bed capacity must be a number');
      await DormitoriesService.create(payload as any);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dormitories'] });
      setOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload = {
        name: editState.name.trim(),
        gender: (editState.gender || 'Male') as 'Male' | 'Female',
        classIds: editState.classIds,
        bedCapacity: Number(editState.bedCapacity || 0),
        patronStaffIds: editState.patronStaffIds,
        inChargePupilIds: editState.inChargePupilIds,
      };
      await DormitoriesService.update(editing.id, payload as any);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dormitories'] });
      setOpen(false);
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => DormitoriesService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dormitories'] }),
  });

  const handleOpenCreate = () => {
    resetForm();
    setOpen(true);
  };
  const handleOpenEdit = (d: Dormitory) => {
    setEditing(d);
    setEditState({
      name: d.name,
      gender: d.gender,
      classIds: d.classIds || [],
      bedCapacity: String(d.bedCapacity ?? ''),
      patronStaffIds: d.patronStaffIds || [],
      inChargePupilIds: d.inChargePupilIds || [],
    });
    setOpen(true);
  };

  return (
    <div className="min-h-screen animate-in fade-in duration-500">
      <GlassPageTopBar
        title="Dormitories"
        subtitle="Manage student housing, patrons, and in-charge pupil assignments"
        backHref="/boarding"
        backLabel="Back to boarding"
        className="mb-1.5"
        meta={
          <div className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 p-[1px] shrink-0 shadow-sm">
            <div className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              In-House
            </div>
          </div>
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="List"
              icon={<Bed className="h-4 w-4" />}
              tone="slate"
              href="/boarding/list"
            />
            <GlassActionButton
              label={editing ? 'Edit' : 'Create'}
              icon={<Plus className="h-4 w-4" />}
              tone="orange"
              onClick={() => setOpen(true)}
            />
          </GlassActionDock>
        }
      />

      <GlassSummaryBar
        left={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
              Dormitories Summary
            </span>
          </div>
        }
        right={
          <>
            <div className="flex items-center gap-1 bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{dormitories.length}</span>
              <span className="text-indigo-700/85 dark:text-indigo-300 font-medium">Total Dorms</span>
            </div>
            <div className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-green-600 dark:text-green-400">{dormitories.reduce((n, d) => n + (d.bedCapacity ?? 0), 0)}</span>
              <span className="text-green-700/85 dark:text-green-300 font-medium">Total Capacity</span>
            </div>
            <div className="flex items-center gap-1 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-blue-600 dark:text-blue-400">{dormitories.filter(d => d.gender === 'Male').length}</span>
              <span className="text-blue-700/85 dark:text-blue-300 font-medium">Boys Dorms</span>
            </div>
            <div className="flex items-center gap-1 bg-fuchsia-50/80 dark:bg-fuchsia-950/20 border border-fuchsia-100/50 dark:border-fuchsia-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-fuchsia-600 dark:text-fuchsia-400">{dormitories.filter(d => d.gender === 'Female').length}</span>
              <span className="text-fuchsia-700/85 dark:text-fuchsia-300 font-medium">Girls Dorms</span>
            </div>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
              <DialogContent className="max-w-2xl border border-white/60 bg-white/70 backdrop-blur-xl">
                <DialogHeader>
                  <DialogTitle className="text-lg">{editing ? 'Edit Dormitory' : 'Create Dormitory'}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={editState.name} onChange={(e) => setEditState(s => ({ ...s, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                <Select value={editState.gender} onValueChange={(v) => setEditState(s => ({ ...s, gender: v as any }))}>
                      <SelectTrigger className="bg-white/70 backdrop-blur">
                    <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                    <SelectItem value="Male">Boys Dormitory</SelectItem>
                    <SelectItem value="Female">Girls Dormitory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Class(es)</Label>
                    <MultiSelect
                      options={classOptions}
                      selected={editState.classIds}
                      onChange={(vals) => setEditState(s => ({ ...s, classIds: vals }))}
                      placeholder="Select classes"
                      searchPlaceholder="Search classes..."
                      className="bg-white/70 backdrop-blur rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Bed Capacity</Label>
                    <Input id="capacity" type="number" min={0} value={editState.bedCapacity} onChange={(e) => setEditState(s => ({ ...s, bedCapacity: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Patron (Staff)</Label>
                    <MultiSelect
                      options={staffOptions}
                      selected={editState.patronStaffIds}
                      onChange={(vals) => setEditState(s => ({ ...s, patronStaffIds: vals }))}
                      placeholder="Select staff"
                      searchPlaceholder="Search staff..."
                      className="bg-white/70 backdrop-blur rounded-md"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>In-Charge (Pupils)</Label>
                    <MultiSelect
                      options={pupilLeaderOptions}
                      selected={editState.inChargePupilIds}
                      onChange={(vals) => setEditState(s => ({ ...s, inChargePupilIds: vals }))}
                      placeholder="Select pupil leaders"
                      searchPlaceholder="Search pupils..."
                      className="bg-white/70 backdrop-blur rounded-md"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
                    disabled={createMutation.isLoading || updateMutation.isLoading}
                    className="rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-md hover:from-indigo-700 hover:to-fuchsia-700"
                  >
                    {editing
                      ? (updateMutation.isLoading ? 'Saving…' : 'Save Changes')
                      : (createMutation.isLoading ? 'Creating…' : 'Create')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>



        <Card className="border-white/60 bg-white/70 backdrop-blur-xl">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bed className="h-5 w-5 text-indigo-600" /> Dormitories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading dormitories…</div>
            ) : dormitories.length === 0 ? (
              <div className="text-sm text-muted-foreground">No dormitories found.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {dormitories.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-white/60 bg-gradient-to-br from-white/80 to-white/60 backdrop-blur p-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-[11px] px-2 py-0.5 rounded-full bg-white/70 border border-white/60 text-muted-foreground">
                        {formatDormGender(d.gender as any)}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Classes: {(d.classIds || []).length} • Capacity: {d.bedCapacity ?? 0}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(d)}
                          className="rounded-full bg-white/70 backdrop-blur"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeMutation.mutate(d.id)}
                          className="rounded-full"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Link
                        href={`/boarding/dormitory/${d.id}`}
                        className="text-sm rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white px-3 py-1 shadow hover:from-indigo-700 hover:to-fuchsia-700"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

