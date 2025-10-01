"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, Power, PowerOff } from 'lucide-react';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle } from '@/components/ui/modern-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewCommentModal } from '@/components/commentary/ViewCommentModal';
import { EditCommentModal } from '@/components/commentary/EditCommentModal';
import { DeleteCommentModal } from '@/components/commentary/DeleteCommentModal';
import { useCommentTemplates } from '@/hooks/useCommentTemplates';
import { CommentTemplate } from '@/types';
import { toast } from '@/hooks/use-toast';

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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<CommentTemplate | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Add comment form state
  const [newComment, setNewComment] = useState({
    status: 'good' as const,
    type: 'class_teacher' as const,
    comment: ''
  });

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
    
    return acc;
  }, {} as Record<string, { classTeacherComments: CommentTemplate[], headTeacherComments: CommentTemplate[] }>);

  const handleAddComment = async () => {
    if (!newComment.comment.trim()) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    try {
      await addTemplate({
        status: newComment.status,
        type: newComment.type,
        comment: newComment.comment,
        isActive: true
      });
      
      setNewComment({
        status: 'good',
        type: 'class_teacher',
        comment: ''
      });
      setIsAddModalOpen(false);
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
      await updateTemplate(updatedComment.id, {
        comment: updatedComment.comment,
        status: updatedComment.status,
        type: updatedComment.type,
        isActive: updatedComment.isActive
      });
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
    <Card className={`mb-3 ${!comment.isActive ? 'opacity-60 bg-gray-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className={`text-sm ${!comment.isActive ? 'text-gray-500' : 'text-gray-700'}`}>
              {comment.comment}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={comment.isActive ? "default" : "secondary"}>
                {comment.isActive ? "Active" : "Disabled"}
              </Badge>
              <span className="text-xs text-gray-500">
                {comment.type === 'class_teacher' ? 'Class Teacher' : 'Head Teacher'}
              </span>
            </div>
          </div>
          <div className="flex gap-1 ml-4">
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
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Commentary Management</h1>
          <p className="text-gray-600 mt-2">
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
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Comment
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {Object.entries(statusLabels).map(([status, label]) => {
          const statusData = groupedTemplates[status as keyof typeof statusLabels];
          
          return (
            <Card key={status}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${statusColors[status as keyof typeof statusColors]}`} />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-blue-700">Class Teacher Comments</h4>
                    {statusData?.classTeacherComments?.length > 0 ? (
                      statusData.classTeacherComments.map((comment) => (
                        <CommentCard key={comment.id} comment={comment} />
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No class teacher comments available</p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 text-green-700">Head Teacher Comments</h4>
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
            </Card>
          );
        })}
      </div>

      {/* Add Comment Modal */}
      <ModernDialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <ModernDialogContent open={isAddModalOpen} onOpenChange={(open) => { if (!open) setIsAddModalOpen(false); }}>
          <ModernDialogHeader>
            <ModernDialogTitle>Add New Comment</ModernDialogTitle>
          </ModernDialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Performance Status</label>
              <Select
                value={newComment.status}
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
            <div>
              <label className="block text-sm font-medium mb-2">Comment Type</label>
              <Select
                value={newComment.type}
                onValueChange={(value: any) => setNewComment(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class_teacher">Class Teacher</SelectItem>
                  <SelectItem value="head_teacher">Head Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Comment</label>
              <Textarea
                value={newComment.comment}
                onChange={(e) => setNewComment(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Enter comment text..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddComment} disabled={loading}>
                {loading ? 'Adding...' : 'Add Comment'}
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
    </div>
  );
}
