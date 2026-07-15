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

function getTermAliases(termId?: string): string[] {
  if (!termId) return [];

  const aliases = new Set<string>([termId]);
  const normalized = termId.toLowerCase();

  if (normalized.includes('t1') || normalized.includes('term1') || normalized.includes('term_1')) {
    aliases.add('term_1');
    aliases.add('term1');
    aliases.add('t1');
  }
  if (normalized.includes('t2') || normalized.includes('term2') || normalized.includes('term_2')) {
    aliases.add('term_2');
    aliases.add('term2');
    aliases.add('t2');
  }
  if (normalized.includes('t3') || normalized.includes('term3') || normalized.includes('term_3')) {
    aliases.add('term_3');
    aliases.add('term3');
    aliases.add('t3');
  }

  return Array.from(aliases);
}

function matchesApplicableTerms(applicableTerms: string[] | undefined, termId?: string): boolean {
  if (!termId || !applicableTerms || applicableTerms.length === 0) {
    return true;
  }

  const aliases = getTermAliases(termId);
  return applicableTerms.includes('all') || aliases.some(alias => applicableTerms.includes(alias));
}

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

  // Get all active comment templates (useful for bulk in-memory processing)
  async getAllActiveTemplates(): Promise<CommentTemplate[]> {
    try {
      console.log('🔍 CommentaryService: Fetching all ACTIVE templates for bulk processing');
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      console.log('📊 CommentaryService: Found', querySnapshot.docs.length, 'active templates');
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as CommentTemplate[];
    } catch (error) {
      console.error('❌ CommentaryService Error fetching active templates:', error);
      throw new Error('Failed to fetch active comment templates');
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
      const cleanTemplate = Object.fromEntries(
        Object.entries(template).filter(([_, v]) => v !== undefined)
      );
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...cleanTemplate,
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
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      );
      await updateDoc(docRef, {
        ...cleanUpdates,
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
  },

  // Get comment templates by subject and status
  async getCommentTemplatesBySubject(
    subject: string,
    subjectStatus: string,
    classId?: string,
    termId?: string
  ): Promise<CommentTemplate[]> {
    try {
      console.log(`🔍 getCommentTemplatesBySubject: Querying ${subject} - ${subjectStatus} (classId: ${classId || 'all'}, termId: ${termId || 'all'})`);

      // Build query conditions
      const conditions = [
        where('type', '==', 'subject'),
        where('subject', '==', subject),
        where('subjectStatus', '==', subjectStatus)
      ];

      // If classId is provided, prioritize class-specific comments
      // We'll fetch both class-specific and general templates and then filter locally.
      let templates: CommentTemplate[] = [];

      if (classId) {
        // First try class-specific comments
        try {
          const classSpecificQuery = query(
            collection(db, COLLECTION_NAME),
            ...conditions,
            where('classId', '==', classId)
          );
          const classSpecificSnapshot = await getDocs(classSpecificQuery);
          const classSpecificTemplates = classSpecificSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          })) as CommentTemplate[];

          templates = classSpecificTemplates;
          console.log(`📊 getCommentTemplatesBySubject: Found ${templates.length} class-specific templates`);
        } catch (error) {
          console.log(`⚠️ getCommentTemplatesBySubject: Error fetching class-specific, will try general`);
        }
      }

      // If no class-specific templates found, or if no classId provided, fetch general templates.
      // Some existing docs omit classId entirely instead of storing null, so we fetch broadly
      // and then treat null/undefined/empty as "general".
      if (templates.length === 0) {
        const generalQuery = query(
          collection(db, COLLECTION_NAME),
          ...conditions
        );
        const generalSnapshot = await getDocs(generalQuery);
        templates = generalSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })).filter((template: any) => !template.classId) as CommentTemplate[];
        console.log(`📊 getCommentTemplatesBySubject: Found ${templates.length} general templates`);
      }

      // Filter by term if provided
      let filteredTemplates = templates.filter(t => t.isActive);

      if (termId) {
        const termSpecific = filteredTemplates.filter(t => matchesApplicableTerms(t.applicableTerms, termId));

        if (termSpecific.length > 0) {
          console.log(`📊 getCommentTemplatesBySubject: Filtered to ${termSpecific.length} term-specific templates`);
          filteredTemplates = termSpecific;
        } else {
          console.log(`⚠️ getCommentTemplatesBySubject: No term-specific templates, using all ${filteredTemplates.length} templates`);
        }
      }

      return filteredTemplates;
    } catch (error) {
      console.error('❌ getCommentTemplatesBySubject Error:', error);
      // Try a simpler query without classId filter as fallback
      try {
        const q = query(
          collection(db, COLLECTION_NAME),
          where('type', '==', 'subject'),
          where('subject', '==', subject),
          where('subjectStatus', '==', subjectStatus)
        );
        const querySnapshot = await getDocs(q);
        const fallbackTemplates = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as CommentTemplate[];

        return fallbackTemplates.filter(template => {
          const classMatches = !classId || template.classId === classId || !template.classId;
          const termMatches = matchesApplicableTerms(template.applicableTerms, termId);
          return template.isActive && classMatches && termMatches;
        });
      } catch (fallbackError) {
        console.error('❌ getCommentTemplatesBySubject Fallback Error:', fallbackError);
        return [];
      }
    }
  },

  // Get random comment template for a subject and status
  async getRandomSubjectComment(
    subject: string,
    subjectStatus: string,
    classId?: string,
    termId?: string
  ): Promise<CommentTemplate | null> {
    try {
      const templates = await this.getCommentTemplatesBySubject(subject, subjectStatus, classId, termId);

      if (templates.length === 0) {
        return null;
      }

      const activeTemplates = templates.filter(t => t.isActive);
      if (activeTemplates.length === 0) {
        return null;
      }

      const randomIndex = Math.floor(Math.random() * activeTemplates.length);
      return activeTemplates[randomIndex];
    } catch (error) {
      console.error('❌ getRandomSubjectComment Error:', error);
      return null;
    }
  }
}; 
