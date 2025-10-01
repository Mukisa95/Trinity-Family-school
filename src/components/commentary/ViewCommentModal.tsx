"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle } from '@/components/ui/modern-dialog';
import { Eye, Users, GraduationCap } from 'lucide-react';
import { CommentTemplate } from '@/types';

interface ViewCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export function ViewCommentModal({ isOpen, onClose, comment }: ViewCommentModalProps) {
  if (!comment) return null;

  const statusColor = statusColors[comment.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  const statusLabel = statusLabels[comment.status as keyof typeof statusLabels] || comment.status;
  const typeLabel = typeLabels[comment.type as keyof typeof typeLabels] || comment.type;

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModernDialogContent open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-600" />
            View Comment Template
          </ModernDialogTitle>
        </ModernDialogHeader>

        <div className="space-y-6">
          {/* Comment Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Performance Status:</span>
                <Badge className={statusColor} variant="secondary">
                  {statusLabel}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Comment Type:</span>
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
              <span className="text-sm font-medium text-gray-600">Comment Text:</span>
              <div className="bg-gray-50 border rounded-lg p-4">
                <p className="text-gray-900 leading-relaxed">
                  {comment.comment}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Template ID: {comment.id}</span>
              <span>•</span>
              <span>Status: {comment.isActive ? 'Active' : 'Disabled'}</span>
              <span>•</span>
              <span>Created: {new Date(comment.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </ModernDialogContent>
    </ModernDialog>
  );
} 