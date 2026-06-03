/**
 * Wiza SMS Account Service
 * Fetches account balance via the server-side proxy route (/api/sms/wiza-balance)
 * to avoid CORS restrictions.
 */

interface WizaAccountData {
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
  source?: string;
  message?: string;
}

export class WizaSMSAccountService {
  /**
   * Get Wiza SMS account balance via server-side proxy (no CORS).
   */
  static async getAccountData(): Promise<WizaAccountData> {
    try {
      console.log('Fetching Wiza SMS account balance...');

      const response = await fetch('/api/sms/wiza-balance', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Balance API error: ${response.status}`);
      }

      const data: WizaAccountData = await response.json();
      console.log('Wiza SMS balance data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching Wiza SMS account data:', error);
      return {
        success: true, // Don't block the UI
        balance: '0',
        currency: 'UGX',
        source: 'unavailable',
        message: 'Visit https://wizasms.ug to check your real-time balance.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format currency amount for display
   */
  static formatCurrency(amount: string, currency: string = 'UGX'): string {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return `${currency} 0.00`;

    return `${currency} ${numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
