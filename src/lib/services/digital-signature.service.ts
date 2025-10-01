import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/auth-context';
import type { 
  DigitalSignature, 
  SignedRecord, 
  CreateSignatureData, 
  RecordType, 
  AuditTrailEntry,
  SignatureVerification 
} from '@/types/digital-signature';
import type { SystemUser } from '@/types';

const SIGNATURES_COLLECTION = 'digital_signatures';
const AUDIT_TRAIL_COLLECTION = 'audit_trail';

export class DigitalSignatureService {
  /**
   * Create a digital signature for an action
   */
  static async createSignature(
    user: SystemUser,
    data: CreateSignatureData,
    additionalMetadata?: Record<string, any>
  ): Promise<DigitalSignature> {
    try {
      const signature: Omit<DigitalSignature, 'id'> = {
        userId: user.id,
        userName: (user.firstName && user.lastName) 
          ? `${user.firstName} ${user.lastName}`.trim() 
          : user.firstName || user.lastName || user.username || 'Unknown User',
        userRole: user.role,
        action: data.action,
        timestamp: new Date().toISOString(),
        ipAddress: this.getClientIP(),
        userAgent: this.getUserAgent(),
        sessionId: this.getSessionId(),
      };

      // Store in signatures collection
      const signatureRef = await addDoc(collection(db, SIGNATURES_COLLECTION), {
        ...signature,
        createdAt: serverTimestamp(),
      });

      const signatureId = signatureRef.id;

      // Create audit trail entry
      // Filter out undefined values from metadata to prevent Firebase errors
      const cleanMetadata: Record<string, any> = {};
      
      // Add data.metadata fields (excluding undefined values)
      if (data.metadata) {
        Object.keys(data.metadata).forEach(key => {
          if (data.metadata![key] !== undefined) {
            cleanMetadata[key] = data.metadata![key];
          }
        });
      }
      
      // Add additionalMetadata fields (excluding undefined values)
      if (additionalMetadata) {
        Object.keys(additionalMetadata).forEach(key => {
          if (additionalMetadata[key] !== undefined) {
            cleanMetadata[key] = additionalMetadata[key];
          }
        });
      }

      const auditEntry: Omit<AuditTrailEntry, 'id'> = {
        signature: { ...signature, id: signatureId },
        recordType: data.recordType,
        recordId: data.recordId,
        action: data.action,
        description: data.description,
        timestamp: signature.timestamp,
        metadata: Object.keys(cleanMetadata).length > 0 ? cleanMetadata : undefined,
      };

      await addDoc(collection(db, AUDIT_TRAIL_COLLECTION), {
        ...auditEntry,
        createdAt: serverTimestamp(),
      });

      return { ...signature, id: signatureId };
    } catch (error) {
      console.error('Error creating digital signature:', error);
      throw error;
    }
  }

  /**
   * Get signatures for a specific record
   */
  static async getSignaturesForRecord(
    recordType: RecordType,
    recordId: string
  ): Promise<AuditTrailEntry[]> {
    try {
      const auditRef = collection(db, AUDIT_TRAIL_COLLECTION);
      
      // Use a simpler query without orderBy to avoid index requirement
      // We'll sort in JavaScript instead
      const q = query(
        auditRef,
        where('recordType', '==', recordType),
        where('recordId', '==', recordId)
      );

      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(doc => {
        const data = doc.data() as AuditTrailEntry;
        // Fix undefined userName in existing signatures
        if (data.signature && (!data.signature.userName || data.signature.userName.includes('undefined'))) {
          data.signature.userName = data.signature.userName?.replace(/undefined/g, '').trim() || 'Unknown User';
        }
        return {
          ...data,
          id: doc.id,
        };
      }) as AuditTrailEntry[];
      
      // Sort by timestamp in JavaScript (descending order)
      return entries.sort((a, b) => {
        const timestampA = new Date(a.timestamp).getTime();
        const timestampB = new Date(b.timestamp).getTime();
        return timestampB - timestampA; // Descending order (newest first)
      });
    } catch (error) {
      console.error('Error fetching signatures for record:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for a user
   */
  static async getUserAuditTrail(
    userId: string,
    limit: number = 100
  ): Promise<AuditTrailEntry[]> {
    try {
      const auditRef = collection(db, AUDIT_TRAIL_COLLECTION);
      const q = query(
        auditRef,
        where('signature.userId', '==', userId),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs
        .slice(0, limit)
        .map(doc => {
          const data = doc.data() as AuditTrailEntry;
          // Fix undefined userName in existing signatures
          if (data.signature && (!data.signature.userName || data.signature.userName.includes('undefined'))) {
            data.signature.userName = data.signature.userName?.replace(/undefined/g, '').trim() || 'Unknown User';
          }
          return {
            ...data,
            id: doc.id,
          };
        }) as AuditTrailEntry[];
    } catch (error) {
      console.error('Error fetching user audit trail:', error);
      throw error;
    }
  }

  /**
   * Get recent audit trail entries
   */
  static async getRecentAuditTrail(limit: number = 50): Promise<AuditTrailEntry[]> {
    try {
      const auditRef = collection(db, AUDIT_TRAIL_COLLECTION);
      const q = query(auditRef, orderBy('timestamp', 'desc'));

      const snapshot = await getDocs(q);
      return snapshot.docs
        .slice(0, limit)
        .map(doc => {
          const data = doc.data() as AuditTrailEntry;
          // Fix undefined userName in existing signatures
          if (data.signature && (!data.signature.userName || data.signature.userName.includes('undefined'))) {
            data.signature.userName = data.signature.userName?.replace(/undefined/g, '').trim() || 'Unknown User';
          }
          return {
            ...data,
            id: doc.id,
          };
        }) as AuditTrailEntry[];
    } catch (error) {
      console.error('Error fetching recent audit trail:', error);
      throw error;
    }
  }

  /**
   * Verify a digital signature
   */
  static async verifySignature(signatureId: string): Promise<SignatureVerification> {
    try {
      // In a production system, this would involve cryptographic verification
      // For now, we'll do basic validation
      const auditRef = collection(db, AUDIT_TRAIL_COLLECTION);
      const q = query(auditRef, where('signature.id', '==', signatureId));
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return {
          isValid: false,
          signature: {} as DigitalSignature,
          verifiedAt: new Date().toISOString(),
          issues: ['Signature not found in audit trail'],
        };
      }

      const entry = snapshot.docs[0].data() as AuditTrailEntry;
      
      return {
        isValid: true,
        signature: entry.signature,
        verifiedAt: new Date().toISOString(),
        issues: [],
      };
    } catch (error) {
      console.error('Error verifying signature:', error);
      return {
        isValid: false,
        signature: {} as DigitalSignature,
        verifiedAt: new Date().toISOString(),
        issues: ['Verification failed due to system error'],
      };
    }
  }

  /**
   * Get signature statistics for a user
   */
  static async getUserSignatureStats(userId: string): Promise<{
    totalActions: number;
    actionsByType: Record<RecordType, number>;
    recentActivity: AuditTrailEntry[];
  }> {
    try {
      const auditTrail = await this.getUserAuditTrail(userId, 1000);
      
      const actionsByType: Record<RecordType, number> = {} as Record<RecordType, number>;
      
      auditTrail.forEach(entry => {
        actionsByType[entry.recordType] = (actionsByType[entry.recordType] || 0) + 1;
      });

      return {
        totalActions: auditTrail.length,
        actionsByType,
        recentActivity: auditTrail.slice(0, 10),
      };
    } catch (error) {
      console.error('Error getting user signature stats:', error);
      throw error;
    }
  }

  // Helper methods for gathering system information
  private static getClientIP(): string {
    // In a real application, this would be obtained from the request headers
    // For client-side, we can't get the real IP, so we'll use a placeholder
    return 'client-side';
  }

  private static getUserAgent(): string {
    return typeof window !== 'undefined' ? window.navigator.userAgent : 'server-side';
  }

  private static getSessionId(): string {
    // Generate or retrieve session ID
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('trinity_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('trinity_session_id', sessionId);
      }
      return sessionId;
    }
    return `server_session_${Date.now()}`;
  }

  /**
   * Format action description for display
   */
  static formatActionDescription(recordType: RecordType, action: string, metadata?: Record<string, any>): string {
    const actionMappings: Record<RecordType, (action: string, meta?: any) => string> = {
      fee_payment: (action, meta) => `Payment collected: ${meta?.amount ? `UGX ${meta.amount.toLocaleString()}` : 'amount not specified'}`,
      attendance_record: (action, meta) => `Attendance recorded for ${meta?.date || 'unknown date'}`,
      exam_creation: (action, meta) => `Exam created: ${meta?.examName || 'unnamed exam'}`,
      exam_result: (action, meta) => `Exam results recorded for ${meta?.examName || 'exam'}`,
      procurement: (action, meta) => `Procurement item ${action}: ${meta?.itemName || 'item'}`,
      requirement_collection: (action, meta) => `Requirement collected: ${meta?.requirementName || 'requirement'}`,
      uniform_payment: (action, meta) => `Uniform payment: ${meta?.amount ? `UGX ${meta.amount.toLocaleString()}` : 'amount not specified'}`,
      pupil_promotion: (action, meta) => `Pupil promoted: ${meta?.pupilName || 'pupil'}`,
      event_creation: (action, meta) => `Event created: ${meta?.eventName || 'event'}`,
      banking_transaction: (action, meta) => `Banking transaction: ${meta?.transactionType || 'transaction'}`,
      user_creation: (action, meta) => `User created: ${meta?.username || 'user'}`,
      user_modification: (action, meta) => `User modified: ${meta?.username || 'user'}`,
      academic_year_creation: (action, meta) => `Academic year created: ${meta?.yearName || 'year'}`,
      class_creation: (action, meta) => `Class created: ${meta?.className || 'class'}`,
      subject_creation: (action, meta) => `Subject created: ${meta?.subjectName || 'subject'}`,
      fee_structure_creation: (action, meta) => `Fee structure created: ${meta?.feeName || 'fee'}`,
      exam_type_creation: (action, meta) => `Exam type created: ${meta?.typeName || 'type'}`,
      bulk_sms: (action, meta) => `Bulk SMS sent to ${meta?.recipientCount || 'recipients'}`,
      notification_send: (action, meta) => `Notification sent: ${meta?.title || 'notification'}`,
      data_export: (action, meta) => `Data exported: ${meta?.exportType || 'data'}`,
      system_backup: (action, meta) => `System backup: ${meta?.backupType || 'backup'}`,
      password_change: (action, meta) => `Password changed for ${meta?.username || 'user'}`,
      permission_change: (action, meta) => `Permissions modified for ${meta?.username || 'user'}`,
    };

    const formatter = actionMappings[recordType];
    return formatter ? formatter(action, metadata) : `${action} performed on ${recordType}`;
  }
}

// Hook for easy access to digital signature functionality
export function useDigitalSignature() {
  const { user } = useAuth();

  const createSignature = async (data: CreateSignatureData, additionalMetadata?: Record<string, any>) => {
    if (!user) {
      throw new Error('User must be authenticated to create signatures');
    }
    return DigitalSignatureService.createSignature(user, data, additionalMetadata);
  };

  return {
    createSignature,
    getSignaturesForRecord: DigitalSignatureService.getSignaturesForRecord,
    getUserAuditTrail: DigitalSignatureService.getUserAuditTrail,
    getRecentAuditTrail: DigitalSignatureService.getRecentAuditTrail,
    verifySignature: DigitalSignatureService.verifySignature,
    getUserSignatureStats: DigitalSignatureService.getUserSignatureStats,
    formatActionDescription: DigitalSignatureService.formatActionDescription,
    user,
  };
} 