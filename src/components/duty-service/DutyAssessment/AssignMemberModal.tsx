'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { useAssignMemberToDuty, useDutyRotas, usePrefectoralPosts, usePostAssignments } from '@/lib/hooks/use-duty-service';
import { useStaff } from '@/lib/hooks/use-staff';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useToast } from '@/hooks/use-toast';
import type { CreateDutyAssignmentData, TeamType } from '@/types/duty-service';

interface AssignMemberModalProps {
  trigger?: React.ReactNode;
  rotaId?: string;
}

export function AssignMemberModal({ trigger, rotaId }: AssignMemberModalProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateDutyAssignmentData>>({
    rotaId: rotaId || '',
    memberId: '',
    memberType: 'staff',
    isSupervisor: false,
    startDate: '',
    endDate: '',
    service: '',
  });

  const { data: dutyRotas = [] } = useDutyRotas();
  const { data: staff = [] } = useStaff();
  const { data: pupils = [] } = usePupils();
  const { data: prefectoralPosts = [] } = usePrefectoralPosts();
  const { data: postAssignments = [] } = usePostAssignments();
  const assignMemberToDuty = useAssignMemberToDuty();
  const { toast } = useToast();

  // Filter active staff and pupils
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.rotaId || !formData.memberId || !formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await assignMemberToDuty.mutateAsync({
        rotaId: formData.rotaId,
        memberId: formData.memberId,
        memberType: formData.memberType as TeamType,
        isSupervisor: formData.isSupervisor || false,
        startDate: formData.startDate,
        endDate: formData.endDate,
        service: formData.service || undefined,
      });

      setOpen(false);
      setFormData({
        rotaId: rotaId || '',
        memberId: '',
        memberType: 'staff',
        isSupervisor: false,
        startDate: '',
        endDate: '',
        service: '',
      });
    } catch (error) {
      console.error('Error assigning member to duty:', error);
    }
  };

  const handleInputChange = (field: keyof CreateDutyAssignmentData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Assign Member
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Member to Duty</DialogTitle>
          <DialogDescription>
            Assign a staff member, prefect, or pupil to a specific duty
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="rotaId">Duty Rota *</Label>
            <Select
              value={formData.rotaId}
              onValueChange={(value) => handleInputChange('rotaId', value)}
              disabled={!!rotaId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select duty rota" />
              </SelectTrigger>
              <SelectContent>
                {dutyRotas.map((rota) => (
                  <SelectItem key={rota.id} value={rota.id}>
                    {rota.dutyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="memberType">Member Type *</Label>
              <Select
                value={formData.memberType}
                onValueChange={(value) => {
                  handleInputChange('memberType', value);
                  // Reset member selection when type changes
                  handleInputChange('memberId', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="prefects">Prefect</SelectItem>
                  <SelectItem value="pupils">Pupil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="memberId">Select Member *</Label>
              <Select
                value={formData.memberId}
                onValueChange={(value) => handleInputChange('memberId', value)}
                disabled={!formData.memberType}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${formData.memberType || 'member'}`} />
                </SelectTrigger>
                <SelectContent>
                  {formData.memberType === 'staff' && activeStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName} ({member.employeeId})
                    </SelectItem>
                  ))}
                  {formData.memberType === 'prefects' && activePrefects.map((member) => {
                    const assignment = postAssignments.find(a => a.pupilId === member.id && a.isActive);
                    const post = assignment ? prefectoralPosts.find(p => p.id === assignment.postId) : null;
                    return (
                      <SelectItem key={member.id} value={member.id}>
                        {member.firstName} {member.lastName} - {post?.postName || 'Prefect'} ({member.className || 'No Class'})
                      </SelectItem>
                    );
                  })}
                  {formData.memberType === 'pupils' && activePupils.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName} - {member.className || 'No Class'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isSupervisor"
              checked={formData.isSupervisor}
              onCheckedChange={(checked) => handleInputChange('isSupervisor', checked)}
            />
            <Label htmlFor="isSupervisor">Is Supervisor</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Service Description</Label>
            <Textarea
              id="service"
              placeholder="Describe what this member/team will be doing during their duty assignment (e.g., 'Monitor library during study hours', 'Assist with morning assembly', 'Supervise lunch break')"
              value={formData.service}
              onChange={(e) => handleInputChange('service', e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Provide specific details about the service or responsibilities for this assignment
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={assignMemberToDuty.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={assignMemberToDuty.isPending}
            >
              {assignMemberToDuty.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Assign Member
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
