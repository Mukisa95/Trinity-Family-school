'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { useCreatePrefectoralPost } from '@/lib/hooks/use-duty-service';
import type { CreatePrefectoralPostData, PositionOfHonour } from '@/types/duty-service';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

interface CreatePrefectoralPostModalProps {
  trigger?: React.ReactNode;
}

export function CreatePrefectoralPostModal({ trigger }: CreatePrefectoralPostModalProps) {
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<CreatePrefectoralPostData>>({
    postName: '',
    positionOfHonour: 1,
    allowance: undefined,
  });
  const createPrefectoralPost = useCreatePrefectoralPost();
  const formValidation = useFormValidation([
    createFieldValidation('postName', formData.postName, 'Post name', true, { message: 'Enter the prefectoral post name.' }),
    createFieldValidation('positionOfHonour', formData.positionOfHonour, 'Position of honour', true, { message: 'Choose the position of honour.' }),
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formValidation.validateAll().isValid) return;

    try {
      await createPrefectoralPost.mutateAsync({
        postName: formData.postName!,
        positionOfHonour: formData.positionOfHonour as PositionOfHonour,
        allowance: formData.allowance,
        isActive: true,
      });

      setOpen(false);
      setFormData({
        postName: '',
        positionOfHonour: 1,
        allowance: undefined,
      });
    } catch (error) {
      console.error('Error creating prefectoral post:', error);
      formValidation.setSubmissionError(error instanceof Error ? error.message : 'The post could not be created. Please try again.');
    }
  };

  const handleInputChange = (field: keyof CreatePrefectoralPostData, value: any) => {
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
            Create Post
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Prefectoral Post</DialogTitle>
          <DialogDescription>
            Create a new leadership position for the prefectoral body
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postName" className={formValidation.getFieldError('postName') ? 'text-destructive' : undefined}>Post Name *</Label>
              <Input
                id="postName"
                value={formData.postName}
                onChange={(e) => { handleInputChange('postName', e.target.value); formValidation.handleFieldChange('postName'); }}
                {...formValidation.getFieldProps('postName')}
                placeholder="e.g., Head Prefect, Sanitary Prefect"
              />
              <FieldError error={formValidation.getFieldError('postName')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="positionOfHonour">Position of Honour *</Label>
              <Select
                value={formData.positionOfHonour?.toString()}
                onValueChange={(value) => { handleInputChange('positionOfHonour', parseInt(value)); formValidation.handleFieldChange('positionOfHonour'); }}
              >
                <SelectTrigger {...formValidation.getFieldProps('positionOfHonour')}>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Highest Rank</SelectItem>
                  <SelectItem value="2">2 - Second Rank</SelectItem>
                  <SelectItem value="3">3 - Third Rank</SelectItem>
                  <SelectItem value="4">4 - Fourth Rank</SelectItem>
                  <SelectItem value="5">5 - Fifth Rank</SelectItem>
                </SelectContent>
              </Select>
              <FieldError error={formValidation.getFieldError('positionOfHonour')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="allowance">Allowance (KES)</Label>
              <Input
                id="allowance"
                type="number"
                value={formData.allowance || ''}
                onChange={(e) => handleInputChange('allowance', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Optional allowance amount"
              />
            </div>
          </div>



          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this post..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createPrefectoralPost.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createPrefectoralPost.isPending}
            >
              {createPrefectoralPost.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Post
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
