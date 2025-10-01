'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Crown, 
  Users, 
  UserCheck, 
  UserX, 
  Plus, 
  User, 
  MoreHorizontal,
  Trash2,
  List,
  Network,
  Minimize,
  Printer
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PrefectoralPost, PostAssignment } from '@/types/duty-service';
import { AssignPupilToPostModal } from './AssignPupilToPostModal';
import { format } from 'date-fns';
import { useDeletePrefectoralPost } from '@/lib/hooks/use-duty-service';
import { generatePrefectoralPDF } from '@/lib/utils/prefectoral-pdf-generator';

interface PrefectoralManagementViewProps {
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
  showPhoto?: boolean;
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
  isLastInRow = false,
  showPhoto = true
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

  const getClassCode = (className: string) => {
    const match = className.match(/(\d+)([A-Za-z]+)/);
    return match ? `${match[1]}${match[2].charAt(0).toUpperCase()}` : className;
  };

     if (!showPhoto) {
     // Very compact version without photos
     return (
       <div className="relative">
         <Card className={`${getPositionColor(post.positionOfHonour, isTopRank)} ${isTopRank ? 'w-32 h-20' : 'w-28 h-16'} relative overflow-hidden`}>
           {/* Position Icon */}
           <div className="absolute top-0.5 right-0.5 p-0">
             {getPositionIcon(post.positionOfHonour)}
           </div>

           {/* Active Assignment Indicator */}
           {activeAssignment && (
             <div className="absolute top-0.5 left-0.5 p-0">
               <div className="h-1.5 w-1.5 bg-green-500 rounded-full"></div>
             </div>
           )}

           {/* Three-dot Menu */}
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button
                 variant="ghost"
                 size="sm"
                 className="absolute top-0.5 left-0.5 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 <MoreHorizontal className="h-2 w-2" />
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="start">
               <DropdownMenuItem onClick={() => onAssignPupil(post)}>
                 <Plus className="h-4 w-4 mr-2" />
                 Assign Pupil
               </DropdownMenuItem>
               <DropdownMenuItem 
                 onClick={() => onDeletePost(post)}
                 disabled={isDeleting}
                 className="text-red-600"
               >
                 <Trash2 className="h-4 w-4 mr-2" />
                 {isDeleting ? 'Deleting...' : 'Delete Post'}
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>

           {/* Content */}
           <CardContent className="p-1 h-full flex flex-col justify-center">
             <div className="text-center">
               <h3 className={`font-semibold ${isTopRank ? 'text-xs' : 'text-xs'} leading-tight mb-0.5`}>
                 {post.postName}
               </h3>
               
               {activeAssignment ? (
                 <div className="space-y-0">
                   <p className={`${isTopRank ? 'text-xs' : 'text-xs'} font-medium leading-tight`}>
                     {getPupilName(activeAssignment.pupilId)}
                   </p>
                   <Badge variant="outline" className={`${isTopRank ? 'text-xs' : 'text-xs'} px-0.5 py-0 h-3`}>
                     {getClassCode(getPupilClass(activeAssignment.pupilId))}
                   </Badge>
                 </div>
               ) : (
                 <div className="flex items-center justify-center">
                   <UserX className={`${isTopRank ? 'h-4 w-4' : 'h-3 w-3'} text-gray-400`} />
                 </div>
               )}
             </div>
           </CardContent>
         </Card>

         {/* Connector Lines */}
         {hasConnector && !isLastInRow && (
           <div className="absolute top-1/2 -right-0.5 w-1 h-0.5 bg-gray-300 transform -translate-y-1/2"></div>
         )}
       </div>
     );
   }

  // Full version with photos (existing code)
  return (
    <div className="relative group">
      <Card className={`${getPositionColor(post.positionOfHonour, isTopRank)} ${isTopRank ? 'w-44 h-52' : 'w-36 h-44'} relative overflow-hidden`}>
        {/* Background Image */}
        {activeAssignment && getPupilPhoto(activeAssignment.pupilId) ? (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${getPupilPhoto(activeAssignment.pupilId)})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            {activeAssignment ? (
              <User className={`${isTopRank ? 'h-12 w-12' : 'h-10 w-10'} text-gray-400`} />
            ) : (
              <UserX className={`${isTopRank ? 'h-12 w-12' : 'h-10 w-10'} text-gray-400`} />
            )}
          </div>
        )}

        {/* Position Icon */}
        <div className="absolute top-1 right-1 p-0.5">
          {getPositionIcon(post.positionOfHonour)}
        </div>

        {/* Active Assignment Indicator */}
        {activeAssignment && (
          <div className="absolute top-1 left-1 p-0.5">
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          </div>
        )}

        {/* Three-dot Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1 left-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onAssignPupil(post)}>
              <Plus className="h-4 w-4 mr-2" />
              Assign Pupil
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDeletePost(post)}
              disabled={isDeleting}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete Post'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Information Strip */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-0.5">
          <div className="text-center">
            <h3 className="text-xs font-semibold text-white leading-tight mb-0.5">
              {post.postName}
            </h3>
            
            {activeAssignment ? (
              <div className="space-y-0.5">
                <p className="text-xs text-white leading-tight">
                  {getPupilName(activeAssignment.pupilId)} {getClassCode(getPupilClass(activeAssignment.pupilId))}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-300">No Assignment</p>
            )}
          </div>
        </div>
      </Card>

      {/* Connector Lines */}
      {hasConnector && !isLastInRow && (
        <div className="absolute top-1/2 -right-1 w-2 h-0.5 bg-gray-300 transform -translate-y-1/2"></div>
      )}
    </div>
  );
};

// List View Component
const ListView: React.FC<{
  posts: PrefectoralPost[];
  assignments: PostAssignment[];
  getPupilName: (pupilId: string) => string;
  getPupilClass: (pupilId: string) => string;
  onAssignPupil: (post: PrefectoralPost) => void;
  onDeletePost: (post: PrefectoralPost) => void;
  isDeleting?: boolean;
}> = ({ posts, assignments, getPupilName, getPupilClass, onAssignPupil, onDeletePost, isDeleting }) => {
  const sortedPosts = [...posts].sort((a, b) => a.positionOfHonour - b.positionOfHonour);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Post Name</TableHead>
              <TableHead>Current Assignment</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPosts.map((post) => {
              const postAssignments = assignments.filter(a => a.postId === post.id);
              const activeAssignment = postAssignments.find(a => a.isActive);
              
              return (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {post.positionOfHonour === 1 ? (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <Users className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="font-medium">{post.positionOfHonour}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{post.postName}</TableCell>
                  <TableCell>
                    {activeAssignment ? (
                      <span className="font-medium">
                        {getPupilName(activeAssignment.pupilId)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No Assignment</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {activeAssignment ? (
                      <Badge variant="outline">
                        {getPupilClass(activeAssignment.pupilId)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {activeAssignment ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline">Vacant</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAssignPupil(post)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Assign
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDeletePost(post)}
                        disabled={isDeleting}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

// Tree View Component (existing logic)
const TreeView: React.FC<{
  posts: PrefectoralPost[];
  assignments: PostAssignment[];
  getPupilName: (pupilId: string) => string;
  getPupilClass: (pupilId: string) => string;
  getPupilPhoto: (pupilId: string) => string;
  onAssignPupil: (post: PrefectoralPost) => void;
  onDeletePost: (post: PrefectoralPost) => void;
  isDeleting?: boolean;
  showPhoto?: boolean;
}> = ({ posts, assignments, getPupilName, getPupilClass, getPupilPhoto, onAssignPupil, onDeletePost, isDeleting, showPhoto = true }) => {
  // Group posts by position of honour
  const postsByRank: Record<number, PrefectoralPost[]> = {};
  posts.forEach(post => {
    if (!postsByRank[post.positionOfHonour]) {
      postsByRank[post.positionOfHonour] = [];
    }
    postsByRank[post.positionOfHonour].push(post);
  });

  const ranks = Object.keys(postsByRank).map(Number).sort((a, b) => a - b);

     return (
     <div className={showPhoto ? "space-y-2" : "space-y-1"}>
       {ranks.map((rank, rankIndex) => {
         const rankPosts = postsByRank[rank];
         const isTopRank = rank === 1;
         
         return (
           <div key={rank} className="flex justify-center">
             <div className={`flex ${showPhoto ? 'gap-2' : 'gap-1'} items-center`}>
               {rankPosts.map((post, postIndex) => (
                 <PostCard
                   key={post.id}
                   post={post}
                   assignments={assignments}
                   isTopRank={isTopRank}
                   getPupilName={getPupilName}
                   getPupilClass={getPupilClass}
                   getPupilPhoto={getPupilPhoto}
                   onAssignPupil={onAssignPupil}
                   onDeletePost={onDeletePost}
                   isDeleting={isDeleting}
                   hasConnector={rankPosts.length > 1}
                   isLastInRow={postIndex === rankPosts.length - 1}
                   showPhoto={showPhoto}
                 />
               ))}
             </div>
           </div>
         );
       })}
     </div>
   );
};

export function PrefectoralManagementView({ 
  posts, 
  assignments, 
  getPupilName, 
  getPupilClass, 
  getPupilPhoto,
  onPostClick 
}: PrefectoralManagementViewProps) {
  const [selectedPostForAssignment, setSelectedPostForAssignment] = useState<PrefectoralPost | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPrintViewModal, setShowPrintViewModal] = useState(false);
  const [showPrintSizeModal, setShowPrintSizeModal] = useState(false);
  const [selectedPrintView, setSelectedPrintView] = useState<'tree' | 'minimized' | 'list'>('tree');
  const deletePrefectoralPost = useDeletePrefectoralPost();

  const handleAssignPupil = (post: PrefectoralPost) => {
    setSelectedPostForAssignment(post);
    setShowAssignModal(true);
  };

  const handleDeletePost = (post: PrefectoralPost) => {
    deletePrefectoralPost.mutate(post.id);
  };

  const handlePrintClick = () => {
    setShowPrintViewModal(true);
  };

  const handleViewSelection = (view: 'tree' | 'minimized' | 'list') => {
    setSelectedPrintView(view);
    setShowPrintViewModal(false);
    setShowPrintSizeModal(true);
  };

  const handleSizeSelection = async (size: 'A3' | 'A4') => {
    setShowPrintSizeModal(false);
    try {
      await generatePrefectoralPDF({
        posts,
        assignments,
        viewType: selectedPrintView,
        paperSize: size,
        getPupilName,
        getPupilClass,
        getPupilPhoto
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Prefectoral Management</h2>
        <Button onClick={handlePrintClick} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>
      
      <Tabs defaultValue="tree" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tree" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Tree View
          </TabsTrigger>
          <TabsTrigger value="minimized" className="flex items-center gap-2">
            <Minimize className="h-4 w-4" />
            Compact Tree
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            List View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="mt-6">
          <TreeView
            posts={posts}
            assignments={assignments}
            getPupilName={getPupilName}
            getPupilClass={getPupilClass}
            getPupilPhoto={getPupilPhoto}
            onAssignPupil={handleAssignPupil}
            onDeletePost={handleDeletePost}
            isDeleting={deletePrefectoralPost.isPending}
            showPhoto={true}
          />
        </TabsContent>

        <TabsContent value="minimized" className="mt-6">
          <TreeView
            posts={posts}
            assignments={assignments}
            getPupilName={getPupilName}
            getPupilClass={getPupilClass}
            getPupilPhoto={getPupilPhoto}
            onAssignPupil={handleAssignPupil}
            onDeletePost={handleDeletePost}
            isDeleting={deletePrefectoralPost.isPending}
            showPhoto={false}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <ListView
            posts={posts}
            assignments={assignments}
            getPupilName={getPupilName}
            getPupilClass={getPupilClass}
            onAssignPupil={handleAssignPupil}
            onDeletePost={handleDeletePost}
            isDeleting={deletePrefectoralPost.isPending}
          />
        </TabsContent>
      </Tabs>

      {showAssignModal && selectedPostForAssignment && (
        <AssignPupilToPostModal
          post={selectedPostForAssignment}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedPostForAssignment(null);
          }}
        />
      )}

      {/* Print View Selection Modal */}
      {showPrintViewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Select View Type</h3>
            <div className="space-y-3">
              <Button 
                onClick={() => handleViewSelection('tree')}
                className="w-full justify-start"
                variant="outline"
              >
                <Network className="h-4 w-4 mr-2" />
                Tree View
              </Button>
              <Button 
                onClick={() => handleViewSelection('minimized')}
                className="w-full justify-start"
                variant="outline"
              >
                <Minimize className="h-4 w-4 mr-2" />
                Compact Tree
              </Button>
              <Button 
                onClick={() => handleViewSelection('list')}
                className="w-full justify-start"
                variant="outline"
              >
                <List className="h-4 w-4 mr-2" />
                List View
              </Button>
            </div>
            <Button 
              onClick={() => setShowPrintViewModal(false)}
              variant="ghost"
              className="mt-4 w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Print Size Selection Modal */}
      {showPrintSizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">Select Paper Size</h3>
            <div className="space-y-3">
              <Button 
                onClick={() => handleSizeSelection('A4')}
                className="w-full justify-start"
                variant="outline"
              >
                A4 (210 × 297 mm)
              </Button>
              <Button 
                onClick={() => handleSizeSelection('A3')}
                className="w-full justify-start"
                variant="outline"
              >
                A3 (297 × 420 mm)
              </Button>
            </div>
            <Button 
              onClick={() => setShowPrintSizeModal(false)}
              variant="ghost"
              className="mt-4 w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
