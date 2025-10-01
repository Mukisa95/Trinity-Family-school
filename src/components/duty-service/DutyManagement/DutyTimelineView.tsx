'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle, 
  Circle, 
  ArrowRight,
  Plus,
  Loader2,
  Eye,
  UserPlus,
  Edit,
  Trash2
} from 'lucide-react';
import { useDutyTimeline, useDeleteDutyAssignment } from '@/lib/hooks/use-duty-service';
import { useStaff } from '@/lib/hooks/use-staff';
import { usePupils } from '@/lib/hooks/use-pupils';
import { format, isSameMonth } from 'date-fns';
import { DutyTimeline, DutyPeriod, DutyAssignment } from '@/types/duty-service';
import { BulkAssignMembersModal } from './BulkAssignMembersModal';
import { EditAssignmentModal } from '../DutyAssessment/EditAssignmentModal';

interface DutyTimelineViewProps {
  rotaId: string;
}

export function DutyTimelineView({ rotaId }: DutyTimelineViewProps) {
  const { data: timeline, isLoading, error } = useDutyTimeline(rotaId);
  const { data: staff = [] } = useStaff();
  const { data: pupils = [] } = usePupils();
  const deleteAssignment = useDeleteDutyAssignment();
  const [selectedPeriod, setSelectedPeriod] = useState<DutyPeriod | null>(null);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<DutyAssignment | null>(null);
  const [showEditAssignmentModal, setShowEditAssignmentModal] = useState(false);

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

  // Function to get status icon
  const getStatusIcon = (period: DutyPeriod) => {
    if (period.isCompleted) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (period.isCurrent) {
      return <Clock className="h-4 w-4 text-blue-500" />;
    } else {
      return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Function to get status badge
  const getStatusBadge = (period: DutyPeriod) => {
    if (period.isCompleted) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">Completed</Badge>;
    } else if (period.isCurrent) {
      return <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">Current</Badge>;
    } else {
      return <Badge variant="outline" className="text-xs">Upcoming</Badge>;
    }
  };

  // Function to format dates intelligently
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isSameMonth(start, end)) {
      // Same month: "Sep 15 - 21, 2025"
      return `${format(start, 'MMM dd')} - ${format(end, 'dd, yyyy')}`;
    } else {
      // Different months: "Sep 15, 2025 - Oct 21, 2025"
      return `${format(start, 'MMM dd, yyyy')} - ${format(end, 'MMM dd, yyyy')}`;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading duty timeline...</p>
        </div>
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Timeline</h3>
          <p className="text-muted-foreground">Failed to load duty timeline</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {timeline.rotaName} Timeline
          </CardTitle>
          <CardDescription>
            {timeline.frequency} duty schedule with {timeline.totalPeriods} periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{timeline.totalPeriods}</div>
              <p className="text-sm text-muted-foreground">Total Periods</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{timeline.completedPeriods}</div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {timeline.currentPeriod ? 1 : 0}
              </div>
              <p className="text-sm text-muted-foreground">Current</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{timeline.upcomingPeriods.length}</div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Duty Periods</CardTitle>
              <CardDescription>
                View all periods and their assignments
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowBulkAssignModal(true)}
              disabled={!timeline.upcomingPeriods.length}
            >
              <Plus className="h-4 w-4 mr-2" />
              Bulk Assign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period & Status</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Assigned Members</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeline.periods.map((period) => (
                  <TableRow key={period.periodNumber}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(period)}
                        <div>
                          <div>{period.periodName}</div>
                          {getStatusBadge(period)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDateRange(period.startDate, period.endDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground max-w-xs">
                        {period.assignments.find(a => a.service)?.service || 'No service description'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {period.assignments.length === 0 ? (
                          <span className="text-muted-foreground text-sm">No assignments</span>
                        ) : (
                          (() => {
                            const staffAssignments = period.assignments.filter(a => a.memberType === 'staff');
                            const prefectAssignments = period.assignments.filter(a => a.memberType === 'prefects');
                            const pupilAssignments = period.assignments.filter(a => a.memberType === 'pupils');
                            
                            return (
                              <>
                                {staffAssignments.length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-xs font-medium text-blue-600 mb-1">Staff</div>
                                    {staffAssignments.map((assignment) => (
                                      <div key={assignment.id} className="text-sm ml-2">
                                        <div className="flex items-center gap-2">
                                          <Users className="h-3 w-3" />
                                          <span>{getMemberName(assignment.memberId, assignment.memberType)}</span>
                                          {assignment.isSupervisor && (
                                            <Badge variant="outline" className="text-xs">Supervisor</Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {prefectAssignments.length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-xs font-medium text-green-600 mb-1">Prefects</div>
                                    {prefectAssignments.map((assignment) => (
                                      <div key={assignment.id} className="text-sm ml-2">
                                        <div className="flex items-center gap-2">
                                          <Users className="h-3 w-3" />
                                          <span>{getMemberName(assignment.memberId, assignment.memberType)}</span>
                                          {assignment.isSupervisor && (
                                            <Badge variant="outline" className="text-xs">Supervisor</Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {pupilAssignments.length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-xs font-medium text-purple-600 mb-1">Pupils</div>
                                    {pupilAssignments.map((assignment) => (
                                      <div key={assignment.id} className="text-sm ml-2">
                                        <div className="flex items-center gap-2">
                                          <Users className="h-3 w-3" />
                                          <span>{getMemberName(assignment.memberId, assignment.memberType)}</span>
                                          {assignment.isSupervisor && (
                                            <Badge variant="outline" className="text-xs">Supervisor</Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPeriod(period)}
                              className="p-2 h-8 w-8"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                              <DialogTitle>{period.periodName} Details</DialogTitle>
                              <DialogDescription>
                                {formatDateRange(period.startDate, period.endDate)}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium mb-2">Assigned Members</h4>
                                {period.assignments.length === 0 ? (
                                  <p className="text-muted-foreground">No members assigned to this period</p>
                                ) : (
                                  <>
                                    {/* Service Description */}
                                    {period.assignments.some(a => a.service) && (
                                      <div className="mb-4 p-3 bg-blue-50 rounded border">
                                        <h5 className="text-sm font-medium text-blue-800 mb-1">Service Description</h5>
                                        <p className="text-sm text-blue-700">
                                          {period.assignments.find(a => a.service)?.service}
                                        </p>
                                      </div>
                                    )}
                                    <div className="space-y-4">
                                      {(() => {
                                        const staffAssignments = period.assignments.filter(a => a.memberType === 'staff');
                                        const prefectAssignments = period.assignments.filter(a => a.memberType === 'prefects');
                                        const pupilAssignments = period.assignments.filter(a => a.memberType === 'pupils');
                                        
                                        return (
                                          <>
                                            {staffAssignments.length > 0 && (
                                              <div>
                                                <h5 className="text-sm font-medium text-blue-600 mb-2">Staff</h5>
                                                <div className="space-y-2">
                                                                                                     {staffAssignments.map((assignment) => (
                                                     <div key={assignment.id} className="flex items-center justify-between p-2 border rounded bg-blue-50/30">
                                                       <div>
                                                         <p className="font-medium">
                                                           {getMemberName(assignment.memberId, assignment.memberType)}
                                                         </p>
                                                         <p className="text-sm text-muted-foreground">
                                                           Type: {assignment.memberType}
                                                         </p>
                                                         {assignment.service && (
                                                           <p className="text-sm text-blue-600 mt-1">
                                                             Service: {assignment.service}
                                                           </p>
                                                         )}
                                                       </div>
                                                       <div className="text-right">
                                                         {assignment.isSupervisor && (
                                                           <Badge variant="default">Supervisor</Badge>
                                                         )}
                                                         <p className="text-sm text-muted-foreground">
                                                           {assignment.isActive ? 'Active' : 'Inactive'}
                                                         </p>
                                                         <div className="flex gap-1 mt-2">
                                                           <Button
                                                             variant="outline"
                                                             size="sm"
                                                             onClick={() => {
                                                               setSelectedAssignment(assignment);
                                                               setShowEditAssignmentModal(true);
                                                             }}
                                                             className="p-1 h-6 w-6"
                                                             title="Edit Assignment"
                                                           >
                                                             <Edit className="h-3 w-3" />
                                                           </Button>
                                                           <Button
                                                             variant="outline"
                                                             size="sm"
                                                             onClick={() => {
                                                               if (confirm('Are you sure you want to delete this assignment?')) {
                                                                 deleteAssignment.mutate(assignment.id);
                                                               }
                                                             }}
                                                             className="p-1 h-6 w-6 text-red-600 hover:text-red-700"
                                                             title="Delete Assignment"
                                                             disabled={deleteAssignment.isPending}
                                                           >
                                                             <Trash2 className="h-3 w-3" />
                                                           </Button>
                                                         </div>
                                                       </div>
                                                     </div>
                                                   ))}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {prefectAssignments.length > 0 && (
                                              <div>
                                                <h5 className="text-sm font-medium text-green-600 mb-2">Prefects</h5>
                                                <div className="space-y-2">
                                                  {prefectAssignments.map((assignment) => (
                                                    <div key={assignment.id} className="flex items-center justify-between p-2 border rounded bg-green-50/30">
                                                      <div>
                                                        <p className="font-medium">
                                                          {getMemberName(assignment.memberId, assignment.memberType)}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                          Type: {assignment.memberType}
                                                        </p>
                                                        {assignment.service && (
                                                          <p className="text-sm text-green-600 mt-1">
                                                            Service: {assignment.service}
                                                          </p>
                                                        )}
                                                      </div>
                                                      <div className="text-right">
                                                        {assignment.isSupervisor && (
                                                          <Badge variant="default">Supervisor</Badge>
                                                        )}
                                                        <p className="text-sm text-muted-foreground">
                                                          {assignment.isActive ? 'Active' : 'Inactive'}
                                                        </p>
                                                        <div className="flex gap-1 mt-2">
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                              setSelectedAssignment(assignment);
                                                              setShowEditAssignmentModal(true);
                                                            }}
                                                            className="p-1 h-6 w-6"
                                                            title="Edit Assignment"
                                                          >
                                                            <Edit className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                              if (confirm('Are you sure you want to delete this assignment?')) {
                                                                deleteAssignment.mutate(assignment.id);
                                                              }
                                                            }}
                                                            className="p-1 h-6 w-6 text-red-600 hover:text-red-700"
                                                            title="Delete Assignment"
                                                            disabled={deleteAssignment.isPending}
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {pupilAssignments.length > 0 && (
                                              <div>
                                                <h5 className="text-sm font-medium text-purple-600 mb-2">Pupils</h5>
                                                <div className="space-y-2">
                                                  {pupilAssignments.map((assignment) => (
                                                    <div key={assignment.id} className="flex items-center justify-between p-2 border rounded bg-purple-50/30">
                                                      <div>
                                                        <p className="font-medium">
                                                          {getMemberName(assignment.memberId, assignment.memberType)}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                          Type: {assignment.memberType}
                                                        </p>
                                                        {assignment.service && (
                                                          <p className="text-sm text-purple-600 mt-1">
                                                            Service: {assignment.service}
                                                          </p>
                                                        )}
                                                      </div>
                                                      <div className="text-right">
                                                        {assignment.isSupervisor && (
                                                          <Badge variant="default">Supervisor</Badge>
                                                        )}
                                                        <p className="text-sm text-muted-foreground">
                                                          {assignment.isActive ? 'Active' : 'Inactive'}
                                                        </p>
                                                        <div className="flex gap-1 mt-2">
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                              setSelectedAssignment(assignment);
                                                              setShowEditAssignmentModal(true);
                                                            }}
                                                            className="p-1 h-6 w-6"
                                                            title="Edit Assignment"
                                                          >
                                                            <Edit className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                              if (confirm('Are you sure you want to delete this assignment?')) {
                                                                deleteAssignment.mutate(assignment.id);
                                                              }
                                                            }}
                                                            className="p-1 h-6 w-6 text-red-600 hover:text-red-700"
                                                            title="Delete Assignment"
                                                            disabled={deleteAssignment.isPending}
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        {!period.isCompleted && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPeriod(period);
                              setShowBulkAssignModal(true);
                            }}
                            className="p-2 h-8 w-8"
                            title="Assign Members"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <BulkAssignMembersModal
          rotaId={rotaId}
          selectedPeriod={selectedPeriod}
          onClose={() => {
            setShowBulkAssignModal(false);
            setSelectedPeriod(null);
          }}
        />
      )}

      {/* Edit Assignment Modal */}
      <EditAssignmentModal
        assignment={selectedAssignment}
        open={showEditAssignmentModal}
        onOpenChange={setShowEditAssignmentModal}
      />
    </div>
  );
}
