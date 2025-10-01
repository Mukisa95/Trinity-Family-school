interface TopUpRequest {
  amount: number;
  currency: string;
  paymentMethod: 'mobile_money' | 'card' | 'bank_transfer';
  phoneNumber?: string;
  provider?: 'MTN' | 'Airtel' | 'Orange' | 'Safaricom';
  metadata?: {
    userId: string;
    description?: string;
  };
}

interface TopUpResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  instructions?: string;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
}

interface AutoTopUpConfig {
  enabled: boolean;
  threshold: number;
  amount: number;
  currency: string;
  paymentMethod: 'mobile_money' | 'card' | 'bank_transfer';
  phoneNumber?: string;
  provider?: 'MTN' | 'Airtel' | 'Orange' | 'Safaricom';
  maxTopUpsPerDay?: number;
  lastTopUpDate?: string;
  topUpCount?: number;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export class TopUpService {
  /**
   * Process a manual top-up request (redirects to Africa's Talking billing page)
   */
  static async processTopUp(request: TopUpRequest): Promise<TopUpResponse> {
    try {
      console.log('Processing top-up request:', request);

      // Use Firebase Functions endpoint (local API is disabled for static export)
      const apiEndpoint = 'https://us-central1-trinity-family-schools.cloudfunctions.net/smsTopup';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: TopUpResponse = await response.json();
      console.log('Top-up response:', result);

      // If we have a payment URL, open it in a new tab
      if (result.success && result.paymentUrl) {
        console.log('Opening Africa\'s Talking billing page in new tab');
        window.open(result.paymentUrl, '_blank', 'noopener,noreferrer');
      }

      return result;
    } catch (error) {
      console.error('Error processing top-up:', error);
      
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        };
      } else {
        return {
          success: false,
          error: 'Unknown error occurred while processing top-up'
        };
      }
    }
  }

  /**
   * Get auto top-up configuration for a user
   */
  static async getAutoTopUpConfig(userId: string): Promise<{
    success: boolean;
    config?: AutoTopUpConfig;
    error?: string;
  }> {
    try {
      console.log('Fetching auto top-up config for user:', userId);

      // Use Firebase Functions endpoint (local API is disabled for static export)
      const apiEndpoint = 'https://us-central1-trinity-family-schools.cloudfunctions.net/smsAutoTopup';

      const response = await fetch(`${apiEndpoint}?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Auto top-up config retrieved:', result);

      return result;
    } catch (error) {
      console.error('Error fetching auto top-up config:', error);
      
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        };
      } else {
        return {
          success: false,
          error: 'Unknown error occurred while fetching auto top-up configuration'
        };
      }
    }
  }

  /**
   * Update auto top-up configuration
   */
  static async updateAutoTopUpConfig(config: Partial<AutoTopUpConfig>): Promise<{
    success: boolean;
    config?: AutoTopUpConfig;
    error?: string;
  }> {
    try {
      console.log('Updating auto top-up config:', config);

      // Use Firebase Functions endpoint (local API is disabled for static export)
      const apiEndpoint = 'https://us-central1-trinity-family-schools.cloudfunctions.net/smsAutoTopup';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Auto top-up config updated:', result);

      return result;
    } catch (error) {
      console.error('Error updating auto top-up config:', error);
      
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        };
      } else {
        return {
          success: false,
          error: 'Unknown error occurred while updating auto top-up configuration'
        };
      }
    }
  }

  /**
   * Check if auto top-up should trigger and execute if needed
   */
  static async checkAutoTopUp(userId: string, currentBalance: string): Promise<{
    success: boolean;
    triggered?: boolean;
    transactionId?: string;
    instructions?: string;
    error?: string;
  }> {
    try {
      console.log('Checking auto top-up for user:', userId, 'Balance:', currentBalance);

      // Use Firebase Functions endpoint (local API is disabled for static export)
      const apiEndpoint = 'https://us-central1-trinity-family-schools.cloudfunctions.net/smsAutoTopup';

      const response = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          currentBalance
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('Auto top-up triggered successfully:', result);
        
        // If auto top-up is triggered, open Africa's Talking billing page
        if (result.triggered && result.paymentUrl) {
          console.log('Opening Africa\'s Talking billing page for auto top-up');
          window.open(result.paymentUrl || 'https://account.africastalking.com/apps/ayaprfvonp/billing/payment/methods', '_blank', 'noopener,noreferrer');
        }
        
        return {
          success: true,
          triggered: true,
          transactionId: result.transactionId,
          instructions: result.instructions
        };
      } else {
        // Auto top-up not triggered (could be disabled, above threshold, etc.)
        console.log('Auto top-up not triggered:', result.error);
        return {
          success: true,
          triggered: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('Error checking auto top-up:', error);
      
      if (error instanceof Error) {
        return {
          success: false,
          triggered: false,
          error: error.message
        };
      } else {
        return {
          success: false,
          triggered: false,
          error: 'Unknown error occurred while checking auto top-up'
        };
      }
    }
  }

  /**
   * Open Africa's Talking billing page directly
   */
  static openBillingPage(): void {
    const billingUrl = 'https://account.africastalking.com/apps/ayaprfvonp/billing/payment/methods';
    console.log('Opening Africa\'s Talking billing page directly');
    window.open(billingUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Get available payment methods and providers
   */
  static getPaymentMethods(): {
    mobile_money: {
      name: string;
      providers: Array<{
        id: 'MTN' | 'Airtel' | 'Orange' | 'Safaricom';
        name: string;
        countries: string[];
      }>;
    };
    card: {
      name: string;
      description: string;
    };
    bank_transfer: {
      name: string;
      description: string;
    };
  } {
    return {
      mobile_money: {
        name: 'Mobile Money',
        providers: [
          {
            id: 'MTN',
            name: 'MTN Mobile Money',
            countries: ['Uganda', 'Ghana', 'Cameroon', 'Ivory Coast']
          },
          {
            id: 'Airtel',
            name: 'Airtel Money',
            countries: ['Uganda', 'Kenya', 'Tanzania', 'Rwanda']
          },
          {
            id: 'Orange',
            name: 'Orange Money',
            countries: ['Senegal', 'Mali', 'Burkina Faso', 'Niger']
          },
          {
            id: 'Safaricom',
            name: 'M-Pesa',
            countries: ['Kenya', 'Tanzania']
          }
        ]
      },
      card: {
        name: 'Credit/Debit Card',
        description: 'Pay with Visa, Mastercard, or other supported cards via Africa\'s Talking'
      },
      bank_transfer: {
        name: 'Bank Transfer',
        description: 'Direct bank transfer via Africa\'s Talking billing portal'
      }
    };
  }

  /**
   * Format currency amount for display
   */
  static formatCurrency(amount: number | string, currency: string = 'UGX'): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return `${currency} 0.00`;
    
    return `${currency} ${numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phoneNumber: string, provider: string): {
    valid: boolean;
    formatted?: string;
    error?: string;
  } {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      return {
        valid: false,
        error: 'Phone number is required'
      };
    }

    // Remove spaces and special characters
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Check if it starts with + or country code
    if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
      return {
        valid: false,
        error: 'Phone number must be 10-15 digits and may start with +'
      };
    }

    // Format with + if not present
    const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;

    return {
      valid: true,
      formatted
    };
  }

  /**
   * Get recommended top-up amounts based on current balance
   */
  static getRecommendedAmounts(currentBalance: number, currency: string = 'UGX'): number[] {
    const balance = currentBalance || 0;
    
    if (currency === 'UGX') {
      if (balance < 1000) {
        return [5000, 10000, 20000, 50000];
      } else if (balance < 5000) {
        return [10000, 20000, 50000, 100000];
      } else {
        return [20000, 50000, 100000, 200000];
      }
    } else if (currency === 'KES') {
      if (balance < 100) {
        return [500, 1000, 2000, 5000];
      } else if (balance < 500) {
        return [1000, 2000, 5000, 10000];
      } else {
        return [2000, 5000, 10000, 20000];
      }
    } else {
      // Default amounts for other currencies
      return [10, 25, 50, 100];
    }
  }
} 