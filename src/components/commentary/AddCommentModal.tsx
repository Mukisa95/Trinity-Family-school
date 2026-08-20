"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle } from '@/components/ui/modern-dialog';
import { MessageSquare, Plus } from 'lucide-react';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

interface AddCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (comment: {
    status: string;
    type: string;
    comment: string;
  }) => void;
  defaultStatus?: string;
}

export function AddCommentModal({ isOpen, onClose, onAdd, defaultStatus = 'good' }: AddCommentModalProps) {
  const [formData, setFormData] = useState({
    status: defaultStatus,
    type: 'classTeacher',
    comment: ''
  });
  const formValidation = useFormValidation([
    createFieldValidation('comment', formData.comment, 'Comment text', true, {
      message: 'Enter the comment template text.',
    }),
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formValidation.validateAll().isValid) return;

    onAdd(formData);
    
    // Reset form
    setFormData({
      status: defaultStatus,
      type: 'classTeacher',
      comment: ''
    });
    formValidation.resetValidation();
    
    onClose();
  };

  const handleClose = () => {
    // Reset form when closing
    setFormData({
      status: defaultStatus,
      type: 'classTeacher',
      comment: ''
    });
    formValidation.resetValidation();
    onClose();
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <ModernDialogContent open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Add Comment Template
          </ModernDialogTitle>
        </ModernDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormErrorSummary errors={formValidation.errors} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Performance Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="weak">Weak</SelectItem>
                  <SelectItem value="young">Young</SelectItem>
                  <SelectItem value="irregular">Irregular</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Comment Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classTeacher">Class Teacher</SelectItem>
                  <SelectItem value="headTeacher">Head Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment" className={formValidation.getFieldError('comment') ? 'text-destructive' : undefined}>Comment Text <span className="text-destructive">*</span></Label>
            <Textarea
              id="comment"
              placeholder="Enter the comment template text..."
              value={formData.comment}
              onChange={(e) => { setFormData({ ...formData, comment: e.target.value }); formValidation.handleFieldChange('comment'); }}
              {...formValidation.getFieldProps('comment')}
              rows={4}
              className="resize-none"
            />
            <FieldError error={formValidation.getFieldError('comment')} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Template
            </Button>
          </div>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
}
