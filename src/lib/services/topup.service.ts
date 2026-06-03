/**
 * Top-Up Service for Wiza SMS
 * All top-ups are done by visiting the Wiza SMS dashboard directly.
 */

interface TopUpResponse {
  success: boolean;
  dashboardUrl?: string;
  instructions?: string;
  error?: string;
}

interface AutoTopUpConfig {
  enabled: boolean;
  threshold: number;
  amount: number;
  currency: string;
  userId: string;
}

export class TopUpService {
  private static readonly WIZA_DASHBOARD_URL = 'https://wizasms.ug';

  /**
   * Open the Wiza SMS dashboard for manual top-up
   */
  static async processTopUp(_request: unknown): Promise<TopUpResponse> {
    this.openBillingPage();
    return {
      success: true,
      dashboardUrl: this.WIZA_DASHBOARD_URL,
      instructions: 'You have been redirected to the Wiza SMS dashboard to top up your balance.',
    };
  }

  /**
   * Get auto top-up configuration (not supported — Wiza SMS requires manual top-up)
   */
  static async getAutoTopUpConfig(_userId: string): Promise<{
    success: boolean;
    config?: AutoTopUpConfig;
    error?: string;
  }> {
    return {
      success: false,
      error: 'Auto top-up is not supported for Wiza SMS. Please visit the dashboard to top up manually.',
    };
  }

  /**
   * Update auto top-up configuration (not supported)
   */
  static async updateAutoTopUpConfig(_config: Partial<AutoTopUpConfig>): Promise<{
    success: boolean;
    error?: string;
  }> {
    return {
      success: false,
      error: 'Auto top-up is not supported for Wiza SMS.',
    };
  }

  /**
   * Check auto top-up — not applicable for Wiza SMS
   */
  static async checkAutoTopUp(_userId: string, _currentBalance: string): Promise<{
    success: boolean;
    triggered?: boolean;
    error?: string;
  }> {
    return { success: true, triggered: false };
  }

  /**
   * Open the Wiza SMS dashboard
   */
  static openBillingPage(): void {
    window.open(this.WIZA_DASHBOARD_URL, '_blank', 'noopener,noreferrer');
  }

  static formatCurrency(amount: number | string, currency: string = 'UGX'): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return `${currency} 0.00`;
    return `${currency} ${numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  static getRecommendedAmounts(_currentBalance: number, _currency: string = 'UGX'): number[] {
    return [5000, 10000, 20000, 50000];
  }

  static getPaymentMethods() {
    return {
      mobile_money: {
        name: 'Mobile Money',
        providers: [
          { id: 'MTN', name: 'MTN Mobile Money', countries: ['Uganda'] },
          { id: 'Airtel', name: 'Airtel Money', countries: ['Uganda'] },
        ]
      }
    };
  }

  static validatePhoneNumber(phoneNumber: string, _provider: string): { valid: boolean; formatted?: string; error?: string } {
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
      return { valid: false, error: 'Phone number must be 10-15 digits' };
    }
    return { valid: true, formatted: cleaned.startsWith('+') ? cleaned : `+${cleaned}` };
  }
}