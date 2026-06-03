"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Eye, Power, PowerOff, ArrowLeft, Layers, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle } from '@/components/ui/modern-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewCommentModal } from '@/components/commentary/ViewCommentModal';
import { EditCommentModal } from '@/components/commentary/EditCommentModal';
import { DeleteCommentModal } from '@/components/commentary/DeleteCommentModal';
import { useCommentTemplates } from '@/hooks/useCommentTemplates';
import { CommentTemplate, SubjectCommentType, SubjectStatus } from '@/types';
import { toast } from '@/hooks/use-toast';
import { SUBJECT_COMMENT_TYPES, SUBJECT_STATUS_OPTIONS, getSubjectLabel } from '@/lib/constants/subject-comments';
import { useClasses } from '@/lib/hooks/use-classes';

// Comment interface
interface CommentItem {
  text: string;
  isActive: boolean;
  id: string;
}

// Static comments from the NurseryAssessmentReport (now as default templates)
const defaultComments = {
  good: {
    classTeacher: [
      { text: "Outstanding achievement! Your hard work and commitment are truly paying off.", isActive: true, id: "good_ct_1" },
      { text: "Excellent work across the board. Keep pushing yourself and reaching new heights!", isActive: true, id: "good_ct_2" },
      { text: "You are consistently showing great understanding and effort. Very impressive!", isActive: true, id: "good_ct_3" },
      { text: "Brilliant performance this term! Maintain this positive momentum.", isActive: true, id: "good_ct_4" },
    ],
    headTeacher: [
      { text: "You are doing well, but there's always room to reach even higher.", isActive: true, id: "good_ht_1" },
      { text: "Excellent effort so far — aim for even greater achievements!", isActive: true, id: "good_ht_2" },
      { text: "You're performing strongly; now challenge yourself to reach your fullest potential.", isActive: true, id: "good_ht_3" },
      { text: "Solid results! Push yourself a little further for even bigger success.", isActive: true, id: "good_ht_4" },
    ]
  },
  fair: {
    classTeacher: [
      { text: "A strong effort! With just a bit more focus, you'll achieve even greater success.", isActive: true, id: "fair_ct_1" },
      { text: "You're building a solid foundation; keep aiming higher.", isActive: true, id: "fair_ct_2" },
      { text: "Good progress! Let's keep up the energy and reach for excellence.", isActive: true, id: "fair_ct_3" },
      { text: "You are on the right track. A little more consistency will take you even further!", isActive: true, id: "fair_ct_4" },
    ],
    headTeacher: [
      { text: "Good progress, but greater focus will lead to even better results.", isActive: true, id: "fair_ht_1" },
      { text: "You've done well — now aim to double your efforts for outstanding achievements.", isActive: true, id: "fair_ht_2" },
      { text: "A strong performance, but there's more you can accomplish with extra dedication.", isActive: true, id: "fair_ht_3" },
      { text: "With continued hard work, you can move from good to exceptional.", isActive: true, id: "fair_ht_4" },
    ]
  },
  weak: {
    classTeacher: [
      { text: "Improvement is within reach! Let's put more effort into challenging areas.", isActive: true, id: "weak_ct_1" },
      { text: "A stronger commitment to study will help you unlock your full potential.", isActive: true, id: "weak_ct_2" },
      { text: "You have the ability — now let's work on consistency and effort.", isActive: true, id: "weak_ct_3" },
      { text: "Focus and persistence will lead to much better results next term.", isActive: true, id: "weak_ct_4" },
    ],
    headTeacher: [
      { text: "Greater effort and focus are key to better outcomes.", isActive: true, id: "weak_ht_1" },
      { text: "A stronger commitment to learning will greatly improve your results.", isActive: true, id: "weak_ht_2" },
      { text: "Let's aim to strengthen your understanding for better future results.", isActive: true, id: "weak_ht_3" },
      { text: "You can do much better with more consistent effort and attention.", isActive: true, id: "weak_ht_4" },
    ]
  },
  young: {
    classTeacher: [
      { text: "You're showing promise. Let's channel your energy into steady learning habits.", isActive: true, id: "young_ct_1" },
      { text: "With greater attention to detail, you can achieve wonderful results.", isActive: true, id: "young_ct_2" },
      { text: "There is so much potential here — let's work together to develop it.", isActive: true, id: "young_ct_3" },
      { text: "You're at the beginning of an exciting journey. Stay focused and enthusiastic!", isActive: true, id: "young_ct_4" },
    ],
    headTeacher: [
      { text: "Patience and practice will lead to steady improvement.", isActive: true, id: "young_ht_1" },
      { text: "Keep developing your skills — growth takes time.", isActive: true, id: "young_ht_2" },
      { text: "You have the foundation; consistent effort will bring visible results.", isActive: true, id: "young_ht_3" },
      { text: "With persistence and guidance, your abilities will continue to grow.", isActive: true, id: "young_ht_4" },
    ]
  },
  irregular: {
    classTeacher: [
      { text: "More consistent attendance will greatly boost your performance.", isActive: true, id: "irregular_ct_1" },
      { text: "Regular participation is key to achieving your true potential.", isActive: true, id: "irregular_ct_2" },
      { text: "With steady attendance, your understanding and results will significantly improve.", isActive: true, id: "irregular_ct_3" },
      { text: "Frequent engagement will help you build stronger skills and confidence.", isActive: true, id: "irregular_ct_4" },
    ],
    headTeacher: [
      { text: "Consistent attendance is essential for steady improvement.", isActive: true, id: "irregular_ht_1" },
      { text: "Making it to class regularly will boost both confidence and performance.", isActive: true, id: "irregular_ht_2" },
      { text: "Frequent class participation will support much better results.", isActive: true, id: "irregular_ht_3" },
      { text: "Attendance needs to be more regular for you to achieve your best.", isActive: true, id: "irregular_ht_4" },
    ]
  }
};

const performanceStatuses = [
  { key: 'good', label: 'Good', color: 'bg-green-100 text-green-800' },
  { key: 'fair', label: 'Fair', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'weak', label: 'Weak', color: 'bg-red-100 text-red-800' },
  { key: 'young', label: 'Young', color: 'bg-blue-100 text-blue-800' },
  { key: 'irregular', label: 'Irregular', color: 'bg-purple-100 text-purple-800' },
];

const statusLabels = {
  good: 'Good Performance',
  fair: 'Fair Performance',
  weak: 'Weak Performance',
  young: 'Young Learner',
  irregular: 'Irregular Performance'
};

const statusColors = {
  good: 'bg-green-500',
  fair: 'bg-yellow-500',
  weak: 'bg-red-500',
  young: 'bg-blue-500',
  irregular: 'bg-purple-500'
};

export default function CommentaryManagementPage() {
  const {
    templates,
    loading,
    error,
    fetchAllTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate
  } = useCommentTemplates();
  const router = useRouter();

  const { data: allClasses = [], isLoading: classesLoading } = useClasses();

  // Filter to only nursery classes
  const nurseryClasses = allClasses.filter((cls) => cls.level === 'Nursery');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<CommentTemplate | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Push feature state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [pushTargetClasses, setPushTargetClasses] = useState<string[]>([]);
  const [pushTargetTerms, setPushTargetTerms] = useState<string[]>(['all']);
  const [isPushing, setIsPushing] = useState(false);

  // Add comment form state - for continuous creation
  const [newComment, setNewComment] = useState({
    type: 'class_teacher' as 'class_teacher' | 'head_teacher' | 'subject',
    status: 'good' as 'good' | 'fair' | 'weak' | 'young' | 'irregular' | undefined,
    comment: '',
    subject: undefined as SubjectCommentType | undefined,
    subjectStatus: undefined as SubjectStatus | undefined,
    classId: undefined as string | undefined,
    applicableTerms: ['all'] as string[] // Default to 'all' terms
  });

  // Collapsible state for status cards - all collapsed by default
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set());
  const toggleStatus = (status: string) =>
    setExpandedStatuses(prev => { const n = new Set(prev); n.has(status) ? n.delete(status) : n.add(status); return n; });

  // Subject-based comment filters
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterTerm, setFilterTerm] = useState<string>('all');

  // Continuous creation mode - form stays open after saving
  const [continuousMode, setContinuousMode] = useState(false);

  const toggleSelectId = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Select / deselect all visible comments for a given subject (across all statuses)
  const selectAllForSubject = (subjectValue: SubjectCommentType, ids: string[], checked: boolean) =>
    setSelectedIds(prev => {
      const n = new Set(prev);
      ids.forEach(id => checked ? n.add(id) : n.delete(id));
      return n;
    });

  // Select / deselect all visible comments for a given subject+status
  const selectAllForStatus = (ids: string[], checked: boolean) =>
    setSelectedIds(prev => {
      const n = new Set(prev);
      ids.forEach(id => checked ? n.add(id) : n.delete(id));
      return n;
    });

  const togglePushTerm = (term: string, checked: boolean) => {
    if (term === 'all') { setPushTargetTerms(checked ? ['all'] : []); return; }
    setPushTargetTerms(prev => {
      const without = prev.filter(t => t !== 'all' && t !== term);
      return checked ? [...without, term] : without;
    });
  };

  const togglePushClass = (id: string, checked: boolean) => {
    setPushTargetClasses(prev => checked ? [...prev, id] : prev.filter(c => c !== id));
  };

  const handlePush = async () => {
    const commentsToPush = templates.filter(t => selectedIds.has(t.id));
    if (commentsToPush.length === 0) return;
    if (pushTargetTerms.length === 0) {
      toast({ title: 'Select at least one term', variant: 'destructive' }); return;
    }
    setIsPushing(true);
    let saved = 0, failed = 0;
    const classTargets = pushTargetClasses.length === 0 ? [undefined] : pushTargetClasses.map(id => id);
    try {
      await Promise.all(commentsToPush.flatMap(c =>
        classTargets.map(async (cid) => {
          try {
            await addTemplate({
              type: 'subject',
              subject: c.subject,
              subjectStatus: c.subjectStatus,
              comment: c.comment,
              isActive: true,
              classId: cid,
              applicableTerms: pushTargetTerms,
            });
            saved++;
          } catch { failed++; }
        })
      ));
      toast({ title: 'Push complete', description: `${saved} comment${saved !== 1 ? 's' : ''} pushed.${failed > 0 ? ` ${failed} failed.` : ''}` });
      if (failed === 0) { setSelectedIds(new Set()); setIsPushModalOpen(false); }
      await fetchAllTemplates();
    } finally { setIsPushing(false); }
  };

  // Load templates on component mount
  useEffect(() => {
    console.log('🔄 Commentary Management: Loading templates...');
    fetchAllTemplates();
  }, []);

  // Function to seed database with default comments if empty
  const seedDefaultComments = async () => {
    try {
      console.log('🌱 Seeding database with default comments...');

      const seedPromises = [];

      // Convert defaultComments to CommentTemplate format and add to database
      for (const [status, categories] of Object.entries(defaultComments)) {
        // Add class teacher comments
        for (const comment of categories.classTeacher) {
          seedPromises.push(
            addTemplate({
              status: status as any,
              type: 'class_teacher',
              comment: comment.text,
              isActive: comment.isActive
            })
          );
        }

        // Add head teacher comments
        for (const comment of categories.headTeacher) {
          seedPromises.push(
            addTemplate({
              status: status as any,
              type: 'head_teacher',
              comment: comment.text,
              isActive: comment.isActive
            })
          );
        }
      }

      await Promise.all(seedPromises);
      console.log('✅ Database seeded successfully');

      toast({
        title: "Database Seeded",
        description: "Default comments have been added to the database",
      });

      // Refresh the templates
      await fetchAllTemplates();
    } catch (error) {
      console.error('❌ Error seeding database:', error);
      toast({
        title: "Seeding Error",
        description: "Failed to seed database with default comments",
        variant: "destructive",
      });
    }
  };

  // Check if database is empty and offer to seed it
  useEffect(() => {
    console.log('📊 Commentary Management State:', {
      loading,
      templatesCount: templates.length,
      error,
      templates: templates.slice(0, 2) // Show first 2 templates for debugging
    });

    if (!loading && templates.length === 0 && !error) {
      console.log('📊 Database appears to be empty, templates count:', templates.length);
    }
  }, [templates, loading, error]);

  // Group templates by status
  const groupedTemplates = templates.reduce((acc, template) => {
    if (template.type === 'subject') {
      // Handle subject-based comments
      if (!acc.subjectComments) {
        acc.subjectComments = {};
      }
      if (!template.subject || !template.subjectStatus) return acc;

      const subjectKey = `${template.subject}_${template.subjectStatus}`;
      if (!acc.subjectComments[subjectKey]) {
        acc.subjectComments[subjectKey] = [];
      }
      acc.subjectComments[subjectKey].push(template);
    } else {
      // Handle class teacher and head teacher comments (status is required for these)
      if (!template.status) return acc; // Skip if no status

      if (!acc[template.status]) {
        acc[template.status] = {
          classTeacherComments: [],
          headTeacherComments: []
        };
      }

      if (template.type === 'class_teacher') {
        acc[template.status].classTeacherComments.push(template);
      } else {
        acc[template.status].headTeacherComments.push(template);
      }
    }

    return acc;
  }, {} as Record<string, any>);

  const handleAddComment = async () => {
    if (!newComment.comment.trim()) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    // Validate based on comment type
    if (newComment.type === 'subject') {
      if (!newComment.subject || !newComment.subjectStatus) {
        toast({
          title: "Error",
          description: "Please select both subject and subject status",
          variant: "destructive",
        });
        return;
      }
    } else {
      // For class_teacher and head_teacher, status is required
      if (!newComment.status) {
        toast({
          title: "Error",
          description: "Please select a performance status",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      await addTemplate({
        status: newComment.type === 'subject' ? undefined : newComment.status,
        type: newComment.type,
        comment: newComment.comment,
        isActive: true,
        subject: newComment.type === 'subject' ? newComment.subject : undefined,
        subjectStatus: newComment.type === 'subject' ? newComment.subjectStatus : undefined,
        classId: newComment.type === 'subject' ? newComment.classId : undefined,
        applicableTerms: newComment.type === 'subject' ? newComment.applicableTerms : undefined
      });

      toast({
        title: "Success",
        description: "Comment added successfully",
      });

      // Refresh templates
      await fetchAllTemplates();

      // If continuous mode, only clear the comment field; otherwise reset form and close modal
      if (continuousMode) {
        setNewComment(prev => ({
          ...prev,
          comment: '' // Only clear the comment, keep everything else
        }));
      } else {
        setNewComment({
          type: 'class_teacher',
          status: 'good',
          comment: '',
          subject: undefined,
          subjectStatus: undefined,
          classId: undefined,
          applicableTerms: ['all']
        });
        setIsAddModalOpen(false);
      }
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const handleViewComment = (comment: CommentTemplate) => {
    setSelectedComment(comment);
    setIsViewModalOpen(true);
  };

  const handleEditComment = (comment: CommentTemplate) => {
    setSelectedComment(comment);
    setIsEditModalOpen(true);
  };

  const handleDeleteComment = (comment: CommentTemplate) => {
    setSelectedComment(comment);
    setIsDeleteModalOpen(true);
  };

  const handleToggleActive = async (comment: CommentTemplate) => {
    try {
      await updateTemplate(comment.id, {
        isActive: !comment.isActive
      });

      toast({
        title: "Success",
        description: `Comment ${comment.isActive ? 'disabled' : 'enabled'} successfully`,
      });
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const handleUpdateComment = async (updatedComment: CommentTemplate) => {
    try {
      const updateData: any = {
        comment: updatedComment.comment,
        type: updatedComment.type,
        isActive: updatedComment.isActive
      };

      // Handle status field based on comment type
      if (updatedComment.type === 'subject') {
        // For subject comments, we'll mark status for deletion in the service
        // Don't include it in updateData
      } else {
        // For other comment types, include status if it exists
        if (updatedComment.status) {
          updateData.status = updatedComment.status;
        }
      }

      // Include subject-related fields if it's a subject comment
      if (updatedComment.type === 'subject') {
        if (updatedComment.subject) {
          updateData.subject = updatedComment.subject;
        }
        if (updatedComment.subjectStatus) {
          updateData.subjectStatus = updatedComment.subjectStatus;
        }
        // classId can be undefined (for "all classes"), so only include if it has a value
        if (updatedComment.classId !== undefined) {
          updateData.classId = updatedComment.classId;
        }
        // applicableTerms for term filtering
        if (updatedComment.applicableTerms !== undefined) {
          updateData.applicableTerms = updatedComment.applicableTerms;
        }
      }

      await updateTemplate(updatedComment.id, updateData);
      setIsEditModalOpen(false);
      setSelectedComment(null);
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedComment) return;

    try {
      await deleteTemplate(selectedComment.id);
      setIsDeleteModalOpen(false);
      setSelectedComment(null);
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const CommentCard = ({ comment }: { comment: CommentTemplate }) => (
    <Card className={`mb-2 ${!comment.isActive ? 'opacity-60 bg-gray-50' : ''}`}>
      <CardContent className="p-3">
        <div className="flex flex-col h-full">
          <div className="flex-1 min-w-0">
            <p className={`text-sm break-words ${!comment.isActive ? 'text-gray-500' : 'text-gray-700'}`}>
              {comment.comment}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant={comment.isActive ? "default" : "secondary"}>
                {comment.isActive ? "Active" : "Disabled"}
              </Badge>
              <span className="text-xs text-gray-500">
                {comment.type === 'class_teacher' ? 'Class Teacher' :
                  comment.type === 'head_teacher' ? 'Head Teacher' : ''}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-3 pt-2 border-t justify-end shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewComment(comment)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditComment(comment)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleActive(comment)}
              className={comment.isActive ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
            >
              {comment.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteComment(comment)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading && templates.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading comments...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-center gap-4 mb-4">
        <SmartBackButton fallbackHref="/" className="h-5 w-5">
  <ArrowLeft className="h-5 w-5" />
  
</SmartBackButton>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Commentary Management</h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage comment templates for pupil performance reports
          </p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && !loading && (
            <Button
              onClick={seedDefaultComments}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              🌱 Seed Database
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push('/commentary-management/seed-subjects')}
            className="gap-2 border-purple-600 text-purple-600 hover:bg-purple-50"
          >
            <Layers className="h-4 w-4" />
            Seed Subjects
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Comment
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {Object.entries(statusLabels).map(([status, label]) => {
          const statusData = groupedTemplates[status as keyof typeof statusLabels];
          const isExpanded = expandedStatuses.has(status);
          const totalCount =
            (statusData?.classTeacherComments?.length || 0) +
            (statusData?.headTeacherComments?.length || 0);

          return (
            <Card key={status}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleStatus(status)}
              >
                <CardTitle className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${statusColors[status as keyof typeof statusColors]}`} />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs font-normal text-gray-400">{totalCount} comment{totalCount !== 1 ? 's' : ''}</span>
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-gray-400" />
                    : <ChevronRight className="h-4 w-4 text-gray-400" />}
                </CardTitle>
              </CardHeader>
              {isExpanded && (
                <CardContent className="p-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-blue-700">Class Teacher Comments</h4>
                      {statusData?.classTeacherComments?.length > 0 ? (
                        statusData.classTeacherComments.map((comment) => (
                          <CommentCard key={comment.id} comment={comment} />
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm">No class teacher comments available</p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 text-green-700">Head Teacher Comments</h4>
                      {statusData?.headTeacherComments?.length > 0 ? (
                        statusData.headTeacherComments.map((comment) => (
                          <CommentCard key={comment.id} comment={comment} />
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm">No head teacher comments available</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Subject-Based Comments Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              Subject-Based Comments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b">
              <span className="text-xs font-medium text-gray-500 shrink-0">Filter:</span>
              {/* Class filter */}
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="h-7 text-xs w-auto min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="general">General (No specific class)</SelectItem>
                  {nurseryClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Term filter */}
              <Select value={filterTerm} onValueChange={setFilterTerm}>
                <SelectTrigger className="h-7 text-xs w-auto min-w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  <SelectItem value="term_1">Term 1</SelectItem>
                  <SelectItem value="term_2">Term 2</SelectItem>
                  <SelectItem value="term_3">Term 3</SelectItem>
                </SelectContent>
              </Select>
              {(filterClass !== 'all' || filterTerm !== 'all') && (
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => { setFilterClass('all'); setFilterTerm('all'); }}>
                  Clear filters
                </Button>
              )}
            </div>
            {/* Push toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mb-4">
                <span className="text-sm font-medium text-purple-700">{selectedIds.size} comment{selectedIds.size !== 1 ? 's' : ''} selected</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="text-xs">Clear</Button>
                  <Button size="sm" onClick={() => setIsPushModalOpen(true)} className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700">
                    <Send className="h-3.5 w-3.5" /> Push to…
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {SUBJECT_COMMENT_TYPES.map((subject) => {
                // Collect all visible comment IDs for this subject (across all statuses, with filters applied)
                const allSubjectVisibleIds = SUBJECT_STATUS_OPTIONS.flatMap((status) => {
                  const key = `${subject.value}_${status.value}`;
                  const all: CommentTemplate[] = groupedTemplates.subjectComments?.[key] || [];
                  const cf = filterClass === 'all' ? all : filterClass === 'general' ? all.filter(c => !c.classId) : all.filter(c => c.classId === filterClass);
                  const tf = filterTerm === 'all' ? cf : cf.filter(c => !c.applicableTerms || c.applicableTerms.length === 0 || c.applicableTerms.includes('all') || c.applicableTerms.includes(filterTerm));
                  return tf.map(c => c.id);
                });
                const allSubjectSelected = allSubjectVisibleIds.length > 0 && allSubjectVisibleIds.every(id => selectedIds.has(id));
                const someSubjectSelected = allSubjectVisibleIds.some(id => selectedIds.has(id));

                return (
                <div key={subject.value}>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      checked={allSubjectSelected}
                      data-state={someSubjectSelected && !allSubjectSelected ? 'indeterminate' : undefined}
                      onCheckedChange={(checked) => selectAllForSubject(subject.value, allSubjectVisibleIds, !!checked)}
                      disabled={allSubjectVisibleIds.length === 0}
                      className="shrink-0"
                    />
                    <h4 className="font-semibold text-purple-700">{subject.label}</h4>
                    {allSubjectVisibleIds.length > 0 && (
                      <span className="text-xs text-gray-400">
                        {allSubjectVisibleIds.filter(id => selectedIds.has(id)).length}/{allSubjectVisibleIds.length} selected
                      </span>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {SUBJECT_STATUS_OPTIONS.map((status) => {
                      const subjectKey = `${subject.value}_${status.value}`;
                      const allSubjectComments: CommentTemplate[] = groupedTemplates.subjectComments?.[subjectKey] || [];

                      // Apply class filter
                      const classFiltered = filterClass === 'all'
                        ? allSubjectComments
                        : filterClass === 'general'
                          ? allSubjectComments.filter(c => !c.classId)
                          : allSubjectComments.filter(c => c.classId === filterClass);

                      // Apply term filter
                      const subjectComments = filterTerm === 'all'
                        ? classFiltered
                        : classFiltered.filter(c =>
                            !c.applicableTerms ||
                            c.applicableTerms.length === 0 ||
                            c.applicableTerms.includes('all') ||
                            c.applicableTerms.includes(filterTerm)
                          );

                      // Group filtered comments by class
                      const commentsByClass = subjectComments.reduce((acc: Record<string, CommentTemplate[]>, comment: CommentTemplate) => {
                        const classKey = comment.classId || 'general';
                        if (!acc[classKey]) acc[classKey] = [];
                        acc[classKey].push(comment);
                        return acc;
                      }, {});

                      return (() => {
                        const statusAllSelected = subjectComments.length > 0 && subjectComments.every(c => selectedIds.has(c.id));
                        const statusSomeSelected = subjectComments.some(c => selectedIds.has(c.id));
                        return (
                        <div key={status.value} className="border rounded-lg p-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Checkbox
                              checked={statusAllSelected}
                              data-state={statusSomeSelected && !statusAllSelected ? 'indeterminate' : undefined}
                              onCheckedChange={(checked) => selectAllForStatus(subjectComments.map(c => c.id), !!checked)}
                              disabled={subjectComments.length === 0}
                              className="shrink-0"
                            />
                            <Badge className={status.color}>{status.label}</Badge>
                            <span className="text-xs text-gray-500">({subjectComments.length})</span>
                          </div>
                          {subjectComments.length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(commentsByClass).map(([classKey, comments]) => (
                                <div key={classKey}>
                                  {classKey !== 'general' && (
                                    <p className="text-xs font-medium text-gray-700 mb-1">
                                      {nurseryClasses.find(c => c.id === classKey)?.name || 'Class'}
                                    </p>
                                  )}
                                  {classKey === 'general' && (
                                    <p className="text-xs font-medium text-gray-500 mb-1">General (All Nursery Classes)</p>
                                  )}
                                  {comments.map((comment: CommentTemplate) => (
                                    <div key={comment.id} className="flex items-start gap-1">
                                      <Checkbox
                                        checked={selectedIds.has(comment.id)}
                                        onCheckedChange={() => toggleSelectId(comment.id)}
                                        className="mt-2 shrink-0"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <CommentCard comment={comment} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-xs">No comments available</p>
                          )}
                        </div>
                        );
                      })();
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Comment Modal */}
      <ModernDialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <ModernDialogContent open={isAddModalOpen} onOpenChange={(open) => { if (!open) setIsAddModalOpen(false); }}>
          <ModernDialogHeader>
            <ModernDialogTitle>Add New Comment</ModernDialogTitle>
          </ModernDialogHeader>
          <div className="space-y-4">
            {/* Comment Type comes first */}
            <div>
              <label className="block text-sm font-medium mb-2">Comment Type</label>
              <Select
                value={newComment.type}
                onValueChange={(value: any) => {
                  const isSubject = value === 'subject';
                  setNewComment(prev => ({
                    ...prev,
                    type: value,
                    // Clear subject-related fields if switching away from subject
                    subject: isSubject ? prev.subject : undefined,
                    subjectStatus: isSubject ? prev.subjectStatus : undefined,
                    classId: isSubject ? prev.classId : undefined,
                    // Clear or set status based on type
                    status: isSubject ? undefined : (prev.status || 'good')
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class_teacher">Class Teacher</SelectItem>
                  <SelectItem value="head_teacher">Head Teacher</SelectItem>
                  <SelectItem value="subject">Subject-Based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Performance Status - only show for class_teacher and head_teacher */}
            {newComment.type !== 'subject' && (
              <div>
                <label className="block text-sm font-medium mb-2">Performance Status</label>
                <Select
                  value={newComment.status || 'good'}
                  onValueChange={(value: any) => setNewComment(prev => ({ ...prev, status: value }))}
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
            {newComment.type === 'subject' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Subject</label>
                  <Select
                    value={newComment.subject || ''}
                    onValueChange={(value: SubjectCommentType) => setNewComment(prev => ({ ...prev, subject: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECT_COMMENT_TYPES.map((subject) => (
                        <SelectItem key={subject.value} value={subject.value}>
                          {subject.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Subject Status</label>
                  <Select
                    value={newComment.subjectStatus || ''}
                    onValueChange={(value: SubjectStatus) => setNewComment(prev => ({ ...prev, subjectStatus: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECT_STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Class <span className="text-gray-500 text-xs">(Optional - leave empty for all classes)</span>
                  </label>
                  <Select
                    value={newComment.classId || 'all'}
                    onValueChange={(value: string) => setNewComment(prev => ({ ...prev, classId: value === 'all' ? undefined : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Nursery Classes (General)</SelectItem>
                      {nurseryClasses.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Applicable Terms <span className="text-gray-500 text-xs">(Select terms this comment applies to)</span>
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <Checkbox
                          checked={newComment.applicableTerms.includes('all')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewComment(prev => ({ ...prev, applicableTerms: ['all'] }));
                            } else {
                              setNewComment(prev => ({ ...prev, applicableTerms: [] }));
                            }
                          }}
                        />
                        <span className="text-sm">All Terms</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <Checkbox
                          checked={newComment.applicableTerms.includes('term_1')}
                          disabled={newComment.applicableTerms.includes('all')}
                          onCheckedChange={(checked) => {
                            const filtered = newComment.applicableTerms.filter(t => t !== 'all');
                            if (checked) {
                              setNewComment(prev => ({ ...prev, applicableTerms: [...filtered, 'term_1'] }));
                            } else {
                              setNewComment(prev => ({ ...prev, applicableTerms: filtered.filter(t => t !== 'term_1') }));
                            }
                          }}
                        />
                        <span className="text-sm">Term 1</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <Checkbox
                          checked={newComment.applicableTerms.includes('term_2')}
                          disabled={newComment.applicableTerms.includes('all')}
                          onCheckedChange={(checked) => {
                            const filtered = newComment.applicableTerms.filter(t => t !== 'all');
                            if (checked) {
                              setNewComment(prev => ({ ...prev, applicableTerms: [...filtered, 'term_2'] }));
                            } else {
                              setNewComment(prev => ({ ...prev, applicableTerms: filtered.filter(t => t !== 'term_2') }));
                            }
                          }}
                        />
                        <span className="text-sm">Term 2</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <Checkbox
                          checked={newComment.applicableTerms.includes('term_3')}
                          disabled={newComment.applicableTerms.includes('all')}
                          onCheckedChange={(checked) => {
                            const filtered = newComment.applicableTerms.filter(t => t !== 'all');
                            if (checked) {
                              setNewComment(prev => ({ ...prev, applicableTerms: [...filtered, 'term_3'] }));
                            } else {
                              setNewComment(prev => ({ ...prev, applicableTerms: filtered.filter(t => t !== 'term_3') }));
                            }
                          }}
                        />
                        <span className="text-sm">Term 3</span>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Comment</label>
              <Textarea
                value={newComment.comment}
                onChange={(e) => setNewComment(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Enter comment text..."
                rows={4}
              />
            </div>

            {/* Continuous Creation Mode */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="continuousMode"
                checked={continuousMode}
                onCheckedChange={(checked) => setContinuousMode(checked === true)}
              />
              <label htmlFor="continuousMode" className="text-sm text-gray-700 cursor-pointer">
                Keep form open for continuous creation
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsAddModalOpen(false);
                setContinuousMode(false);
                setNewComment({
                  type: 'class_teacher',
                  status: 'good',
                  comment: '',
                  subject: undefined,
                  subjectStatus: undefined,
                  classId: undefined,
                  applicableTerms: ['all']
                });
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddComment} disabled={loading}>
                {loading ? 'Adding...' : continuousMode ? 'Add & Continue' : 'Add Comment'}
              </Button>
            </div>
          </div>
        </ModernDialogContent>
      </ModernDialog>

      {/* View Comment Modal */}
      {selectedComment && (
        <ViewCommentModal
          comment={selectedComment}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedComment(null);
          }}
        />
      )}

      {/* Edit Comment Modal */}
      {selectedComment && (
        <EditCommentModal
          comment={selectedComment}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedComment(null);
          }}
          onSave={handleUpdateComment}
        />
      )}

      {/* Delete Comment Modal */}
      {selectedComment && (
        <DeleteCommentModal
          comment={selectedComment}
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedComment(null);
          }}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* Push Modal */}
      <ModernDialog open={isPushModalOpen} onOpenChange={(open) => { if (!open) setIsPushModalOpen(false); }}>
        <ModernDialogContent open={isPushModalOpen} onOpenChange={(open) => { if (!open) setIsPushModalOpen(false); }}>
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-purple-600" />
              Push {selectedIds.size} Comment{selectedIds.size !== 1 ? 's' : ''} To…
            </ModernDialogTitle>
          </ModernDialogHeader>
          <div className="space-y-5 pt-2">
            {/* Target Classes */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Target Classes <span className="text-gray-400 font-normal text-xs">(leave unchecked for All Nursery Classes)</span>
              </label>
              <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {nurseryClasses.length === 0 ? (
                  <p className="text-sm text-gray-400">No nursery classes found</p>
                ) : (
                  nurseryClasses.map((cls) => (
                    <label key={cls.id} className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={pushTargetClasses.includes(cls.id)}
                        onCheckedChange={(checked) => togglePushClass(cls.id, !!checked)}
                      />
                      <span className="text-sm">{cls.name}</span>
                    </label>
                  ))
                )}
              </div>
              {pushTargetClasses.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">→ Will push as General (All Nursery Classes)</p>
              )}
            </div>

            {/* Target Terms */}
            <div>
              <label className="block text-sm font-medium mb-2">Applicable Terms</label>
              <div className="flex flex-wrap gap-4">
                {[{ value: 'all', label: 'All Terms' }, { value: 'term_1', label: 'Term 1' }, { value: 'term_2', label: 'Term 2' }, { value: 'term_3', label: 'Term 3' }].map((t) => (
                  <label key={t.value} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={pushTargetTerms.includes(t.value)}
                      disabled={t.value !== 'all' && pushTargetTerms.includes('all')}
                      onCheckedChange={(checked) => togglePushTerm(t.value, !!checked)}
                    />
                    <span className="text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setIsPushModalOpen(false)}>Cancel</Button>
              <Button
                onClick={handlePush}
                disabled={isPushing}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {isPushing ? 'Pushing…' : <><Send className="h-4 w-4" /> Push Comments</>}
              </Button>
            </div>
          </div>
        </ModernDialogContent>
      </ModernDialog>
    </div>
  );
}
