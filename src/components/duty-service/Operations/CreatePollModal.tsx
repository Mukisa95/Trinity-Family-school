'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { useCreatePoll } from '@/lib/hooks/use-duty-service';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useToast } from '@/hooks/use-toast';
import type { CreatePollData, PollType } from '@/types/duty-service';

interface CreatePollModalProps {
  trigger?: React.ReactNode;
}

export function CreatePollModal({ trigger }: CreatePollModalProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CreatePollData>>({
    pollType: 'best_staff',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    academicYearId: '',
  });

  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const createPoll = useCreatePoll();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.academicYearId || !formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await createPoll.mutateAsync({
        pollType: formData.pollType as PollType,
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        academicYearId: formData.academicYearId,
      });

      setOpen(false);
      setFormData({
        pollType: 'best_staff',
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        academicYearId: activeAcademicYear?.id || '',
      });
    } catch (error) {
      console.error('Error creating poll:', error);
    }
  };

  const handleInputChange = (field: keyof CreatePollData, value: any) => {
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
            Create Poll
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Poll</DialogTitle>
          <DialogDescription>
            Create a new poll for voting on best performers
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pollType">Poll Type *</Label>
              <Select
                value={formData.pollType}
                onValueChange={(value) => handleInputChange('pollType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select poll type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="best_staff">Best Staff</SelectItem>
                  <SelectItem value="best_prefect">Best Prefect</SelectItem>
                  <SelectItem value="best_pupil">Best Pupil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Poll Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="e.g., Best Staff Member of the Month"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe what this poll is about..."
              rows={3}
            />
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

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createPoll.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createPoll.isPending}
            >
              {createPoll.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Poll
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
