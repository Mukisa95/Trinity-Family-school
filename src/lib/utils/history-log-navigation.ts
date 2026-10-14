import type { HistoryLogRecord } from '../services/history-log.service';

// Preserve record/period context without storing credentials or redirect URLs.
const contextParameters = new Set([
  'id', 'pupilId', 'classId', 'academicYearId', 'yearId', 'termId',
  'examId', 'streamId', 'tab', 'section', 'notes',
]);

export function normaliseHistoryRoute(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || /[\\\u0000-\u001f\u007f]/.test(value) || value.length > 2048) return undefined;
  try {
    const url = new URL(value, 'https://history.trinity.invalid');
    if (url.origin !== 'https://history.trinity.invalid'
      || /^\/(api|_next)(\/|$)/.test(url.pathname)) return undefined;
    const parameters = new URLSearchParams();
    url.searchParams.forEach((item, key) => {
      if (contextParameters.has(key)) parameters.append(key, item);
    });
    const search = parameters.toString();
    return `${url.pathname}${search ? `?${search}` : ''}`;
  } catch { return undefined; }
}

export function currentHistoryRoute(): string | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined;
  return normaliseHistoryRoute(`${window.location.pathname}${window.location.search}`);
}

export function historyMeta(log: HistoryLogRecord, key: string): string | undefined {
  const value = Object.entries(log.m || {}).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function uniquePupilNameLookup(pupilNames: Record<string, string>): Map<string, string | null> {
  const result = new Map<string, string | null>();
  Object.entries(pupilNames).forEach(([id, name]) => {
    const key = name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (key) result.set(key, result.has(key) ? null : id);
  });
  return result;
}

export function getHistoryPupilId(log: HistoryLogRecord, names?: Map<string, string | null>): string | undefined {
  const entity = (log.e || '').toLowerCase();
  if (entity === 'pupil' && log.rid?.trim()) return log.rid.trim();
  const explicit = historyMeta(log, 'pupilId');
  if (explicit) return explicit;
  const name = historyMeta(log, 'pupilName')?.replace(/\s+/g, ' ').toLocaleLowerCase();
  const matched = name && names?.get(name);
  if (matched) return matched;
  // Older banking status logs may only identify the pupil in their page URL.
  if (entity === 'payment' || entity.startsWith('bank')) {
    const route = normaliseHistoryRoute(log.rp);
    if (route) {
      const url = new URL(route, 'https://history.trinity.invalid');
      const feePupil = url.pathname.match(/^\/fees\/collect\/([^/]+)\/?$/)?.[1];
      if (feePupil) { try { return decodeURIComponent(feePupil); } catch { return undefined; } }
      if (['/fees/collect', '/banking/pupil-banking-details'].includes(url.pathname)) {
        return url.searchParams.get('pupilId')?.trim() || undefined;
      }
    }
  }
  return undefined;
}

/** Old records use known record/workspace routes; new records retain origin. */
export function getHistoryLogRoute(log: HistoryLogRecord, names?: Map<string, string | null>): string | undefined {
  const recorded = normaliseHistoryRoute(log.rp);
  if (recorded) return recorded;
  const pupilId = getHistoryPupilId(log, names);
  const entity = (log.e || '').toLowerCase();
  if (entity === 'payment') return pupilId ? `/fees/collect/${encodeURIComponent(pupilId)}` : '/fees/collection';
  if (entity === 'banking' || entity.startsWith('bank_')) {
    return pupilId ? `/banking/pupil-banking-details?pupilId=${encodeURIComponent(pupilId)}` : '/banking';
  }
  if (entity === 'pupil') return log.a === 'delete' ? '/pupils' : pupilId ? `/pupil-detail?id=${encodeURIComponent(pupilId)}` : '/pupils';
  if (entity === 'user') return '/users';
  if (entity === 'fee_structure') return '/fees?tab=fees';
  if (entity === 'requirement') return '/fees?tab=requirements';
  if (entity === 'uniform') return '/fees?tab=uniforms';
  if (entity === 'class' || entity.startsWith('class_')) return '/classes';
  if (entity === 'export') {
    const type = (historyMeta(log, 'dataType') || '').toLowerCase();
    if (/^pupils?([ _-]|$)/.test(type)) return '/pupils';
    if (/^staff([ _-]|$)/.test(type)) return '/staff';
    if (/^(fees?|payments?)([ _-]|$)/.test(type)) return '/fees/collection';
  }
  return pupilId ? `/pupil-detail?id=${encodeURIComponent(pupilId)}` : undefined;
}
