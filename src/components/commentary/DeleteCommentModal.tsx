"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle } from '@/components/ui/modern-dialog';
import { Trash2, AlertTriangle, Users, GraduationCap } from 'lucide-react';
import { CommentTemplate } from '@/types';

interface DeleteCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  comment: CommentTemplate | null;
}

const statusColors = {
  good: 'bg-green-100 text-green-800',
  fair: 'bg-yellow-100 text-yellow-800',
  weak: 'bg-red-100 text-red-800',
  young: 'bg-blue-100 text-blue-800',
  irregular: 'bg-purple-100 text-purple-800',
};

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

export function DeleteCommentModal({ isOpen, onClose, onConfirm, comment }: DeleteCommentModalProps) {
  if (!comment) return null;

  const statusColor = statusColors[comment.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  const statusLabel = statusLabels[comment.status as keyof typeof statusLabels] || comment.status;
  const typeLabel = typeLabels[comment.type as keyof typeof typeLabels] || comment.type;

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModernDialogContent open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete Comment Template
          </ModernDialogTitle>
        </ModernDialogHeader>

        <div className="space-y-6">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800">Permanent Deletion</h4>
              <p className="text-sm text-red-700 mt-1">
                This action cannot be undone. The comment template will be permanently removed from the database.
              </p>
            </div>
          </div>

          {/* Comment Preview */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Comment to be deleted:</h4>
            
            <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <Badge className={statusColor} variant="secondary">
                    {statusLabel}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Type:</span>
                  <div className="flex items-center gap-1">
                    {comment.type === 'class_teacher' ? (
                      <Users className="h-4 w-4 text-blue-600" />
                    ) : (
                      <GraduationCap className="h-4 w-4 text-purple-600" />
                    )}
                    <Badge variant="outline">
                      {typeLabel}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-600">Comment:</span>
                <p className="text-gray-900 text-sm leading-relaxed bg-white border rounded p-3">
                  {comment.comment}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>ID: {comment.id}</span>
                <span>•</span>
                <span>Status: {comment.isActive ? 'Active' : 'Disabled'}</span>
                <span>•</span>
                <span>Created: {new Date(comment.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={onConfirm}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Permanently
            </Button>
          </div>
        </div>
      </ModernDialogContent>
    </ModernDialog>
  );
} 