import { AfricasTalkingAccountService } from './africas-talking-account.service';
import { WizaSMSAccountService } from './wiza-sms-account.service';

interface AccountData {
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
  provider?: string;
}

export class UnifiedAccountBalanceService {
  /**
   * Get account balance based on the active SMS provider
   */
  static async getAccountData(): Promise<AccountData> {
    try {
      // Get the active SMS provider from localStorage
      const savedProviders = typeof window !== 'undefined' ? localStorage.getItem('smsProviders') : null;
      let activeProvider = 'Africa\'s Talking'; // Default fallback

      if (savedProviders) {
        const providers = JSON.parse(savedProviders);
        const active = providers.find((p: any) => p.isActive && p.isDefault);
        if (active) {
          activeProvider = active.name;
        }
      }

      console.log('Checking account balance for provider:', activeProvider);

      let accountData: AccountData;

      if (activeProvider === 'Wiza SMS') {
        // Use Wiza SMS account service
        const wizaData = await WizaSMSAccountService.getAccountData();
        accountData = {
          ...wizaData,
          provider: 'Wiza SMS'
        };
      } else {
        // Use Africa's Talking account service (default)
        const atData = await AfricasTalkingAccountService.getAccountData();
        accountData = {
          ...atData,
          provider: 'Africa\'s Talking'
        };
      }

      console.log('Unified account data retrieved:', accountData);
      return accountData;
    } catch (error) {
      console.error('Error fetching unified account data:', error);
      
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
          provider: 'Unknown'
        };
      } else {
        return {
          success: false,
          error: 'Unknown error occurred while fetching account data',
          provider: 'Unknown'
        };
      }
    }
  }

  /**
   * Format currency amount for display based on provider
   */
  static formatCurrency(amount: string, currency?: string, provider?: string): string {
    const defaultCurrency = provider === 'Wiza SMS' ? 'UGX' : 'KES';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return `${currency || defaultCurrency} 0.00`;
    
    return `${currency || defaultCurrency} ${numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    })}`;
  }

  /**
   * Get estimated SMS count based on provider and balance
   */
  static getEstimatedSMSCount(balance: number, provider?: string): number {
    // Different cost per SMS for different providers
    const costPerSMS = provider === 'Wiza SMS' ? 35 : 25; // UGX 35 vs KES 25
    return Math.floor(balance / costPerSMS);
  }

  /**
   * Get balance status based on provider
   */
  static getBalanceStatus(balance: number, provider?: string): {
    status: 'good' | 'moderate' | 'low' | 'insufficient';
    color: string;
    bgColor: string;
  } {
    // Different thresholds for different providers
    const thresholds = provider === 'Wiza SMS' 
      ? { good: 5000, moderate: 1000, low: 500 } // UGX thresholds
      : { good: 1000, moderate: 100, low: 50 };  // KES thresholds

    if (balance >= thresholds.good) {
      return {
        status: 'good',
        color: 'text-green-700',
        bgColor: 'bg-green-50 border-green-200'
      };
    } else if (balance >= thresholds.moderate) {
      return {
        status: 'moderate',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50 border-yellow-200'
      };
    } else if (balance > 0) {
      return {
        status: 'low',
        color: 'text-orange-700',
        bgColor: 'bg-orange-50 border-orange-200'
      };
    } else {
      return {
        status: 'insufficient',
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200'
      };
    }
  }
}
