import { WizaSMSAccountService } from './wiza-sms-account.service';

interface AccountData {
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
  provider?: string;
  source?: string;
  message?: string;
}

/**
 * Unified Account Balance Service
 * Only Wiza SMS is supported. Africa's Talking has been removed.
 */
export class UnifiedAccountBalanceService {
  static async getAccountData(): Promise<AccountData> {
    try {
      const wizaData = await WizaSMSAccountService.getAccountData();
      return {
        ...wizaData,
        provider: 'Wiza SMS',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'Wiza SMS',
      };
    }
  }

  static formatCurrency(amount: string, currency?: string, _provider?: string): string {
    const defaultCurrency = currency || 'UGX';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return `${defaultCurrency} 0.00`;

    return `${defaultCurrency} ${numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  static getEstimatedSMSCount(balance: number, _provider?: string): number {
    const costPerSMS = 35; // UGX 35 per SMS for Wiza
    return Math.floor(balance / costPerSMS);
  }

  static getBalanceStatus(balance: number, _provider?: string): {
    status: 'good' | 'moderate' | 'low' | 'insufficient';
    color: string;
    bgColor: string;
  } {
    if (balance >= 5000) {
      return { status: 'good', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' };
    } else if (balance >= 1000) {
      return { status: 'moderate', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' };
    } else if (balance > 0) {
      return { status: 'low', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' };
    } else {
      return { status: 'insufficient', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' };
    }
  }
}
