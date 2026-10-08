import { createHash, timingSafeEqual } from 'node:crypto';

export type NativeDeviceInput = { installationId: string; deviceSecret: string; token?: string; applicationId: string; projectId: string };
export function nativeDeviceInput(value: unknown, tokenRequired = true): NativeDeviceInput {
  const input = value as Record<string, unknown> | null;
  if (!input || typeof input.installationId !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input.installationId)
    || typeof input.deviceSecret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.deviceSecret)
    || typeof input.applicationId !== 'string' || !/^[a-z][a-z0-9_.]{5,180}$/.test(input.applicationId)
    || typeof input.projectId !== 'string' || !/^[a-z][a-z0-9-]{4,100}$/.test(input.projectId)
    || tokenRequired && (typeof input.token !== 'string' || !/^[A-Za-z0-9:_-]{80,4096}$/.test(input.token))) throw new Error('INVALID_NATIVE_DEVICE');
  return { installationId: input.installationId, deviceSecret: input.deviceSecret, applicationId: input.applicationId, projectId: input.projectId,
    ...(tokenRequired ? { token: input.token as string } : {}) };
}
export const nativeDeviceId = (input: Pick<NativeDeviceInput, 'installationId' | 'applicationId'>) =>
  `native-${createHash('sha256').update(`${input.applicationId}:${input.installationId}`).digest('hex')}`;
export const nativeSecretHash = (secret: string) => createHash('sha256').update(secret).digest('hex');
export function nativeSecretMatches(secret: string, stored: unknown) {
  if (typeof stored !== 'string' || !/^[a-f0-9]{64}$/.test(stored)) return false;
  return timingSafeEqual(Buffer.from(nativeSecretHash(secret), 'hex'), Buffer.from(stored, 'hex'));
}
export function assertNativeSchool(input: NativeDeviceInput, applicationId: string, projectId: string, runtimeProjectId: string | undefined) {
  if (input.applicationId !== applicationId || input.projectId !== projectId || input.projectId !== runtimeProjectId) throw new Error('NATIVE_SCHOOL_MISMATCH');
}
export function nativeBindingOwner(input: NativeDeviceInput, previous: Record<string, any> | undefined, action: 'register' | 'rotate' | 'deactivate', verifiedUserId?: string) {
  if (previous && (!nativeSecretMatches(input.deviceSecret, previous.deviceSecretHash) || previous.transport !== 'android-fcm')) throw new Error('NATIVE_DEVICE_PROOF_REQUIRED');
  if (action !== 'register' && !previous || action === 'rotate' && !previous?.isActive) throw new Error('NATIVE_DEVICE_NOT_REGISTERED');
  if (action === 'register' && !verifiedUserId) throw new Error('AUTH_REQUIRED');
  return action === 'register' ? verifiedUserId! : String(previous!.userId);
}
function boundedText(value: unknown, bytes: number) {
  return typeof value === 'string' ? Buffer.from(value).subarray(0, bytes).toString('utf8').replace(/\uFFFD$/, '') : '';
}
/** Data messages let Android enforce the currently signed-in account before displaying anything. */
export function nativeMessageData(userId: string, projectId: string, payload: {
  title: string; body: string; url?: string; tag?: string; timestamp?: number; data?: Record<string, string>;
}) {
  const extras: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.data || {}).slice(0, 6)) {
    if (/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key) && !/^(google|gcm)/i.test(key)) extras[key] = boundedText(value, 80);
  }
  const url = typeof payload.url === 'string' && /^\/(?!\/)/.test(payload.url) && !/[\\\r\n]/.test(payload.url) ? payload.url : '/push-notifications';
  const message = { ...extras, title: boundedText(payload.title, 200), body: boundedText(payload.body, 1500),
    url: boundedText(url, 500), tag: boundedText(payload.tag || 'school-announcement', 150),
    timestamp: String(payload.timestamp || Date.now()), recipientId: userId, schoolProjectId: projectId };
  while (Buffer.byteLength(JSON.stringify(message)) > 3500 && message.body) message.body = boundedText(message.body, Math.max(0, Buffer.byteLength(message.body) - 200));
  return message;
}
export const expiredNativeToken = (code?: string) => code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
