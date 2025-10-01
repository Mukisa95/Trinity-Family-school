import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  where,
  Timestamp,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface SMSRequest {
  message: string;
  recipients: string[];
  sentBy: string;
  activeProvider?: string;
}

export interface SMSResponse {
  success: boolean;
  message: string;
  recipientCount: number;
  messageId: string;
  cost?: string;
  details?: {
    total: number;
    successful: number;
    failed: number;
    blocked?: number;
    blockedRecipients?: Array<{
      phoneNumber: string;
      network: string;
      status: string;
      reason: string;
      timestamp: string;
    }>;
    failedRecipients?: Array<{
      number: string;
      status: string;
      network: string;
    }>;
    networkSummary?: Array<{
      network: string;
      sent: number;
      failed: number;
      blocked?: number;
      cost: number;
      success: boolean;
      error?: string;
    }>;
    mtnBlocked?: number;
    retryMessage?: string;
  };
}

export interface SMSLog {
  id: string;
  message: string;
  recipients: string[];
  recipientCount: number;
  sentBy: string;
  sentAt: string;
  status: 'pending' | 'sent' | 'failed' | 'partial';
  messageId?: string;
  cost?: string;
  errorMessage?: string;
}

export interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

const SMS_LOGS_COLLECTION = 'smsLogs';
const SMS_TEMPLATES_COLLECTION = 'smsTemplates';

export class SMSService {
  /**
   * Send bulk SMS messages
   */
  static async sendBulkSMS(request: SMSRequest): Promise<SMSResponse> {
    try {
      // Get active SMS provider
      const activeProvider = await this.getActiveSMSProvider();
      
      // Create SMS log entry
      const logData: Omit<SMSLog, 'id'> = {
        message: request.message,
        recipients: request.recipients,
        recipientCount: request.recipients.length,
        sentBy: request.sentBy,
        sentAt: new Date().toISOString(), // Convert to ISO string
        status: 'pending'
      };

      const logRef = await addDoc(collection(db, SMS_LOGS_COLLECTION), logData);
      const logId = logRef.id;

      try {
        // Send SMS using the appropriate provider
        const result = await this.sendSMSViaProvider(request, activeProvider);
        
        // Update log with success
        await this.updateSMSLog(logId, {
          status: 'sent',
          messageId: result.messageId,
          cost: result.cost
        });

        return result;
      } catch (error) {
        // Update log with failure
        await this.updateSMSLog(logId, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    } catch (error) {
      console.error('Error sending bulk SMS:', error);
      throw new Error('Failed to send SMS messages');
    }
  }

  /**
   * Debug function to check provider configuration
   */
  static async debugProviderConfiguration(): Promise<any> {
    try {
      const savedProviders = typeof window !== 'undefined' ? localStorage.getItem('smsProviders') : null;
      if (savedProviders) {
        const providers = JSON.parse(savedProviders);
        return {
          totalProviders: providers.length,
          providers: providers.map((p: any) => ({
            name: p.name,
            isActive: p.isActive,
            isDefault: p.isDefault
          })),
          activeProviders: providers.filter((p: any) => p.isActive).map((p: any) => p.name),
          defaultProviders: providers.filter((p: any) => p.isDefault).map((p: any) => p.name),
          selectedProvider: await this.getActiveSMSProvider()
        };
      }
      return { error: 'No providers found in localStorage' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get active SMS provider from settings
   */
  private static async getActiveSMSProvider(): Promise<string> {
    try {
      // Get providers from localStorage (client-side) or from settings
      const savedProviders = typeof window !== 'undefined' ? localStorage.getItem('smsProviders') : null;
      if (savedProviders) {
        const providers = JSON.parse(savedProviders);
        
        // First, try to find the default active provider
        let activeProvider = providers.find((p: any) => p.isActive && p.isDefault);
        
        // If no default active provider found, look for any active provider
        if (!activeProvider) {
          activeProvider = providers.find((p: any) => p.isActive);
        }
        
        // If still no active provider found, look for any default provider
        if (!activeProvider) {
          activeProvider = providers.find((p: any) => p.isDefault);
        }
        
        console.log('Active SMS Provider Detection:', {
          totalProviders: providers.length,
          activeProviders: providers.filter((p: any) => p.isActive).map((p: any) => p.name),
          defaultProviders: providers.filter((p: any) => p.isDefault).map((p: any) => p.name),
          selectedProvider: activeProvider ? activeProvider.name : 'Africa\'s Talking'
        });
        
        return activeProvider ? activeProvider.name : 'Africa\'s Talking';
      }
      return 'Africa\'s Talking'; // Default fallback
    } catch (error) {
      console.error('Error getting active SMS provider:', error);
      return 'Africa\'s Talking'; // Default fallback
    }
  }

  /**
   * Send SMS using the appropriate provider
   */
  private static async sendSMSViaProvider(request: SMSRequest, activeProvider: string): Promise<SMSResponse> {
    // For now, we'll use the Firebase Functions endpoint which handles provider selection
    // In the future, this could be extended to use different endpoints based on provider
    return this.sendSMSViaFirebaseFunctions(request, activeProvider);
  }

  /**
   * Send SMS using Firebase Functions (handles provider selection)
   */
  private static async sendSMSViaFirebaseFunctions(request: SMSRequest, activeProvider: string): Promise<SMSResponse> {
    try {
      console.log('Sending SMS via internal API route:', {
        recipientCount: request.recipients.length,
        messageLength: request.message.length,
        sampleRecipients: request.recipients.slice(0, 3) // Log first 3 for debugging
      });

      // Use Firebase Functions endpoint (local API is disabled for static export)
      const apiEndpoint = 'https://smsbulk-u7lfv2gaca-uc.a.run.app';

      // Call our internal API route instead of Africa's Talking directly
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          activeProvider: activeProvider
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('SMS API error response:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('SMS API response:', responseData);

      // Validate response data
      if (!responseData || typeof responseData.success !== 'boolean') {
        console.error('Invalid response format:', responseData);
        throw new Error('Invalid response format from SMS API');
      }

      return {
        success: responseData.success,
        message: responseData.message,
        recipientCount: responseData.recipientCount,
        messageId: responseData.messageId,
        cost: responseData.cost,
        details: responseData.details
      };
    } catch (error) {
      console.error('SMS sending error:', error);
      
      if (error instanceof Error) {
        // Check for common error types
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('NetworkError')) {
          throw new Error('Network error: Could not connect to SMS service. Please check your internet connection.');
        } else if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Unauthorized')) {
          throw new Error('Authentication error: Invalid API credentials for SMS service.');
        } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
          throw new Error('Invalid request: Please check the message content and recipient numbers.');
        } else if (error.message.includes('429')) {
          throw new Error('Rate limit exceeded: Too many SMS requests. Please try again later.');
        } else if (error.message.includes('500') || error.message.includes('503')) {
          throw new Error('SMS service temporarily unavailable. Please try again later.');
        } else {
          throw new Error(`SMS service error: ${error.message}`);
        }
      } else {
        throw new Error('Unknown error occurred while sending SMS');
      }
    }
  }

  /**
   * Simulate SMS sending (fallback method - can be removed in production)
   */
  private static async simulateSMSSending(request: SMSRequest): Promise<SMSResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate success/failure (90% success rate for demo)
    const isSuccess = Math.random() > 0.1;

    if (isSuccess) {
      return {
        success: true,
        message: `Messages sent successfully to ${request.recipients.length} recipients`,
        recipientCount: request.recipients.length,
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cost: `UGX ${request.recipients.length * 50}` // Example cost
      };
    } else {
      throw new Error('SMS service temporarily unavailable. Please try again later.');
    }
  }

  /**
   * Update SMS log entry
   */
  private static async updateSMSLog(logId: string, updates: Partial<SMSLog>): Promise<void> {
    try {
      const logRef = doc(db, SMS_LOGS_COLLECTION, logId);
      await updateDoc(logRef, updates);
    } catch (error) {
      console.error('Error updating SMS log:', error);
    }
  }

  /**
   * Get SMS logs
   */
  static async getSMSLogs(): Promise<SMSLog[]> {
    try {
      const q = query(
        collection(db, SMS_LOGS_COLLECTION), 
        orderBy('sentAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate?.()?.toISOString() || doc.data().sentAt
      })) as SMSLog[];
    } catch (error) {
      console.error('Error fetching SMS logs:', error);
      throw error;
    }
  }

  /**
   * Get SMS logs by user
   */
  static async getSMSLogsByUser(userId: string): Promise<SMSLog[]> {
    try {
      const q = query(
        collection(db, SMS_LOGS_COLLECTION), 
        where('sentBy', '==', userId),
        orderBy('sentAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate?.()?.toISOString() || doc.data().sentAt
      })) as SMSLog[];
    } catch (error) {
      console.error('Error fetching SMS logs by user:', error);
      throw error;
    }
  }

  /**
   * Create SMS template
   */
  static async createSMSTemplate(template: Omit<SMSTemplate, 'id' | 'createdAt'>): Promise<string> {
    try {
      const templateData = {
        ...template,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, SMS_TEMPLATES_COLLECTION), templateData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating SMS template:', error);
      throw error;
    }
  }

  /**
   * Get SMS templates
   */
  static async getSMSTemplates(): Promise<SMSTemplate[]> {
    try {
      const q = query(
        collection(db, SMS_TEMPLATES_COLLECTION), 
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const templates = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as SMSTemplate[];

      // Sort by name in JavaScript to avoid composite index requirement
      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching SMS templates:', error);
      throw error;
    }
  }

  /**
   * Update SMS template
   */
  static async updateSMSTemplate(id: string, updates: Partial<SMSTemplate>): Promise<void> {
    try {
      const templateRef = doc(db, SMS_TEMPLATES_COLLECTION, id);
      await updateDoc(templateRef, updates);
    } catch (error) {
      console.error('Error updating SMS template:', error);
      throw error;
    }
  }

  /**
   * Delete SMS template (soft delete by setting isActive to false)
   */
  static async deleteSMSTemplate(id: string): Promise<void> {
    try {
      await this.updateSMSTemplate(id, { isActive: false });
    } catch (error) {
      console.error('Error deleting SMS template:', error);
      throw error;
    }
  }

  /**
   * Get SMS statistics
   */
  static async getSMSStatistics(userId?: string): Promise<{
    totalSent: number;
    totalRecipients: number;
    successRate: number;
    totalCost: string;
  }> {
    try {
      let q;
      if (userId) {
        q = query(
          collection(db, SMS_LOGS_COLLECTION),
          where('sentBy', '==', userId)
        );
      } else {
        q = query(collection(db, SMS_LOGS_COLLECTION));
      }

      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => doc.data()) as SMSLog[];

      const totalSent = logs.length;
      const totalRecipients = logs.reduce((sum, log) => sum + log.recipientCount, 0);
      const successfulSends = logs.filter(log => log.status === 'sent').length;
      const successRate = totalSent > 0 ? (successfulSends / totalSent) * 100 : 0;

      // Calculate total cost (this would depend on your SMS provider's pricing)
      const totalCost = `UGX ${totalRecipients * 50}`;

      return {
        totalSent,
        totalRecipients,
        successRate,
        totalCost
      };
    } catch (error) {
      console.error('Error fetching SMS statistics:', error);
      throw error;
    }
  }
} 