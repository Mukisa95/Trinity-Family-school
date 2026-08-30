"use client";

import { use, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from '@/lib/contexts/navigation-context';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { DormitoriesService } from "@/lib/services/dormitories.service";
import { usePupils } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { useStaff } from "@/lib/hooks/use-staff";
import type { Class, Dormitory, Pupil, Guardian } from "@/types";
import { ArrowLeft, Plus } from "lucide-react";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import { LinkSiblingsModal } from "@/components/pupils/link-siblings-modal";

export default function DormitoryDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const qc = useQueryClient();
  const { goBack } = useNavigation();

  const { data: dormitory, isLoading } = useQuery({
    queryKey: ['dormitory', id],
    queryFn: () => DormitoriesService.getById(id).then(d => {
      if (!d) throw new Error('Dormitory not found');
      return d;
    }),
  });
  const { data: pupils = [] } = usePupils();
  const { data: classes = [] } = useClasses();
  const { data: staff = [] } = useStaff();
  const { data: allDormitories = [] } = useQuery({
    queryKey: ['dormitories:all'],
    queryFn: () => DormitoriesService.getAll(),
  });

  const assignedPupils: Pupil[] = useMemo(() => {
    const set = new Set(dormitory?.assignedPupilIds ?? []);
    return (pupils as Pupil[]).filter(p => set.has(p.id));
  }, [pupils, dormitory?.assignedPupilIds]);

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPupilIds, setSelectedPupilIds] = useState<string[]>([]);

  const eligiblePupils = useMemo(() => {
    const g = dormitory?.gender;
    const cls = dormitory?.classIds ?? [];
    return (pupils as Pupil[]).filter(p =>
      ((p.section || '').toLowerCase() === 'boarding') &&
      (g ? p.gender === g : true) &&
      (cls.length ? cls.includes(p.classId) : true) &&
      !(dormitory?.assignedPupilIds ?? []).includes(p.id)
    );
  }, [pupils, dormitory]);

  const eligibleOptions: MultiSelectOption[] = useMemo(() => {
    return eligiblePupils.map(p => ({
      value: p.id,
      label: `${p.firstName} ${p.lastName} — ${p.classCode || p.className || ''}`.trim(),
    }));
  }, [eligiblePupils]);

  const assignMutation = useMutation({
    mutationFn: () => DormitoriesService.assignPupils(id, selectedPupilIds),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dormitory', id] });
      setAssignOpen(false);
      setSelectedPupilIds([]);
    },
  });

  // Computed details
  const clsMap = new Map((classes as Class[]).map(c => [c.id, c]));
  const staffMap = new Map((staff as any[]).map((s: any) => [s.id, s]));
  const pupilMap = new Map((pupils as Pupil[]).map(p => [p.id, p]));
  const patronNames = (dormitory?.patronStaffIds || []).map((sid) => {
    const s = staffMap.get(sid);
    return s ? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() : 'Unknown';
  }).filter(Boolean);
  const inChargeNames = (dormitory?.inChargePupilIds || []).map((pid) => {
    const p = pupilMap.get(pid);
    return p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : 'Unknown';
  }).filter(Boolean);
  const totalCapacity = dormitory?.bedCapacity ?? 0;
  const assignedCount = assignedPupils.length;
  const availableBeds = Math.max(0, totalCapacity - assignedCount);
  const formatDormGender = (g: 'Male' | 'Female' | '' | undefined) =>
    g === 'Male' ? 'Boys Dormitory' : g === 'Female' ? 'Girls Dormitory' : '';

  // Family popups (reuse simplified versions)
  const [selectedPupilGuardians, setSelectedPupilGuardians] = useState<{
    pupilName: string;
    guardians: Guardian[];
    emergencyContactId: string;
  } | null>(null);
  const [selectedPupilForLinking, setSelectedPupilForLinking] = useState<Pupil | null>(null);
  const [isLinkSiblingsModalOpen, setIsLinkSiblingsModalOpen] = useState(false);
  const [selectedPupilSiblings, setSelectedPupilSiblings] = useState<{
    pupilName: string;
    siblings: Pupil[];
  } | null>(null);
  const getSiblings = (p: Pupil) => {
    if (!p.familyId) return [] as Pupil[];
    return (pupils as Pupil[]).filter(s => s.familyId === p.familyId && s.id !== p.id);
  };
  const dormitoryByPupilId = useMemo(() => {
    const map = new Map<string, string>();
    (allDormitories as Dormitory[]).forEach(d => {
      (d.assignedPupilIds || []).forEach(pid => {
        if (!map.has(pid)) {
          map.set(pid, d.name);
        }
      });
    });
    return map;
  }, [allDormitories]);

  if (isLoading || !dormitory) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 pointer-events-none" />
        <div className="relative p-4">
          <Button variant="secondary" onClick={() => goBack('/boarding/dormitory')} className="mb-3 inline-flex gap-2 rounded-full bg-white/70 backdrop-blur">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="text-sm text-muted-foreground">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 pointer-events-none" />
      <div className="relative p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => goBack('/boarding/dormitory')} className="inline-flex gap-2 rounded-full bg-white/70 backdrop-blur">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Dialog open={assignOpen} onOpenChange={(v) => { if (!v) setSelectedPupilIds([]); setAssignOpen(v); }}>
            <Button onClick={() => setAssignOpen(true)} className="inline-flex gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-lg hover:from-indigo-700 hover:to-fuchsia-700">
              <Plus className="h-4 w-4" /> Assign Pupils
            </Button>
            <DialogContent className="max-w-lg border border-white/60 bg-white/70 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle>Assign Pupils to {dormitory.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <MultiSelect
                  options={eligibleOptions}
                  selected={selectedPupilIds}
                  onChange={setSelectedPupilIds}
                  placeholder="Select pupils to assign"
                  searchPlaceholder="Search pupils..."
                  className="bg-white/70 backdrop-blur rounded-md"
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => assignMutation.mutate()}
                  disabled={assignMutation.isLoading || selectedPupilIds.length === 0}
                  className="rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow hover:from-indigo-700 hover:to-fuchsia-700"
                >
                  {assignMutation.isLoading ? 'Assigning…' : 'Assign'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card className="border-white/60 bg-white/70 backdrop-blur-xl">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="font-semibold">{dormitory.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/70 border border-white/60 text-muted-foreground">
                    {formatDormGender(dormitory.gender as any)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-[12px]">
                <div className="grid gap-1.5">
                  <div className="rounded-md border border-white/60 bg-white/70 backdrop-blur p-1.5">
                    <div className="text-[10px] text-muted-foreground">Classes</div>
                    <div className="font-medium leading-tight">
                      {(dormitory.classIds || []).map(cid => clsMap.get(cid)?.code || clsMap.get(cid)?.name || 'Unknown').join(', ') || '—'}
                    </div>
                  </div>
                  <div className="rounded-md border border-white/60 bg-white/70 backdrop-blur p-1.5">
                    <div className="text-[10px] text-muted-foreground">Bed Capacity</div>
                    <div className="font-medium leading-tight">{totalCapacity}</div>
                  </div>
                  <div className="rounded-md border border-white/60 bg-white/70 backdrop-blur p-1.5">
                    <div className="text-[10px] text-muted-foreground">Available Beds</div>
                    <div className="font-medium leading-tight">{availableBeds}</div>
                  </div>
                  <div className="rounded-md border border-white/60 bg-white/70 backdrop-blur p-1.5">
                    <div className="text-[10px] text-muted-foreground">Patron(s)</div>
                    {patronNames.length ? (
                      <div className="font-medium space-y-0.5 leading-tight">
                        {patronNames.map((n, i) => (
                          <div key={i} className="truncate" title={n}>{n}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-medium leading-tight">—</div>
                    )}
                  </div>
                  <div className="rounded-md border border-white/60 bg-white/70 backdrop-blur p-1.5">
                    <div className="text-[10px] text-muted-foreground">In-Charge</div>
                    {inChargeNames.length ? (
                      <div className="font-medium space-y-0.5 leading-tight">
                        {inChargeNames.map((n, i) => (
                          <div key={i} className="truncate" title={n}>{n}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-medium leading-tight">—</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
            <Card className="border-indigo-100 bg-white/90 backdrop-blur-sm shadow-sm h-full">
              <CardHeader className="py-2 sm:py-3">
                <CardTitle className="text-sm sm:text-base">Assigned Pupils ({assignedPupils.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {assignedPupils.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No pupils assigned.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="px-2 sm:px-4 py-2 sm:py-3">
                      <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-3">
                        <div className="flex-1 relative group">
                          <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none text-blue-500/80 group-hover:text-blue-600 transition-all duration-500 z-10">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" className="sm:w-4 sm:h-4" fill="currentColor"><path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity=".2"></path><path d="M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path></svg>
                          </div>
                          <input
                            placeholder="Search pupils..."
                            className="w-full pl-8 sm:pl-10 pr-4 sm:pr-6 py-1.5 sm:py-2 text-sm bg-white rounded-full focus:ring-2 focus:ring-blue-400/50 focus:outline-none shadow-sm hover:shadow-md transition-all duration-500 ease-in-out placeholder:text-gray-400 placeholder:text-sm border border-indigo-100"
                            onChange={() => {}}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
                      <table className="min-w-full divide-y divide-indigo-100">
                        <thead className="bg-gradient-to-r from-indigo-50 to-white">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">Pupil Info</th>
                            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">Class</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">Family</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-indigo-100">
                          {assignedPupils
                            .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''))
                            .map((p) => {
                              const initials = `${(p.firstName || '').trim()[0] || ''}${(p.lastName || '').trim()[0] || ''}`.toUpperCase();
                              const guardiansCount = Array.isArray(p.guardians) ? p.guardians.length : 0;
                              const siblingsCount = (p.familyId ? (pupils as Pupil[]).filter(px => px.familyId === p.familyId && px.id !== p.id).length : 0);
                              return (
                                <tr key={p.id} className="hover:bg-indigo-50 transition-colors">
                                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                                    <div className="flex items-center space-x-2 sm:space-x-3">
                                      <div className="relative flex-shrink-0">
                                        <a className="block h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-indigo-100 overflow-hidden ring-2 ring-indigo-100 hover:ring-indigo-300 transition-all flex-shrink-0" href={`/pupil-detail?id=${p.id}`}>
                                          <div className="h-full w-full flex items-center justify-center text-indigo-500 text-xs sm:text-sm font-medium">
                                            {initials || 'PU'}
                                          </div>
                                        </a>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <a className="text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors block truncate" href={`/pupil-detail?id=${p.id}`}>
                                          {(p.firstName || '').toUpperCase()} {(p.lastName || '').toUpperCase()}
                                        </a>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          <span className="truncate">{p.admissionNumber || ''}</span>
                                          <span className="hidden sm:inline">•</span>
                                          <span>{p.gender || ''}</span>
                                          <span className="hidden sm:inline">•</span>
                                          <span>Active</span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="hidden sm:table-cell px-4 py-3">
                                    <div className="text-sm">
                                      <button className="text-indigo-900 hover:text-indigo-600 hover:underline transition-colors font-medium text-left" type="button">
                                        {p.classCode || p.className || ''}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="hidden md:table-cell px-4 py-3">
                                    <div className="text-left text-sm text-indigo-900">
                                      <span className="text-xs text-gray-500">
                                        <button
                                          className="hover:underline cursor-pointer text-indigo-700"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            setSelectedPupilGuardians({
                                              pupilName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                                              guardians: (p.guardians as Guardian[]) || [],
                                              emergencyContactId: p.emergencyContactGuardianId || ''
                                            });
                                          }}
                                        >
                                          {guardiansCount} guardian{guardiansCount === 1 ? '' : 's'}
                                        </button>
                                        {' • '}
                                        <button
                                          className="hover:underline cursor-pointer text-indigo-700"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const siblings = getSiblings(p);
                                            setSelectedPupilSiblings({
                                              pupilName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                                              siblings
                                            });
                                          }}
                                        >
                                          {siblingsCount} sibling{siblingsCount === 1 ? '' : 's'}
                                        </button>
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Guardians Modal */}
        <ModernDialog open={!!selectedPupilGuardians} onOpenChange={(o) => !o && setSelectedPupilGuardians(null)}>
          <ModernDialogContent>
            <ModernDialogHeader>
              <ModernDialogTitle>Guardians</ModernDialogTitle>
              <ModernDialogDescription>{selectedPupilGuardians?.pupilName}</ModernDialogDescription>
            </ModernDialogHeader>
            <div className="space-y-2 max-h-80 overflow-auto">
              {selectedPupilGuardians?.guardians?.length ? (
                selectedPupilGuardians.guardians.map((g, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="font-medium">{g.firstName} {g.lastName}</div>
                    <div className="text-xs text-gray-500">{g.phone}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No guardians found.</div>
              )}
            </div>
            <ModernDialogFooter>
              <Button onClick={() => setSelectedPupilGuardians(null)}>Close</Button>
            </ModernDialogFooter>
          </ModernDialogContent>
        </ModernDialog>
        {/* View Siblings Modal (compact viewer) */}
        <ModernDialog open={!!selectedPupilSiblings} onOpenChange={(o) => !o && setSelectedPupilSiblings(null)}>
          <ModernDialogContent>
            <ModernDialogHeader>
              <ModernDialogTitle>Siblings</ModernDialogTitle>
              <ModernDialogDescription>{selectedPupilSiblings?.pupilName}</ModernDialogDescription>
            </ModernDialogHeader>
            <div className="space-y-2 max-h-80 overflow-auto">
              {selectedPupilSiblings?.siblings?.length ? (
                selectedPupilSiblings.siblings.map((s, idx) => (
                  <a key={idx} href={`/pupil-detail?id=${s.id}`} className="block text-sm hover:underline">
                    {s.firstName} {s.lastName}
                    <span className="text-xs text-gray-500"> • {s.classCode || s.className || ''}</span>
                    {s.section ? (
                      <span className="text-xs text-gray-500"> • {s.section}{s.section === 'Boarding' ? ` — ${dormitoryByPupilId.get(s.id) || 'Dormitory N/A'}` : ''}</span>
                    ) : null}
                  </a>
                ))
              ) : (
                <div className="text-sm text-gray-500">No siblings found for this pupil.</div>
              )}
            </div>
            <ModernDialogFooter>
              <Button onClick={() => setSelectedPupilSiblings(null)}>Close</Button>
            </ModernDialogFooter>
          </ModernDialogContent>
        </ModernDialog>
      </div>
    </div>
  );
}
