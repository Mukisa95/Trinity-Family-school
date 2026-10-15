export type OperationalAuditContext = {
  runtime: 'browser' | 'pwa' | 'native-android';
  browser: string;
  os: 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'unknown';
  startup: 'first-setup' | 'repeat-startup' | 'unknown';
};

/** Broad families only: no raw user agent, device identifier or account data. */
export function auditRuntimeContext(input: { userAgent: string; native: boolean; standalone: boolean; firstSetup?: boolean }): OperationalAuditContext {
  const ua = input.userAgent;
  const family = /Edg\//.test(ua) ? 'Edge' : /(?:Chrome|CriOS)\//.test(ua) ? 'Chrome' : /(?:Firefox|FxiOS)\//.test(ua) ? 'Firefox' : /Version\/.+Safari\//.test(ua) ? 'Safari' : '';
  const version = family && ua.match(family === 'Edge' ? /Edg\/(\d+)/ : family === 'Chrome' ? /(?:Chrome|CriOS)\/(\d+)/ : family === 'Firefox' ? /(?:Firefox|FxiOS)\/(\d+)/ : /Version\/(\d+)/)?.[1];
  return {
    runtime: input.native ? 'native-android' : input.standalone ? 'pwa' : 'browser',
    browser: family ? `${family}${version ? ` ${version}` : ''}${input.native ? ' WebView' : ''}` : 'unknown',
    os: /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown',
    startup: input.firstSetup === undefined ? 'unknown' : input.firstSetup ? 'first-setup' : 'repeat-startup',
  };
}

export function auditObservationWindow(startTime: number, duration: number, timeOrigin: number) {
  const first = timeOrigin + Math.max(0, startTime);
  return { firstAt: new Date(first).toISOString(), lastAt: new Date(first + Math.max(0, duration)).toISOString() };
}
