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
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/common/date-picker';
import { format, parseISO, isValid } from 'date-fns';
import type { CreatePollData, PollType } from '@/types/duty-service';

const toDate = (s?: string) => { if (!s) return undefined; try { const d = parseISO(s); return isValid(d) ? d : undefined; } catch { return undefined; } };
const toStr = (d?: Date) => d ? format(d, 'yyyy-MM-dd') : '';

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
  });

  const createPoll = useCreatePoll();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.startDate || !formData.endDate) {
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
        isActive: true,
      });

      setOpen(false);
      setFormData({
        pollType: 'best_staff',
        title: '',
        description: '',
        startDate: '',
        endDate: '',
      });
    } catch (error) {
      console.error('Error creating poll:', error);
    }
  };

  const handleInputChange = (field: keyof CreatePollData, value: any) => {
    setFormData((prev: Partial<CreatePollData>) => ({
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
              <Label>Start Date *</Label>
              <DatePicker
                date={toDate(formData.startDate)}
                setDate={(d) => handleInputChange('startDate', toStr(d))}
                placeholder="Pick start date"
                allowFuture
              />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <DatePicker
                date={toDate(formData.endDate)}
                setDate={(d) => handleInputChange('endDate', toStr(d))}
                placeholder="Pick end date"
                allowFuture
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
