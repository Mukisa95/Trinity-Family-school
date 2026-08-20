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
import { DatePicker } from '@/components/common/date-picker';
import { format, parseISO, isValid } from 'date-fns';
import type { CreateDutyAssignmentData, TeamType } from '@/types/duty-service';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

const toDate = (s?: string) => { if (!s) return undefined; try { const d = parseISO(s); return isValid(d) ? d : undefined; } catch { return undefined; } };
const toStr = (d?: Date) => d ? format(d, 'yyyy-MM-dd') : '';

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
  const formValidation = useFormValidation([
    createFieldValidation('assignmentRota', formData.rotaId, 'Duty rota', true, { message: 'Choose the duty rota.' }),
    createFieldValidation('assignmentMember', formData.memberId, 'Member', true, { message: 'Choose the member to assign.' }),
    createFieldValidation('assignmentStartDate', formData.startDate, 'Start date', true, { message: 'Choose the assignment start date.' }),
    createFieldValidation('assignmentEndDate', formData.endDate, 'End date', true, {
      message: 'Choose the assignment end date.',
      validate: (value) => value && formData.startDate && String(value) < formData.startDate ? 'Choose an end date on or after the start date.' : undefined,
    }),
  ]);

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

    if (!formValidation.validateAll().isValid) return;

    try {
      await assignMemberToDuty.mutateAsync({
        rotaId: formData.rotaId!,
        memberId: formData.memberId!,
        memberType: formData.memberType as TeamType,
        isSupervisor: formData.isSupervisor || false,
        startDate: formData.startDate!,
        endDate: formData.endDate!,
        isActive: true,
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
      formValidation.setSubmissionError(error instanceof Error ? error.message : 'The member could not be assigned. Please try again.');
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

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
          <div className="space-y-2">
            <Label htmlFor="rotaId" className={formValidation.getFieldError('assignmentRota') ? 'text-destructive' : undefined}>Duty Rota *</Label>
            <Select
              value={formData.rotaId}
              onValueChange={(value) => { handleInputChange('rotaId', value); formValidation.handleFieldChange('assignmentRota'); }}
              disabled={!!rotaId}
            >
              <SelectTrigger {...formValidation.getFieldProps('assignmentRota')}>
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
            <FieldError error={formValidation.getFieldError('assignmentRota')} />
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
              <Label htmlFor="memberId" className={formValidation.getFieldError('assignmentMember') ? 'text-destructive' : undefined}>Select Member *</Label>
              <Select
                value={formData.memberId}
                onValueChange={(value) => { handleInputChange('memberId', value); formValidation.handleFieldChange('assignmentMember'); }}
                disabled={!formData.memberType}
              >
                <SelectTrigger {...formValidation.getFieldProps('assignmentMember')}>
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
              <FieldError error={formValidation.getFieldError('assignmentMember')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={formValidation.getFieldError('assignmentStartDate') ? 'text-destructive' : undefined}>Start Date *</Label>
              <DatePicker
                date={toDate(formData.startDate)}
                setDate={(d) => { handleInputChange('startDate', toStr(d)); formValidation.handleFieldChange('assignmentStartDate'); }}
                triggerProps={formValidation.getFieldProps('assignmentStartDate')}
                placeholder="Pick start date"
                allowFuture
              />
              <FieldError error={formValidation.getFieldError('assignmentStartDate')} />
            </div>
            <div className="space-y-2">
              <Label className={formValidation.getFieldError('assignmentEndDate') ? 'text-destructive' : undefined}>End Date *</Label>
              <DatePicker
                date={toDate(formData.endDate)}
                setDate={(d) => { handleInputChange('endDate', toStr(d)); formValidation.handleFieldChange('assignmentEndDate'); }}
                triggerProps={formValidation.getFieldProps('assignmentEndDate')}
                placeholder="Pick end date"
                allowFuture
              />
              <FieldError error={formValidation.getFieldError('assignmentEndDate')} />
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
