"use client";

import * as React from "react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, CheckCircle, TrendingDown, TrendingUp, GraduationCap } from "lucide-react";
import type { Pupil, Class, GraduatePupilsData } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { usePupils, useUpdatePupil } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
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

  // Reset form state function
  const resetFormState = () => {
    setFromClassId("");
    setToClassId("");
    setSelectedPupilIds([]);
    setPromotionType(null);
  };

  // Derived data
  const pupilsInFromClass = React.useMemo(() => 
    fromClassId ? allPupils.filter(p => p.classId === fromClassId && p.status === 'Active') : [],
    [allPupils, fromClassId]
  );

  React.useEffect(() => {
    setSelectedPupilIds([]); // Reset selection when from class changes
  }, [fromClassId]);

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

  const handleGraduatePupils = async () => {
    if (!fromClassId || selectedPupilIds.length === 0 || !activeAcademicYear) {
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
      const graduationDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const graduationYear = new Date().getFullYear();
      
      for (const pupilId of selectedPupilIds) {
        const pupil = allPupils.find(p => p.id === pupilId);
        if (pupil) {
          const graduationHistoryEntry = {
            date: new Date().toISOString(),
            fromClassId: pupil.classId,
            fromClassName: pupil.className,
            toClassId: pupil.classId, // Graduating from same class
            toClassName: pupil.className,
            type: 'Graduation' as const,
            notes: `Graduated from ${fromClass.name} on ${new Date().toLocaleDateString()}`,
            processedBy: "System Admin", // Placeholder for user
            academicYearId: activeAcademicYear.id,
            graduationYear: graduationYear,
          };

          const statusChangeEntry = {
            date: new Date().toISOString(),
            fromStatus: pupil.status,
            toStatus: 'Graduated' as const,
            reason: `Graduated from ${fromClass.name}`,
            processedBy: "System Admin",
          };

          const { id, createdAt, ...updateData } = pupil;
          await updatePupilMutation.mutateAsync({
            id: pupil.id,
            data: {
              ...updateData,
              status: 'Graduated',
              graduationDate: graduationDate,
              graduationYear: graduationYear,
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

      toast({
        title: "Graduation Complete",
        description: `${processedCount} pupil(s) have been successfully graduated from ${fromClass.name}.`,
      });

      setSelectedPupilIds([]);
      setShowGraduateDialog(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to graduate pupils. Please try again.",
      });
    }
  };

  const handleProcessPupils = async () => {
    if (!fromClassId || !toClassId || selectedPupilIds.length === 0 || !promotionType) {
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
      
      for (const pupilId of selectedPupilIds) {
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

      toast({
        title: "Processing Complete",
        description: `${processedCount} pupil(s) have been ${promotionType === 'Promotion' ? 'promoted' : promotionType === 'Demotion' ? 'demoted' : 'transferred'} to ${toClass.name}.`,
      });

      setSelectedPupilIds([]);
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
      <PageHeader
        title="Promote / Demote Pupils"
        description="Manage pupil progression between classes."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
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

            {/* Graduate Button - Shows when class is selected */}
            {fromClassId && pupilsInFromClass.length > 0 && (
              <div className="space-y-2">
                <Dialog open={showGraduateDialog} onOpenChange={setShowGraduateDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full border-green-200 text-green-700 hover:bg-green-50"
                      disabled={selectedPupilIds.length === 0}
                    >
                      <GraduationCap className="mr-2 h-4 w-4" />
                      Graduate Selected Pupils ({selectedPupilIds.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center">
                        <GraduationCap className="mr-2 h-5 w-5 text-green-600" />
                        Confirm Graduation
                      </DialogTitle>
                      <DialogDescription className="space-y-2">
                        <span>You are about to graduate <strong>{selectedPupilIds.length}</strong> pupil(s) from <strong>{allClasses.find(c => c.id === fromClassId)?.name}</strong>.</span>
                        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md mt-2">
                          <strong>Note:</strong> This action will change their status to "Graduated" and they will no longer appear in active pupil lists.
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end space-x-2 mt-4">
                      <Button variant="outline" onClick={() => setShowGraduateDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleGraduatePupils}
                        disabled={updatePupilMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {updatePupilMutation.isPending ? (
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
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Pupils from {allClasses.find(c => c.id === fromClassId)?.name || "..."}</CardTitle>
            </CardHeader>
            <CardContent>
              {fromClassId ? (
                pupilsInFromClass.length > 0 ? (
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
                        <TableHead>Admission No.</TableHead>
                        <TableHead>Status</TableHead>
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
                          <TableCell className="font-medium">{pupil.firstName} {pupil.lastName}</TableCell>
                          <TableCell>{pupil.admissionNumber}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {pupil.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No active pupils found in the selected class.</p>
                )
              ) : (
                <p className="text-muted-foreground text-center py-4">Please select a 'From Class' to view pupils.</p>
              )}
            </CardContent>
          </Card>

          {selectedPupilIds.length > 0 && promotionType && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {promotionType === 'Promotion' && <TrendingUp className="mr-2 h-5 w-5 text-green-600" />}
                  {promotionType === 'Demotion' && <TrendingDown className="mr-2 h-5 w-5 text-red-600" />}
                  {promotionType === 'Transfer' && <ArrowRight className="mr-2 h-5 w-5 text-blue-600" />}
                  Confirm {promotionType}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  You are about to {promotionType.toLowerCase()} <strong>{selectedPupilIds.length}</strong> pupil(s) 
                  from <strong>{allClasses.find(c => c.id === fromClassId)?.name}</strong> to <strong>{allClasses.find(c => c.id === toClassId)?.name}</strong>.
                </p>
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
                    `Confirm ${promotionType}`
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

