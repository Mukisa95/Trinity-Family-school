'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Calendar, 
  Plus,
  Loader2,
  Edit,
  Trash2,
  Printer
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { 
  usePrefectoralPosts, 
  useDutyRotas, 
  useDutyAssignments, 
  useDeleteDutyRota,
  usePostAssignments,
  useDutyTimeline
} from '@/lib/hooks/use-duty-service';
import { useStaff } from '@/lib/hooks/use-staff';
import { usePupils } from '@/lib/hooks/use-pupils';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { ActionGuard } from '@/components/auth/action-guard';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { CreatePrefectoralPostModal } from '@/components/duty-service/PrefectoralManagement/CreatePrefectoralPostModal';
import { CreateDutyRotaModal } from '@/components/duty-service/DutyManagement/CreateDutyRotaModal';
import { EditDutyRotaModal } from '@/components/duty-service/DutyManagement/EditDutyRotaModal';

import { DutyTimelineView } from '@/components/duty-service/DutyManagement/DutyTimelineView';
import { PrefectoralManagementView } from '@/components/duty-service/PrefectoralManagement/PrefectoralManagementView';
import { DutyAssignment, DutyRota } from '@/types/duty-service';
import { generateDutyRotaPDF } from '@/lib/utils/pdf-generator';
import { DutyServiceService } from '@/lib/services/duty-service.service';
import { Toaster } from '@/components/ui/toaster';

export default function DutyServicePage() {
  const [activeTab, setActiveTab] = useState('prefectoral');
  const [selectedRotaForTimeline, setSelectedRotaForTimeline] = useState<string | null>(null);
  const [selectedRotaForEdit, setSelectedRotaForEdit] = useState<DutyRota | null>(null);
  const [showEditRotaModal, setShowEditRotaModal] = useState(false);
  const [printingRotaId, setPrintingRotaId] = useState<string | null>(null);
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const { data: prefectoralPosts = [], isLoading: postsLoading } = usePrefectoralPosts(activeAcademicYear?.id);
  const { data: dutyRotas = [], isLoading: rotasLoading } = useDutyRotas(activeAcademicYear?.id);
  const { data: dutyAssignments = [], isLoading: assignmentsLoading } = useDutyAssignments();
  const { data: postAssignments = [], isLoading: postAssignmentsLoading } = usePostAssignments();
  const { data: staff = [] } = useStaff();
  const { data: pupils = [] } = usePupils();
  const permissions = usePermissions();
  const deleteRota = useDeleteDutyRota();
  const { toast } = useToast();

  // Function to handle printing duty rota
  const handlePrintDutyRota = async (rota: DutyRota) => {
    setPrintingRotaId(rota.id);
    try {
      // Get the timeline data for this rota
      const timelineData = await DutyServiceService.getDutyTimeline(rota.id);
      
      if (timelineData) {
        // Find the academic year and term data
        const academicYearData = academicYears.find(ay => ay.id === rota.academicYearId);
        const termData = rota.termId ? academicYearData?.terms?.find(t => t.id === rota.termId) : null;
        
        await generateDutyRotaPDF({
          dutyRota: rota,
          timeline: timelineData,
          staff,
          pupils,
          academicYear: academicYearData,
          term: termData
        });
        toast({
          title: "PDF Generated Successfully",
          description: `Duty rota "${rota.dutyName}" has been downloaded as PDF.`,
        });
      } else {
        toast({
          title: "No Data Available",
          description: "No timeline data available for this duty rota.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error Generating PDF",
        description: "An error occurred while generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPrintingRotaId(null);
    }
  };

  // Function to get member name by ID and type
  const getMemberName = (memberId: string, memberType: string) => {
    if (memberType === 'staff') {
      const member = staff.find(s => s.id === memberId);
      return member ? `${member.firstName} ${member.lastName} (${member.employeeId})` : `Staff ID: ${memberId}`;
    } else if (memberType === 'prefects' || memberType === 'pupils') {
      const member = pupils.find(p => p.id === memberId);
      return member ? `${member.firstName} ${member.lastName} - ${member.className || 'No Class'}` : `Pupil ID: ${memberId}`;
    }
    return `Unknown ID: ${memberId}`;
  };

  // Function to get current week assignments for a duty rota
  const getCurrentWeekAssignments = (rotaId: string): DutyAssignment[] => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday end

    return dutyAssignments.filter(assignment => {
      if (assignment.rotaId !== rotaId || !assignment.isActive) return false;
      
      const assignmentStart = new Date(assignment.startDate);
      const assignmentEnd = new Date(assignment.endDate);
      
      // Check if the assignment overlaps with current week
      return isWithinInterval(assignmentStart, { start: weekStart, end: weekEnd }) ||
             isWithinInterval(assignmentEnd, { start: weekStart, end: weekEnd }) ||
             isWithinInterval(weekStart, { start: assignmentStart, end: assignmentEnd });
    });
  };

  // Function to get current week assignments grouped by team type
  const getCurrentWeekAssignmentsByTeam = (rotaId: string) => {
    const currentAssignments = getCurrentWeekAssignments(rotaId);
    
    const grouped = {
      staff: currentAssignments.filter(assignment => assignment.memberType === 'staff'),
      prefects: currentAssignments.filter(assignment => assignment.memberType === 'prefects'),
      pupils: currentAssignments.filter(assignment => assignment.memberType === 'pupils')
    };
    
    return grouped;
  };

  // Function to get member names for a specific team type
  const getMemberNamesForTeam = (assignments: DutyAssignment[], teamType: string) => {
    if (assignments.length === 0) return null;
    
    const memberNames = assignments.map(assignment => {
      if (teamType === 'staff') {
        const member = staff.find(s => s.id === assignment.memberId);
        return member ? `${member.firstName} ${member.lastName}` : `Staff ID: ${assignment.memberId}`;
      } else if (teamType === 'prefects' || teamType === 'pupils') {
        const member = pupils.find(p => p.id === assignment.memberId);
        return member ? `${member.firstName} ${member.lastName}` : `Pupil ID: ${assignment.memberId}`;
      }
      return `Unknown ID: ${assignment.memberId}`;
    });
    
    return memberNames.join(', ');
  };

  const canAccessDutyService = permissions.canAccessModule('duty_service');

  if (!canAccessDutyService) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-semibold">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to access the Duty & Service module.</p>
        </div>
      </div>
    );
  }

  const isLoading = postsLoading || rotasLoading || assignmentsLoading || postAssignmentsLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duty & Service Management"
        description="Manage leadership positions, duty rotas, assessments, and performance rankings"
        icon={Users}
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading duty and service data...</p>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prefectoral" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Prefectoral
            </TabsTrigger>
            <TabsTrigger value="duty-management" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Duty Management
            </TabsTrigger>
          </TabsList>



          <TabsContent value="prefectoral">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Prefectoral Management</CardTitle>
                    <CardDescription>
                      Manage leadership positions and assignments in hierarchical tree format
                    </CardDescription>
                  </div>
                  <ActionGuard module="duty_service" page="prefectoral" action="create_prefectoral_post">
                    <CreatePrefectoralPostModal />
                  </ActionGuard>
                </div>
              </CardHeader>
              <CardContent>
                <PrefectoralManagementView 
                  posts={prefectoralPosts}
                  assignments={postAssignments}
                  getPupilName={(pupilId) => {
                    const pupil = pupils.find(p => p.id === pupilId);
                    return pupil ? `${pupil.firstName} ${pupil.lastName}` : `Pupil ${pupilId.slice(0, 8)}`;
                  }}
                  getPupilClass={(pupilId) => {
                    const pupil = pupils.find(p => p.id === pupilId);
                    return pupil ? pupil.className || 'No Class' : 'Unknown Class';
                  }}
                  getPupilPhoto={(pupilId) => {
                    const pupil = pupils.find(p => p.id === pupilId);
                    return pupil?.photo || '';
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="duty-management">
            {selectedRotaForTimeline ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedRotaForTimeline(null)}
                  >
                    ← Back to Duty Rotas
                  </Button>
                </div>
                <DutyTimelineView rotaId={selectedRotaForTimeline} />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Duty Management</CardTitle>
                      <CardDescription>
                        Create and manage duty rotas and schedules
                      </CardDescription>
                    </div>
                    <ActionGuard module="duty_service" page="duty_management" action="create_duty_rota">
                      <CreateDutyRotaModal />
                    </ActionGuard>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dutyRotas.length === 0 ? (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Duty Rotas</h3>
                        <p className="text-muted-foreground mb-4">
                          Create your first duty rota to get started
                        </p>
                        <ActionGuard module="duty_service" page="duty_management" action="create_duty_rota">
                          <CreateDutyRotaModal 
                            trigger={
                              <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Create First Rota
                              </Button>
                            }
                          />
                        </ActionGuard>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left p-3 font-medium">Duty Name</th>
                              <th className="text-left p-3 font-medium">Status</th>
                              <th className="text-left p-3 font-medium">Frequency</th>
                              <th className="text-left p-3 font-medium">Teams</th>
                              <th className="text-left p-3 font-medium">Current Week Teachers</th>
                              <th className="text-left p-3 font-medium">Date Range</th>
                              <th className="text-left p-3 font-medium">Type</th>
                              <th className="text-left p-3 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dutyRotas.map((rota) => {
                              const currentAssignments = getCurrentWeekAssignmentsByTeam(rota.id);
                              const hasAssignments = currentAssignments.staff.length > 0 || 
                                                   currentAssignments.prefects.length > 0 || 
                                                   currentAssignments.pupils.length > 0;
                              
                              return (
                                <React.Fragment key={rota.id}>
                                  {/* Main row */}
                                  <tr className="border-b hover:bg-muted/30 transition-colors">
                                    <td className="p-3">
                                      <div className="font-medium">{rota.dutyName}</div>
                                    </td>
                                    <td className="p-3">
                                      <Badge variant={rota.isActive ? "default" : "secondary"}>
                                        {rota.isActive ? "Active" : "Inactive"}
                                      </Badge>
                                    </td>
                                    <td className="p-3">
                                      <span className="capitalize">{rota.frequency.replace('_', ' ')}</span>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex flex-wrap gap-1">
                                        {rota.teamsInvolved.map((team) => (
                                          <Badge key={team} variant="outline" className="text-xs">
                                            {team}
                                          </Badge>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm text-muted-foreground max-w-xs">
                                        {hasAssignments ? 'See rows below' : 'No assignments'}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm">
                                        <div>{format(new Date(rota.startDate), 'MMM dd, yyyy')}</div>
                                        <div className="text-muted-foreground">to</div>
                                        <div>{format(new Date(rota.endDate), 'MMM dd, yyyy')}</div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      {rota.isMarked ? (
                                        <Badge variant="secondary" className="text-xs">
                                          Academic Period
                                        </Badge>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">Custom</span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <div className="flex gap-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setSelectedRotaForTimeline(rota.id)}
                                          className="p-2 h-8 w-8"
                                          title="View Timeline"
                                        >
                                          <Calendar className="h-4 w-4" />
                                        </Button>

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedRotaForEdit(rota);
                                            setShowEditRotaModal(true);
                                          }}
                                          className="p-2 h-8 w-8"
                                          title="Edit Duty Rota"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            if (confirm('Are you sure you want to delete this duty rota? This action cannot be undone.')) {
                                              deleteRota.mutate(rota.id);
                                            }
                                          }}
                                          className="p-2 h-8 w-8 text-red-600 hover:text-red-700"
                                          title="Delete Duty Rota"
                                          disabled={deleteRota.isPending}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handlePrintDutyRota(rota)}
                                          className="p-2 h-8 w-8 text-blue-600 hover:text-blue-700"
                                          title="Print Duty Rota"
                                          disabled={printingRotaId === rota.id}
                                        >
                                          {printingRotaId === rota.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Printer className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  {/* Assignment detail rows */}
                                  {currentAssignments.staff.length > 0 && (
                                    <tr className="border-b bg-blue-50/30">
                                      <td className="p-3 pl-8">
                                        <div className="text-sm text-blue-600 font-medium">Staff</div>
                                      </td>
                                      <td colSpan={2} className="p-3">
                                        <div className="text-sm">
                                          {getMemberNamesForTeam(currentAssignments.staff, 'staff')}
                                        </div>
                                      </td>
                                      <td colSpan={5}></td>
                                    </tr>
                                  )}
                                  
                                  {currentAssignments.prefects.length > 0 && (
                                    <tr className="border-b bg-green-50/30">
                                      <td className="p-3 pl-8">
                                        <div className="text-sm text-green-600 font-medium">Prefects</div>
                                      </td>
                                      <td colSpan={2} className="p-3">
                                        <div className="text-sm">
                                          {getMemberNamesForTeam(currentAssignments.prefects, 'prefects')}
                                        </div>
                                      </td>
                                      <td colSpan={5}></td>
                                    </tr>
                                  )}
                                  
                                  {currentAssignments.pupils.length > 0 && (
                                    <tr className="border-b bg-purple-50/30">
                                      <td className="p-3 pl-8">
                                        <div className="text-sm text-purple-600 font-medium">Pupils</div>
                                      </td>
                                      <td colSpan={2} className="p-3">
                                        <div className="text-sm">
                                          {getMemberNamesForTeam(currentAssignments.pupils, 'pupils')}
                                        </div>
                                      </td>
                                      <td colSpan={5}></td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>






        </Tabs>
      )}

      {/* Edit Duty Rota Modal */}
      <EditDutyRotaModal
        rota={selectedRotaForEdit}
        open={showEditRotaModal}
        onOpenChange={setShowEditRotaModal}
      />
      
      {/* Toaster for notifications */}
      <Toaster />
    </div>
  );
}
