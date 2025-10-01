import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CommentTemplate } from '@/types';

const COLLECTION_NAME = 'commentTemplates';

export const commentaryService = {
  // Get all comment templates
  async getAllCommentTemplates(): Promise<CommentTemplate[]> {
    try {
      console.log('🔍 CommentaryService: Fetching all templates from collection:', COLLECTION_NAME);
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      console.log('📊 CommentaryService: Found', querySnapshot.docs.length, 'templates');
      
      const templates = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as CommentTemplate[];
      
      console.log('📋 CommentaryService: Processed templates:', templates.slice(0, 2));
      
      return templates;
    } catch (error) {
      console.error('❌ CommentaryService Error fetching comment templates:', error);
      throw new Error('Failed to fetch comment templates');
    }
  },

  // Get comment templates by performance status
  async getCommentTemplatesByStatus(performanceStatus: string): Promise<CommentTemplate[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', performanceStatus),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as CommentTemplate[];
    } catch (error) {
      console.error('Error fetching comment templates by status:', error);
      throw new Error('Failed to fetch comment templates');
    }
  },

  // Get comment templates by category and status
  async getCommentTemplatesByCategory(
    performanceStatus: string, 
    category: 'class_teacher' | 'head_teacher'
  ): Promise<CommentTemplate[]> {
    try {
      console.log(`🔍 getCommentTemplatesByCategory: Querying ${performanceStatus} - ${category}`);
      
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', performanceStatus),
        where('type', '==', category)
        // Note: Removed orderBy to avoid requiring composite index
        // Random selection happens in getRandomCommentTemplate anyway
      );
      const querySnapshot = await getDocs(q);
      
      console.log(`📊 getCommentTemplatesByCategory: Found ${querySnapshot.docs.length} documents`);
      
      const templates = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as CommentTemplate[];
      
      console.log(`📋 getCommentTemplatesByCategory: Processed templates:`, templates.map(t => ({ id: t.id, status: t.status, type: t.type, isActive: t.isActive })));
      
      return templates;
    } catch (error) {
      console.error('❌ getCommentTemplatesByCategory Error:', error);
      throw new Error('Failed to fetch comment templates');
    }
  },

  // Add new comment template
  async addCommentTemplate(template: Omit<CommentTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = Timestamp.now();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...template,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding comment template:', error);
      throw new Error('Failed to add comment template');
    }
  },

  // Update comment template
  async updateCommentTemplate(id: string, updates: Partial<Omit<CommentTemplate, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating comment template:', error);
      throw new Error('Failed to update comment template');
    }
  },

  // Delete comment template
  async deleteCommentTemplate(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting comment template:', error);
      throw new Error('Failed to delete comment template');
    }
  },

  // Get random comment template for a specific status and category
  async getRandomCommentTemplate(
    performanceStatus: string, 
    category: 'class_teacher' | 'head_teacher'
  ): Promise<CommentTemplate | null> {
    try {
      console.log(`🎲 getRandomCommentTemplate: Fetching templates for ${performanceStatus} - ${category}`);
      
      const templates = await this.getCommentTemplatesByCategory(performanceStatus, category);
      
      console.log(`📊 getRandomCommentTemplate: Found ${templates.length} templates`);
      
      if (templates.length === 0) {
        console.log(`⚠️ getRandomCommentTemplate: No templates found`);
        return null;
      }
      
      // Filter for active templates only
      const activeTemplates = templates.filter(t => t.isActive);
      console.log(`✅ getRandomCommentTemplate: ${activeTemplates.length} active templates`);
      
      if (activeTemplates.length === 0) {
        console.log(`⚠️ getRandomCommentTemplate: No active templates found`);
        return null;
      }
      
      const randomIndex = Math.floor(Math.random() * activeTemplates.length);
      const selectedTemplate = activeTemplates[randomIndex];
      
      console.log(`🎯 getRandomCommentTemplate: Selected template #${randomIndex}:`, selectedTemplate.comment.substring(0, 50) + '...');
      
      return selectedTemplate;
    } catch (error) {
      console.error('❌ getRandomCommentTemplate Error:', error);
      return null;
    }
  }
}; 