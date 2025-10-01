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
import { useUpdateDutyRota } from '@/lib/hooks/use-duty-service';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { DutyRota, DutyFrequency } from '@/types/duty-service';

interface EditDutyRotaModalProps {
  rota: DutyRota | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDutyRotaModal({ rota, open, onOpenChange }: EditDutyRotaModalProps) {
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const updateRota = useUpdateDutyRota();
  
  const [formData, setFormData] = useState<Partial<DutyRota>>({
    dutyName: '',
    teamsInvolved: [],
    frequency: 'weekly',
    startDate: '',
    endDate: '',
    allowances: {
      staff: 0,
      prefects: 0,
      pupils: 0
    },
    academicYearId: '',
    termId: '',
    isMarked: false,
  });

  // Initialize form data when rota changes
  useEffect(() => {
    if (rota) {
      setFormData({
        dutyName: rota.dutyName,
        teamsInvolved: rota.teamsInvolved,
        frequency: rota.frequency,
        startDate: rota.startDate,
        endDate: rota.endDate,
        allowances: rota.allowances,
        academicYearId: rota.academicYearId,
        termId: rota.termId,
        isMarked: rota.isMarked || false,
      });
    }
  }, [rota]);

  // Update academicYearId when activeAcademicYear changes
  useEffect(() => {
    if (activeAcademicYear && !formData.academicYearId) {
      setFormData(prev => ({ ...prev, academicYearId: activeAcademicYear.id }));
    }
  }, [activeAcademicYear, formData.academicYearId]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAllowanceChange = (teamType: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      allowances: {
        ...prev.allowances!,
        [teamType]: numValue
      }
    }));
  };

  const handleTeamToggle = (teamType: string) => {
    setFormData(prev => ({
      ...prev,
      teamsInvolved: prev.teamsInvolved?.includes(teamType)
        ? prev.teamsInvolved.filter(t => t !== teamType)
        : [...(prev.teamsInvolved || []), teamType]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!rota) return;

    try {
      await updateRota.mutateAsync({
        id: rota.id,
        data: {
          dutyName: formData.dutyName,
          teamsInvolved: formData.teamsInvolved,
          frequency: formData.frequency as DutyFrequency,
          startDate: formData.startDate,
          endDate: formData.endDate,
          allowances: formData.allowances,
          academicYearId: formData.academicYearId,
          termId: formData.termId,
          isMarked: formData.isMarked,
        }
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating duty rota:', error);
    }
  };

  if (!rota) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Duty Rota</DialogTitle>
          <DialogDescription>
            Update the duty rota configuration and settings.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Duty Name */}
          <div className="space-y-2">
            <Label htmlFor="dutyName">Duty Name</Label>
            <Input
              id="dutyName"
              value={formData.dutyName}
              onChange={(e) => handleInputChange('dutyName', e.target.value)}
              placeholder="e.g., Staff Weekly Duty, Library Duty"
              required
            />
          </div>

          {/* Teams Involved */}
          <div className="space-y-2">
            <Label>Teams Involved</Label>
            <div className="space-y-2">
              {['staff', 'prefects', 'pupils'].map((team) => (
                <div key={team} className="flex items-center space-x-2">
                  <Checkbox
                    id={team}
                    checked={formData.teamsInvolved?.includes(team)}
                    onCheckedChange={() => handleTeamToggle(team)}
                  />
                  <Label htmlFor={team} className="capitalize">{team}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              value={formData.frequency}
              onValueChange={(value) => handleInputChange('frequency', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">One Time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="termly">Termly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Academic Year */}
          <div className="space-y-2">
            <Label htmlFor="academicYear">Academic Year</Label>
            <Select
              value={formData.academicYearId}
              onValueChange={(value) => handleInputChange('academicYearId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select academic year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Term */}
          <div className="space-y-2">
            <Label htmlFor="term">Term</Label>
            <Select
              value={formData.termId}
              onValueChange={(value) => handleInputChange('termId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific term</SelectItem>
                {academicYears
                  .find(y => y.id === formData.academicYearId)
                  ?.terms?.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Marked Checkbox (for weekly, daily, termly) */}
          {['weekly', 'daily', 'termly'].includes(formData.frequency || '') && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isMarked"
                checked={formData.isMarked}
                onCheckedChange={(checked) => handleInputChange('isMarked', checked)}
              />
              <Label htmlFor="isMarked">Marked (Use academic year/term dates automatically)</Label>
            </div>
          )}

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

          {/* Allowances */}
          <div className="space-y-4">
            <Label>Allowances (per period)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staffAllowance">Staff</Label>
                <Input
                  id="staffAllowance"
                  type="number"
                  value={formData.allowances?.staff || 0}
                  onChange={(e) => handleAllowanceChange('staff', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefectsAllowance">Prefects</Label>
                <Input
                  id="prefectsAllowance"
                  type="number"
                  value={formData.allowances?.prefects || 0}
                  onChange={(e) => handleAllowanceChange('prefects', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pupilsAllowance">Pupils</Label>
                <Input
                  id="pupilsAllowance"
                  type="number"
                  value={formData.allowances?.pupils || 0}
                  onChange={(e) => handleAllowanceChange('pupils', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateRota.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateRota.isPending || !formData.dutyName}
            >
              {updateRota.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Duty Rota
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
