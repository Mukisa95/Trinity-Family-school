"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle } from '@/components/ui/modern-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Users, GraduationCap } from 'lucide-react';
import { CommentTemplate } from '@/types';

interface EditCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (comment: CommentTemplate) => void;
  comment: CommentTemplate | null;
}

const statusLabels = {
  good: 'Good Performance',
  fair: 'Fair Performance',
  weak: 'Weak Performance',
  young: 'Young Learner',
  irregular: 'Irregular Performance',
};

const typeLabels = {
  class_teacher: 'Class Teacher',
  head_teacher: 'Head Teacher',
};

export function EditCommentModal({ isOpen, onClose, onSave, comment }: EditCommentModalProps) {
  const [editedComment, setEditedComment] = useState<CommentTemplate | null>(null);

  useEffect(() => {
    if (comment) {
      setEditedComment({ ...comment });
    }
  }, [comment]);

  const handleSave = () => {
    if (editedComment) {
      onSave(editedComment);
    }
  };

  const handleClose = () => {
    setEditedComment(null);
    onClose();
  };

  if (!comment || !editedComment) return null;

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <ModernDialogContent open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-blue-600" />
            Edit Comment Template
          </ModernDialogTitle>
        </ModernDialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Performance Status
              </label>
              <Select
                value={editedComment.status}
                onValueChange={(value: any) => 
                  setEditedComment(prev => prev ? { ...prev, status: value } : null)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment Type
              </label>
              <Select
                value={editedComment.type}
                onValueChange={(value: any) => 
                  setEditedComment(prev => prev ? { ...prev, type: value } : null)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        {value === 'class_teacher' ? (
                          <Users className="h-4 w-4 text-blue-600" />
                        ) : (
                          <GraduationCap className="h-4 w-4 text-purple-600" />
                        )}
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment Text
              </label>
              <Textarea
                value={editedComment.comment}
                onChange={(e) => 
                  setEditedComment(prev => prev ? { ...prev, comment: e.target.value } : null)
                }
                placeholder="Enter comment text..."
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <Badge variant={editedComment.isActive ? "default" : "secondary"}>
                {editedComment.isActive ? "Active" : "Disabled"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => 
                  setEditedComment(prev => prev ? { ...prev, isActive: !prev.isActive } : null)
                }
              >
                {editedComment.isActive ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </ModernDialogContent>
    </ModernDialog>
  );
} 