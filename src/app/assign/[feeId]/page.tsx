"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import { Fragment, useCallback, useMemo, useState, use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AcademicYear,
  FeeStructure,
  PaymentRecord,
  Pupil,
  PupilAssignedFee,
} from "@/types";
import { FeeStructuresService } from "@/lib/services/fee-structures.service";
import { PupilsService } from "@/lib/services/pupils.service";
import { PaymentsService } from "@/lib/services/payments.service";
import { useAcademicYears, useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { detectCurrentAcademicYear, getActiveOrMostRecentTerm } from "@/lib/utils/academic-year-utils";
import { getEffectiveTermForDataDisplay } from "@/lib/utils/term-status-utils";
import {
  isAssignmentValidForContext,
  upsertPupilFeeAssignment,
} from "@/lib/utils/fee-assignment-pipeline";
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronUp, ArrowLeft, Info, Wallet, MoreVertical, Sliders, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AssignmentTimeManagementForm,
  DEFAULT_ASSIGNMENT_TIME_SETTINGS,
  type AssignmentTimeManagementFormData,
} from "@/components/pupils/assignment-time-management-form";

interface AssignmentRecord {
  pupil: Pupil;
  assignment: PupilAssignedFee;
  payments: PaymentRecord[];
  totalPaid: number;
  balance: number;
}

interface FeeDetailPageProps {
  params: Promise<{
    feeId: string;
  }>;
}

export default function AssignDetailPage({ params }: FeeDetailPageProps) {
  const { feeId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /** Keep assign-pupils and assignment-details in sync after any mutation (order matters for refetch). */
  const refreshAssignmentCaches = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["assign-pupils"] });
    await queryClient.invalidateQueries({ queryKey: ["assignment-details", feeId] });
  }, [queryClient, feeId]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPupilIds, setSelectedPupilIds] = useState<Set<string>>(new Set());
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("Active");
  const [searchText, setSearchText] = useState<string>("");
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("");

  // Modify Modal State
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [modifyAction, setModifyAction] = useState<"extend" | "constrain">("extend");
  const [modifyFetchYearId, setModifyFetchYearId] = useState<string>("");
  const [modifyFetchTermId, setModifyFetchTermId] = useState<string>("");
  const [modifyTargetYearId, setModifyTargetYearId] = useState<string>("");
  const [modifyTargetTermId, setModifyTargetTermId] = useState<string>("");
  const [modifySelectedPupilIds, setModifySelectedPupilIds] = useState<Set<string>>(new Set());
  const [isModifying, setIsModifying] = useState(false);

  const [assignTimeSettings, setAssignTimeSettings] = useState<AssignmentTimeManagementFormData>(
    DEFAULT_ASSIGNMENT_TIME_SETTINGS
  );
  const [notes, setNotes] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTargetPupil, setEditTargetPupil] = useState<Pupil | null>(null);
  const [editTimeSettings, setEditTimeSettings] = useState<AssignmentTimeManagementFormData>(
    DEFAULT_ASSIGNMENT_TIME_SETTINGS
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyTargetPupil, setHistoryTargetPupil] = useState<Pupil | null>(null);
  const [selectedForBulkDeleteIds, setSelectedForBulkDeleteIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();

  const isAssignDisabled = useMemo(() => {
    if (!selectedYearId || !activeAcademicYear) return false;
    const selYear = academicYears.find(y => y.id === selectedYearId);
    if (!selYear) return false;
    const selStart = new Date(selYear.startDate).getTime();
    const actStart = new Date(activeAcademicYear.startDate).getTime();
    if (selStart < actStart) return true;
    if (selStart > actStart) return false;
    if (selectedTermId) {
      const selTerm = selYear.terms.find(t => t.id === selectedTermId);
      const actTerm = activeAcademicYear.terms.find(t => t.isCurrent) || activeAcademicYear.terms[0];
      if (selTerm && actTerm) {
        return new Date(selTerm.startDate).getTime() < new Date(actTerm.startDate).getTime();
      }
    }
    return false;
  }, [selectedYearId, activeAcademicYear, academicYears, selectedTermId]);

  // Use centralized date-based detection
  const getCurrentAcademicYear = (): AcademicYear | undefined => {
    return detectCurrentAcademicYear(academicYears) || activeAcademicYear;
  };

  // Resolve current term for a given academic year using dates or isCurrent flag
  const getCurrentTermForYear = (year?: AcademicYear) => {
    if (!year || !year.terms || year.terms.length === 0) return undefined;
    const now = new Date();
    const byDate = year.terms.find(t => {
      if (!t.startDate || !t.endDate) return false;
      const s = new Date(t.startDate);
      const e = new Date(t.endDate);
      return now >= s && now <= e;
    });
    if (byDate) return byDate;
    return year.terms.find(t => t.isCurrent) || year.terms[0];
  };

  const {
    data: feeStructure,
    isLoading: isLoadingFee,
    isError: isFeeError,
    error: feeError,
  } = useQuery({
    queryKey: ["fee-structure-detail", feeId],
    queryFn: async () => {
      const fee = await FeeStructuresService.getFeeStructureById(feeId);
      if (!fee) {
        throw new Error("Fee structure not found");
      }
      return fee;
    },
  });

  const {
    data: pupils = [],
    isLoading: isLoadingPupils,
    error: pupilsError,
    isError: isPupilsError,
  } = useQuery({
    queryKey: ["assign-pupils"],
    queryFn: () => PupilsService.getAllPupils(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: assignmentRecords = [],
    isFetching: isFetchingAssignments,
    isError: isAssignmentsError,
    error: assignmentsError,
  } = useQuery<AssignmentRecord[]>({
    queryKey: ["assignment-details", feeId, selectedYearId, selectedTermId],
    enabled: Boolean(feeStructure),
    queryFn: async () => {
      if (!feeStructure) return [];

      const pupilsList = await queryClient.fetchQuery<Pupil[]>({
        queryKey: ["assign-pupils"],
        queryFn: () => PupilsService.getAllPupils(),
        staleTime: 5 * 60 * 1000,
      });

      const assignments = pupilsList
        .map((pupil) => {
          const all = pupil.assignedFees || [];
          const assignment = all.find(af =>
            af.feeStructureId === feeStructure.id &&
            af.status === "active" &&
            !!selectedYearId &&
            !!selectedTermId &&
            isAssignmentValidForContext(af, selectedYearId, selectedTermId, academicYears)
          );
          if (!assignment) return null;
          return { pupil, assignment };
        })
        .filter(
          (
            entry
          ): entry is {
            pupil: Pupil;
            assignment: PupilAssignedFee;
          } => Boolean(entry)
        );

      const effectiveYearId =
        selectedYearId ||
        feeStructure.academicYearId ||
        activeAcademicYear?.id ||
        detectCurrentAcademicYear(academicYears.filter(y => !y.isLocked))?.id ||
        academicYears[0]?.id;

      const effectiveYear = effectiveYearId
        ? academicYears.find((year) => year.id === effectiveYearId)
        : undefined;

      const effectiveTermId =
        selectedTermId ||
        feeStructure.termId ||
        effectiveYear?.terms?.find((term) => term.isCurrent)?.id ||
        effectiveYear?.terms?.[0]?.id;

      const termPayments =
        effectiveYearId && effectiveTermId
          ? await PaymentsService.getAllPaymentsByTerm(effectiveYearId, effectiveTermId)
          : [];
      const paymentsByPupil = PaymentsService.groupPaymentsByPupil(termPayments);

      return Promise.all(
        assignments.map(async ({ pupil, assignment }) => {
          const filterPayments = (records: PaymentRecord[]) =>
            records.filter((payment) => {
              if (payment.reverted) return false;
              if (payment.feeStructureId !== feeStructure.id) return false;
              if (effectiveYearId && payment.academicYearId !== effectiveYearId) return false;
              if (effectiveTermId && payment.termId !== effectiveTermId) return false;
              return true;
            });

          let payments: PaymentRecord[];

          if (termPayments.length > 0) {
            payments = filterPayments(paymentsByPupil.get(pupil.id) || []);
          } else if (effectiveYearId) {
            try {
              const byYear = await PaymentsService.getPaymentsByPupilAndYear(pupil.id, effectiveYearId);
              payments = filterPayments(byYear);
            } catch (error) {
              console.warn("Year-based payments query failed, falling back to pupil query.", error);
              const fallback = await PaymentsService.getPaymentsByPupil(pupil.id);
              payments = filterPayments(fallback);
            }
          } else {
            const byPupil = await PaymentsService.getPaymentsByPupil(pupil.id);
            payments = filterPayments(byPupil);
          }

          const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
          const baseAmount = feeStructure.amount || 0;
          const balance = Math.max(0, baseAmount - totalPaid);

          return {
            pupil,
            assignment,
            payments,
            totalPaid,
            balance,
          };
        })
      );
    },
  });

  const toggleRow = (pupilId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(pupilId)) {
        next.delete(pupilId);
      } else {
        next.add(pupilId);
      }
      return next;
    });
  };

  const summary = useMemo(() => {
    if (!feeStructure || assignmentRecords.length === 0) {
      return {
        totalAssigned: assignmentRecords.length,
        totalAmount: 0,
        totalPaid: 0,
        outstanding: 0,
      };
    }

    const totalAmount = assignmentRecords.length * (feeStructure.amount || 0);
    const totalPaid = assignmentRecords.reduce((sum, record) => sum + record.totalPaid, 0);
    const outstanding = Math.max(0, totalAmount - totalPaid);

    return {
      totalAssigned: assignmentRecords.length,
      totalAmount,
      totalPaid,
      outstanding,
    };
  }, [assignmentRecords, feeStructure]);

  // Default year + term: same logic as Pupil Fees Collection (getEffectiveTermForDataDisplay)
  useEffect(() => {
    if (!academicYears.length) return;
    if (selectedYearId && selectedTermId) return;

    if (!selectedYearId && !selectedTermId) {
      const effective = getEffectiveTermForDataDisplay(academicYears);
      if (effective.term?.id && effective.academicYear?.id) {
        setSelectedYearId(effective.academicYear.id);
        setSelectedTermId(effective.term.id);
        return;
      }
      const fallbackYear =
        detectCurrentAcademicYear(academicYears.filter((y) => !y.isLocked)) ||
        activeAcademicYear ||
        academicYears[0];
      if (fallbackYear?.id) {
        setSelectedYearId(fallbackYear.id);
        const t =
          getCurrentTermForYear(fallbackYear) ||
          getActiveOrMostRecentTerm(fallbackYear) ||
          fallbackYear.terms?.[0];
        if (t?.id) setSelectedTermId(t.id);
      }
      return;
    }

    if (!selectedYearId && selectedTermId) {
      for (const y of academicYears) {
        if (y.terms?.some((t) => t.id === selectedTermId)) {
          setSelectedYearId(y.id);
          return;
        }
      }
    }
  }, [academicYears, activeAcademicYear, selectedYearId, selectedTermId]);

  // When year changes via selector, ensure term is valid for that year
  useEffect(() => {
    if (!selectedYearId) return;
    const year = academicYears.find(y => y.id === selectedYearId);
    if (!year) return;
    const termIds = (year.terms || []).map(t => t.id);
    if (!selectedTermId || !termIds.includes(selectedTermId)) {
      const globalEffective = getEffectiveTermForDataDisplay(academicYears);
      if (
        globalEffective.term?.id &&
        globalEffective.academicYear?.id === selectedYearId
      ) {
        setSelectedTermId(globalEffective.term.id);
        return;
      }
      const term =
        getCurrentTermForYear(year) ||
        getActiveOrMostRecentTerm(year) ||
        year.terms?.[0];
      if (term?.id) setSelectedTermId(term.id);
    }
  }, [selectedYearId, academicYears, selectedTermId]);

  // Is selected context in the past?
  const isSelectedPast = useMemo(() => {
    if (!selectedYearId || !activeAcademicYear) return false;
    const selectedYear = academicYears.find(y => y.id === selectedYearId);
    if (!selectedYear) return false;
    const selStart = new Date(selectedYear.startDate).getTime();
    const actStart = new Date(activeAcademicYear.startDate).getTime();
    if (selStart < actStart) return true;
    if (selStart > actStart) return false;
    if (selectedTermId) {
      const selTerm = selectedYear.terms.find(t => t.id === selectedTermId);
      const actTerm = activeAcademicYear.terms.find(t => t.isCurrent) || activeAcademicYear.terms[0];
      if (selTerm && actTerm) {
        const selTermStart = new Date(selTerm.startDate).getTime();
        const actTermStart = new Date(actTerm.startDate).getTime();
        return selTermStart < actTermStart;
      }
    }
    return false;
  }, [selectedYearId, selectedTermId, academicYears, activeAcademicYear]);

  const bulkSelectablePupilIds = useMemo(
    () => assignmentRecords.map((r) => r.pupil.id),
    [assignmentRecords]
  );

  const bulkAllSelected =
    bulkSelectablePupilIds.length > 0 &&
    bulkSelectablePupilIds.every((id) => selectedForBulkDeleteIds.has(id));
  const bulkSomeSelected = bulkSelectablePupilIds.some((id) =>
    selectedForBulkDeleteIds.has(id)
  );

  useEffect(() => {
    const allowed = new Set(assignmentRecords.map((r) => r.pupil.id));
    setSelectedForBulkDeleteIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [assignmentRecords]);

  useEffect(() => {
    if (isSelectedPast) setSelectedForBulkDeleteIds(new Set());
  }, [isSelectedPast]);

  const toggleBulkSelectOne = (pupilId: string) => {
    setSelectedForBulkDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(pupilId)) next.delete(pupilId);
      else next.add(pupilId);
      return next;
    });
  };

  const toggleBulkSelectAll = () => {
    if (bulkAllSelected) setSelectedForBulkDeleteIds(new Set());
    else setSelectedForBulkDeleteIds(new Set(bulkSelectablePupilIds));
  };

  const handleBulkDeleteAssignments = async () => {
    const ids = [...selectedForBulkDeleteIds];
    if (ids.length === 0 || !feeStructure?.id) return;
    if (
      !confirm(
        `Remove this fee assignment from ${ids.length} pupil(s)? This cannot be undone from here.`
      )
    ) {
      return;
    }
    setIsBulkDeleting(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const pupilId of ids) {
        const pupil = pupils.find((p) => p.id === pupilId);
        if (!pupil) {
          fail++;
          continue;
        }
        try {
          const current = pupil.assignedFees || [];
          const updated = current.filter((a) => a.feeStructureId !== feeStructure.id);
          await PupilsService.updatePupil(pupil.id, { assignedFees: updated });
          ok++;
        } catch {
          fail++;
        }
      }
      setSelectedForBulkDeleteIds(new Set());
      await refreshAssignmentCaches();
      if (fail > 0) {
        toast({
          variant: "destructive",
          title: "Bulk delete finished with errors",
          description: `Removed from ${ok} pupil(s); ${fail} failed.`,
        });
      } else {
        toast({
          title: "Assignments removed",
          description: `This fee was removed from ${ok} pupil(s).`,
        });
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const assignablePupils = useMemo(() => {
    if (!feeStructure) return [];
    const alreadyAssigned = new Set(assignmentRecords.map((record) => record.pupil.id));
    const filtered = pupils
      .filter((pupil) => !alreadyAssigned.has(pupil.id))
      .filter((pupil) => (filterClassId === "all" ? true : pupil.classId === filterClassId))
      .filter((pupil) => (filterSection === "all" ? true : (pupil.section || "").toLowerCase() === filterSection.toLowerCase()))
      .filter((pupil) =>
        filterStatus === "all"
          ? true
          : (pupil.status || "Active").toLowerCase() === filterStatus.toLowerCase()
      )
      .filter((pupil) => {
        if (!searchText.trim()) return true;
        const q = searchText.trim().toLowerCase();
        return (
          (pupil.firstName || "").toLowerCase().includes(q) ||
          (pupil.lastName || "").toLowerCase().includes(q) ||
          (pupil.admissionNumber || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const nameA = `${a.lastName || ""} ${a.firstName || ""}`.trim().toLowerCase();
        const nameB = `${b.lastName || ""} ${b.firstName || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
    return filtered;
  }, [assignmentRecords, pupils, feeStructure, filterClassId, filterSection, filterStatus, searchText]);

  const toggleSelectedPupil = (pupilId: string) => {
    setSelectedPupilIds(prev => {
      const next = new Set(prev);
      if (next.has(pupilId)) next.delete(pupilId);
      else next.add(pupilId);
      return next;
    });
  };

  // --- Modify logic ---
  useEffect(() => {
    if (!modifyFetchYearId && academicYears.length > 0) {
      const effective = getEffectiveTermForDataDisplay(academicYears);
      const year =
        effective.academicYear ||
        detectCurrentAcademicYear(academicYears) ||
        activeAcademicYear ||
        academicYears[0];
      if (year) {
        setModifyFetchYearId(year.id);
        const term =
          (effective.academicYear?.id === year.id ? effective.term : undefined) ||
          getCurrentTermForYear(year) ||
          getActiveOrMostRecentTerm(year) ||
          year.terms[0];
        if (term) setModifyFetchTermId(term.id);
      }
    }
  }, [academicYears, activeAcademicYear, modifyFetchYearId]);

  useEffect(() => {
    if (!modifyTargetYearId && academicYears.length > 0) {
      const effective = getEffectiveTermForDataDisplay(academicYears);
      const year =
        effective.academicYear ||
        detectCurrentAcademicYear(academicYears) ||
        activeAcademicYear ||
        academicYears[0];
      if (year) {
        setModifyTargetYearId(year.id);
        const term =
          (effective.academicYear?.id === year.id ? effective.term : undefined) ||
          getCurrentTermForYear(year) ||
          getActiveOrMostRecentTerm(year) ||
          year.terms[0];
        if (term) setModifyTargetTermId(term.id);
      }
    }
  }, [academicYears, activeAcademicYear, modifyTargetYearId]);

  const fetchedModifyPupils = useMemo(() => {
    if (!feeStructure || !modifyFetchYearId || !modifyFetchTermId || !modifyTargetYearId || !modifyTargetTermId) return [];

    return pupils.filter((pupil) => {
      // Must have an active assignment in the "fetch" context
      const allFees = pupil.assignedFees || [];
      const fetchAssignment = allFees.find((af) =>
        af.feeStructureId === feeStructure.id &&
        af.status === "active" &&
        isAssignmentValidForContext(af, modifyFetchYearId, modifyFetchTermId, academicYears)
      );

      if (!fetchAssignment) return false;

      const targetIsActive = allFees.some((af) =>
        af.feeStructureId === feeStructure.id &&
        af.status === "active" &&
        isAssignmentValidForContext(af, modifyTargetYearId, modifyTargetTermId, academicYears)
      );

      if (modifyAction === "extend") {
        return !targetIsActive; // extend: shouldn't have it yet
      } else {
        return targetIsActive; // constrain: should currently have it
      }
    });
  }, [pupils, feeStructure, modifyFetchYearId, modifyFetchTermId, modifyTargetYearId, modifyTargetTermId, modifyAction, academicYears]);

  const toggleSelectedModifyPupil = (pupilId: string) => {
    setModifySelectedPupilIds((prev) => {
      const next = new Set(prev);
      if (next.has(pupilId)) next.delete(pupilId);
      else next.add(pupilId);
      return next;
    });
  };

  const handleModifySelected = async () => {
    setIsModifying(true);
    try {
      if (!feeStructure || modifySelectedPupilIds.size === 0) {
        toast({
          variant: "destructive",
          title: "No pupils selected",
          description: "Select one or more pupils to modify.",
        });
        return;
      }

      const selectedPupils = pupils.filter((p) => modifySelectedPupilIds.has(p.id));

      for (const pupil of selectedPupils) {
        let currentAssigned = [...(pupil.assignedFees || [])];

        if (modifyAction === "extend") {
          const extension: PupilAssignedFee = {
            id: `assign-extend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            feeStructureId: feeStructure.id,
            assignedAt: new Date().toISOString(),
            assignedBy: "System Admin",
            status: "active",
            validityType: "specific_year",
            startAcademicYearId: modifyTargetYearId,
            termApplicability: "specific_terms",
            applicableTermIds: [modifyTargetTermId],
            notes: "Extended assignment",
            statusHistory: [
              {
                date: new Date().toISOString(),
                action: "enabled",
                newStatus: "active",
                processedBy: "System Admin",
              },
            ],
          };
          currentAssigned = upsertPupilFeeAssignment(
            currentAssigned,
            extension,
            academicYears,
          ).assignments;
        } else if (modifyAction === "constrain") {
          currentAssigned = currentAssigned.map((af) => {
            if (
              af.feeStructureId === feeStructure.id &&
              af.status === "active" &&
              isAssignmentValidForContext(af, modifyTargetYearId, modifyTargetTermId, academicYears)
            ) {
              let newTermIds: string[] = [];
              let newExcludedIds: string[] = [...(af.excludedTermIds || [])];

              if (af.termApplicability === "all_terms") {
                // Instead of converting an indefinite/all_terms assignment to specific terms,
                // we explicitly exclude this term ID to punch a hole while preserving its future applicability
                if (!newExcludedIds.includes(modifyTargetTermId)) {
                  newExcludedIds.push(modifyTargetTermId);
                }
              } else {
                newTermIds = (af.applicableTermIds || []).filter(id => id !== modifyTargetTermId);
              }

              const newStatus = (af.termApplicability === "specific_terms" && newTermIds.length === 0) ? "disabled" : "active";

              return {
                ...af,
                ...(af.termApplicability === "specific_terms" ? { applicableTermIds: newTermIds } : { excludedTermIds: newExcludedIds }),
                status: newStatus as "active" | "disabled",
                statusHistory: [
                  ...(af.statusHistory || []),
                  {
                    date: new Date().toISOString(),
                    action: "time_adjusted" as const,
                    previousStatus: "active",
                    newStatus: newStatus as "active" | "disabled",
                    processedBy: "System Admin",
                    reason: "Constrained from modifying action",
                  },
                ],
              };
            }
            return af;
          });
        }
        await PupilsService.updatePupil(pupil.id, { assignedFees: currentAssigned });
      }

      toast({
        title: `Assignments ${modifyAction === "extend" ? "Extended" : "Constrained"}`,
        description: `${modifySelectedPupilIds.size} pupil(s) modified successfully.`,
      });

      setModifySelectedPupilIds(new Set());
      setIsModifyModalOpen(false);
      await refreshAssignmentCaches();
    } catch (error) {
      console.error("Error modifying pupil:", error);
      toast({
        variant: "destructive",
        title: "Unable to modify",
        description: (error as Error)?.message || "Please try again.",
      });
    } finally {
      setIsModifying(false);
    }
  };
  // --- End Modify logic ---

  const handleAssignSelected = async () => {
    setIsAssigning(true);
    try {
      if (!feeStructure || selectedPupilIds.size === 0) {
        toast({
          variant: "destructive",
          title: "No pupils selected",
          description: "Select one or more pupils to assign.",
        });
        return;
      }

      const timestamp = Date.now();
      const assignmentsToApply: PupilAssignedFee = {
        id: `assign-${timestamp}`,
        feeStructureId: feeStructure.id,
        assignedAt: new Date().toISOString(),
        assignedBy: "System Admin",
        status: "active",
        validityType: assignTimeSettings.validityType,
        startAcademicYearId: assignTimeSettings.startAcademicYearId,
        endAcademicYearId: assignTimeSettings.endAcademicYearId,
        termApplicability: assignTimeSettings.termApplicability,
        applicableTermIds:
          assignTimeSettings.termApplicability === 'specific_terms'
            ? assignTimeSettings.applicableTermIds
            : undefined,
        notes: notes.trim() || undefined,
        statusHistory: [
          {
            date: new Date().toISOString(),
            action: "enabled",
            newStatus: "active",
            processedBy: "System Admin",
          },
        ],
      };

      const selectedPupils = pupils.filter(p => selectedPupilIds.has(p.id));
      let createdCount = 0;
      let mergedCount = 0;
      let unchangedCount = 0;
      for (const pupil of selectedPupils) {
        const result = upsertPupilFeeAssignment(
          pupil.assignedFees,
          {
            ...assignmentsToApply,
            id: `assign-${timestamp}-${pupil.id}`,
          },
          academicYears,
        );

        if (result.outcome === 'created') createdCount++;
        else if (result.outcome === 'merged') mergedCount++;
        else unchangedCount++;

        if (result.outcome !== 'unchanged') {
          await PupilsService.updatePupil(pupil.id, {
            assignedFees: result.assignments,
          });
        }
      }

      toast({
        title: "Assignments updated",
        description: [
          createdCount ? `${createdCount} created` : '',
          mergedCount ? `${mergedCount} extended/consolidated` : '',
          unchangedCount ? `${unchangedCount} already covered` : '',
        ].filter(Boolean).join(', ') + `. No overlapping records were added for "${feeStructure.name}".`,
      });

      setSelectedPupilIds(new Set());
      setAssignTimeSettings(DEFAULT_ASSIGNMENT_TIME_SETTINGS);
      setNotes("");
      setIsAssignModalOpen(false);
      await refreshAssignmentCaches();
    } catch (error) {
      console.error("Error assigning pupil:", error);
      toast({
        variant: "destructive",
        title: "Unable to assign",
        description: (error as Error)?.message || "Please try again.",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const getYearName = (yearId?: string) => {
    if (!yearId) return "All Years";
    return academicYears.find((year) => year.id === yearId)?.name || yearId;
  };

  const getTermName = (termId?: string) => {
    if (!termId) return "All Terms";
    for (const year of academicYears) {
      const term = year.terms?.find((t) => t.id === termId);
      if (term) {
        return `${term.name} (${year.name})`;
      }
    }
    return termId;
  };

  const getTermApplicability = (assignment: PupilAssignedFee) => {
    if (assignment.termApplicability === "all_terms") {
      return "All terms";
    }

    if (!assignment.applicableTermIds || assignment.applicableTermIds.length === 0) {
      return "Specific terms (not provided)";
    }

    return assignment.applicableTermIds.map((termId) => getTermName(termId)).join(", ");
  };

  const getValidityLabel = (assignment: PupilAssignedFee) => {
    switch (assignment.validityType) {
      case "indefinite":
        return "Indefinite";
      case "current_term":
        return "Current term only";
      case "current_year":
        return "Current academic year";
      case "specific_year":
        return `Specific year: ${getYearName(assignment.startAcademicYearId)}`;
      case "year_range":
        return `Year range: ${getYearName(assignment.startAcademicYearId)} → ${getYearName(
          assignment.endAcademicYearId
        )}`;
      case "specific_terms":
        return "Specific terms";
      default:
        return assignment.validityType;
    }
  };

  const yearSelectorDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-[34px] min-w-[95px] rounded-full border border-blue-200/60 bg-white/90 px-2.5 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50"
        >
          {(academicYears.find(y => y.id === selectedYearId)?.name) || "Year"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px] max-h-[70vh] overflow-y-auto bg-white border shadow-lg z-[999999]">
        <DropdownMenuLabel className="text-xs sticky top-0 bg-popover z-10">Select Year</DropdownMenuLabel>
        {academicYears.map(y => (
          <DropdownMenuItem
            key={y.id}
            onClick={() => {
              setSelectedYearId(y.id);
              const globalEffective = getEffectiveTermForDataDisplay(academicYears);
              if (
                globalEffective.term?.id &&
                globalEffective.academicYear?.id === y.id
              ) {
                setSelectedTermId(globalEffective.term.id);
                return;
              }
              const cur =
                getCurrentTermForYear(y) ||
                getActiveOrMostRecentTerm(y) ||
                y.terms?.[0];
              if (cur?.id) setSelectedTermId(cur.id);
            }}
          >
            {y.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const termSelectorDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-[34px] min-w-[95px] rounded-full border border-blue-200/60 bg-white/90 px-2.5 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50"
          disabled={!selectedYearId}
        >
          {(selectedYearId && academicYears.find(y => y.id === selectedYearId)?.terms.find(t => t.id === selectedTermId)?.name) || "Term"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] max-h-[50vh] overflow-y-auto bg-white border shadow-lg z-[999999]">
        <DropdownMenuLabel className="text-xs sticky top-0 bg-popover z-10">Select Term</DropdownMenuLabel>
        {(selectedYearId
          ? academicYears.find(y => y.id === selectedYearId)?.terms || []
          : []
        ).map(t => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setSelectedTermId(t.id)}
          >
            {t.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isLoadingFee || isLoadingPupils || isFetchingAssignments) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Assign Details"
          subtitle="Loading assignment information..."
          backHref="/assign"
          backLabel="Back to assign"
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card className="p-10 flex justify-center">
            <LoadingIndicator isLoading size="lg" text="Loading assignment details..." />
          </Card>
        </div>
      </div>
    );
  }

  if (isFeeError || isPupilsError || isAssignmentsError) {
    const message =
      (feeError as Error)?.message ||
      (pupilsError as Error)?.message ||
      (assignmentsError as Error)?.message ||
      "Unable to load assignment details. Please try again.";

    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Assign Details"
          subtitle="View assignment usage and payments."
          backHref="/assign"
          backLabel="Back to assign"
        />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!feeStructure) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Assign Details"
          subtitle="View assignment usage and payments."
          backHref="/assign"
          backLabel="Back to assign"
        />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <Alert>
            <AlertTitle>Fee structure not found</AlertTitle>
            <AlertDescription>The requested assignment fee could not be located.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animate-in fade-in duration-500">
      <GlassPageTopBar
        title={feeStructure.name}
        subtitle="View assignment usage and payments."
        backHref="/assign"
        backLabel="Back to assign"
        titleControls={
          <div className="flex items-center gap-1.5 lg:hidden">
            {yearSelectorDropdown}
            {termSelectorDropdown}
          </div>
        }
        center={
          <div className="hidden lg:flex items-center gap-2">
            {yearSelectorDropdown}
            {termSelectorDropdown}
          </div>
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Modify"
              icon={<Sliders className="h-4 w-4" />}
              tone="violet"
              onClick={() => setIsModifyModalOpen(true)}
            />
            <GlassActionButton
              label="Assign"
              icon={<UserPlus className="h-4 w-4" />}
              tone="orange"
              onClick={() => setIsAssignModalOpen(true)}
              disabled={isAssignDisabled}
            />
          </GlassActionDock>
        }
      />
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      <div className="grid gap-3 lg:grid-cols-4">
        <Card className="py-2">
          <CardHeader className="py-2">
            <CardTitle className="text-xs text-muted-foreground">Assignments</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <p className="text-2xl font-semibold leading-6">{summary.totalAssigned}</p>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardHeader className="py-2">
            <CardTitle className="text-xs text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <p className="text-2xl font-semibold leading-6">{formatCurrency(summary.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardHeader className="py-2">
            <CardTitle className="text-xs text-muted-foreground">Amount Paid</CardTitle>
          </CardHeader>
          <CardContent className="py-2 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-500" />
            <p className="text-2xl font-semibold leading-6 text-emerald-600">{formatCurrency(summary.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardHeader className="py-2">
            <CardTitle className="text-xs text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <p className="text-2xl font-semibold leading-6 text-amber-600">
              {formatCurrency(summary.outstanding)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-100">
        <CardHeader className="py-2">
          <CardTitle>Assignment Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {assignmentRecords.length === 0 ? (
            <Alert>
              <AlertTitle>No active assignments</AlertTitle>
              <AlertDescription>
                No pupils are currently assigned to this fee or discount.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {!isSelectedPast && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    {selectedForBulkDeleteIds.size > 0
                      ? `${selectedForBulkDeleteIds.size} pupil(s) selected for removal.`
                      : "Select one or more pupils, then delete this fee assignment from all of them at once."}
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={selectedForBulkDeleteIds.size === 0 || isBulkDeleting}
                    onClick={handleBulkDeleteAssignments}
                  >
                    {isBulkDeleting ? "Deleting…" : "Delete selected"}
                  </Button>
                </div>
              )}
              <div className="rounded-xl border border-blue-50 shadow-inner shadow-blue-100/40">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50/70">
                    {!isSelectedPast && (
                      <TableHead className="w-10 align-middle">
                        <Checkbox
                          checked={
                            bulkAllSelected
                              ? true
                              : bulkSomeSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={() => toggleBulkSelectAll()}
                          aria-label="Select all assignments in this list"
                        />
                      </TableHead>
                    )}
                    <TableHead>Pupil</TableHead>
                    <TableHead>Period & Terms</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    {!isSelectedPast && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentRecords.map((record) => (
                    <Fragment key={record.pupil.id}>
                      <TableRow>
                        {!isSelectedPast && (
                          <TableCell className="w-10 align-middle">
                            <Checkbox
                              checked={selectedForBulkDeleteIds.has(record.pupil.id)}
                              onCheckedChange={() => toggleBulkSelectOne(record.pupil.id)}
                              aria-label={`Select ${record.pupil.firstName} ${record.pupil.lastName}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium space-y-1">
                          <div>
                            <Link
                              href={`/fees/collect/${record.pupil.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {record.pupil.firstName} {record.pupil.lastName}
                            </Link>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ADM: {record.pupil.admissionNumber || "N/A"} •{" "}
                            {record.pupil.classCode || record.pupil.className || "Class"} ({record.pupil.section || "Section"})
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{getValidityLabel(record.assignment)}</div>
                          <div className="text-xs text-muted-foreground">{getTermApplicability(record.assignment)}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(feeStructure.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600 hover:text-emerald-700"
                            onClick={() => toggleRow(record.pupil.id)}
                          >
                            {formatCurrency(record.totalPaid)}
                            {expandedRows.has(record.pupil.id) ? (
                              <ChevronUp className="w-4 h-4 ml-2" />
                            ) : (
                              <ChevronDown className="w-4 h-4 ml-2" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right font-medium text-amber-600">
                          {formatCurrency(record.balance)}
                        </TableCell>
                        {!isSelectedPast && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditTargetPupil(record.pupil);
                                  setEditTimeSettings({
                                    validityType: record.assignment.validityType,
                                    startAcademicYearId: record.assignment.startAcademicYearId,
                                    endAcademicYearId: record.assignment.endAcademicYearId,
                                    termApplicability:
                                      record.assignment.termApplicability ?? 'all_terms',
                                    applicableTermIds: record.assignment.applicableTermIds,
                                  });
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const current = record.pupil.assignedFees || [];
                                    const updated = current.map(a => {
                                      if (a.feeStructureId === (feeStructure?.id || "")) {
                                        return {
                                          ...a,
                                          status: "disabled" as const,
                                          statusHistory: [
                                            ...(a.statusHistory || []),
                                            {
                                              date: new Date().toISOString(),
                                              action: "disabled",
                                              previousStatus: a.status as "active" | "disabled",
                                              newStatus: "disabled" as const,
                                              processedBy: "System Admin",
                                            },
                                          ],
                                        };
                                      }
                                      return a;
                                    });
                                    await PupilsService.updatePupil(record.pupil.id, { assignedFees: updated });
                                    toast({ title: "Assignment disabled", description: `${record.pupil.firstName} ${record.pupil.lastName}` });
                                    await refreshAssignmentCaches();
                                  } catch (e) {
                                    toast({ variant: "destructive", title: "Disable failed" });
                                  }
                                }}
                              >
                                Disable
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  if (!confirm(`Remove this assignment from ${record.pupil.firstName} ${record.pupil.lastName}?`)) return;
                                  try {
                                    const current = record.pupil.assignedFees || [];
                                    const updated = current.filter(a => a.feeStructureId !== (feeStructure?.id || ""));
                                    await PupilsService.updatePupil(record.pupil.id, { assignedFees: updated });
                                    toast({ title: "Assignment removed" });
                                    await refreshAssignmentCaches();
                                  } catch (e) {
                                    toast({ variant: "destructive", title: "Delete failed" });
                                  }
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setHistoryTargetPupil(record.pupil);
                                  setIsHistoryOpen(true);
                                }}
                              >
                                History
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        )}
                      </TableRow>
                      {expandedRows.has(record.pupil.id) && (
                        <TableRow className="bg-blue-50/40">
                          <TableCell colSpan={!isSelectedPast ? 7 : 5} className="p-4">
                            {record.payments.length === 0 ? (
                              <Alert>
                                <Info className="w-4 h-4" />
                                <AlertDescription>
                                  No payment history recorded for this assignment yet.
                                </AlertDescription>
                              </Alert>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-sm font-semibold">Payment History</p>
                                <div className="rounded-lg border bg-white">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Recorded By</TableHead>
                                        <TableHead>Notes</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {record.payments.map((payment) => (
                                        <TableRow key={payment.id}>
                                          <TableCell>
                                            {new Date(payment.paymentDate).toLocaleString()}
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            {formatCurrency(payment.amount)}
                                          </TableCell>
                                          <TableCell>
                                            {payment.paidBy?.name || payment.paidBy?.id || "N/A"}
                                          </TableCell>
                                          <TableCell className="text-xs text-muted-foreground">
                                            {payment.notes || "—"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Pupils Modal */}
      <Dialog
        open={isAssignModalOpen}
        onOpenChange={(open) => {
          setIsAssignModalOpen(open);
          if (!open) {
            setAssignTimeSettings(DEFAULT_ASSIGNMENT_TIME_SETTINGS);
            setNotes("");
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Assign pupils to {feeStructure.name}</DialogTitle>
            <DialogDescription>Select one or more pupils and set assignment options.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Filters + Pupil list */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label>Class</Label>
                  <Select value={filterClassId} onValueChange={setFilterClassId}>
                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {[...new Set(pupils.map(p => p.classId).filter(Boolean))].map(id => (
                        <SelectItem key={id as string} value={id as string}>
                          {pupils.find(p => p.classId === id)?.classCode || pupils.find(p => p.classId === id)?.className || id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Section</Label>
                  <Select value={filterSection} onValueChange={setFilterSection}>
                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {[...new Set(pupils.map(p => (p.section || "").trim()).filter(Boolean))].map(sec => (
                        <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger><SelectValue placeholder="Active" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Graduated">Graduated</SelectItem>
                      <SelectItem value="Transferred">Transferred</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Search</Label>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Name or Admission..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 w-8"></th>
                      <th className="text-left p-2">Pupil</th>
                      <th className="text-left p-2">Class</th>
                      <th className="text-left p-2">Section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignablePupils.map(p => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">
                          <Checkbox
                            checked={selectedPupilIds.has(p.id)}
                            onCheckedChange={() => toggleSelectedPupil(p.id)}
                          />
                        </td>
                        <td className="p-2">{p.firstName} {p.lastName}</td>
                        <td className="p-2">{p.classCode || p.className || "N/A"}</td>
                        <td className="p-2">{p.section || "N/A"}</td>
                      </tr>
                    ))}
                    {assignablePupils.length === 0 && (
                      <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No pupils match the filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Time Management + Notes */}
            <div className="space-y-4">
              <AssignmentTimeManagementForm
                academicYears={academicYears}
                settings={assignTimeSettings}
                onSettingsChange={setAssignTimeSettings}
              />
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes for this assignment"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="pt-2">
                <Button
                  disabled={selectedPupilIds.size === 0 || isAssigning}
                  onClick={handleAssignSelected}
                  className="w-full"
                >
                  {isAssigning ? "Assigning..." : `Assign to ${selectedPupilIds.size} pupil(s)`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modify Modal */}
      <Dialog open={isModifyModalOpen} onOpenChange={setIsModifyModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Modify Assignments for {feeStructure.name}</DialogTitle>
            <DialogDescription>Extend or constrain assignments for pupils based on specific terms.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex gap-2 border-b pb-2">
                <Button
                  variant={modifyAction === "extend" ? "default" : "outline"}
                  onClick={() => setModifyAction("extend")}
                  className="w-1/2"
                >
                  Extend
                </Button>
                <Button
                  variant={modifyAction === "constrain" ? "default" : "outline"}
                  onClick={() => setModifyAction("constrain")}
                  className="w-1/2"
                >
                  Constrain
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fetch From</Label>
                  <Select value={modifyFetchYearId} onValueChange={setModifyFetchYearId}>
                    <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                    <SelectContent>
                      {academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={modifyFetchTermId} onValueChange={setModifyFetchTermId}>
                    <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
                    <SelectContent>
                      {(modifyFetchYearId ? academicYears.find(y => y.id === modifyFetchYearId)?.terms || [] : []).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{modifyAction === "extend" ? "Extend To" : "Constrain From"}</Label>
                  <Select value={modifyTargetYearId} onValueChange={setModifyTargetYearId}>
                    <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                    <SelectContent>
                      {academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={modifyTargetTermId} onValueChange={setModifyTargetTermId}>
                    <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
                    <SelectContent>
                      {(modifyTargetYearId ? academicYears.find(y => y.id === modifyTargetYearId)?.terms || [] : []).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button
                  disabled={modifySelectedPupilIds.size === 0 || isModifying}
                  onClick={handleModifySelected}
                  className="w-full"
                >
                  {isModifying ? "Modifying..." : `${modifyAction === "extend" ? "Extend" : "Constrain"} selected (${modifySelectedPupilIds.size} pupil${modifySelectedPupilIds.size === 1 ? '' : 's'})`}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Select Pupils</Label>
              <div className="max-h-[300px] overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 w-8">
                        <Checkbox
                          checked={fetchedModifyPupils.length > 0 && modifySelectedPupilIds.size === fetchedModifyPupils.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setModifySelectedPupilIds(new Set(fetchedModifyPupils.map(p => p.id)));
                            } else {
                              setModifySelectedPupilIds(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="text-left p-2">Pupil Name</th>
                      <th className="text-left p-2">Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fetchedModifyPupils.map(p => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">
                          <Checkbox
                            checked={modifySelectedPupilIds.has(p.id)}
                            onCheckedChange={() => toggleSelectedModifyPupil(p.id)}
                          />
                        </td>
                        <td className="p-2">{p.firstName} {p.lastName}</td>
                        <td className="p-2">{p.classCode || p.className || "N/A"}</td>
                      </tr>
                    ))}
                    {fetchedModifyPupils.length === 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No pupils match the current criteria.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Edit Time Settings Modal */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditTargetPupil(null);
            setEditTimeSettings(DEFAULT_ASSIGNMENT_TIME_SETTINGS);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
            <DialogDescription>Update validity period and term applicability.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <AssignmentTimeManagementForm
              academicYears={academicYears}
              settings={editTimeSettings}
              onSettingsChange={setEditTimeSettings}
            />
            <div className="pt-2">
              <Button
                onClick={async () => {
                  if (!editTargetPupil || !feeStructure) {
                    setIsEditDialogOpen(false);
                    return;
                  }
                  try {
                    const updated = (editTargetPupil.assignedFees || []).map(a => {
                      if (a.feeStructureId === feeStructure.id) {
                        return {
                          ...a,
                          validityType: editTimeSettings.validityType,
                          startAcademicYearId: editTimeSettings.startAcademicYearId,
                          endAcademicYearId: editTimeSettings.endAcademicYearId,
                          termApplicability: editTimeSettings.termApplicability,
                          applicableTermIds:
                            editTimeSettings.termApplicability === 'specific_terms'
                              ? editTimeSettings.applicableTermIds
                              : undefined,
                          statusHistory: [
                            ...(a.statusHistory || []),
                            {
                              date: new Date().toISOString(),
                              action: "time_adjusted" as const,
                              previousStatus: a.status as "active" | "disabled",
                              newStatus: a.status as "active" | "disabled",
                              processedBy: "System Admin",
                            },
                          ],
                        };
                      }
                      return a;
                    });
                    await PupilsService.updatePupil(editTargetPupil.id, { assignedFees: updated });
                    toast({ title: "Assignment updated" });
                    setIsEditDialogOpen(false);
                    await refreshAssignmentCaches();
                  } catch (e) {
                    toast({ variant: "destructive", title: "Update failed" });
                  }
                }}
                className="w-full"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assignment History</DialogTitle>
            <DialogDescription>Status changes for this assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {!historyTargetPupil || !(historyTargetPupil.assignedFees || []).some(a => a.feeStructureId === (feeStructure?.id || "")) ? (
              <p className="text-muted-foreground">No history available.</p>
            ) : (
              <>
                {(historyTargetPupil.assignedFees || [])
                  .find(a => a.feeStructureId === (feeStructure?.id || ""))!
                  .statusHistory?.map((h, idx) => (
                    <div key={idx} className="rounded border p-2">
                      <div className="font-medium">{h.action}</div>
                      <div className="text-xs text-muted-foreground">{new Date(h.date).toLocaleString()}</div>
                    </div>
                  )) || <p className="text-muted-foreground">No history entries.</p>}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>  {/* close max-w-7xl */}
    </div>
  );
}

