import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  where,
  updateDoc,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface SMSProvider {
  id: string;
  name: string;
  description: string;
  apiKey: string;
  apiSecret?: string;
  username?: string;
  senderId?: string;
  baseUrl: string;
  isActive: boolean;
  isDefault: boolean;
  features: {
    bulkSMS: boolean;
    deliveryReports: boolean;
    costTracking: boolean;
    webhooks: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

const SMS_PROVIDERS_COLLECTION = 'smsProviders';

export class SMSProvidersService {
  /**
   * Get all SMS providers
   */
  static async getProviders(): Promise<SMSProvider[]> {
    try {
      const q = query(
        collection(db, SMS_PROVIDERS_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const providers: SMSProvider[] = [];
      
      querySnapshot.forEach((doc) => {
        providers.push({
          id: doc.id,
          ...doc.data()
        } as SMSProvider);
      });
      
      return providers;
    } catch (error) {
      console.error('Error fetching SMS providers:', error);
      throw new Error('Failed to fetch SMS providers');
    }
  }

  /**
   * Get active SMS provider
   */
  static async getActiveProvider(): Promise<SMSProvider | null> {
    try {
      const q = query(
        collection(db, SMS_PROVIDERS_COLLECTION),
        where('isActive', '==', true),
        where('isDefault', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as SMSProvider;
    } catch (error) {
      console.error('Error fetching active SMS provider:', error);
      throw new Error('Failed to fetch active SMS provider');
    }
  }

  /**
   * Create a new SMS provider
   */
  static async createProvider(provider: Omit<SMSProvider, 'id' | 'createdAt' | 'updatedAt'>): Promise<SMSProvider> {
    try {
      const now = new Date().toISOString();
      const providerData = {
        ...provider,
        createdAt: now,
        updatedAt: now
      };
      
      const docRef = await addDoc(collection(db, SMS_PROVIDERS_COLLECTION), providerData);
      
      return {
        id: docRef.id,
        ...providerData
      } as SMSProvider;
    } catch (error) {
      console.error('Error creating SMS provider:', error);
      throw new Error('Failed to create SMS provider');
    }
  }

  /**
   * Update an SMS provider
   */
  static async updateProvider(id: string, updates: Partial<SMSProvider>): Promise<SMSProvider> {
    try {
      const providerRef = doc(db, SMS_PROVIDERS_COLLECTION, id);
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(providerRef, updateData);
      
      // Return the updated provider
      const updatedDoc = await getDocs(query(
        collection(db, SMS_PROVIDERS_COLLECTION),
        where('__name__', '==', id)
      ));
      
      if (updatedDoc.empty) {
        throw new Error('Provider not found');
      }
      
      return {
        id: updatedDoc.docs[0].id,
        ...updatedDoc.docs[0].data()
      } as SMSProvider;
    } catch (error) {
      console.error('Error updating SMS provider:', error);
      throw new Error('Failed to update SMS provider');
    }
  }

  /**
   * Delete an SMS provider
   */
  static async deleteProvider(id: string): Promise<void> {
    try {
      const providerRef = doc(db, SMS_PROVIDERS_COLLECTION, id);
      await deleteDoc(providerRef);
    } catch (error) {
      console.error('Error deleting SMS provider:', error);
      throw new Error('Failed to delete SMS provider');
    }
  }

  /**
   * Set a provider as default
   */
  static async setDefaultProvider(id: string): Promise<void> {
    try {
      // First, remove default from all providers
      const allProviders = await this.getProviders();
      const updatePromises = allProviders.map(provider => 
        updateDoc(doc(db, SMS_PROVIDERS_COLLECTION, provider.id), {
          isDefault: false,
          updatedAt: new Date().toISOString()
        })
      );
      
      await Promise.all(updatePromises);
      
      // Then set the specified provider as default
      await updateDoc(doc(db, SMS_PROVIDERS_COLLECTION, id), {
        isDefault: true,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error setting default provider:', error);
      throw new Error('Failed to set default provider');
    }
  }

  /**
   * Test provider connection
   */
  static async testConnection(provider: SMSProvider): Promise<{ success: boolean; message: string }> {
    try {
      // This would be a real API test in production
      // For now, we'll simulate a test
      const testEndpoint = `${provider.baseUrl}/test`;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate success/failure based on provider configuration
      if (provider.apiKey && provider.baseUrl) {
        return {
          success: true,
          message: `Successfully connected to ${provider.name} API`
        };
      } else {
        return {
          success: false,
          message: `Failed to connect to ${provider.name} API - Invalid configuration`
        };
      }
    } catch (error) {
      console.error('Error testing provider connection:', error);
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Initialize default providers
   */
  static async initializeDefaultProviders(): Promise<void> {
    try {
      const existingProviders = await this.getProviders();
      
      if (existingProviders.length === 0) {
        const defaultProviders = [
          {
            name: 'Africa\'s Talking',
            description: 'Leading African SMS gateway with excellent delivery rates and competitive pricing',
            apiKey: 'atsk_f6441bd8aa6d905da4199c5d824c45b46b81185c8f4663fa3b5c315a3cceb204687b3617',
            username: 'trinityfsch',
            baseUrl: 'https://api.africastalking.com/version1',
            isActive: true,
            isDefault: true,
            features: {
              bulkSMS: true,
              deliveryReports: true,
              costTracking: true,
              webhooks: true,
            }
          },
          {
            name: 'Twilio',
            description: 'Global SMS platform with advanced features and worldwide coverage',
            apiKey: '',
            apiSecret: '',
            baseUrl: 'https://api.twilio.com/2010-04-01',
            isActive: false,
            isDefault: false,
            features: {
              bulkSMS: true,
              deliveryReports: true,
              costTracking: true,
              webhooks: true,
            }
          },
                     {
             name: 'Vonage (Nexmo)',
             description: 'Enterprise-grade SMS platform with advanced analytics',
             apiKey: 'your_vonage_api_key',
             apiSecret: 'your_vonage_api_secret',
             baseUrl: 'https://rest.nexmo.com',
             isActive: false,
             isDefault: false,
             features: {
               bulkSMS: true,
               deliveryReports: true,
               costTracking: true,
               webhooks: true,
             }
           },
           {
             name: 'Wiza SMS',
             description: 'Ugandan SMS gateway with local expertise and competitive pricing',
             apiKey: 'your_wiza_username',
             apiSecret: 'your_wiza_password',
             username: 'your_wiza_username',
             senderId: 'TRINITY',
             baseUrl: 'https://wizasms.ug/API/V1',
             isActive: false,
             isDefault: false,
             features: {
               bulkSMS: true,
               deliveryReports: false,
               costTracking: true,
               webhooks: false,
             }
           }
        ];
        
        for (const provider of defaultProviders) {
          await this.createProvider(provider);
        }
        
        console.log('Default SMS providers initialized');
      }
    } catch (error) {
      console.error('Error initializing default providers:', error);
      throw new Error('Failed to initialize default SMS providers');
    }
  }
}
