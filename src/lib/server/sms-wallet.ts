import 'server-only';
export async function readSmsWalletBalance(): Promise<number | null> {
    const username = process.env.WIZA_SMS_USERNAME || '', password = process.env.WIZA_SMS_PASSWORD || '';
    if (!username || !password)
        return null;
    try {
        const response = await fetch('https://api.wizasms.ug/v1/sms/balance', { headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }, signal: AbortSignal.timeout(6000), cache: 'no-store' });
        if (!response.ok)
            return null;
        const data = await response.json(), value = Number(data.balance ?? data.wallet_balance ?? data.amount);
        return Number.isFinite(value) ? value : null;
    }
    catch {
        return null;
    }
}
