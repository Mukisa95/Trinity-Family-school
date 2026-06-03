'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2 } from 'lucide-react';
import { useCreateBulkDutyAssignment, useDutyTimeline, usePrefectoralPosts, usePostAssignments } from '@/lib/hooks/use-duty-service';
import { useStaff } from '@/lib/hooks/use-staff';
import { usePupils } from '@/lib/hooks/use-pupils';
import { format } from 'date-fns';
import { DutyPeriod, TeamType, CreateBulkDutyAssignmentData } from '@/types/duty-service';

interface BulkAssignMembersModalProps {
  rotaId: string;
  selectedPeriod?: DutyPeriod | null;
  onClose: () => void;
}

interface AssignmentEntry {
  id: string;
  memberId: string;
  memberType: TeamType;
  isSupervisor: boolean;
}

export function BulkAssignMembersModal({ rotaId, selectedPeriod, onClose }: BulkAssignMembersModalProps) {
  const { data: timeline } = useDutyTimeline(rotaId);
  const { data: staff = [] } = useStaff();
  const { data: pupils = [] } = usePupils();
  const { data: prefectoralPosts = [] } = usePrefectoralPosts();
  const { data: postAssignments = [] } = usePostAssignments();
  const createBulkAssignment = useCreateBulkDutyAssignment();
  
  const [selectedPeriodNumber, setSelectedPeriodNumber] = useState<number>(
    selectedPeriod?.periodNumber || 1
  );
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [serviceDescription, setServiceDescription] = useState<string>('');
  const [newAssignment, setNewAssignment] = useState<{
    memberId: string;
    memberType: TeamType;
    isSupervisor: boolean;
  }>({
    memberId: '',
    memberType: 'staff',
    isSupervisor: false,
  });

  const activeStaff = staff.filter(s => s.status === 'active');
  const activePupils = pupils.filter(p => p.status === 'Active');

  // Get active prefects (pupils assigned to prefectoral posts)
  const activePrefects = React.useMemo(() => {
    const activeAssignments = postAssignments.filter(assignment => assignment.isActive);
    const prefectPupilIds = activeAssignments.map(assignment => assignment.pupilId);
    return pupils.filter(pupil => 
      pupil.status === 'Active' && prefectPupilIds.includes(pupil.id)
    );
  }, [postAssignments, pupils]);

  // Function to get member name by ID and type
  const getMemberName = (memberId: string, memberType: string) => {
    if (memberType === 'staff') {
      const member = staff.find(s => s.id === memberId);
      return member ? `${member.firstName} ${member.lastName} (${member.employeeId})` : `Staff ID: ${memberId}`;
    } else if (memberType === 'prefects') {
      const member = activePrefects.find(p => p.id === memberId);
      if (member) {
        const assignment = postAssignments.find(a => a.pupilId === memberId && a.isActive);
        const post = assignment ? prefectoralPosts.find(p => p.id === assignment.postId) : null;
        return `${member.firstName} ${member.lastName} - ${post?.postName || 'Prefect'} (${member.className || 'No Class'})`;
      }
      return `Prefect ID: ${memberId}`;
    } else if (memberType === 'pupils') {
      const member = pupils.find(p => p.id === memberId);
      return member ? `${member.firstName} ${member.lastName} - ${member.className || 'No Class'}` : `Pupil ID: ${memberId}`;
    }
    return `Unknown ID: ${memberId}`;
  };

  // Function to get available members based on type
  const getAvailableMembers = (memberType: TeamType) => {
    switch (memberType) {
      case 'staff':
        return activeStaff;
      case 'prefects':
        return activePrefects;
      case 'pupils':
        return activePupils;
      default:
        return [];
    }
  };

  // Function to add new assignment
  const addAssignment = () => {
    if (!newAssignment.memberId) return;

    // Check if member is already assigned
    const isAlreadyAssigned = assignments.some(
      a => a.memberId === newAssignment.memberId && a.memberType === newAssignment.memberType
    );

    if (isAlreadyAssigned) {
      return; // Don't add duplicate
    }

    setAssignments(prev => [
      ...prev,
      {
        id: `${newAssignment.memberId}-${newAssignment.memberType}-${Date.now()}`,
        ...newAssignment
      }
    ]);

    setNewAssignment({
      memberId: '',
      memberType: 'staff',
      isSupervisor: false,
    });
  };

  // Function to remove assignment
  const removeAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  // Function to toggle supervisor status
  const toggleSupervisor = (id: string) => {
    setAssignments(prev => 
      prev.map(a => 
        a.id === id ? { ...a, isSupervisor: !a.isSupervisor } : a
      )
    );
  };

  // Function to handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (assignments.length === 0) {
      return;
    }

    const data: CreateBulkDutyAssignmentData = {
      rotaId,
      periodNumber: selectedPeriodNumber,
      service: serviceDescription || undefined,
      assignments: assignments.map(({ memberId, memberType, isSupervisor }) => ({
        memberId,
        memberType,
        isSupervisor,
      })),
    };

    try {
      await createBulkAssignment.mutateAsync(data);
      onClose();
    } catch (error) {
      console.error('Error creating bulk assignment:', error);
    }
  };

  const targetPeriod = timeline?.periods.find(p => p.periodNumber === selectedPeriodNumber);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Assign Members to Duty</DialogTitle>
          <DialogDescription>
            Assign multiple members to a specific duty period
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Period Selection */}
          <div className="space-y-2">
            <Label htmlFor="period">Select Period</Label>
            <Select
              value={selectedPeriodNumber.toString()}
              onValueChange={(value) => setSelectedPeriodNumber(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a period" />
              </SelectTrigger>
              <SelectContent>
                {timeline?.periods
                  .filter(period => !period.isCompleted)
                  .map((period) => (
                    <SelectItem key={period.periodNumber} value={period.periodNumber.toString()}>
                      {period.periodName} ({format(new Date(period.startDate), 'MMM dd')} - {format(new Date(period.endDate), 'MMM dd, yyyy')})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            
            {targetPeriod && (
              <div className="text-sm text-muted-foreground">
                {targetPeriod.periodName}: {format(new Date(targetPeriod.startDate), 'MMM dd, yyyy')} - {format(new Date(targetPeriod.endDate), 'MMM dd, yyyy')}
              </div>
            )}
          </div>

          {/* Service Description */}
          <div className="space-y-2">
            <Label htmlFor="service">Service Description</Label>
            <Textarea
              id="service"
              placeholder="Describe what the team will be doing during this duty period (e.g., 'Monitor library during study hours', 'Assist with morning assembly', 'Supervise lunch break')"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Provide specific details about the service or responsibilities for this assignment period
            </p>
          </div>

          {/* Current Assignments */}
          {targetPeriod && targetPeriod.assignments.length > 0 && (
            <div className="space-y-2">
              <Label>Current Assignments</Label>
              <div className="space-y-2">
                {targetPeriod.assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">
                        {getMemberName(assignment.memberId, assignment.memberType)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Type: {assignment.memberType}
                      </p>
                    </div>
                    <div className="text-right">
                      {assignment.isSupervisor && (
                        <Badge variant="default">Supervisor</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Assignment */}
          <div className="space-y-4">
            <Label>Add New Assignments</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="memberType">Member Type</Label>
                <Select
                  value={newAssignment.memberType}
                  onValueChange={(value: TeamType) => setNewAssignment(prev => ({ ...prev, memberType: value, memberId: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="prefects">Prefect</SelectItem>
                    <SelectItem value="pupils">Pupil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="memberId">Member</Label>
                <Select
                  value={newAssignment.memberId}
                  onValueChange={(value) => setNewAssignment(prev => ({ ...prev, memberId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${newAssignment.memberType}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableMembers(newAssignment.memberType).map((member) => {
                      if (newAssignment.memberType === 'prefects') {
                        const assignment = postAssignments.find(a => a.pupilId === member.id && a.isActive);
                        const post = assignment ? prefectoralPosts.find(p => p.id === assignment.postId) : null;
                        return (
                          <SelectItem key={member.id} value={member.id}>
                            {member.firstName} {member.lastName} - {post?.postName || 'Prefect'} ({member.className || 'No Class'})
                          </SelectItem>
                        );
                      }
                      return (
                        <SelectItem key={member.id} value={member.id}>
                          {member.firstName} {member.lastName}
                          {newAssignment.memberType === 'staff' && ` (${member.employeeId})`}
                          {newAssignment.memberType === 'pupils' ? ` - ${member.className || 'No Class'}` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isSupervisor"
                    checked={newAssignment.isSupervisor}
                    onCheckedChange={(checked) => setNewAssignment(prev => ({ ...prev, isSupervisor: checked as boolean }))}
                  />
                  <Label htmlFor="isSupervisor" className="text-sm">Supervisor</Label>
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={addAssignment}
              disabled={!newAssignment.memberId}
              variant="outline"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Assignment
            </Button>
          </div>

          {/* Assignment List */}
          {assignments.length > 0 && (
            <div className="space-y-2">
              <Label>New Assignments</Label>
              <div className="space-y-2">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">
                        {getMemberName(assignment.memberId, assignment.memberType)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Type: {assignment.memberType}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={assignment.isSupervisor}
                          onCheckedChange={() => toggleSupervisor(assignment.id)}
                        />
                        <Label className="text-sm">Supervisor</Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAssignment(assignment.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createBulkAssignment.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createBulkAssignment.isPending || assignments.length === 0}
            >
              {createBulkAssignment.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Assign {assignments.length} Member{assignments.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
