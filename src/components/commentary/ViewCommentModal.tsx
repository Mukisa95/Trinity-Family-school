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
  good: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200',
  fair: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200',
  weak: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
  young: 'bg-brand-surface-100 text-brand-ink-800 dark:bg-brand-surface-950/40 dark:text-brand-ink-200',
  irregular: 'bg-brand-secondary-surface-100 text-brand-secondary-ink-800 dark:bg-brand-secondary-surface-950/40 dark:text-brand-secondary-ink-200',
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
  subject: 'Subject Comment'
};

export function ViewCommentModal({ isOpen, onClose, comment }: ViewCommentModalProps) {
  if (!comment) return null;

  const statusColor = statusColors[comment.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 dark:bg-slate-900 dark:text-slate-100';
  const statusLabel = statusLabels[comment.status as keyof typeof statusLabels] || comment.status;
  const typeLabel = typeLabels[comment.type as keyof typeof typeLabels] || comment.type;

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModernDialogContent open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-brand-ink-600 dark:text-brand-ink-400" />
            View Comment Template
          </ModernDialogTitle>
        </ModernDialogHeader>

        <div className="space-y-6">
          {/* Comment Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Performance Status:</span>
                <Badge className={statusColor} variant="secondary">
                  {statusLabel}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Comment Type:</span>
                <div className="flex items-center gap-1">
                  {comment.type === 'class_teacher' ? (
                    <Users className="h-4 w-4 text-brand-ink-600 dark:text-brand-ink-400" />
                  ) : (
                    <GraduationCap className="h-4 w-4 text-brand-secondary-ink-600 dark:text-brand-secondary-ink-400" />
                  )}
                  <Badge variant="outline">
                    {typeLabel}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Applicable Terms (for Subject Comments) */}
            {comment.type === 'subject' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Applicable Terms:</span>
                <div className="flex flex-wrap gap-1">
                  {(!comment.applicableTerms || comment.applicableTerms.includes('all') || comment.applicableTerms.length === 0) ? (
                    <Badge variant="outline" className="bg-brand-surface-50 text-brand-ink-700 border-brand-200 dark:bg-brand-surface-950/40 dark:text-brand-ink-300 dark:border-brand-800/60">
                      All Terms
                    </Badge>
                  ) : (
                    comment.applicableTerms.map(term => (
                      <Badge key={term} variant="outline" className="bg-brand-surface-50 text-brand-ink-700 border-brand-200 dark:bg-brand-surface-950/40 dark:text-brand-ink-300 dark:border-brand-800/60">
                        {term.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Comment Text:</span>
              <div className="bg-gray-50 border rounded-lg p-4 dark:bg-slate-900">
                <p className="text-gray-900 leading-relaxed dark:text-slate-100">
                  {comment.comment}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-slate-400">
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