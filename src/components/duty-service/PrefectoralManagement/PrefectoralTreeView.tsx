'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronRight, 
  Crown, 
  Users, 
  UserCheck, 
  UserX, 
  Plus, 
  User, 
  MoreHorizontal,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PrefectoralPost, PostAssignment } from '@/types/duty-service';
import { AssignPupilToPostModal } from './AssignPupilToPostModal';
import { format } from 'date-fns';
import { useDeletePrefectoralPost } from '@/lib/hooks/use-duty-service';

interface PrefectoralTreeViewProps {
  posts: PrefectoralPost[];
  assignments: PostAssignment[];
  getPupilName: (pupilId: string) => string;
  getPupilClass: (pupilId: string) => string;
  getPupilPhoto: (pupilId: string) => string;
  onPostClick?: (post: PrefectoralPost) => void;
}

interface PostCardProps {
  post: PrefectoralPost;
  assignments: PostAssignment[];
  isTopRank: boolean;
  getPupilName: (pupilId: string) => string;
  getPupilClass: (pupilId: string) => string;
  getPupilPhoto: (pupilId: string) => string;
  onAssignPupil: (post: PrefectoralPost) => void;
  onDeletePost: (post: PrefectoralPost) => void;
  isDeleting?: boolean;
  hasConnector?: boolean;
  isLastInRow?: boolean;
}

const PostCard: React.FC<PostCardProps> = ({ 
  post, 
  assignments, 
  isTopRank, 
  getPupilName, 
  getPupilClass, 
  getPupilPhoto,
  onAssignPupil,
  onDeletePost,
  isDeleting = false,
  hasConnector = false,
  isLastInRow = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const postAssignments = assignments.filter(a => a.postId === post.id);
  const activeAssignment = postAssignments.find(a => a.isActive);
  const historicalAssignments = postAssignments.filter(a => !a.isActive);

     const getPositionIcon = (position: number) => {
     switch (position) {
       case 1:
         return <Crown className={`${isTopRank ? 'h-4 w-4' : 'h-3 w-3'} text-yellow-500`} />;
       case 2:
         return <Users className={`${isTopRank ? 'h-4 w-4' : 'h-3 w-3'} text-blue-500`} />;
       default:
         return <Users className={`${isTopRank ? 'h-4 w-4' : 'h-3 w-3'} text-gray-500`} />;
     }
   };

  const getPositionColor = (position: number, isTop: boolean) => {
    if (isTop) {
      return 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 shadow-lg';
    }
    
    switch (position) {
      case 1:
        return 'bg-yellow-50 border-yellow-200 shadow-md';
      case 2:
        return 'bg-blue-50 border-blue-200 shadow-md';
      case 3:
        return 'bg-green-50 border-green-200 shadow-md';
      case 4:
        return 'bg-purple-50 border-purple-200 shadow-md';
      default:
        return 'bg-gray-50 border-gray-200 shadow-md';
    }
  };

  // Function to extract class code from class name (e.g., "Primary Six" -> "P6")
  const getClassCode = (className: string) => {
    if (!className) return '';
    
    const classMap: { [key: string]: string } = {
      'primary one': 'P1',
      'primary two': 'P2', 
      'primary three': 'P3',
      'primary four': 'P4',
      'primary five': 'P5',
      'primary six': 'P6',
      'primary seven': 'P7',
      'secondary one': 'S1',
      'secondary two': 'S2',
      'secondary three': 'S3',
      'secondary four': 'S4',
      'secondary five': 'S5',
      'secondary six': 'S6',
    };
    
    const normalizedClass = className.toLowerCase().trim();
    return classMap[normalizedClass] || className.substring(0, 2).toUpperCase();
  };

     return (
     <div className="flex flex-col items-center relative">
       {/* Main Card */}
               <Card className={`${isTopRank ? 'w-44 h-52' : 'w-36 h-44'} ${getPositionColor(post.positionOfHonour, isTopRank)} transition-all hover:shadow-lg relative overflow-hidden`}>
        <CardContent className="p-0 h-full relative">
                     {/* Three-dot Menu Button - Top Left */}
           <div className="absolute top-1 left-1 z-10">
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="ghost" size="sm" className="h-6 w-6 p-0 bg-white/80 hover:bg-white">
                   <MoreHorizontal className="h-3 w-3" />
                 </Button>
               </DropdownMenuTrigger>
                             <DropdownMenuContent align="start">
                 <DropdownMenuItem onClick={() => onAssignPupil(post)}>
                   <Plus className="h-4 w-4 mr-2" />
                   Assign Pupil
                 </DropdownMenuItem>
                 {postAssignments.length > 0 && (
                   <DropdownMenuItem onClick={() => setIsExpanded(!isExpanded)}>
                     {isExpanded ? (
                       <>
                         <ChevronDown className="h-4 w-4 mr-2" />
                         Hide History
                       </>
                     ) : (
                       <>
                         <ChevronRight className="h-4 w-4 mr-2" />
                         View History
                       </>
                     )}
                   </DropdownMenuItem>
                 )}
                                   <DropdownMenuItem 
                    onClick={() => onDeletePost(post)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isDeleting ? 'Deleting...' : 'Delete Post'}
                  </DropdownMenuItem>
               </DropdownMenuContent>
            </DropdownMenu>
          </div>

                     {/* Position Icon - Top Right */}
           <div className="absolute top-1 right-1 z-10">
             <div className="bg-white/80 rounded-full p-0.5">
               {getPositionIcon(post.positionOfHonour)}
             </div>
           </div>

          {/* Pupil Photo as Background - Fills entire card */}
          <div className="w-full h-full relative">
            {activeAssignment ? (
              <div className="w-full h-full">
                {getPupilPhoto(activeAssignment.pupilId) ? (
                  <img 
                    src={getPupilPhoto(activeAssignment.pupilId)} 
                    alt={getPupilName(activeAssignment.pupilId)}
                    className="w-full h-full object-cover"
                  />
                                 ) : (
                   <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                     <User className={`${isTopRank ? 'h-12 w-12' : 'h-10 w-10'} text-gray-400`} />
                   </div>
                 )}
                {/* Active assignment indicator */}
                                 <div className="absolute top-1 left-1/2 transform -translate-x-1/2 bg-green-500 rounded-full p-0.5">
                   <UserCheck className="h-2 w-2 text-white" />
                 </div>
              </div>
                         ) : (
               <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                 <UserX className={`${isTopRank ? 'h-12 w-12' : 'h-10 w-10'} text-gray-400`} />
               </div>
             )}

                         {/* Dark strip at bottom with information */}
             <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-0.5">
               <div className="text-center">
                 {/* Post Title */}
                 <h3 className={`font-bold text-white ${isTopRank ? 'text-xs' : 'text-xs'} leading-tight`}>
                   {post.postName}
                 </h3>
 
                 {/* Pupil Information (if assigned) */}
                 {activeAssignment && (
                   <div className="flex items-center justify-center gap-1 mt-0.5">
                     <p className="font-semibold text-white text-xs leading-tight">
                       {getPupilName(activeAssignment.pupilId)}
                     </p>
                     <Badge variant="secondary" className="text-xs px-1 py-0 bg-white/20 text-white border-white/30 leading-tight">
                       {getClassCode(getPupilClass(activeAssignment.pupilId))}
                     </Badge>
                   </div>
                 )}
 
                 {/* No Assignment Message */}
                 {!activeAssignment && (
                   <p className="text-xs text-gray-300 italic leading-tight">No pupil assigned</p>
                 )}
 
                 {/* Allowance Badge */}
                 {post.allowance && (
                   <Badge variant="outline" className="mt-0.5 text-xs bg-white/20 text-white border-white/30 leading-tight">
                     KES {post.allowance.toLocaleString()}
                   </Badge>
                 )}
               </div>
             </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignment History */}
      {isExpanded && postAssignments.length > 0 && (
        <div className="mt-4 w-full max-w-md">
          <Card>
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3 text-center">Assignment History</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {postAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                        {getPupilPhoto(assignment.pupilId) ? (
                          <img 
                            src={getPupilPhoto(assignment.pupilId)} 
                            alt={getPupilName(assignment.pupilId)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getPupilName(assignment.pupilId)}</span>
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {getClassCode(getPupilClass(assignment.pupilId))}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={assignment.isActive ? "default" : "secondary"} className="text-xs">
                        {assignment.isActive ? "Active" : "Past"}
                      </Badge>
                      <p className="text-muted-foreground text-xs mt-1">
                        {format(new Date(assignment.startDate), 'MMM dd, yyyy')} - {format(new Date(assignment.endDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export function PrefectoralTreeView({ 
  posts, 
  assignments, 
  getPupilName, 
  getPupilClass,
  getPupilPhoto,
  onPostClick 
}: PrefectoralTreeViewProps) {
  const [selectedPostForAssignment, setSelectedPostForAssignment] = useState<PrefectoralPost | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const deletePrefectoralPost = useDeletePrefectoralPost();

  // Sort posts by position of honour (1 = highest rank)
  const sortedPosts = [...posts].sort((a, b) => a.positionOfHonour - b.positionOfHonour);

  // Group posts by position of honour for rendering in rows
  const postsByRank: Record<number, PrefectoralPost[]> = sortedPosts.reduce((acc, post) => {
    if (!acc[post.positionOfHonour]) {
      acc[post.positionOfHonour] = [];
    }
    acc[post.positionOfHonour].push(post);
    return acc;
  }, {} as Record<number, PrefectoralPost[]>);

  const ranks = Object.keys(postsByRank).map(Number).sort((a, b) => a - b);

  const handleAssignPupil = (post: PrefectoralPost) => {
    setSelectedPostForAssignment(post);
    setShowAssignModal(true);
  };

  const handleDeletePost = (post: PrefectoralPost) => {
    if (confirm(`Are you sure you want to delete the post "${post.postName}"? This action cannot be undone.`)) {
      deletePrefectoralPost.mutate(post.id);
    }
  };

  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Prefectoral Posts</h3>
        <p className="text-muted-foreground">
          Create prefectoral posts to start building your leadership hierarchy
        </p>
      </div>
    );
  }

     return (
     <div className="space-y-2">
       {/* Hierarchical Structure */}
        <div className="space-y-2">
          {ranks.map((rank, index) => {
            const postsInRank = postsByRank[rank];
            const isTopRank = rank === 1;
            
            return (
              <div key={rank} className="flex flex-col items-center">
                {/* Posts in this rank with connecting lines */}
                <div className="flex justify-center gap-2 flex-wrap relative">
                  {postsInRank.map((post, postIndex) => (
                    <div key={post.id} className="relative">
                                             <PostCard
                         post={post}
                         assignments={assignments}
                         isTopRank={isTopRank}
                         getPupilName={getPupilName}
                         getPupilClass={getPupilClass}
                         getPupilPhoto={getPupilPhoto}
                         onAssignPupil={handleAssignPupil}
                         onDeletePost={handleDeletePost}
                         isDeleting={deletePrefectoralPost.isPending}
                         hasConnector={index > 0} // Add connector for all levels except the first
                         isLastInRow={postIndex === postsInRank.length - 1}
                       />
                      
                      {/* Horizontal connector line between cards in the same row */}
                      {postIndex < postsInRank.length - 1 && (
                        <div className="absolute top-1/2 -right-1 w-2 h-px bg-gray-300 transform -translate-y-1/2"></div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Vertical connector lines from each card to the next level */}
                {index < ranks.length - 1 && (
                  <div className="flex justify-center gap-2 mt-2">
                    {postsInRank.map((_, postIndex) => (
                      <div key={postIndex} className="w-px h-2 bg-gray-300"></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      {/* Assign Pupil Modal */}
      <AssignPupilToPostModal
        post={selectedPostForAssignment}
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
      />
    </div>
  );
}
