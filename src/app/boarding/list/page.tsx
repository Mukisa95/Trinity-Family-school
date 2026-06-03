"use client";

import { useMemo, useState } from "react";
import { useActivePupils } from "@/lib/hooks/use-pupils";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DormitoriesService } from "@/lib/services/dormitories.service";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import type { Guardian } from "@/types";

type Pupil = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string;
  className?: string;
  classCode?: string;
  section?: string;
  gender?: 'Male' | 'Female' | '';
  familyId?: string;
  guardians?: Array<{ id: string; firstName?: string; lastName?: string; phone?: string }>;
};

export default function BoardingListPage() {
  const router = useRouter();
  const { data = [], isLoading, isError } = useActivePupils();
  const pupils = (data as Pupil[]) || [];
  const [search, setSearch] = useState('');

  const boardingPupils = useMemo(
    () => {
      const list = pupils.filter(p => (p.section || '').toLowerCase() === 'boarding');
      const q = search.trim().toLowerCase();
      if (!q) return list;
      return list.filter(p => {
        const first = (p.firstName || '').toLowerCase();
        const last = (p.lastName || '').toLowerCase();
        const adm = (p.admissionNumber || '').toLowerCase();
        const cls = (p.classCode || p.className || '').toLowerCase();
        return first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q) || adm.includes(q) || cls.includes(q);
      });
    },
    [pupils, search]
  );
  const boys = useMemo(
    () => boardingPupils.filter(p => (p.gender || '').toLowerCase() === 'male'),
    [boardingPupils]
  );
  const girls = useMemo(
    () => boardingPupils.filter(p => (p.gender || '').toLowerCase() === 'female'),
    [boardingPupils]
  );

  // Precompute siblings by familyId (within loaded active pupils)
  const siblingsMap = useMemo(() => {
    const map = new Map<string, Pupil[]>();
    const byFamily = new Map<string, Pupil[]>();
    boardingPupils.forEach(p => {
      if (p.familyId) {
        const arr = byFamily.get(p.familyId) || [];
        arr.push(p);
        byFamily.set(p.familyId, arr);
      }
    });
    boardingPupils.forEach(p => {
      if (p.familyId) {
        const fam = (byFamily.get(p.familyId) || []).filter(s => s.id !== p.id);
        map.set(p.id, fam);
      } else {
        map.set(p.id, []);
      }
    });
    return map;
  }, [boardingPupils]);

  // Group by class for each gender list
  const groupByClass = (arr: Pupil[]) => {
    const map = new Map<string, Pupil[]>();
    arr.forEach(p => {
      const key = p.classCode || p.className || 'Unassigned';
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    });
    return map;
  };
  const boysByClass = useMemo(() => groupByClass(boys), [boys]);
  const girlsByClass = useMemo(() => groupByClass(girls), [girls]);

  // Family popups
  const [selectedPupilGuardians, setSelectedPupilGuardians] = useState<{
    pupilName: string;
    guardians: Guardian[];
    emergencyContactId: string;
  } | null>(null);
  const [selectedPupilSiblings, setSelectedPupilSiblings] = useState<{
    pupilName: string;
    siblings: Pupil[];
  } | null>(null);

  // Dormitory lookup for siblings (show dorm name when section is Boarding)
  const { data: allDormitories = [] } = useQuery({
    queryKey: ['dormitories:all'],
    queryFn: () => DormitoriesService.getAll(),
  });
  const dormitoryByPupilId = useMemo(() => {
    const map = new Map<string, string>();
    (allDormitories as any[]).forEach((d: any) => {
      (d.assignedPupilIds || []).forEach((pid: string) => {
        if (!map.has(pid)) map.set(pid, d.name);
      });
    });
    return map;
  }, [allDormitories]);

  if (isLoading) {
    return (
      <div className="p-4">
        <PageHeader title="Boarding" />
        <div className="text-sm text-muted-foreground">Loading boarding pupils…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4">
        <PageHeader title="Boarding" />
        <div className="text-sm text-red-600">Unable to load boarding pupils.</div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 pointer-events-none" />
      <div className="relative p-3 sm:p-4 space-y-4">
        <div className="flex items-center gap-3 justify-between">
          <PageHeader title="Boarding Pupils" />
          <div className="relative flex-1 max-w-2xl">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, admission number, or class..."
              className="pl-3 pr-3 py-2 text-sm border border-indigo-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 rounded-full bg-white/90"
            />
          </div>
          <Button
            onClick={() => router.push('/boarding/dormitory')}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow hover:from-indigo-700 hover:to-fuchsia-700"
            size="sm"
          >
            Back
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
        {/* Boys */}
        <Card className="border-indigo-100 bg-white/90 backdrop-blur-sm shadow-sm">
          <CardHeader className="py-2 sm:py-3">
            <CardTitle className="text-sm sm:text-base">Boys ({boys.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {boys.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No boarding boys found.</div>
            ) : (
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-4 pr-1">
              {Array.from(boysByClass.keys()).sort().map(cls => {
                const list = (boysByClass.get(cls) || []).slice().sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
                return (
                  <div key={`boys-${cls}`} className="px-2 sm:px-3">
                    <div className="text-xs font-medium text-indigo-900 mb-2">{cls} • {list.length}</div>
                    <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
                      <table className="min-w-full divide-y divide-indigo-100">
                        <thead className="hidden">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">Pupil Info</th>
                            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">Class</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">Family</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-indigo-100">
                          {list.map(p => {
                            const initials = `${(p.firstName || '').trim()[0] || ''}${(p.lastName || '').trim()[0] || ''}`.toUpperCase();
                            const guardiansCount = Array.isArray(p.guardians) ? p.guardians.length : 0;
                            const siblings = siblingsMap.get(p.id) || [];
                            const siblingCount = siblings.length;
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
                                  <div className="text-sm">{p.classCode || p.className || ''}</div>
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
                                            emergencyContactId: ''
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
                                          const siblings = siblingsMap.get(p.id) || [];
                                          setSelectedPupilSiblings({
                                            pupilName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                                            siblings
                                          });
                                        }}
                                      >
                                        {siblingCount} sibling{siblingCount === 1 ? '' : 's'}
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
                );
              })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Girls */}
        <Card className="border-indigo-100 bg-white/90 backdrop-blur-sm shadow-sm">
          <CardHeader className="py-2 sm:py-3">
            <CardTitle className="text-sm sm:text-base">Girls ({girls.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {girls.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No boarding girls found.</div>
            ) : (
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-4 pr-1">
              {Array.from(girlsByClass.keys()).sort().map(cls => {
                const list = (girlsByClass.get(cls) || []).slice().sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
                return (
                  <div key={`girls-${cls}`} className="px-2 sm:px-3">
                    <div className="text-xs font-medium text-indigo-900 mb-2">{cls} • {list.length}</div>
                    <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
                      <table className="min-w-full divide-y divide-indigo-100">
                        <thead className="hidden">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">Pupil Info</th>
                            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">Class</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">Family</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-indigo-100">
                          {list.map(p => {
                            const initials = `${(p.firstName || '').trim()[0] || ''}${(p.lastName || '').trim()[0] || ''}`.toUpperCase();
                            const guardiansCount = Array.isArray(p.guardians) ? p.guardians.length : 0;
                            const siblings = siblingsMap.get(p.id) || [];
                            const siblingCount = siblings.length;
                            return (
                              <tr key={p.id} className="hover:bg-indigo-50 transition-colors">
                                <td className="px-2 sm:px-4 py-2 sm:py-3">
                                  <div className="flex items-center space-x-2 sm:space-x-3">
                                    <div className="relative flex-shrink-0">
                                      <a className="block h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-pink-100 overflow-hidden ring-2 ring-pink-100 hover:ring-pink-300 transition-all flex-shrink-0" href={`/pupil-detail?id=${p.id}`}>
                                        <div className="h-full w-full flex items-center justify-center text-pink-500 text-xs sm:text-sm font-medium">
                                          {initials || 'PU'}
                                        </div>
                                      </a>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <a className="text-xs sm:text-sm font-medium text-pink-600 hover:text-pink-800 transition-colors block truncate" href={`/pupil-detail?id=${p.id}`}>
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
                                  <div className="text-sm">{p.classCode || p.className || ''}</div>
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
                                            emergencyContactId: ''
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
                                          const siblings = siblingsMap.get(p.id) || [];
                                          setSelectedPupilSiblings({
                                            pupilName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                                            siblings
                                          });
                                        }}
                                      >
                                        {siblingCount} sibling{siblingCount === 1 ? '' : 's'}
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
                );
              })}
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

      {/* Siblings Modal */}
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
                    <span className="text-xs text-gray-500">
                      {' '}• {s.section}{s.section === 'Boarding' ? ` — ${dormitoryByPupilId.get(s.id) || 'Dormitory N/A'}` : ''}
                    </span>
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
  );
}


