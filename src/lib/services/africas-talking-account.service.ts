interface AccountData {
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
}

export class AfricasTalkingAccountService {
  /**
   * Get account balance and information
   */
  static async getAccountData(): Promise<AccountData> {
    try {
      console.log('Fetching Africa\'s Talking account data...');

      // Use Firebase Functions endpoint (local API is disabled for static export)
      const apiEndpoint = 'https://smsaccount-u7lfv2gaca-uc.a.run.app';

      // Add cache-busting parameter to ensure fresh data
      const timestamp = new Date().getTime();
      const response = await fetch(`${apiEndpoint}?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const accountData: AccountData = await response.json();
      console.log('Account data retrieved:', accountData);

      return accountData;
    } catch (error) {
      console.error('Error fetching account data:', error);
      
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        };
      } else {
        return {
          success: false,
          error: 'Unknown error occurred while fetching account data'
        };
      }
    }
  }

  /**
   * Format currency amount for display
   */
  static formatCurrency(amount: string, currency: string = 'KES'): string {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return `${currency} 0.00`;
    
    return `${currency} ${numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    })}`;
  }
} 