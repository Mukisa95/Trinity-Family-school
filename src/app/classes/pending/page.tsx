"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePupils, useUpdatePupil } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { ArrowLeft, Search, Users, Loader2, CheckCircle2, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import type { Pupil } from "@/types";
import { useAuth } from "@/lib/contexts/auth-context";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PendingPupilsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classIdFilter = searchParams.get('classId');
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: allClasses = [] } = useClasses();
  const { data: schoolSettings } = useSchoolSettings();
  const updatePupilMutation = useUpdatePupil();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedPupilIds, setSelectedPupilIds] = React.useState<Set<string>>(new Set());
  const [isActivatingSelected, setIsActivatingSelected] = React.useState(false);

  // Filter pupils with Pending status and optionally by classId
  const pendingPupils = React.useMemo(() => {
    let filtered = allPupils.filter((pupil) => pupil.status === "Pending");
    
    // Filter by classId if provided in URL
    if (classIdFilter) {
      filtered = filtered.filter((pupil) => pupil.classId === classIdFilter);
    }
    
    return filtered;
  }, [allPupils, classIdFilter]);

  // Filter by search query
  const filteredPupils = React.useMemo(() => {
    if (!searchQuery.trim()) return pendingPupils;

    const query = searchQuery.toLowerCase();
    return pendingPupils.filter((pupil) => {
      const fullName = `${pupil.firstName} ${pupil.lastName} ${pupil.otherNames || ""}`.toLowerCase();
      const admissionNumber = pupil.admissionNumber.toLowerCase();
      const className = allClasses.find((c) => c.id === pupil.classId)?.name?.toLowerCase() || "";

      return (
        fullName.includes(query) ||
        admissionNumber.includes(query) ||
        className.includes(query)
      );
    });
  }, [pendingPupils, searchQuery, allClasses]);

  // Handle activating a pupil (changing status from Pending to Active)
  const handleActivatePupil = async (pupil: Pupil) => {
    try {
      const statusChangeEntry = {
        date: new Date().toISOString(),
        fromStatus: pupil.status,
        toStatus: "Active" as const,
        reason: "Returned",
        processedBy: user?.name || "System",
      };

      const { id, createdAt, ...updateData } = pupil;
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: {
          ...updateData,
          status: "Active",
          statusChangeHistory: [...(pupil.statusChangeHistory || []), statusChangeEntry],
        },
      });

      toast({
        title: "Pupil Activated",
        description: `${pupil.firstName} ${pupil.lastName} has been activated and will now appear in all components.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to activate pupil. Please try again.",
      });
    }
  };

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      // Clear selection when exiting selection mode
      setSelectedPupilIds(new Set());
    }
  };

  // Toggle pupil selection
  const handleTogglePupilSelection = (pupilId: string) => {
    setSelectedPupilIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pupilId)) {
        newSet.delete(pupilId);
      } else {
        newSet.add(pupilId);
      }
      return newSet;
    });
  };

  // Select all filtered pupils
  const handleSelectAll = () => {
    if (selectedPupilIds.size === filteredPupils.length) {
      // Deselect all
      setSelectedPupilIds(new Set());
    } else {
      // Select all
      setSelectedPupilIds(new Set(filteredPupils.map(p => p.id)));
    }
  };

  // Activate selected pupils
  const handleActivateSelected = async () => {
    if (selectedPupilIds.size === 0) {
      toast({
        variant: "destructive",
        title: "No Selection",
        description: "Please select at least one pupil to activate.",
      });
      return;
    }

    setIsActivatingSelected(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const pupilId of selectedPupilIds) {
        const pupil = filteredPupils.find(p => p.id === pupilId);
        if (!pupil) continue;

        try {
          const statusChangeEntry = {
            date: new Date().toISOString(),
            fromStatus: pupil.status,
            toStatus: "Active" as const,
            reason: "Returned",
            processedBy: user?.name || "System",
          };

          const { id, createdAt, ...updateData } = pupil;
          await updatePupilMutation.mutateAsync({
            id: pupil.id,
            data: {
              ...updateData,
              status: "Active",
              statusChangeHistory: [...(pupil.statusChangeHistory || []), statusChangeEntry],
            },
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to activate pupil ${pupilId}:`, error);
          errorCount++;
        }
      }

      setIsActivatingSelected(false);
      setIsSelectionMode(false);
      setSelectedPupilIds(new Set());

      if (errorCount === 0) {
        toast({
          title: "Pupils Activated",
          description: `Successfully activated ${successCount} pupil(s). They will now appear in all components.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Partial Success",
          description: `Activated ${successCount} pupil(s). Failed to activate ${errorCount} pupil(s).`,
        });
      }
    } catch (error) {
      setIsActivatingSelected(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to activate pupils. Please try again.",
      });
    }
  };

  const getInitials = (pupil: Pupil) => {
    const first = pupil.firstName?.charAt(0) || "";
    const last = pupil.lastName?.charAt(0) || "";
    return `${first}${last}`.toUpperCase() || "?";
  };

  const getClassName = (classId: string) => {
    const classItem = allClasses.find((c) => c.id === classId);
    return classItem ? classItem.name : "Not Assigned";
  };

  const getClassCode = (classId: string) => {
    const classItem = allClasses.find((c) => c.id === classId);
    return classItem ? classItem.code : "";
  };

  if (pupilsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading pending pupils...</span>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={classIdFilter ? `Pending Pupils - ${allClasses.find(c => c.id === classIdFilter)?.name || 'Class'}` : "Pending Pupils"}
        description={classIdFilter ? "Manage pending pupils in this class. Activate them to make them visible in all components." : "Manage pupils in Pending status. Activate them to make them visible in all components."}
        actions={
          <div className="flex gap-2">
            {pendingPupils.length > 0 && (
              <>
                {!isSelectionMode ? (
                  <Button
                    onClick={handleToggleSelectionMode}
                    variant="default"
                    className="rounded-full bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Select
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleActivateSelected}
                      disabled={isActivatingSelected || updatePupilMutation.isPending || selectedPupilIds.size === 0}
                      variant="default"
                      className="rounded-full bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50"
                    >
                      {isActivatingSelected || updatePupilMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Activating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Activate ({selectedPupilIds.size})
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleToggleSelectionMode}
                      variant="outline"
                      className="rounded-full"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </>
            )}
            <Button
              asChild
              variant="outline"
              size="icon"
              title="Back to Classes"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-background via-background to-muted/20 border-2 border-primary/20 hover:border-primary/40 shadow-lg hover:shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-gradient-to-br hover:from-primary/5 hover:via-primary/10 hover:to-primary/5"
            >
              <Link href={classIdFilter ? `/class-detail?id=${classIdFilter}` : "/classes"}>
                <ArrowLeft className="h-4 w-4 sm:h-4 sm:w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <CardTitle>Pending Pupils ({filteredPupils.length})</CardTitle>
            </div>
            {schoolSettings?.pending?.enabled && (
              <Badge variant="default" className="bg-amber-600">
                Pending Status Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, admission number, or class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredPupils.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No pending pupils found matching your search."
                  : "No pupils are currently in Pending status."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSelectionMode && (
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={filteredPupils.length > 0 && selectedPupilIds.size === filteredPupils.length}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Pupil</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">{isSelectionMode ? "Select" : "Activate"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPupils.map((pupil, index) => (
                    <TableRow key={pupil.id} className="hover:bg-muted/50">
                      {isSelectionMode && (
                        <TableCell>
                          <Checkbox
                            checked={selectedPupilIds.has(pupil.id)}
                            onCheckedChange={() => handleTogglePupilSelection(pupil.id)}
                            aria-label={`Select ${pupil.firstName} ${pupil.lastName}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 flex-shrink-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
                            {pupil.photo && pupil.photo.trim() !== "" ? (
                              <AvatarImage
                                src={pupil.photo}
                                alt={`${pupil.firstName} ${pupil.lastName}`}
                                className="object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground font-medium text-sm">
                              {getInitials(pupil)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {pupil.firstName} {pupil.lastName}
                              {pupil.otherNames && ` ${pupil.otherNames}`}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{pupil.admissionNumber}</TableCell>
                      <TableCell>
                        <Link
                          href={`/class-detail?id=${pupil.classId}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {getClassCode(pupil.classId) || getClassName(pupil.classId)}
                        </Link>
                      </TableCell>
                      <TableCell>{pupil.gender || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {isSelectionMode ? (
                          <Badge variant={selectedPupilIds.has(pupil.id) ? "default" : "outline"}>
                            {selectedPupilIds.has(pupil.id) ? "Selected" : "Not Selected"}
                          </Badge>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={false}
                              onCheckedChange={() => handleActivatePupil(pupil)}
                              disabled={updatePupilMutation.isPending}
                              aria-label={`Activate ${pupil.firstName} ${pupil.lastName}`}
                            />
                            {updatePupilMutation.isPending && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function PendingPupilsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    }>
      <PendingPupilsContent />
    </Suspense>
  );
}
