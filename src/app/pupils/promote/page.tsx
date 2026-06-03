"use client";

import * as React from "react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { PromotionHistoryDialog } from "@/components/pupils/PromotionHistoryDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, ArrowRight, CheckCircle, TrendingDown, TrendingUp, GraduationCap, History, Filter, Search } from "lucide-react";
import type { Pupil, Class, GraduatePupilsData } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { usePupils, useUpdatePupil } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useCreatePLERecord, useP7Pupils } from "@/lib/hooks/use-ple-results";
import { useCreatePromotionBatch } from "@/lib/hooks/use-promotion-batches";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function PromotePupilsPage() {
  const { toast } = useToast();

  // Firebase hooks
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const { data: activeAcademicYear, isLoading: academicYearLoading } = useActiveAcademicYear();
  const updatePupilMutation = useUpdatePupil();

  const [fromClassId, setFromClassId] = React.useState<string>("");
  const [toClassId, setToClassId] = React.useState<string>("");
  const [selectedPupilIds, setSelectedPupilIds] = React.useState<string[]>([]);
  const [promotionType, setPromotionType] = React.useState<'Promotion' | 'Demotion' | 'Transfer' | null>(null);
  const [showGraduateDialog, setShowGraduateDialog] = React.useState(false);
  const [graduationYear, setGraduationYear] = React.useState<number>(new Date().getFullYear());
  const [createPLERecord, setCreatePLERecord] = React.useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = React.useState(false);
  const [registrationYearFilterActive, setRegistrationYearFilterActive] = React.useState(false);
  const [currentYearPupilIds, setCurrentYearPupilIds] = React.useState<string[]>([]);
  const [previousYearsPupilIds, setPreviousYearsPupilIds] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");

  // PLE hooks
  const createPLERecordMutation = useCreatePLERecord();
  const { data: p7Pupils = [] } = useP7Pupils();

  // Promotion batch hook
  const createPromotionBatchMutation = useCreatePromotionBatch();

  // Reset form state function
  const resetFormState = () => {
    setFromClassId("");
    setToClassId("");
    setSelectedPupilIds([]);
    setPromotionType(null);
  };

  // Helper function to check if a class is P7
  const isP7Class = React.useCallback((classId: string) => {
    const classItem = allClasses.find(c => c.id === classId);
    if (!classItem) return false;

    const className = (classItem.name || '').toUpperCase();
    const classCode = (classItem.code || '').toUpperCase();

    return (
      className === 'P.7' ||
      className === 'PRIMARY SEVEN' ||
      className === 'PRIMARY 7' ||
      className === 'P7' ||
      className === 'GRADE 7' ||
      className === 'YEAR 7' ||
      classCode === 'P.7' ||
      classCode === 'P7' ||
      (className.includes('SEVEN') && (classItem.level === 'Upper Primary' || classItem.level === 'Primary'))
    );
  }, [allClasses]);

  // Derived data
  const pupilsInFromClass = React.useMemo(() => {
    if (!fromClassId) return [];

    const classPupils = allPupils.filter(p => p.classId === fromClassId && p.status === 'Active');

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = classPupils.filter(p => {
        const fullName = `${p.firstName} ${p.lastName} ${p.otherNames || ''}`.toLowerCase();
        return fullName.includes(query);
      });
      // Sort alphabetically by lastName
      return filtered.sort((a, b) => a.lastName.localeCompare(b.lastName));
    }

    // Sort alphabetically by lastName
    return classPupils.sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [allPupils, fromClassId, searchQuery]);

  // Split pupils by registration year when filter is active
  const { previousYearsPupils, currentYearPupils } = React.useMemo(() => {
    if (!registrationYearFilterActive) {
      return { previousYearsPupils: pupilsInFromClass, currentYearPupils: [] };
    }

    // Use current calendar year instead of academic year
    const currentCalendarYear = new Date().getFullYear();
    const previous: Pupil[] = [];
    const current: Pupil[] = [];

    pupilsInFromClass.forEach(pupil => {
      if (pupil.registrationDate) {
        const registrationYear = new Date(pupil.registrationDate).getFullYear();
        if (registrationYear >= currentCalendarYear) {
          current.push(pupil);
        } else {
          previous.push(pupil);
        }
      } else {
        // If no registration date, treat as previous years
        previous.push(pupil);
      }
    });

    // Sort both arrays alphabetically by lastName
    previous.sort((a, b) => a.lastName.localeCompare(b.lastName));
    current.sort((a, b) => a.lastName.localeCompare(b.lastName));

    return { previousYearsPupils: previous, currentYearPupils: current };
  }, [pupilsInFromClass, registrationYearFilterActive]);

  // Check if selected class is P7
  const isSelectedClassP7 = React.useMemo(() =>
    fromClassId ? isP7Class(fromClassId) : false,
    [fromClassId, isP7Class]
  );

  React.useEffect(() => {
    setSelectedPupilIds([]); // Reset selection when from class changes
    setCurrentYearPupilIds([]);
    setPreviousYearsPupilIds([]);
    setSearchQuery(""); // Clear search when changing class
  }, [fromClassId]);

  // Update separate selections when filter toggle changes
  React.useEffect(() => {
    if (registrationYearFilterActive) {
      // Split current selections into two groups
      const currentIds = selectedPupilIds.filter(id =>
        currentYearPupils.some(p => p.id === id)
      );
      const previousIds = selectedPupilIds.filter(id =>
        previousYearsPupils.some(p => p.id === id)
      );
      setCurrentYearPupilIds(currentIds);
      setPreviousYearsPupilIds(previousIds);
    } else {
      // Merge selections when filter is deactivated
      const merged = [...new Set([...currentYearPupilIds, ...previousYearsPupilIds])];
      setSelectedPupilIds(merged);
    }
  }, [registrationYearFilterActive]);

  React.useEffect(() => {
    if (fromClassId && toClassId) {
      const fromClass = allClasses.find(c => c.id === fromClassId);
      const toClass = allClasses.find(c => c.id === toClassId);
      if (fromClass && toClass) {
        if (toClass.order > fromClass.order) {
          setPromotionType("Promotion");
        } else if (toClass.order < fromClass.order) {
          setPromotionType("Demotion");
        } else {
          setPromotionType("Transfer");
        }
      } else {
        setPromotionType(null);
      }
    } else {
      setPromotionType(null);
    }
  }, [fromClassId, toClassId, allClasses]);

  const handleSelectAll = (checked: boolean | string) => {
    if (checked === true || checked === 'indeterminate' && pupilsInFromClass.length > 0) {
      setSelectedPupilIds(pupilsInFromClass.map(p => p.id));
    } else {
      setSelectedPupilIds([]);
    }
  };

  const handleSelectPupil = (pupilId: string, checked: boolean | string) => {
    if (checked === true) {
      setSelectedPupilIds(prev => [...prev, pupilId]);
    } else {
      setSelectedPupilIds(prev => prev.filter(id => id !== pupilId));
    }
  };

  // Separate handlers for registration year filter
  const handleSelectAllPreviousYears = (checked: boolean | string) => {
    if (checked === true || checked === 'indeterminate') {
      setPreviousYearsPupilIds(previousYearsPupils.map(p => p.id));
    } else {
      setPreviousYearsPupilIds([]);
    }
  };

  const handleSelectPupilPreviousYears = (pupilId: string, checked: boolean | string) => {
    if (checked === true) {
      setPreviousYearsPupilIds(prev => [...prev, pupilId]);
    } else {
      setPreviousYearsPupilIds(prev => prev.filter(id => id !== pupilId));
    }
  };

  const handleSelectAllCurrentYear = (checked: boolean | string) => {
    if (checked === true || checked === 'indeterminate') {
      setCurrentYearPupilIds(currentYearPupils.map(p => p.id));
    } else {
      setCurrentYearPupilIds([]);
    }
  };

  const handleSelectPupilCurrentYear = (pupilId: string, checked: boolean | string) => {
    if (checked === true) {
      setCurrentYearPupilIds(prev => [...prev, pupilId]);
    } else {
      setCurrentYearPupilIds(prev => prev.filter(id => id !== pupilId));
    }
  };

  const handleGraduatePupils = async () => {
    const pupilIdsToProcess = getSelectedPupilIdsForProcessing();
    if (!fromClassId || pupilIdsToProcess.length === 0 || !activeAcademicYear) {
      toast({
        title: "Missing Information",
        description: "Please select a class and at least one pupil to graduate.",
        variant: "destructive",
      });
      return;
    }

    const fromClass = allClasses.find(c => c.id === fromClassId);
    if (!fromClass) {
      toast({ title: "Error", description: "Selected class not found.", variant: "destructive" });
      return;
    }

    try {
      let processedCount = 0;
      const graduationDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format (actual date of graduation action)

      // Get selected pupils
      const selectedPupils = pupilIdsToProcess.map(id => allPupils.find(p => p.id === id)).filter(Boolean) as Pupil[];

      // Create PLE record if checkbox is checked
      if (createPLERecord) {
        try {
          // Filter to only active P7 pupils for PLE record (exclude already graduated)
          const p7SelectedPupils = selectedPupils.filter(pupil => {
            // Only include active pupils (exclude graduated)
            if (pupil.status !== 'Active') return false;

            // Check if pupil is in P7 class
            return isP7Class(pupil.classId || '');
          });

          if (p7SelectedPupils.length > 0) {
            // Create snapshot of pupils for PLE record
            const pupilsSnapshot = p7SelectedPupils.map(pupil => ({
              id: pupil.id,
              firstName: pupil.firstName,
              lastName: pupil.lastName,
              otherNames: pupil.otherNames,
              admissionNumber: pupil.admissionNumber,
              gender: pupil.gender,
              classId: pupil.classId,
              className: pupil.className,
              classCode: pupil.classCode,
              section: pupil.section,
            }));

            await createPLERecordMutation.mutateAsync({
              examName: `PLE ${graduationYear}`,
              year: graduationYear,
              pupilsSnapshot: pupilsSnapshot,
            });

            toast({
              title: "PLE Record Created",
              description: `PLE ${graduationYear} record created with ${p7SelectedPupils.length} candidate(s).`,
            });
          } else {
            toast({
              title: "No P7 Pupils",
              description: "No P7 pupils found in selection. PLE record not created.",
              variant: "default",
            });
          }
        } catch (pleError) {
          console.error('Error creating PLE record:', pleError);
          toast({
            variant: "destructive",
            title: "PLE Record Error",
            description: "Failed to create PLE record, but graduation will continue.",
          });
        }
      }

      // Graduate pupils
      for (const pupilId of pupilIdsToProcess) {
        const pupil = allPupils.find(p => p.id === pupilId);
        if (pupil) {
          const graduationHistoryEntry = {
            date: new Date().toISOString(),
            fromClassId: pupil.classId,
            fromClassName: pupil.className,
            toClassId: pupil.classId, // Graduating from same class
            toClassName: pupil.className,
            type: 'Graduation' as const,
            notes: `Graduated from ${fromClass.name} on ${new Date().toLocaleDateString()} - Class of ${graduationYear}`,
            processedBy: "System Admin", // Placeholder for user
            academicYearId: activeAcademicYear.id,
            graduationYear: graduationYear, // Use selected year, not current year
          };

          const statusChangeEntry = {
            date: new Date().toISOString(),
            fromStatus: pupil.status,
            toStatus: 'Graduated' as const,
            reason: `Graduated from ${fromClass.name} - Class of ${graduationYear}`,
            processedBy: "System Admin",
          };

          const { id, createdAt, ...updateData } = pupil;
          await updatePupilMutation.mutateAsync({
            id: pupil.id,
            data: {
              ...updateData,
              status: 'Graduated',
              graduationDate: graduationDate, // Actual date of graduation action
              graduationYear: graduationYear, // Selected year for "Class of XXXX"
              graduationClassId: fromClass.id,
              graduationClassName: fromClass.name,
              graduationAcademicYearId: activeAcademicYear.id,
              promotionHistory: [...(pupil.promotionHistory || []), graduationHistoryEntry],
              statusChangeHistory: [...(pupil.statusChangeHistory || []), statusChangeEntry],
            }
          });
          processedCount++;
        }
      }

      // Create promotion batch record for graduation
      try {
        await createPromotionBatchMutation.mutateAsync({
          type: 'Graduation',
          fromClassId: fromClass.id,
          fromClassName: fromClass.name,
          pupilIds: pupilIdsToProcess,
          processedBy: "System Admin",
          academicYearId: activeAcademicYear.id,
          graduationYear: graduationYear,
          notes: `Graduated ${processedCount} pupils from ${fromClass.name} - Class of ${graduationYear}`,
        });
      } catch (batchError) {
        console.error('Error creating graduation batch record:', batchError);
        // Don't fail the graduation if batch creation fails
      }

      toast({
        title: "Graduation Complete",
        description: `${processedCount} pupil(s) have been successfully graduated from ${fromClass.name} - Class of ${graduationYear}.`,
      });

      setSelectedPupilIds([]);
      setCurrentYearPupilIds([]);
      setPreviousYearsPupilIds([]);
      setShowGraduateDialog(false);
      setCreatePLERecord(false);
      setGraduationYear(new Date().getFullYear()); // Reset to current year
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to graduate pupils. Please try again.",
      });
    }
  };

  const handleProcessPupils = async () => {
    const pupilIdsToProcess = getSelectedPupilIdsForProcessing();
    if (!fromClassId || !toClassId || pupilIdsToProcess.length === 0 || !promotionType) {
      toast({
        title: "Missing Information",
        description: "Please select 'From Class', 'To Class', and at least one pupil.",
        variant: "destructive",
      });
      return;
    }

    const fromClass = allClasses.find(c => c.id === fromClassId);
    const toClass = allClasses.find(c => c.id === toClassId);

    if (!fromClass || !toClass) {
      toast({ title: "Error", description: "Selected class not found.", variant: "destructive" });
      return;
    }

    try {
      let processedCount = 0;

      for (const pupilId of pupilIdsToProcess) {
        const pupil = allPupils.find(p => p.id === pupilId);
        if (pupil) {
          const historyEntry = {
            date: new Date().toISOString(),
            fromClassId: pupil.classId,
            fromClassName: pupil.className,
            toClassId: toClass.id,
            toClassName: toClass.name,
            type: promotionType,
            notes: `Processed on ${new Date().toLocaleDateString()}`,
            processedBy: "System Admin", // Placeholder for user
          };

          const { id, createdAt, ...updateData } = pupil;
          await updatePupilMutation.mutateAsync({
            id: pupil.id,
            data: {
              ...updateData,
              classId: toClass.id,
              className: toClass.name,
              promotionHistory: [...(pupil.promotionHistory || []), historyEntry],
            }
          });
          processedCount++;
        }
      }

      // Create promotion batch record
      try {
        await createPromotionBatchMutation.mutateAsync({
          type: promotionType,
          fromClassId: fromClass.id,
          fromClassName: fromClass.name,
          toClassId: toClass.id,
          toClassName: toClass.name,
          pupilIds: pupilIdsToProcess,
          processedBy: "System Admin",
          academicYearId: activeAcademicYear?.id,
          notes: `${promotionType} of ${processedCount} pupils from ${fromClass.name} to ${toClass.name}`,
        });
      } catch (batchError) {
        console.error('Error creating promotion batch record:', batchError);
        // Don't fail the promotion if batch creation fails
      }

      toast({
        title: "Processing Complete",
        description: `${processedCount} pupil(s) have been ${promotionType === 'Promotion' ? 'promoted' : promotionType === 'Demotion' ? 'demoted' : 'transferred'} to ${toClass.name}.`,
      });

      setSelectedPupilIds([]);
      setCurrentYearPupilIds([]);
      setPreviousYearsPupilIds([]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process pupils. Please try again.",
      });
    }
  };

  const availableToClasses = allClasses.filter(c => c.id !== fromClassId);
  const allSelected = pupilsInFromClass.length > 0 && selectedPupilIds.length === pupilsInFromClass.length;
  const allPreviousSelected = previousYearsPupils.length > 0 && previousYearsPupilIds.length === previousYearsPupils.length;
  const allCurrentSelected = currentYearPupils.length > 0 && currentYearPupilIds.length === currentYearPupils.length;

  // Merged selection count for display when filter is active
  const totalSelectedCount = registrationYearFilterActive
    ? previousYearsPupilIds.length + currentYearPupilIds.length
    : selectedPupilIds.length;

  // Get merged pupil IDs for processing when filter is active
  const getSelectedPupilIdsForProcessing = () => {
    if (registrationYearFilterActive) {
      return [...previousYearsPupilIds, ...currentYearPupilIds];
    }
    return selectedPupilIds;
  };

  if (pupilsLoading || classesLoading || academicYearLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Promote / Demote Pupils" />
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading data...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Promote / Demote Pupils"
          description="Manage pupil progression between classes."
        />
        <Button
          variant="outline"
          onClick={() => setShowHistoryDialog(true)}
        >
          <History className="mr-2 h-4 w-4" />
          History
        </Button>
      </div>

      <PromotionHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 sticky top-6 self-start">
          <CardHeader>
            <CardTitle>Select Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="fromClass">From Class</Label>
              <Select value={fromClassId} onValueChange={setFromClassId}>
                <SelectTrigger id="fromClass">
                  <SelectValue placeholder="Select original class" />
                </SelectTrigger>
                <SelectContent>
                  {allClasses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Graduate Button - Shows only when P7 class is selected */}
            {isSelectedClassP7 && pupilsInFromClass.length > 0 && (
              <div className="space-y-2">
                <Dialog open={showGraduateDialog} onOpenChange={setShowGraduateDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full border-green-200 text-green-700 hover:bg-green-50"
                      disabled={totalSelectedCount === 0}
                    >
                      <GraduationCap className="mr-2 h-4 w-4" />
                      Graduate Selected Pupils ({totalSelectedCount})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center">
                        <GraduationCap className="mr-2 h-5 w-5 text-green-600" />
                        Confirm Graduation
                      </DialogTitle>
                      <DialogDescription>
                        You are about to graduate <strong>{totalSelectedCount}</strong> pupil(s) from <strong>{allClasses.find(c => c.id === fromClassId)?.name}</strong>.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md mt-2">
                      <strong>Note:</strong> This action will change their status to "Graduated" and they will no longer appear in active pupil lists.
                    </div>
                    <div className="space-y-4 mt-4">
                      {/* Graduation Year Selector */}
                      <div className="space-y-2">
                        <Label htmlFor="graduationYear">Graduation Year (Class of)</Label>
                        <Select
                          value={graduationYear.toString()}
                          onValueChange={(value) => setGraduationYear(parseInt(value))}
                        >
                          <SelectTrigger id="graduationYear">
                            <SelectValue placeholder="Select graduation year" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => {
                              const year = new Date().getFullYear() - 5 + i;
                              return (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          This year will be used for "Class of {graduationYear}" grouping. The graduation date will be today's date.
                        </p>
                      </div>

                      {/* PLE Record Creation Checkbox */}
                      <div className="flex items-start space-x-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                        <Checkbox
                          id="createPLERecord"
                          checked={createPLERecord}
                          onCheckedChange={(checked) => setCreatePLERecord(checked === true)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor="createPLERecord"
                            className="text-sm font-medium cursor-pointer"
                          >
                            Create PLE Record
                          </Label>
                          <p className="text-xs text-gray-600 mt-1">
                            Automatically create a PLE record for {graduationYear} using the selected year.
                            Only P7 pupils will be included in the PLE record.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-6">
                      <Button variant="outline" onClick={() => {
                        setShowGraduateDialog(false);
                        setCreatePLERecord(false);
                        setGraduationYear(new Date().getFullYear());
                      }}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleGraduatePupils}
                        disabled={updatePupilMutation.isPending || createPLERecordMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {(updatePupilMutation.isPending || createPLERecordMutation.isPending) ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <GraduationCap className="mr-2 h-4 w-4" />
                            Confirm Graduation
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="text-xs text-gray-500 text-center">
                  Select pupils above first, then click Graduate
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="toClass">To Class (for Promotion/Demotion)</Label>
              <Select value={toClassId} onValueChange={setToClassId} disabled={!fromClassId}>
                <SelectTrigger id="toClass">
                  <SelectValue placeholder="Select destination class" />
                </SelectTrigger>
                <SelectContent>
                  {availableToClasses.length === 0 && <SelectItem value="no-classes" disabled>No other classes available</SelectItem>}
                  {availableToClasses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {promotionType && fromClassId && toClassId && (
              <Alert variant={promotionType === 'Promotion' ? 'default' : promotionType === 'Demotion' ? 'destructive' : 'default'} className="mt-4">
                {promotionType === 'Promotion' && <CheckCircle className="h-4 w-4" />}
                {promotionType === 'Demotion' && <AlertCircle className="h-4 w-4" />}
                {promotionType === 'Transfer' && <ArrowRight className="h-4 w-4" />}
                <AlertTitle className="capitalize">{promotionType} Action</AlertTitle>
                <AlertDescription>
                  Pupils will be {promotionType.toLowerCase()}ed from {allClasses.find(c => c.id === fromClassId)?.name} to {allClasses.find(c => c.id === toClassId)?.name}.
                </AlertDescription>
              </Alert>
            )}

            {/* Confirm Promotion Button */}
            {totalSelectedCount > 0 && promotionType && (
              <div className="mt-4">
                <Button
                  onClick={handleProcessPupils}
                  className="w-full"
                  disabled={updatePupilMutation.isPending}
                >
                  {updatePupilMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {promotionType === 'Promotion' && <TrendingUp className="mr-2 h-4 w-4" />}
                      {promotionType === 'Demotion' && <TrendingDown className="mr-2 h-4 w-4" />}
                      {promotionType === 'Transfer' && <ArrowRight className="mr-2 h-4 w-4" />}
                      Confirm {promotionType} ({totalSelectedCount} pupils)
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Pupils from {allClasses.find(c => c.id === fromClassId)?.name || "..."}</CardTitle>
                {fromClassId && pupilsInFromClass.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="registration-filter" className="text-sm font-normal cursor-pointer">
                      <Filter className="h-4 w-4 inline mr-1" />
                      Filter by Registration Year
                    </Label>
                    <Checkbox
                      id="registration-filter"
                      checked={registrationYearFilterActive}
                      onCheckedChange={(checked) => setRegistrationYearFilterActive(checked === true)}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {fromClassId && (
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search pupils by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              )}
              {fromClassId ? (
                pupilsInFromClass.length > 0 ? (
                  registrationYearFilterActive ? (
                    <div className="space-y-6">
                      {/* Previous Years' Pupils Table */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-700">
                            Previous Years' Pupils ({previousYearsPupils.length})
                          </h3>
                          {previousYearsPupils.length > 0 && (
                            <span className="text-xs text-gray-500">
                              {previousYearsPupilIds.length} selected
                            </span>
                          )}
                        </div>
                        {previousYearsPupils.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]">
                                  <Checkbox
                                    checked={allPreviousSelected}
                                    onCheckedChange={handleSelectAllPreviousYears}
                                    aria-label="Select all previous years pupils"
                                  />
                                </TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Registration Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previousYearsPupils.map(pupil => (
                                <TableRow key={pupil.id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={previousYearsPupilIds.includes(pupil.id)}
                                      onCheckedChange={(checked) => handleSelectPupilPreviousYears(pupil.id, checked)}
                                      aria-label={`Select ${pupil.firstName} ${pupil.lastName}`}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{pupil.lastName} {pupil.firstName}{pupil.otherNames ? ` ${pupil.otherNames}` : ''}</TableCell>
                                  <TableCell className="text-sm text-gray-600">
                                    {pupil.registrationDate ? new Date(pupil.registrationDate).toLocaleDateString() : 'N/A'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-muted-foreground text-center py-4 text-sm">No pupils registered in previous years.</p>
                        )}
                      </div>

                      {/* Current Year's Pupils Table */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-blue-700">
                            Current Year's Pupils ({currentYearPupils.length})
                          </h3>
                          {currentYearPupils.length > 0 && (
                            <span className="text-xs text-blue-600">
                              {currentYearPupilIds.length} selected
                            </span>
                          )}
                        </div>
                        {currentYearPupils.length > 0 ? (
                          <div className="border-2 border-blue-200 rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-blue-50">
                                  <TableHead className="w-[50px]">
                                    <Checkbox
                                      checked={allCurrentSelected}
                                      onCheckedChange={handleSelectAllCurrentYear}
                                      aria-label="Select all current year pupils"
                                    />
                                  </TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Registration Date</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {currentYearPupils.map(pupil => (
                                  <TableRow key={pupil.id} className="bg-blue-50/30">
                                    <TableCell>
                                      <Checkbox
                                        checked={currentYearPupilIds.includes(pupil.id)}
                                        onCheckedChange={(checked) => handleSelectPupilCurrentYear(pupil.id, checked)}
                                        aria-label={`Select ${pupil.firstName} ${pupil.lastName}`}
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium">{pupil.lastName} {pupil.firstName}{pupil.otherNames ? ` ${pupil.otherNames}` : ''}</TableCell>
                                    <TableCell className="text-sm text-blue-700">
                                      {pupil.registrationDate ? new Date(pupil.registrationDate).toLocaleDateString() : 'N/A'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-4 text-sm">No pupils registered in current year.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={handleSelectAll}
                              aria-label="Select all pupils"
                              disabled={pupilsInFromClass.length === 0}
                            />
                          </TableHead>
                          <TableHead>Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pupilsInFromClass.map(pupil => (
                          <TableRow key={pupil.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedPupilIds.includes(pupil.id)}
                                onCheckedChange={(checked) => handleSelectPupil(pupil.id, checked)}
                                aria-label={`Select ${pupil.firstName} ${pupil.lastName}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{pupil.lastName} {pupil.firstName}{pupil.otherNames ? ` ${pupil.otherNames}` : ''}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                ) : (
                  <p className="text-muted-foreground text-center py-4">No active pupils found in the selected class.</p>
                )
              ) : (
                <p className="text-muted-foreground text-center py-4">Please select a 'From Class' to view pupils.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

