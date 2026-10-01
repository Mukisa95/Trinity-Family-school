import 'server-only';
import {OAuth2Client} from 'google-auth-library';
import {feeReminderTarget} from '../../../functions/fee-reminder-targets';

const verifier = new OAuth2Client();
export async function verifyFeeReminderFunction(authorization: string | null, projectId: string): Promise<boolean> {
  if (!authorization?.startsWith('Bearer ') || authorization.length > 16000) return false;
  try {
    const target = feeReminderTarget(projectId);
    const ticket = await verifier.verifyIdToken({idToken: authorization.slice(7), audience: target.audience});
    const claims = ticket.getPayload();
    return claims?.email_verified === true && target.identities.includes(claims.email || '');
  } catch { return false; }
}
