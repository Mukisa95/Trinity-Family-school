"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit3,
  Trash2,
  Save,
  MessageSquare,
  UserCheck,
  Award,
  AlertCircle,
  Copy,
  Search,
  Filter,
  Users,
  Star,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  text: string;
  role: 'class_teacher' | 'head_teacher';
  gradeCategory: string;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
}

const GRADE_CATEGORIES = [
  { 
    value: 'aggregate_4', 
    label: 'Aggregate 4', 
    description: 'Excellent Performance',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200', 
    icon: Award,
    bgGradient: 'from-emerald-50 to-green-50'
  },
  { 
    value: 'aggregate_5_6', 
    label: 'Aggregate 5-6', 
    description: 'Good Performance',
    color: 'bg-blue-100 text-blue-800 border-blue-200', 
    icon: TrendingUp,
    bgGradient: 'from-blue-50 to-indigo-50'
  },
  { 
    value: 'aggregate_7_12', 
    label: 'Aggregate 7-12', 
    description: 'Satisfactory Performance',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    icon: UserCheck,
    bgGradient: 'from-yellow-50 to-amber-50'
  },
  { 
    value: 'aggregate_13_28', 
    label: 'Aggregate 13-28', 
    description: 'Needs Improvement',
    color: 'bg-orange-100 text-orange-800 border-orange-200', 
    icon: TrendingDown,
    bgGradient: 'from-orange-50 to-red-50'
  },
  { 
    value: 'aggregate_29_36', 
    label: 'Aggregate 29-36', 
    description: 'Requires Attention',
    color: 'bg-red-100 text-red-800 border-red-200', 
    icon: AlertCircle,
    bgGradient: 'from-red-50 to-rose-50'
  }
];

const DEFAULT_COMMENTS = {
  class_teacher: {
    aggregate_4: [
      "An exceptionally brilliant performance, [Name]! Keep it up.",
      "Outstanding academic execution. Your focus is commendable.",
      "Exemplary results! You have set a very high standard this term.",
      "A masterclass in dedication and academic excellence. Bravo!",
      "Superb effort! Your consistency has yielded the ultimate reward."
    ],
    aggregate_5_6: [
      "Excellent work, [Name]! You are very close to perfection.",
      "A highly impressive performance. Keep striving for the top.",
      "Strong academic display. Your potential is shining bright.",
      "Great focus and execution this term. Keep the momentum going.",
      "Very good results! With a bit more effort, you can score straight A's."
    ],
    aggregate_7_12: [
      "A very good performance, [Name]. Keep working hard.",
      "Good steady results. You have shown solid understanding.",
      "A commendable effort. Focus on refinement in your next term.",
      "Solid academic display. You have worked well this term.",
      "Promising results. Keep pushing yourself to exceed these scores."
    ],
    aggregate_13_28: [
      "A fair performance, [Name], but you are capable of much more.",
      "Satisfactory results. Let's aim higher next term.",
      "An average display. More concentration in class is needed.",
      "You have potential, but more consistent study is required.",
      "Let's double our efforts next term to achieve better grades."
    ],
    aggregate_29_36: [
      "The results are quite weak, [Name]. Hard work is urgent.",
      "Requires serious effort and attention. Let's focus on basics.",
      "Low performance. You must pay attention and study daily.",
      "Struggling in key areas. I recommend extra remedial help.",
      "Please revise thoroughly and consult teachers for guidance."
    ]
  },
  head_teacher: {
    aggregate_4: [
      "A perfect score! You are a shining example of excellence.",
      "Sensational academic record. The school is proud of you.",
      "Outstanding! A testament to your discipline and brilliance.",
      "Incredible results! Keep aspiring for the greatest heights.",
      "Superb! Your relentless pursuit of knowledge is admirable."
    ],
    aggregate_5_6: [
      "Superb performance! You are on the pathway to greatness.",
      "An excellent report card. Keep up the high standard.",
      "A wonderful display of intelligence and hard work.",
      "Impressive results! You have a bright academic future.",
      "Outstanding effort. Keep pushing for the absolute peak."
    ],
    aggregate_7_12: [
      "A highly commendable performance. Keep up the good work.",
      "Good results. You are maintaining a solid academic standard.",
      "A positive report. Keep working steadily toward your goals.",
      "Very good effort. Continuous practice will bring even better results.",
      "Solid results. Focus on your weaker areas to improve further."
    ],
    aggregate_13_28: [
      "A satisfactory attempt, but there is room for improvement.",
      "You can do better with more determination and focus.",
      "Average performance. Let's make a strategic study plan.",
      "Keep trying; consistency will yield better academic outcomes.",
      "Focus more on class instructions and revise regularly."
    ],
    aggregate_29_36: [
      "A very weak performance. Immediate improvement is required.",
      "Please seek guidance and study consistently to catch up.",
      "Serious dedication to studies is needed to reverse this trend.",
      "Your grades require urgent attention. Work harder next term.",
      "Consult your teachers regularly and focus on the fundamentals."
    ]
  }
};

interface CommentaryBoxManagementProps {
  addTrigger: number;
}

export function CommentaryBoxManagement({ addTrigger }: CommentaryBoxManagementProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'class_teacher' | 'head_teacher'>('class_teacher');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    text: '',
    role: 'class_teacher' as 'class_teacher' | 'head_teacher',
    gradeCategory: 'aggregate_4',
  });

  // Listen to parent adding trigger
  useEffect(() => {
    if (addTrigger > 0) {
      handleOpenAddDialog();
    }
  }, [addTrigger]);

  // Initialize with default comments
  useEffect(() => {
    initializeDefaultComments();
  }, []);

  const initializeDefaultComments = () => {
    const defaultComments: Comment[] = [];
    
    Object.entries(DEFAULT_COMMENTS).forEach(([role, categories]) => {
      Object.entries(categories).forEach(([category, commentTexts]) => {
        commentTexts.forEach((text, index) => {
          defaultComments.push({
            id: `${role}_${category}_${index}`,
            text,
            role: role as 'class_teacher' | 'head_teacher',
            gradeCategory: category,
            createdAt: new Date(),
            updatedAt: new Date(),
            isDefault: true,
          });
        });
      });
    });

    setComments(defaultComments);
    setIsLoading(false);
  };

  // Filter comments by role and search term
  const filteredComments = comments.filter(comment => {
    const roleMatch = comment.role === selectedRole;
    const searchMatch = comment.text.toLowerCase().includes(searchTerm.toLowerCase());
    return roleMatch && searchMatch;
  });

  // Group comments by grade category for display
  const commentsByCategory = GRADE_CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = filteredComments.filter(c => c.gradeCategory === cat.value);
    return acc;
  }, {} as Record<string, Comment[]>);

  const handleOpenAddDialog = () => {
    setEditingComment(null);
    setFormData({
      text: '',
      role: selectedRole,
      gradeCategory: 'aggregate_4',
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (comment: Comment) => {
    setEditingComment(comment);
    setFormData({
      text: comment.text,
      role: comment.role,
      gradeCategory: comment.gradeCategory,
    });
    setIsAddDialogOpen(true);
  };

  const handleAddComment = () => {
    if (!formData.text.trim()) return;

    const newComment: Comment = {
      id: `custom_${Date.now()}`,
      text: formData.text.trim(),
      role: formData.role,
      gradeCategory: formData.gradeCategory,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: false,
    };

    setComments(prev => [newComment, ...prev]);
    setIsAddDialogOpen(false);
    toast({
      title: "Comment Added",
      description: "Successfully added new comment template.",
    });
  };

  const handleUpdateComment = () => {
    if (!editingComment || !formData.text.trim()) return;

    setComments(prev => prev.map(c => 
      c.id === editingComment.id 
        ? { ...c, text: formData.text.trim(), role: formData.role, gradeCategory: formData.gradeCategory, updatedAt: new Date() }
        : c
    ));
    setIsAddDialogOpen(false);
    setEditingComment(null);
    toast({
      title: "Comment Updated",
      description: "Successfully updated the comment template.",
    });
  };

  const handleDeleteComment = (commentId: string) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast({
        title: "Comment Deleted",
        description: "Successfully removed comment template.",
      });
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Comment template copied to clipboard.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-2">Loading commentary box data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Tabs */}
      <Tabs value={selectedRole} onValueChange={(val) => setSelectedRole(val as any)} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-slate-100/80 p-0.5 rounded-full border border-slate-200/50">
            <TabsTrigger value="class_teacher" className="rounded-full px-4 py-1 text-xs">Class Teacher Comments</TabsTrigger>
            <TabsTrigger value="head_teacher" className="rounded-full px-4 py-1 text-xs">Head Teacher Comments</TabsTrigger>
          </TabsList>

          <div className="relative w-64">
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search comments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8 text-xs bg-white/80"
            />
          </div>
        </div>

        {GRADE_CATEGORIES.map((category) => {
          const categoryComments = commentsByCategory[category.value] || [];
          const CategoryIcon = category.icon;

          return (
            <Card key={category.value} className={`border border-slate-100 bg-gradient-to-br ${category.bgGradient} mb-6 shadow-sm overflow-hidden`}>
              <CardHeader className="py-3 px-6 flex flex-row items-center justify-between border-b border-slate-100/50">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg bg-white border shadow-sm`}>
                    <CategoryIcon className="h-4 w-4 text-slate-700" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800">{category.label}</CardTitle>
                    <p className="text-[10px] text-slate-500">{category.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`${category.color} text-[10px]`}>
                  {categoryComments.length} Templates
                </Badge>
              </CardHeader>
              <CardContent className="p-4 bg-white/40">
                {categoryComments.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No comment templates configured for this category.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryComments.map((comment) => (
                      <div 
                        key={comment.id} 
                        className="group flex flex-col justify-between p-3 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-300 relative"
                      >
                        <p className="text-xs text-slate-700 leading-relaxed pr-8">{comment.text}</p>
                        
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                          <span className="text-[9px] text-slate-400">
                            {comment.isDefault ? 'Standard Default' : 'Custom'}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleCopyToClipboard(comment.text)}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-indigo-600"
                              title="Copy"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            {!comment.isDefault && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleOpenEditDialog(comment)}
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600"
                                  title="Edit"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Tabs>

      {/* Add/Edit Modal */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingComment ? 'Edit' : 'Add New'} Comment Template</DialogTitle>
            <DialogDescription>
              Create a reusable comment template for student report cards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Recipient Role</label>
                <Select 
                  value={formData.role} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, role: val as any }))}
                >
                  <SelectTrigger className="w-full bg-white text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="class_teacher">Class Teacher</SelectItem>
                    <SelectItem value="head_teacher">Head Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Performance Category</label>
                <Select 
                  value={formData.gradeCategory} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, gradeCategory: val }))}
                >
                  <SelectTrigger className="w-full bg-white text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {GRADE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Comment Text</label>
              <Textarea
                value={formData.text}
                onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                placeholder="Enter the comment text. Use [Name] as a placeholder for the student's name."
                rows={4}
                className="resize-none text-xs"
              />
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <MessageSquare className="h-3 w-3" />
                <span>Use [Name] in your comment and it will be automatically replaced with the student's name in reports.</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingComment(null);
                setFormData({ text: '', role: 'class_teacher', gradeCategory: 'aggregate_4' });
              }}
              className="text-xs"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={editingComment ? handleUpdateComment : handleAddComment}
              disabled={!formData.text.trim()}
              className="text-xs"
            >
              <Save className="h-4 w-4 mr-2" />
              {editingComment ? 'Update' : 'Add'} Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
