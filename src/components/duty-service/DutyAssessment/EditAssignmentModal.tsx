'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useUpdateDutyAssignment } from '@/lib/hooks/use-duty-service';
import { useStaff } from '@/lib/hooks/use-staff';
import { usePupils } from '@/lib/hooks/use-pupils';
import { DutyAssignment, TeamType } from '@/types/duty-service';

interface EditAssignmentModalProps {
  assignment: DutyAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAssignmentModal({ assignment, open, onOpenChange }: EditAssignmentModalProps) {
  const { data: staff = [] } = useStaff();
  const { data: pupils = [] } = usePupils();
  const updateAssignment = useUpdateDutyAssignment();
  
  const [formData, setFormData] = useState<Partial<DutyAssignment>>({
    memberId: '',
    memberType: 'staff',
    isSupervisor: false,
    startDate: '',
    endDate: '',
    service: '',
  });

  // Initialize form data when assignment changes
  useEffect(() => {
    if (assignment) {
      setFormData({
        memberId: assignment.memberId,
        memberType: assignment.memberType,
        isSupervisor: assignment.isSupervisor,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        service: assignment.service || '',
      });
    }
  }, [assignment]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assignment) return;

    try {
      await updateAssignment.mutateAsync({
        id: assignment.id,
        data: {
          memberId: formData.memberId,
          memberType: formData.memberType as TeamType,
          isSupervisor: formData.isSupervisor || false,
          startDate: formData.startDate,
          endDate: formData.endDate,
          service: formData.service || undefined,
        }
      });
      
      onOpenChange(false);
      setFormData({
        memberId: '',
        memberType: 'staff',
        isSupervisor: false,
        startDate: '',
        endDate: '',
        service: '',
      });
    } catch (error) {
      console.error('Error updating assignment:', error);
    }
  };

  const getMemberOptions = (memberType: string) => {
    if (memberType === 'staff') {
      return staff.filter(s => s.status === 'active').map(s => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName} (${s.employeeId})`
      }));
    } else if (memberType === 'prefects' || memberType === 'pupils') {
      return pupils.filter(p => p.status === 'active').map(p => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName} - ${p.className || 'No Class'}`
      }));
    }
    return [];
  };

  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Duty Assignment</DialogTitle>
          <DialogDescription>
            Update the assignment details for this duty period.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Member Type */}
          <div className="space-y-2">
            <Label htmlFor="memberType">Member Type</Label>
            <Select
              value={formData.memberType}
              onValueChange={(value) => {
                handleInputChange('memberType', value);
                handleInputChange('memberId', ''); // Reset member selection
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select member type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="prefects">Prefects</SelectItem>
                <SelectItem value="pupils">Pupils</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Member Selection */}
          <div className="space-y-2">
            <Label htmlFor="memberId">Member</Label>
            <Select
              value={formData.memberId}
              onValueChange={(value) => handleInputChange('memberId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {getMemberOptions(formData.memberType || 'staff').map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Supervisor Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isSupervisor"
              checked={formData.isSupervisor}
              onCheckedChange={(checked) => handleInputChange('isSupervisor', checked)}
            />
            <Label htmlFor="isSupervisor">Is Supervisor</Label>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Service Description */}
          <div className="space-y-2">
            <Label htmlFor="service">Service Description</Label>
            <Textarea
              id="service"
              placeholder="Describe what this member will be doing during their duty assignment (e.g., 'Monitor library during study hours', 'Assist with morning assembly', 'Supervise lunch break')"
              value={formData.service}
              onChange={(e) => handleInputChange('service', e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Provide specific details about the service or responsibilities for this assignment
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateAssignment.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateAssignment.isPending || !formData.memberId}
            >
              {updateAssignment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Assignment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
