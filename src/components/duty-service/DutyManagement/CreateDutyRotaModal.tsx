'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2 } from 'lucide-react';
import { useCreateDutyRota } from '@/lib/hooks/use-duty-service';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useToast } from '@/hooks/use-toast';
import type { CreateDutyRotaData, DutyFrequency, TeamType } from '@/types/duty-service';

interface CreateDutyRotaModalProps {
  trigger?: React.ReactNode;
}

export function CreateDutyRotaModal({ trigger }: CreateDutyRotaModalProps) {
  const [open, setOpen] = useState(false);
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  const [formData, setFormData] = useState<Partial<CreateDutyRotaData>>({
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
    academicYearId: activeAcademicYear?.id || '',
    termId: undefined,
    isMarked: false,
  });
  const createDutyRota = useCreateDutyRota();
  const { toast } = useToast();

  // Update academicYearId when activeAcademicYear changes
  useEffect(() => {
    if (activeAcademicYear?.id && !formData.academicYearId) {
      setFormData(prev => ({
        ...prev,
        academicYearId: activeAcademicYear.id
      }));
    }
  }, [activeAcademicYear?.id, formData.academicYearId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.dutyName || !formData.academicYearId || !formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.teamsInvolved.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one team",
        variant: "destructive",
      });
      return;
    }

    try {
      await createDutyRota.mutateAsync({
        dutyName: formData.dutyName,
        teamsInvolved: formData.teamsInvolved as TeamType[],
        frequency: formData.frequency as DutyFrequency,
        startDate: formData.startDate,
        endDate: formData.endDate,
        allowances: formData.allowances!,
        academicYearId: formData.academicYearId,
        termId: formData.termId,
      });

      setOpen(false);
      setFormData({
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
        academicYearId: activeAcademicYear?.id || '',
        termId: undefined,
        isMarked: false,
      });
    } catch (error) {
      console.error('Error creating duty rota:', error);
    }
  };

  const handleInputChange = (field: keyof CreateDutyRotaData, value: any) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };

      // Handle automatic date setting for marked duty rotas
      if (field === 'isMarked' && value === true) {
        if (updated.frequency === 'weekly' || updated.frequency === 'daily' || updated.frequency === 'termly') {
          if (updated.termId && activeAcademicYear) {
            const selectedTerm = activeAcademicYear.terms?.find(term => term.id === updated.termId);
            if (selectedTerm) {
              updated.startDate = selectedTerm.startDate;
              updated.endDate = selectedTerm.endDate;
            }
          } else if (activeAcademicYear) {
            // If no term selected, use academic year dates
            updated.startDate = activeAcademicYear.startDate;
            updated.endDate = activeAcademicYear.endDate;
          }
        }
      }

      return updated;
    });
  };

  const handleTeamToggle = (team: TeamType) => {
    setFormData(prev => ({
      ...prev,
      teamsInvolved: prev.teamsInvolved?.includes(team)
        ? prev.teamsInvolved.filter(t => t !== team)
        : [...(prev.teamsInvolved || []), team]
    }));
  };

  const handleAllowanceChange = (team: TeamType, value: string) => {
    setFormData(prev => ({
      ...prev,
      allowances: {
        ...prev.allowances!,
        [team]: parseInt(value) || 0
      }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Rota
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create Duty Rota</DialogTitle>
          <DialogDescription>
            Create a new duty schedule for staff, prefects, or pupils
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dutyName">Duty Name *</Label>
              <Input
                id="dutyName"
                value={formData.dutyName}
                onChange={(e) => handleInputChange('dutyName', e.target.value)}
                placeholder="e.g., Staff Weekly Duty, Sanitary Duty"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => handleInputChange('frequency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One Time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="termly">Termly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
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
                disabled={formData.isMarked && (formData.frequency === 'weekly' || formData.frequency === 'daily' || formData.frequency === 'termly')}
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
                disabled={formData.isMarked && (formData.frequency === 'weekly' || formData.frequency === 'daily' || formData.frequency === 'termly')}
              />
            </div>
          </div>

          {/* Marked Duty Rota Option */}
          {(formData.frequency === 'weekly' || formData.frequency === 'daily' || formData.frequency === 'termly') && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isMarked"
                checked={formData.isMarked}
                onCheckedChange={(checked) => handleInputChange('isMarked', checked)}
              />
              <Label htmlFor="isMarked" className="text-sm">
                Mark as Academic Period Duty (automatically uses {formData.termId ? 'selected term' : 'academic year'} dates)
              </Label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="academicYear">Academic Year *</Label>
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
            
            <div className="space-y-2">
              <Label htmlFor="term">Term</Label>
              <Select
                value={formData.termId || 'none'}
                onValueChange={(value) => handleInputChange('termId', value === 'none' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific term</SelectItem>
                  {activeAcademicYear?.terms?.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Teams Selection */}
          <div className="space-y-4">
            <Label>Teams Involved *</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="staff"
                  checked={formData.teamsInvolved?.includes('staff')}
                  onCheckedChange={() => handleTeamToggle('staff')}
                />
                <Label htmlFor="staff">Staff</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prefects"
                  checked={formData.teamsInvolved?.includes('prefects')}
                  onCheckedChange={() => handleTeamToggle('prefects')}
                />
                <Label htmlFor="prefects">Prefects</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pupils"
                  checked={formData.teamsInvolved?.includes('pupils')}
                  onCheckedChange={() => handleTeamToggle('pupils')}
                />
                <Label htmlFor="pupils">Pupils</Label>
              </div>
            </div>
          </div>

          {/* Allowances */}
          <div className="space-y-4">
            <Label>Allowances (KES per period)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staffAllowance">Staff Allowance</Label>
                <Input
                  id="staffAllowance"
                  type="number"
                  value={formData.allowances?.staff || 0}
                  onChange={(e) => handleAllowanceChange('staff', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefectsAllowance">Prefects Allowance</Label>
                <Input
                  id="prefectsAllowance"
                  type="number"
                  value={formData.allowances?.prefects || 0}
                  onChange={(e) => handleAllowanceChange('prefects', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pupilsAllowance">Pupils Allowance</Label>
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

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details about this duty rota..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createDutyRota.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createDutyRota.isPending}
            >
              {createDutyRota.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Rota
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
