"use client";

import * as React from "react";
import { Search, Users, User, Check, X, Edit, Eye, Save, Loader2, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { usePupils, useUpdatePupil } from "@/lib/hooks/use-pupils";
import type { Staff, Pupil } from "@/types";
import { formatPupilDisplayName } from "@/lib/utils/name-formatter";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StaffPupilAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
}

export function StaffPupilAssignmentModal({
  open,
  onOpenChange,
  staff,
}: StaffPupilAssignmentModalProps) {
  const { toast } = useToast();
  const { data: pupils = [], isLoading } = usePupils();
  const updatePupilMutation = useUpdatePupil();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedPupilIds, setSelectedPupilIds] = React.useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = React.useState<"assign" | "view" | "edit">("assign");
  const [isSaving, setIsSaving] = React.useState(false);

  // Load existing assignments when modal opens
  React.useEffect(() => {
    if (open && staff && pupils.length > 0) {
      // Find pupils already assigned to this staff member
      const assignedPupilIds = pupils
        .filter((p: Pupil) => p.assignedStaffId === staff.id)
        .map((p: Pupil) => p.id);
      setSelectedPupilIds(new Set(assignedPupilIds));
    }
  }, [open, staff, pupils]);

  // Filter pupils based on search
  const filteredPupils = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return pupils;
    }

    const searchLower = searchTerm.toLowerCase();
    return pupils.filter((pupil: Pupil) => {
      const fullName = formatPupilDisplayName(pupil).toLowerCase();
      return (
        fullName.includes(searchLower) ||
        pupil.admissionNumber.toLowerCase().includes(searchLower) ||
        pupil.className?.toLowerCase().includes(searchLower) ||
        pupil.familyId?.toLowerCase().includes(searchLower)
      );
    });
  }, [pupils, searchTerm]);

  // Group pupils by family
  const familiesMap = React.useMemo(() => {
    const map = new Map<string, Pupil[]>();
    filteredPupils.forEach((pupil: Pupil) => {
      const familyId = pupil.familyId || "no-family";
      if (!map.has(familyId)) {
        map.set(familyId, []);
      }
      map.get(familyId)!.push(pupil);
    });
    return map;
  }, [filteredPupils]);

  // Get assigned pupils for this staff
  const assignedPupils = React.useMemo(() => {
    return pupils.filter((p: Pupil) => p.assignedStaffId === staff?.id);
  }, [pupils, staff]);

  const handleTogglePupil = (pupilId: string) => {
    setSelectedPupilIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pupilId)) {
        newSet.delete(pupilId);
      } else {
        newSet.add(pupilId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPupilIds.size === filteredPupils.length) {
      setSelectedPupilIds(new Set());
    } else {
      setSelectedPupilIds(new Set(filteredPupils.map((p: Pupil) => p.id)));
    }
  };

  const handleSelectFamily = (familyId: string) => {
    const familyPupils = familiesMap.get(familyId) || [];
    const familyPupilIds = familyPupils.map((p) => p.id);
    
    setSelectedPupilIds((prev) => {
      const newSet = new Set(prev);
      const allSelected = familyPupilIds.every((id) => newSet.has(id));
      
      if (allSelected) {
        // Deselect all family members
        familyPupilIds.forEach((id) => newSet.delete(id));
      } else {
        // Select all family members
        familyPupilIds.forEach((id) => newSet.add(id));
      }
      return newSet;
    });
  };

  const handleSaveAssignments = async () => {
    if (!staff) return;

    setIsSaving(true);
    try {
      // Get currently assigned pupils
      const currentlyAssigned = pupils.filter(
        (p: Pupil) => p.assignedStaffId === staff.id
      );

      // Pupils to assign (new selections)
      const toAssign = filteredPupils.filter((p: Pupil) =>
        selectedPupilIds.has(p.id) && p.assignedStaffId !== staff.id
      );

      // Pupils to unassign (previously assigned but now deselected)
      const toUnassign = currentlyAssigned.filter(
        (p: Pupil) => !selectedPupilIds.has(p.id)
      );

      // Update pupils to assign
      const assignPromises = toAssign.map((pupil: Pupil) =>
        updatePupilMutation.mutateAsync({
          id: pupil.id,
          data: {
            ...pupil,
            assignedStaffId: staff.id,
          },
        })
      );

      // Update pupils to unassign
      const unassignPromises = toUnassign.map((pupil: Pupil) => {
        const { assignedStaffId, ...rest } = pupil;
        return updatePupilMutation.mutateAsync({
          id: pupil.id,
          data: {
            ...rest,
            assignedStaffId: undefined,
          },
        });
      });

      await Promise.all([...assignPromises, ...unassignPromises]);

      toast({
        title: "Assignments Updated",
        description: `Successfully updated ${toAssign.length} assignments and removed ${toUnassign.length} assignments.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving assignments:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save assignments. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!staff) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Assign Pupils to {staff.firstName} {staff.lastName}
          </DialogTitle>
          <DialogDescription>
            Select one or more pupils to assign to this staff member. You can view families and edit assignments.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="assign">
              <UserCheck className="h-4 w-4 mr-2" />
              Assign ({selectedPupilIds.size})
            </TabsTrigger>
            <TabsTrigger value="view">
              <Eye className="h-4 w-4 mr-2" />
              View Families
            </TabsTrigger>
            <TabsTrigger value="edit">
              <Edit className="h-4 w-4 mr-2" />
              Edit Assignments ({assignedPupils.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assign" className="flex-1 flex flex-col overflow-hidden mt-4">
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              {/* Search and Select All */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search pupils by name, admission number, or class..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="whitespace-nowrap"
                >
                  {selectedPupilIds.size === filteredPupils.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              {/* Results Count */}
              <div className="text-sm text-gray-600">
                {filteredPupils.length} pupil{filteredPupils.length !== 1 ? "s" : ""} found
                {selectedPupilIds.size > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    ({selectedPupilIds.size} selected)
                  </span>
                )}
              </div>

              {/* Pupils List */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Loading pupils...</span>
                  </div>
                ) : filteredPupils.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <User className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No pupils found matching your search.</p>
                  </div>
                ) : (
                  filteredPupils.map((pupil: Pupil) => (
                    <Card
                      key={pupil.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedPupilIds.has(pupil.id)
                          ? "ring-2 ring-blue-500 bg-blue-50"
                          : ""
                      }`}
                      onClick={() => handleTogglePupil(pupil.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedPupilIds.has(pupil.id)}
                            onCheckedChange={() => handleTogglePupil(pupil.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Avatar className="h-10 w-10">
                            {pupil.photo ? (
                              <AvatarImage src={pupil.photo} alt={formatPupilDisplayName(pupil)} />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              {pupil.firstName[0]}{pupil.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                {formatPupilDisplayName(pupil)}
                              </h3>
                              <Badge variant={pupil.status === "Active" ? "default" : "secondary"}>
                                {pupil.status}
                              </Badge>
                              {pupil.familyId && (
                                <Badge variant="outline" className="text-xs">
                                  Family: {pupil.familyId.slice(0, 8)}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                              <span>ID: {pupil.admissionNumber}</span>
                              {pupil.className && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span>Class: {pupil.className}</span>
                                </>
                              )}
                              <span className="text-gray-300">•</span>
                              <span>{pupil.section}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="view" className="flex-1 flex flex-col overflow-hidden mt-4">
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search families..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Families List */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {Array.from(familiesMap.entries()).map(([familyId, familyPupils]) => {
                  const allSelected = familyPupils.every((p) => selectedPupilIds.has(p.id));
                  const someSelected = familyPupils.some((p) => selectedPupilIds.has(p.id));

                  return (
                    <Card key={familyId} className="border-2">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            <h3 className="font-semibold">
                              {familyId === "no-family" ? "No Family" : `Family ${familyId.slice(0, 8)}`}
                            </h3>
                            <Badge variant="outline">
                              {familyPupils.length} member{familyPupils.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelectFamily(familyId)}
                          >
                            {allSelected ? "Deselect All" : "Select All"}
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {familyPupils.map((pupil: Pupil) => (
                            <div
                              key={pupil.id}
                              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                selectedPupilIds.has(pupil.id)
                                  ? "bg-blue-50 border border-blue-200"
                                  : "hover:bg-gray-50"
                              }`}
                              onClick={() => handleTogglePupil(pupil.id)}
                            >
                              <Checkbox
                                checked={selectedPupilIds.has(pupil.id)}
                                onCheckedChange={() => handleTogglePupil(pupil.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Avatar className="h-8 w-8">
                                {pupil.photo ? (
                                  <AvatarImage src={pupil.photo} alt={formatPupilDisplayName(pupil)} />
                                ) : null}
                                <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                                  {pupil.firstName[0]}{pupil.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {formatPupilDisplayName(pupil)}
                                  </span>
                                  <Badge variant={pupil.status === "Active" ? "default" : "secondary"} className="text-xs">
                                    {pupil.status}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-600">
                                  {pupil.admissionNumber} • {pupil.className || "No Class"} • {pupil.section}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="flex-1 flex flex-col overflow-hidden mt-4">
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              <div className="text-sm text-gray-600">
                Currently assigned pupils: {assignedPupils.length}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {assignedPupils.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <User className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No pupils are currently assigned to this staff member.</p>
                  </div>
                ) : (
                  assignedPupils.map((pupil: Pupil) => (
                    <Card key={pupil.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {pupil.photo ? (
                              <AvatarImage src={pupil.photo} alt={formatPupilDisplayName(pupil)} />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              {pupil.firstName[0]}{pupil.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                {formatPupilDisplayName(pupil)}
                              </h3>
                              <Badge variant={pupil.status === "Active" ? "default" : "secondary"}>
                                {pupil.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                              <span>ID: {pupil.admissionNumber}</span>
                              {pupil.className && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span>Class: {pupil.className}</span>
                                </>
                              )}
                              <span className="text-gray-300">•</span>
                              <span>{pupil.section}</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTogglePupil(pupil.id)}
                          >
                            {selectedPupilIds.has(pupil.id) ? (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Remove
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Keep
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="text-sm text-gray-600">
            {selectedPupilIds.size} pupil{selectedPupilIds.size !== 1 ? "s" : ""} selected
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAssignments}
              disabled={isSaving || selectedPupilIds.size === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Assignments
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

