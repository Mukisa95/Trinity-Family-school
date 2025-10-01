import { useState, useEffect } from 'react';
import { commentaryService } from '@/services/commentaryService';
import { CommentTemplate } from '@/types';
import { toast } from '@/hooks/use-toast';

export const useCommentTemplates = () => {
  const [templates, setTemplates] = useState<CommentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await commentaryService.getAllCommentTemplates();
      setTemplates(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplatesByStatus = async (performanceStatus: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await commentaryService.getCommentTemplatesByStatus(performanceStatus);
      setTemplates(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplatesByCategory = async (
    performanceStatus: string, 
    category: 'class_teacher' | 'head_teacher'
  ) => {
    setLoading(true);
    setError(null);
    try {
      const data = await commentaryService.getCommentTemplatesByCategory(performanceStatus, category);
      setTemplates(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addTemplate = async (template: Omit<CommentTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    setLoading(true);
    try {
      const id = await commentaryService.addCommentTemplate(template);
      const newTemplate: CommentTemplate = {
        ...template,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTemplates(prev => [newTemplate, ...prev]);
      toast({
        title: "Success",
        description: "Comment template added successfully",
      });
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add template';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = async (id: string, updates: Partial<Omit<CommentTemplate, 'id' | 'createdAt'>>) => {
    setLoading(true);
    try {
      await commentaryService.updateCommentTemplate(id, updates);
      setTemplates(prev => prev.map(template => 
        template.id === id 
          ? { ...template, ...updates, updatedAt: new Date().toISOString() }
          : template
      ));
      toast({
        title: "Success",
        description: "Comment template updated successfully",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update template';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    setLoading(true);
    try {
      await commentaryService.deleteCommentTemplate(id);
      setTemplates(prev => prev.filter(template => template.id !== id));
      toast({
        title: "Success",
        description: "Comment template deleted successfully",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete template';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getRandomTemplate = async (
    performanceStatus: string, 
    category: 'class_teacher' | 'head_teacher'
  ): Promise<CommentTemplate | null> => {
    try {
      return await commentaryService.getRandomCommentTemplate(performanceStatus, category);
    } catch (err) {
      console.error('Error getting random template:', err);
      return null;
    }
  };

  return {
    templates,
    loading,
    error,
    fetchAllTemplates,
    fetchTemplatesByStatus,
    fetchTemplatesByCategory,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getRandomTemplate,
  };
}; 