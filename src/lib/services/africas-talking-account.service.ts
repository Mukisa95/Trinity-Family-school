/**
 * Africa's Talking Account Service - STUB (provider removed)
 * Africa's Talking is no longer used. Wiza SMS is the active provider.
 */

interface AccountData {
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
}

export class AfricasTalkingAccountService {
  static async getAccountData(): Promise<AccountData> {
    return {
      success: false,
      error: "Africa's Talking provider has been removed. Use Wiza SMS.",
    };
  }

  static formatCurrency(amount: string, currency: string = 'UGX'): string {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return `${currency} 0.00`;
    return `${currency} ${numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}