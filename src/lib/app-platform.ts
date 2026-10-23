export type AppPlatform = { nativeAndroid: boolean; installed: boolean; mobile: boolean; os: 'android' | 'ios' | 'desktop'; };

/** OS information is independent of viewport width and browser resizing. */
export function detectAppPlatform({ userAgent, platform = '', maxTouchPoints = 0, nativeAndroid = false, standalone = false, mobileHint = false }: {
  userAgent: string; platform?: string; maxTouchPoints?: number; nativeAndroid?: boolean; standalone?: boolean; mobileHint?: boolean;
}): AppPlatform {
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const android = nativeAndroid || /Android/i.test(userAgent);
  return { nativeAndroid, installed: nativeAndroid || standalone, mobile: ios || android || mobileHint, os: android ? 'android' : ios ? 'ios' : 'desktop' };
}

/** The QR opens the public landing page, never an account or session link. */
export function appDownloadPageUrl(origin: string): string {
  const url = new URL(origin);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('A school website address is required.');
  return new URL('/download', url.origin).href;
}
