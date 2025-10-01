"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit3,
  Trash2,
  Save,
  MessageSquare,
  GraduationCap,
  UserCheck,
  Award,
  AlertCircle,
  Copy,
  Search,
  Filter,
  BookOpen,
  Users,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw
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

// Types
interface Comment {
  id: string;
  text: string;
  role: 'class_teacher' | 'head_teacher';
  gradeCategory: string;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
}

// Grade categories with enhanced styling
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
    value: 'grades_2_3', 
    label: 'Second & Third Grade', 
    description: 'Needs Improvement',
    color: 'bg-orange-100 text-orange-800 border-orange-200', 
    icon: TrendingDown,
    bgGradient: 'from-orange-50 to-red-50'
  },
  { 
    value: 'grades_4_u', 
    label: 'Fourth Grade & U', 
    description: 'Requires Attention',
    color: 'bg-red-100 text-red-800 border-red-200', 
    icon: AlertCircle,
    bgGradient: 'from-red-50 to-pink-50'
  },
];

// Default comments data (complete set as provided by user)
const DEFAULT_COMMENTS: Record<string, Record<string, string[]>> = {
  class_teacher: {
    aggregate_4: [
      "I am delighted with this outstanding performance, [Name].",
      "Thank you for your consistent effort and exceptional results.",
      "[Name], your dedication has produced remarkable outcomes.",
      "I am proud of your exemplary achievement this term.",
      "Well done on maintaining such a high standard of work.",
      "Your hard work is clearly reflected in these excellent results.",
      "Congratulations on achieving such a superb aggregate.",
      "Your enthusiasm and commitment are truly commendable.",
      "I appreciate the enthusiasm you bring to every lesson.",
      "Keep up this brilliant level of performance, [Name].",
      "Your focus and determination have paid off handsomely.",
      "Thank you for setting such an impressive example for your peers.",
      "You have demonstrated exceptional mastery of the material.",
      "Your work ethic has been nothing short of inspiring.",
      "I value the positive attitude you display every day.",
      "You consistently exceed our expectations—well done.",
      "Your achievements this term are a testament to your perseverance.",
      "Keep up this wonderful momentum, [Name].",
      "I am thrilled by the quality of your contributions in class.",
      "This level of performance is truly outstanding—congratulations!"
    ],
    aggregate_5_6: [
      "Thank you, [Name], for your commendable effort this term.",
      "Your work shows real promise—aiming for aggregate 4 is within reach.",
      "Well done on this encouraging performance.",
      "I can see your progress; let's push toward that top grade.",
      "Your dedication is evident—keep striving for aggregate 4.",
      "I appreciate your focus and growing confidence.",
      "You have made good strides; continue to build on this.",
      "This result is promising—keep working hard.",
      "Your determination will help you close the gap to aggregate 4.",
      "Thank you for your steady effort—let's aim higher next term.",
      "You are on the right track; consistency will lead to excellence.",
      "Keep up this positive attitude, [Name].",
      "I encourage you to maintain this level of effort.",
      "You have the ability; continue to challenge yourself.",
      "This performance is solid—strive to make it even stronger.",
      "Your improvement is clear—let's keep the momentum going.",
      "Aim for precision in your work to reach the next level.",
      "I appreciate your willingness to learn and improve.",
      "You are making good progress—let's target aggregate 4 next.",
      "Your effort is commendable; I believe you can do even better."
    ],
    aggregate_7_12: [
      "[Name], your progress this term is encouraging.",
      "I am pleased with the improvement I've seen in your work.",
      "This is good progress—keep building on it.",
      "Thank you for your dedication; continue working hard.",
      "Your steady effort shows real promise.",
      "Well done on this solid performance.",
      "You have demonstrated clear growth—let's keep going.",
      "Your commitment is paying off; maintain this pace.",
      "I appreciate the focus you bring to each lesson.",
      "This result is a step in the right direction.",
      "You're improving; aim to deepen your understanding next term.",
      "Keep up your positive attitude toward learning.",
      "Your hard work is beginning to yield results.",
      "Thank you for striving to do your best every day.",
      "I see real progress—let's work on consistency.",
      "You have great potential; continue to apply yourself.",
      "Stay engaged and ask questions to boost your understanding.",
      "Your perseverance will lead to even better results.",
      "This performance is a foundation—let's build higher.",
      "I'm pleased with your efforts; let's target further improvement."
    ],
    grades_2_3: [
      "[Name], we still expect a lot from you—continue working hard.",
      "I believe in your ability to improve; keep trying.",
      "We have high hopes for you, [Name]. Let's see more effort.",
      "Your potential is clear—focus and determination will help.",
      "You can perform better than this with consistent effort.",
      "Let's work together to raise your achievement.",
      "I encourage you to engage more actively in class.",
      "Keep practicing to strengthen your skills.",
      "You have the ability; believe in yourself and work hard.",
      "I'd like to see you take more initiative in your learning.",
      "Let's set clear goals to boost your performance.",
      "You show promise; focus on improving your weak areas.",
      "Your teachers are here to support your progress.",
      "Let's develop a study plan to help you succeed.",
      "I know you can do better—let's make it happen.",
      "Try to apply feedback more consistently in your work.",
      "Continue to ask questions when you're unsure.",
      "Your attitude can make a big difference—stay positive.",
      "We will work together to help you reach your potential.",
      "Let's aim to see steady improvement next term."
    ],
    grades_4_u: [
      "There is still room for improvement, [Name]. Work harder.",
      "We shall work together to ensure improvement in all subjects.",
      "Let's develop strategies to improve your performance.",
      "Your progress has stalled—let's refocus and try again.",
      "I encourage you to seek extra help where needed.",
      "Let's set realistic goals to guide your improvement.",
      "Please spend more time reviewing your lessons.",
      "Practice and repetition will help you grasp the material.",
      "I am here to support you—let's schedule additional practice.",
      "You can improve with consistent daily effort.",
      "Focus on one subject at a time to build confidence.",
      "Let's track your progress with small, measurable steps.",
      "Try to complete all assignments thoroughly.",
      "Ask for clarification whenever you feel stuck.",
      "A positive attitude will help you overcome challenges.",
      "Persistence will be key to raising your grades.",
      "Let's review past mistakes and learn from them.",
      "I'm confident that targeted practice will yield results.",
      "We'll work together to develop stronger study habits.",
      "Keep trying—your hard work will pay off in due course."
    ]
  },
  head_teacher: {
    aggregate_4: [
      "Congratulations on this outstanding achievement, [Name].",
      "Your dedication has produced superb results.",
      "Well done on maintaining such a high standard of work.",
      "Your hard work shines through these excellent results.",
      "I'm proud of your exemplary performance this term.",
      "You've set a wonderful example for your classmates.",
      "Such consistent excellence is truly impressive.",
      "Keep up this brilliant level of achievement, [Name].",
      "Your focus and perseverance have paid off handsomely.",
      "I appreciate the enthusiasm you bring to every lesson.",
      "Your mastery of the material is outstanding.",
      "You've exceeded all expectations—congratulations!",
      "Exceptional work like this deserves to be celebrated.",
      "Your commitment to learning is admirable.",
      "This level of success reflects your hard work.",
      "Your results are a testament to your effort.",
      "I'm thrilled by the quality of your contributions.",
      "Keep riding this wave of excellence, [Name].",
      "You've raised the bar for yourself this term.",
      "Fantastic performance—keep it going!"
    ],
    aggregate_5_6: [
      "Well done on a commendable performance, [Name].",
      "Your progress is encouraging; aim for aggregate 4 next term.",
      "This result shows real promise—keep striving higher.",
      "You're on the right track; maintain this momentum.",
      "Your growing confidence is reflected in your work.",
      "Continue to refine your skills to reach the next level.",
      "Your determination will help you achieve even more.",
      "Thank you for your steady effort this term.",
      "You have the ability to aim for the top grade.",
      "Keep up this positive attitude toward learning.",
      "Let's push together to reach aggregate 4 soon.",
      "Your effort is clear—let's build on it next term.",
      "I appreciate the focus you bring to each task.",
      "Your work is solid; aim to make it even stronger.",
      "Consistency will take you closer to your goal.",
      "You're improving—let's keep the progress going.",
      "I believe you can achieve aggregate 4 with effort.",
      "Well done; let's set our sights a bit higher.",
      "You're closing the gap—keep pushing forward.",
      "Excellent work so far—let's take it up a notch."
    ],
    aggregate_7_12: [
      "[Name], your improvement this term is very encouraging.",
      "You've made good strides—continue to build on this.",
      "This performance is a solid foundation for growth.",
      "Thank you for your dedication; keep working hard.",
      "Your focus in class is beginning to pay off.",
      "You've shown clear progress—aim for even more next term.",
      "Stay engaged and ask questions to deepen your understanding.",
      "Your steady effort will lead to better results.",
      "Keep this positive momentum going, [Name].",
      "I appreciate the persistence you're showing.",
      "Let's work on consistency to boost your performance.",
      "Your progress is promising—continue to apply yourself.",
      "Well done on this encouraging level of achievement.",
      "You have the potential; let's unlock it together.",
      "Your hard work is beginning to shine through.",
      "Continue to challenge yourself in every subject.",
      "You're on the right path—remain focused.",
      "Small, daily efforts will bring about big gains.",
      "Thank you for rising to the challenge this term.",
      "Use this progress as a springboard to greater success."
    ],
    grades_2_3: [
      "I believe in your ability to achieve better results, [Name].",
      "Let's aim for more consistent effort next term.",
      "You can perform at a higher level with focused practice.",
      "Take initiative in your learning to see real improvement.",
      "Your potential is clear—let's work on strengthening your skills.",
      "Regular revision will help you gain confidence.",
      "I encourage you to seek help whenever you need it.",
      "Let's set clear goals to guide your progress.",
      "Try to apply feedback more consistently in your work.",
      "Your attitude toward learning will shape your success.",
      "You can unlock better results through daily practice.",
      "Focus on tricky areas first to build a stronger foundation.",
      "I'm here to support you—reach out when you feel stuck.",
      "Believe in yourself and the improvements will follow.",
      "We expect more from you; rise to the challenge.",
      "Consistent effort will lead to real growth.",
      "Keep asking questions to clarify your understanding.",
      "Let's establish a study routine that works for you.",
      "Your teachers are ready to help—use their guidance.",
      "I'm confident you can exceed these results next term."
    ],
    grades_4_u: [
      "There is room for significant improvement, [Name]; let's focus on that.",
      "Please engage more actively in every lesson.",
      "A targeted study plan will help raise your grades.",
      "Your current performance needs more consistent effort.",
      "Daily review sessions will strengthen your learning.",
      "Practice fundamentals before moving on to new topics.",
      "You must take greater responsibility for your studies.",
      "Let's check your progress regularly to stay on track.",
      "Persistence and hard work will yield better results.",
      "Ask for clarification whenever a concept is unclear.",
      "Concentrate on one subject at a time for deeper understanding.",
      "I recommend extra practice in your weaker areas.",
      "Developing strong study habits is essential.",
      "I expect to see more effort in your next assessment.",
      "Consistent practice will build your confidence.",
      "Keep trying—your hard work will pay off.",
      "Let's review past mistakes and learn from them.",
      "You have the capacity to improve; please show it.",
      "Stay positive and persistent in your studies.",
      "I anticipate marked improvement next term."
    ]
  }
};

export default function CommentaryBoxPage() {
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

  // Group comments by grade category
  const groupedComments = GRADE_CATEGORIES.map(category => ({
    ...category,
    comments: filteredComments.filter(comment => comment.gradeCategory === category.value)
  }));

  const handleAddComment = () => {
    const newComment: Comment = {
      id: `custom_${Date.now()}`,
      text: formData.text,
      role: formData.role,
      gradeCategory: formData.gradeCategory,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: false,
    };

    setComments(prev => [...prev, newComment]);
    setFormData({ text: '', role: 'class_teacher', gradeCategory: 'aggregate_4' });
    setIsAddDialogOpen(false);
    
    toast({
      title: "Comment Added",
      description: "New comment has been added successfully.",
    });
  };

  const handleEditComment = (comment: Comment) => {
    setEditingComment(comment);
    setFormData({
      text: comment.text,
      role: comment.role,
      gradeCategory: comment.gradeCategory,
    });
  };

  const handleUpdateComment = () => {
    if (!editingComment) return;

    setComments(prev => prev.map(comment => 
      comment.id === editingComment.id
        ? { ...comment, ...formData, updatedAt: new Date() }
        : comment
    ));

    setEditingComment(null);
    setFormData({ text: '', role: 'class_teacher', gradeCategory: 'aggregate_4' });
    
    toast({
      title: "Comment Updated",
      description: "Comment has been updated successfully.",
    });
  };

  const handleDeleteComment = (commentId: string) => {
    setComments(prev => prev.filter(comment => comment.id !== commentId));
    toast({
      title: "Comment Deleted",
      description: "Comment has been deleted successfully.",
    });
  };

  const handleCopyComment = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Comment text copied to clipboard.",
    });
  };

  const getStatsForRole = (role: 'class_teacher' | 'head_teacher') => {
    const roleComments = comments.filter(c => c.role === role);
    return {
      total: roleComments.length,
      custom: roleComments.filter(c => !c.isDefault).length,
      default: roleComments.filter(c => c.isDefault).length,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Commentary Box</h1>
              <p className="text-gray-600">Manage teacher and headteacher comments for pupil reports</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {(['class_teacher', 'head_teacher'] as const).map((role) => {
            const stats = getStatsForRole(role);
            const Icon = role === 'head_teacher' ? GraduationCap : Users;
            
            return (
              <Card key={role} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5 text-blue-600" />
                    {role === 'head_teacher' ? 'Head Teacher Comments' : 'Class Teacher Comments'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.default}</div>
                      <div className="text-xs text-gray-500">Default</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats.custom}</div>
                      <div className="text-xs text-gray-500">Custom</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* Controls Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Manage Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search comments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)} className="whitespace-nowrap">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Comment
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Role Tabs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="class_teacher" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Class Teacher
              </TabsTrigger>
              <TabsTrigger value="head_teacher" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Head Teacher
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedRole} className="mt-6">
              <div className="space-y-6">
                {groupedComments.map((category) => {
                  const Icon = category.icon;
                  
                  if (category.comments.length === 0) return null;

                  return (
                    <motion.div
                      key={category.value}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Card className={`overflow-hidden bg-gradient-to-r ${category.bgGradient}`}>
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${category.color.replace('text-', 'text-white bg-').split(' ')[0]}`}>
                                <Icon className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold">{category.label}</h3>
                                <p className="text-sm text-gray-600">{category.description}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={category.color}>
                              {category.comments.length} comments
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3">
                            {category.comments.map((comment) => (
                              <motion.div
                                key={comment.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm hover:shadow-md transition-all duration-200"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="text-gray-800 leading-relaxed text-sm">
                                      {comment.text}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      {comment.isDefault ? (
                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                          <Star className="h-3 w-3 mr-1" />
                                          Default
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                          Custom
                                        </Badge>
                                      )}
                                      <span className="text-xs text-gray-500">
                                        {comment.isDefault ? 'Built-in' : `Added ${comment.createdAt.toLocaleDateString()}`}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCopyComment(comment.text)}
                                      className="h-8 w-8 p-0 hover:bg-blue-100"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditComment(comment)}
                                      className="h-8 w-8 p-0 hover:bg-green-100"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </Button>
                                    {!comment.isDefault && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Add/Edit Comment Dialog */}
        <Dialog 
          open={isAddDialogOpen || !!editingComment} 
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingComment(null);
              setFormData({ text: '', role: 'class_teacher', gradeCategory: 'aggregate_4' });
            }
          }}
        >
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {editingComment ? 'Edit Comment' : 'Add New Comment'}
              </DialogTitle>
              <DialogDescription>
                {editingComment ? 'Update the comment details below.' : 'Create a new comment for pupil reports.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Role</label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class_teacher">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Class Teacher
                        </div>
                      </SelectItem>
                      <SelectItem value="head_teacher">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          Head Teacher
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Grade Category</label>
                  <Select 
                    value={formData.gradeCategory} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, gradeCategory: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADE_CATEGORIES.map(category => {
                        const Icon = category.icon;
                        return (
                          <SelectItem key={category.value} value={category.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {category.label}
                            </div>
                          </SelectItem>
                        );
                      })}
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
                  className="resize-none"
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
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={editingComment ? handleUpdateComment : handleAddComment}
                disabled={!formData.text.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {editingComment ? 'Update' : 'Add'} Comment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 