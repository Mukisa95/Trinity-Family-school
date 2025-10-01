import { SMSProvider } from './sms-providers.service';

export interface WizaSMSRequest {
  username: string;
  password: string;
  senderId: string;
  message: string;
  recipients: string;
}

export interface WizaSMSResponse {
  statusCode: number;
  success: boolean;
  messages: string;
  data?: {
    recipients_count: number;
    message_length: number;
    cost: number;
  };
}

export interface WizaSMSError {
  statusCode: number;
  success: false;
  messages: string;
}

export class WizaSMSService {
  private static readonly BASE_URL = 'https://wizasms.ug/API/V1';
  private static readonly SEND_ENDPOINT = '/send-bulk-sms';

  /**
   * Send SMS using Wiza SMS API
   */
  static async sendSMS(
    provider: SMSProvider,
    message: string,
    recipients: string[]
  ): Promise<WizaSMSResponse> {
    try {
      // Validate provider configuration
      if (!provider.username || !provider.apiSecret) {
        throw new Error('Wiza SMS provider not properly configured. Username and password are required.');
      }

      // Format recipients for Wiza API (comma-separated string)
      const formattedRecipients = recipients
        .map(phone => {
          // Ensure phone numbers are in the correct format (256XXXXXXXXX)
          let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
          
          if (!cleanPhone.startsWith('+')) {
            if (cleanPhone.startsWith('0')) {
              cleanPhone = '256' + cleanPhone.substring(1);
            } else if (cleanPhone.startsWith('256')) {
              // Already in correct format
            } else {
              cleanPhone = '256' + cleanPhone;
            }
          } else {
            cleanPhone = cleanPhone.substring(1); // Remove the + sign
          }
          
          return cleanPhone;
        })
        .join(',');

             // Prepare request payload
       const payload: WizaSMSRequest = {
         username: provider.username,
         password: provider.apiSecret, // Wiza uses password field
         senderId: provider.senderId || 'TRINITY', // Use configured sender ID or default
         message: message,
         recipients: formattedRecipients
       };

      console.log('Sending SMS via Wiza API:', {
        recipientCount: recipients.length,
        messageLength: message.length,
        sampleRecipients: recipients.slice(0, 3)
      });

      // Make API request
      const response = await fetch(`${this.BASE_URL}${this.SEND_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const responseData: WizaSMSResponse | WizaSMSError = await response.json();

      console.log('Wiza SMS API response:', responseData);

      // Handle error responses
      if (!responseData.success) {
        throw new Error(`Wiza SMS API Error: ${responseData.messages}`);
      }

      return responseData as WizaSMSResponse;

    } catch (error) {
      console.error('Wiza SMS sending error:', error);
      
      if (error instanceof Error) {
        throw new Error(`Wiza SMS Error: ${error.message}`);
      } else {
        throw new Error('Unknown error occurred while sending SMS via Wiza');
      }
    }
  }

  /**
   * Test Wiza SMS API connection
   */
  static async testConnection(provider: SMSProvider): Promise<{ success: boolean; message: string }> {
    try {
      // Validate provider configuration
      if (!provider.username || !provider.apiSecret) {
        return {
          success: false,
          message: 'Wiza SMS provider not properly configured. Username and password are required.'
        };
      }

             // Send a test message to a dummy number
       const testPayload: WizaSMSRequest = {
         username: provider.username,
         password: provider.apiSecret,
         senderId: provider.senderId || 'TEST',
         message: 'Connection test message',
         recipients: '256700000000' // Dummy number for testing
       };

      const response = await fetch(`${this.BASE_URL}${this.SEND_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      const responseData = await response.json();

      if (responseData.success) {
        return {
          success: true,
          message: 'Successfully connected to Wiza SMS API'
        };
      } else {
        // Even if the message fails to send (due to dummy number), 
        // if we get a proper response, the connection is working
        if (responseData.statusCode === 400 && responseData.messages.includes('recipients')) {
          return {
            success: true,
            message: 'Successfully connected to Wiza SMS API (test message failed due to invalid recipient, but connection is working)'
          };
        }
        
        return {
          success: false,
          message: `Wiza SMS API Error: ${responseData.messages}`
        };
      }

    } catch (error) {
      console.error('Wiza SMS connection test error:', error);
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get account balance (if supported by Wiza API)
   */
  static async getAccountBalance(provider: SMSProvider): Promise<{ success: boolean; balance?: string; message: string }> {
    try {
      // Note: Wiza SMS API doesn't provide a balance endpoint in the documentation
      // This is a placeholder for future implementation
      return {
        success: false,
        message: 'Account balance feature not available for Wiza SMS API'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get account balance: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Format phone numbers for Wiza SMS API
   */
  static formatPhoneNumbers(phoneNumbers: string[]): string {
    return phoneNumbers
      .map(phone => {
        let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        
        if (!cleanPhone.startsWith('+')) {
          if (cleanPhone.startsWith('0')) {
            cleanPhone = '256' + cleanPhone.substring(1);
          } else if (cleanPhone.startsWith('256')) {
            // Already in correct format
          } else {
            cleanPhone = '256' + cleanPhone;
          }
        } else {
          cleanPhone = cleanPhone.substring(1); // Remove the + sign
        }
        
        return cleanPhone;
      })
      .join(',');
  }

  /**
   * Validate Wiza SMS provider configuration
   */
  static validateProviderConfig(provider: SMSProvider): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!provider.username) {
      errors.push('Username is required');
    }

    if (!provider.apiSecret) {
      errors.push('Password is required');
    }

    if (!provider.baseUrl) {
      errors.push('Base URL is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
