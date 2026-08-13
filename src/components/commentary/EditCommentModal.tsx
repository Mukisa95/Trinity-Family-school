"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle } from '@/components/ui/modern-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Users, GraduationCap } from 'lucide-react';
import { CommentTemplate } from '@/types';
import { useClasses } from '@/lib/hooks/use-classes';
import { SUBJECT_COMMENT_TYPES, SUBJECT_STATUS_OPTIONS } from '@/lib/constants/subject-comments';
import { commentaryService } from '@/services/commentaryService';
import { toast } from '@/hooks/use-toast';

interface EditCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (comment: CommentTemplate) => void | Promise<void>;
  comment: CommentTemplate | null;
  termScope?: string;
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
  subject: 'Subject Comment'
};

const TERM_OPTIONS = [
  { value: 'all', label: 'All Terms' },
  { value: 'term_1', label: 'Term 1' },
  { value: 'term_2', label: 'Term 2' },
  { value: 'term_3', label: 'Term 3' },
];

export function EditCommentModal({ isOpen, onClose, onSave, comment, termScope }: EditCommentModalProps) {
  const [editedComment, setEditedComment] = useState<CommentTemplate | null>(null);
  // For subject comments, allow pushing to multiple classes
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: allClasses = [] } = useClasses();
  const nurseryClasses = allClasses.filter((c) => c.level === 'Nursery');

  useEffect(() => {
    if (comment) {
      setEditedComment({ ...comment, applicableTerms: termScope ? [termScope] : comment.applicableTerms });
      // Pre-select current classId if it exists
      setTargetClassIds(comment.classId ? [comment.classId] : []);
    }
  }, [comment, termScope]);

  const handleSave = async () => {
    if (!editedComment) return;

    if (editedComment.type === 'subject' && targetClassIds.length > 1) {
      // Multiple classes selected: save original (with first class or general) + new copies
      setIsSaving(true);
      try {
        // Update existing template for the first target (or general)
        const firstClassId = targetClassIds[0] ?? undefined;
        await onSave({ ...editedComment, classId: firstClassId, applicableTerms: termScope ? [termScope] : editedComment.applicableTerms });

        // Create new copies for remaining classes
        for (let i = 1; i < targetClassIds.length; i++) {
          await commentaryService.addCommentTemplate({
            type: 'subject',
            subject: editedComment.subject,
            subjectStatus: editedComment.subjectStatus,
            comment: editedComment.comment,
            isActive: editedComment.isActive,
            classId: targetClassIds[i],
            applicableTerms: termScope ? [termScope] : editedComment.applicableTerms,
          });
        }
        toast({ title: 'Saved', description: `Comment updated across ${targetClassIds.length} classes.` });
      } catch {
        toast({ title: 'Error', description: 'Some copies failed to save.', variant: 'destructive' });
      } finally {
        setIsSaving(false);
      }
    } else {
      // Single class or general
      const resolvedClassId = targetClassIds.length === 1 ? targetClassIds[0] : undefined;
      setIsSaving(true);
      try {
        await onSave({
          ...editedComment,
          classId: editedComment.type === 'subject' ? resolvedClassId : editedComment.classId,
          applicableTerms: termScope && editedComment.type === 'subject' ? [termScope] : editedComment.applicableTerms,
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleClose = () => {
    setEditedComment(null);
    onClose();
  };

  const toggleTerm = (term: string, checked: boolean) => {
    if (term === 'all') {
      setEditedComment(prev => prev ? { ...prev, applicableTerms: checked ? ['all'] : [] } : null);
      return;
    }
    setEditedComment(prev => {
      if (!prev) return null;
      const current = prev.applicableTerms || [];
      const without = current.filter(t => t !== 'all' && t !== term);
      return { ...prev, applicableTerms: checked ? [...without, term] : without };
    });
  };

  const toggleClass = (id: string, checked: boolean) => {
    setTargetClassIds(prev => checked ? [...prev, id] : prev.filter(c => c !== id));
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

        <div className="space-y-5">
          {/* Performance Status — only for non-subject comments */}
          {editedComment.type !== 'subject' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Performance Status</label>
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
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject Status — only for subject comments */}
          {editedComment.type === 'subject' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject Status</label>
              <Select
                value={editedComment.subjectStatus || ''}
                onValueChange={(value: any) =>
                  setEditedComment(prev => prev ? { ...prev, subjectStatus: value } : null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Comment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comment Type</label>
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
                      ) : value === 'head_teacher' ? (
                        <GraduationCap className="h-4 w-4 text-purple-600" />
                      ) : null}
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject & Class selectors — only for subject comments */}
          {editedComment.type === 'subject' && (
            <>
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <Select
                  value={editedComment.subject || ''}
                  onValueChange={(value: any) =>
                    setEditedComment(prev => prev ? { ...prev, subject: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_COMMENT_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Multi-class selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Classes <span className="text-gray-400 font-normal text-xs">(leave all unchecked for All Nursery Classes)</span>
                </label>
                <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {nurseryClasses.length === 0 ? (
                    <p className="text-sm text-gray-400">No nursery classes found</p>
                  ) : (
                    nurseryClasses.map((cls) => (
                      <label key={cls.id} className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox
                          checked={targetClassIds.includes(cls.id)}
                          onCheckedChange={(checked) => toggleClass(cls.id, !!checked)}
                        />
                        <span className="text-sm">{cls.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {targetClassIds.length === 0 ? (
                  <p className="text-xs text-gray-500 mt-1">→ Applies to All Nursery Classes</p>
                ) : targetClassIds.length > 1 ? (
                  <p className="text-xs text-blue-600 mt-1">→ Will create copies for {targetClassIds.length} classes</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">→ {nurseryClasses.find(c => c.id === targetClassIds[0])?.name}</p>
                )}
              </div>

              {/* Applicable Terms */}
              {termScope ? (
                <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
                  This edit applies only to {TERM_OPTIONS.find((term) => term.value === termScope)?.label || termScope}. Other terms will keep their current comment.
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Applicable Terms</label>
                  <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div className="flex flex-wrap gap-4">
                      {TERM_OPTIONS.map((t) => (
                        <label key={t.value} className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox
                            checked={
                              t.value === 'all'
                                ? (editedComment.applicableTerms?.includes('all') || !editedComment.applicableTerms || editedComment.applicableTerms.length === 0)
                                : editedComment.applicableTerms?.includes(t.value)
                            }
                            disabled={t.value !== 'all' && editedComment.applicableTerms?.includes('all')}
                            onCheckedChange={(checked) => toggleTerm(t.value, !!checked)}
                          />
                          <span className="text-sm">{t.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Comment Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comment Text</label>
            <Textarea
              value={editedComment.comment}
              onChange={(e) =>
                setEditedComment(prev => prev ? { ...prev, comment: e.target.value } : null)
              }
              placeholder="Enter comment text… use [He/She], [his/her] for gender-aware text"
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <Badge variant={editedComment.isActive ? 'default' : 'secondary'}>
              {editedComment.isActive ? 'Active' : 'Disabled'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setEditedComment(prev => prev ? { ...prev, isActive: !prev.isActive } : null)
              }
            >
              {editedComment.isActive ? 'Disable' : 'Enable'}
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </ModernDialogContent>
    </ModernDialog>
  );
}
