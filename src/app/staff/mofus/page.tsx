"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import * as React from "react";
import { ArrowLeft, Users, UserCheck, Search, Calendar, Edit, Trash2, Plus, Loader2, X, Check } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useStaff } from "@/lib/hooks/use-staff";
import { usePupils } from "@/lib/hooks/use-pupils";
import { useFeesHolidays } from "@/lib/hooks/use-fees-holiday";
import { FeesHolidayModal } from "@/components/fees/fees-holiday-modal";
import { StaffPupilAssignmentModal } from "@/components/staff/staff-pupil-assignment-modal";
import type { Staff, Pupil, FeesHoliday } from "@/types";
import { formatPupilDisplayName } from "@/lib/utils/name-formatter";
import { formatStaffRoles } from "@/lib/utils/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MofusPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { data: staffList = [], isLoading: isLoadingStaff } = useStaff();
  const { data: pupils = [], isLoading: isLoadingPupils } = usePupils();
  const { data: allFeesHolidays = [] } = useFeesHolidays();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedStaff, setSelectedStaff] = React.useState<Staff | null>(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = React.useState(false);
  const [isFeesHolidayModalOpen, setIsFeesHolidayModalOpen] = React.useState(false);
  const [selectedPupilForHoliday, setSelectedPupilForHoliday] = React.useState<Pupil | null>(null);
  const [selectedHoliday, setSelectedHoliday] = React.useState<FeesHoliday | null>(null);

  // Filter teaching staff
  const teachingStaff = React.useMemo(() => {
    return staffList.filter((s: Staff) => {
      const hasTeachingDepartment = Array.isArray(s.department)
        ? s.department.includes("Teaching")
        : s.department === "Teaching";
      return hasTeachingDepartment;
    });
  }, [staffList]);

  // Get pupils assigned to each staff member
  const staffPupilsMap = React.useMemo(() => {
    const map = new Map<string, Pupil[]>();
    pupils.forEach((pupil: Pupil) => {
      if (pupil.assignedStaffId) {
        if (!map.has(pupil.assignedStaffId)) {
          map.set(pupil.assignedStaffId, []);
        }
        map.get(pupil.assignedStaffId)!.push(pupil);
      }
    });
    return map;
  }, [pupils]);

  // Create a map of pupil ID to active fees holiday
  const pupilHolidaysMap = React.useMemo(() => {
    const map = new Map<string, FeesHoliday>();
    allFeesHolidays.forEach((holiday: FeesHoliday) => {
      if (holiday.isActive) {
        map.set(holiday.pupilId, holiday);
      }
    });
    return map;
  }, [allFeesHolidays]);

  // Filter staff based on search
  const filteredStaff = React.useMemo(() => {
    if (!searchTerm.trim()) return teachingStaff;
    const searchLower = searchTerm.toLowerCase();
    return teachingStaff.filter((staff: Staff) => {
      const fullName = `${staff.firstName} ${staff.lastName}`.toLowerCase();
      return (
        fullName.includes(searchLower) ||
        staff.employeeId.toLowerCase().includes(searchLower) ||
        staff.email.toLowerCase().includes(searchLower)
      );
    });
  }, [teachingStaff, searchTerm]);

  const handleAssignPupils = (staff: Staff) => {
    setSelectedStaff(staff);
    setIsAssignmentModalOpen(true);
  };

  const handleManageFeesHoliday = (pupil: Pupil, holiday?: FeesHoliday) => {
    setSelectedPupilForHoliday(pupil);
    setSelectedHoliday(holiday || null);
    setIsFeesHolidayModalOpen(true);
  };

  if (isLoadingStaff || isLoadingPupils) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Mofus" description="Manage staff-pupil assignments and fees holidays" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <PageHeader
        title="Mofus"
        description="Manage staff-pupil assignments and fees holidays for teachers and their relatives"
        actions={
          <SmartBackButton 
            fallbackHref="/staff"
            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium border border-gray-200 bg-white hover:bg-gray-100 hover:text-gray-900 rounded-md px-3 h-9 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Staff
          </SmartBackButton>
        }
      />

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search staff by name, ID, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Staff List with Assigned Pupils */}
      <div className="space-y-4">
        {filteredStaff.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">No teaching staff found.</p>
            </CardContent>
          </Card>
        ) : (
          filteredStaff.map((staff: Staff) => {
            const assignedPupils = staffPupilsMap.get(staff.id) || [];
            return (
              <Card key={staff.id} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                          {staff.firstName[0]}{staff.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">
                          <Link
                            href={`/staff/${staff.id}`}
                            className="hover:text-blue-600 hover:underline transition-colors"
                          >
                            {staff.firstName} {staff.lastName}
                          </Link>
                        </CardTitle>
                        <p className="text-sm text-gray-600">
                          {staff.employeeId} • {formatStaffRoles(staff.role)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAssignPupils(staff)}
                    >
                      <UserCheck className="mr-2 h-4 w-4" />
                      {assignedPupils.length > 0 ? "Edit Assignments" : "Assign Pupils"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {assignedPupils.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>No pupils assigned to this staff member.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => handleAssignPupils(staff)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Assign Pupils
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-700">
                          Assigned Pupils ({assignedPupils.length})
                        </p>
                      </div>
                      <div className="grid gap-3">
                        {assignedPupils.map((pupil: Pupil) => {
                          const activeHoliday = pupilHolidaysMap.get(pupil.id);

                          return (
                            <div
                              key={pupil.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center space-x-3 flex-1">
                                <Avatar className="h-10 w-10">
                                  {pupil.photo ? (
                                    <AvatarImage src={pupil.photo} alt={formatPupilDisplayName(pupil)} />
                                  ) : null}
                                  <AvatarFallback className="bg-gray-200 text-gray-600">
                                    {pupil.firstName[0]}{pupil.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Link
                                      href={`/pupil-detail?id=${pupil.id}`}
                                      className="font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors"
                                    >
                                      {formatPupilDisplayName(pupil)}
                                    </Link>
                                    <Badge variant={pupil.status === "Active" ? "default" : "secondary"}>
                                      {pupil.status}
                                    </Badge>
                                    {activeHoliday && (
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        Fees Holiday Active
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                                    <span>ID: {pupil.admissionNumber}</span>
                                    {pupil.className && (
                                      <>
                                        <span>•</span>
                                        <span>Class: {pupil.className}</span>
                                      </>
                                    )}
                                    <span>•</span>
                                    <span>{pupil.section}</span>
                                  </div>
                                  {activeHoliday && (
                                    <div className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                                      <p className="font-medium">
                                        {/* Handle both old format (single category) and new format (array) */}
                                        {(() => {
                                          const categories = Array.isArray(activeHoliday.categories)
                                            ? activeHoliday.categories
                                            : (activeHoliday as any).category
                                            ? [(activeHoliday as any).category]
                                            : [];
                                          return categories.map(cat => 
                                            cat === "required" ? "Required Fees" : "Non-Required Fees"
                                          ).join(" & ");
                                        })()}{" "}
                                        - {activeHoliday.discountType === "full"
                                          ? "100%"
                                          : activeHoliday.discountType === "half"
                                          ? "50%"
                                          : activeHoliday.discountType === "quarter"
                                          ? "25%"
                                          : `${activeHoliday.discountValue}%`}{" "}
                                        discount
                                      </p>
                                      {activeHoliday.reason && (
                                        <p className="text-blue-600 mt-1">Reason: {activeHoliday.reason}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleManageFeesHoliday(pupil, activeHoliday || undefined)}
                                >
                                  {activeHoliday ? (
                                    <>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit Holiday
                                    </>
                                  ) : (
                                    <>
                                      <Calendar className="mr-2 h-4 w-4" />
                                      Add Holiday
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Staff-Pupil Assignment Modal */}
      {selectedStaff && (
        <StaffPupilAssignmentModal
          open={isAssignmentModalOpen}
          onOpenChange={setIsAssignmentModalOpen}
          staff={selectedStaff}
        />
      )}

      {/* Fees Holiday Modal */}
      {selectedPupilForHoliday && (
        <FeesHolidayModal
          open={isFeesHolidayModalOpen}
          onOpenChange={(open) => {
            setIsFeesHolidayModalOpen(open);
            if (!open) {
              setSelectedPupilForHoliday(null);
              setSelectedHoliday(null);
            }
          }}
          pupilId={selectedPupilForHoliday.id}
          pupilName={formatPupilDisplayName(selectedPupilForHoliday)}
          existingHoliday={selectedHoliday}
        />
      )}
    </div>
  );
}

