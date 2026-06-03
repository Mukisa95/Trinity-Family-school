"use client";

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CommentTemplate } from '@/types';
import { MoreVertical, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CommentTemplateCardProps {
  template: CommentTemplate;
  onEdit: (template: CommentTemplate) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, isActive: boolean) => void;
}

export const CommentTemplateCard: React.FC<CommentTemplateCardProps> = ({
  template,
  onEdit,
  onDelete,
  onToggleStatus
}) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${!template.isActive ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={template.type === 'class_teacher' ? 'default' : 'secondary'}>
              {template.type === 'class_teacher' ? 'Class Teacher' : 'Head Teacher'}
            </Badge>
            <Badge variant={template.isActive ? 'success' : 'destructive'}>
              {template.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onToggleStatus(template.id, !template.isActive)}
              >
                {template.isActive ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(template.id)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm text-gray-700 mb-3 leading-relaxed">
          {template.comment}
        </p>
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>Created: {formatDate(template.createdAt)}</p>
          {template.updatedAt !== template.createdAt && (
            <p>Updated: {formatDate(template.updatedAt)}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 