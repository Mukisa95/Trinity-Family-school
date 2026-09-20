import type {
  OperationalAuditEvent,
  OperationalAuditRecord,
  OperationalAuditSeverity,
} from '@/lib/services/operational-audit.service';

const UUID_OR_TOKEN = /^(?:[a-f\d]{8}-[a-f\d-]{20,}|[A-Za-z\d_-]{20,}|\d{6,})$/i;

function normalizeSegment(segment: string) {
  const decoded = (() => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  })();
  return UUID_OR_TOKEN.test(decoded) ? ':record' : decoded.slice(0, 40);
}

export function sanitizeAuditRoute(value: string | null | undefined): string {
  if (!value) return '/unknown';
  try {
    const url = new URL(value, 'https://audit.invalid');
    const segments = url.pathname
      .split('/')
      .filter(Boolean)
      .map(normalizeSegment);
    const mask = (index: number) => {
      if (segments[index]) segments[index] = ':record';
    };
    if (segments[0] === 'fees' && ['collect', 'family'].includes(segments[1])) {
      for (let index = 2; index < segments.length; index += 1) mask(index);
    }
    if (['assign', 'fee-assignments', 'events'].includes(segments[0])) mask(1);
    if (segments[0] === 'pupils' && !['new', 'edit', 'promote', 'historical-seeding', 'pending', 'promotion-history'].includes(segments[1])) mask(1);
    if (segments[0] === 'staff' && !['form', 'mofus'].includes(segments[1])) mask(1);
    if (segments[0] === 'classes') {
      if (['graduates', 'history'].includes(segments[1])) mask(2);
      else if (segments[1] !== 'pending') mask(1);
    }
    if (segments[0] === 'exams' && segments[1] !== 'ple-results') {
      mask(1);
      if (segments[2] === 'pupil-results') mask(3);
    }
    if (segments[0] === 'exams' && segments[1] === 'ple-results') {
      if (segments[2] === 'pupil') { mask(3); mask(4); }
      else mask(2);
    }
    if (segments[0] === 'boarding' && segments[1] === 'dormitory') mask(2);
    if (segments[0] === 'payroll' && segments[1] === 'staff') mask(2);
    if (segments[0] === 'enrollment-trends' && segments[1] === 'class') mask(2);
    if (segments[0] === 'pupils' && segments[1] === 'promotion-history') mask(2);
    const path = segments.join('/');
    return `/${path}`.slice(0, 160) || '/';
  } catch {
    return '/unknown';
  }
}

export function sanitizeAuditText(value: unknown, maxLength = 240): string | undefined {
  if (value === null || value === undefined) return undefined;
  let text = String(value).trim().replace(/\s+/g, ' ');
  if (!text) return undefined;
  text = text
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\+?\d[\d\s()-]{7,}\d/g, '[number]')
    .replace(/[A-Za-z\d_-]{28,}/g, '[identifier]');
  return text.slice(0, maxLength);
}

export function auditQueryFamily(queryKey: readonly unknown[]): string {
  const parts = queryKey.slice(0, 2).map((part) => {
    if (typeof part === 'number') return ':number';
    if (typeof part !== 'string') return ':scope';
    return normalizeSegment(part.replace(/\s+/g, '-'));
  });
  return parts.filter(Boolean).join('/') || 'unnamed-query';
}

export function operationalEventKey(event: OperationalAuditEvent): string {
  return [event.kind, event.name, event.source, event.route, event.severity, event.code || '', event.status || ''].join('|');
}

export function mergeOperationalEvent(
  existing: OperationalAuditEvent | undefined,
  incoming: OperationalAuditEvent,
): OperationalAuditEvent {
  if (!existing) return { ...incoming, count: Math.max(1, incoming.count || 1) };
  const existingCount = Math.max(1, existing.count || 1);
  const incomingCount = Math.max(1, incoming.count || 1);
  const durations = [existing.minMs, incoming.minMs, existing.maxMs, incoming.maxMs]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return {
    ...existing,
    count: existingCount + incomingCount,
    firstAt: existing.firstAt < incoming.firstAt ? existing.firstAt : incoming.firstAt,
    lastAt: existing.lastAt > incoming.lastAt ? existing.lastAt : incoming.lastAt,
    totalMs: (existing.totalMs || 0) + (incoming.totalMs || 0) || undefined,
    minMs: durations.length ? Math.min(...durations) : undefined,
    maxMs: durations.length ? Math.max(...durations) : undefined,
    message: existing.message || incoming.message,
  };
}

export type FlatOperationalEvent = OperationalAuditEvent & {
  documentId: string;
  recordedAt: Date;
  actorName: string;
  actorRole: string;
  appVersion: string;
  device: string;
  sessionId: string;
};

export function flattenOperationalRecords(records: OperationalAuditRecord[]): FlatOperationalEvent[] {
  return records.flatMap(record => record.events.map(event => ({
    ...event,
    documentId: record.id,
    recordedAt: record.ts,
    actorName: record.actor?.username || 'Unknown user',
    actorRole: record.actor?.role || 'Unknown role',
    appVersion: record.appVersion,
    device: record.device,
    sessionId: record.sessionId,
  })));
}

function markdownCell(value: unknown) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function durationLabel(event: OperationalAuditEvent) {
  if (typeof event.maxMs !== 'number') return '';
  const average = event.totalMs && event.count ? Math.round(event.totalMs / event.count) : undefined;
  return average === undefined ? `${Math.round(event.maxMs)} ms max` : `${average} ms avg / ${Math.round(event.maxMs)} ms max`;
}

function severityRank(severity: OperationalAuditSeverity) {
  return severity === 'error' ? 3 : severity === 'warning' ? 2 : 1;
}

export function buildOperationalAuditMarkdown(
  records: OperationalAuditRecord[],
  day: string,
  limitReached: boolean,
): string {
  const events = flattenOperationalRecords(records);
  const occurrences = events.reduce((total, event) => total + Math.max(1, event.count), 0);
  const errors = events.filter(event => event.severity === 'error');
  const warnings = events.filter(event => event.severity === 'warning');
  const slow = events
    .filter(event => typeof event.maxMs === 'number')
    .sort((a, b) => (b.maxMs || 0) - (a.maxMs || 0))
    .slice(0, 40);
  const incidents = [...events]
    .filter(event => event.severity !== 'info' || event.source === 'manual')
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.recordedAt.getTime() - a.recordedAt.getTime());
  const routeTotals = new Map<string, number>();
  events.forEach(event => routeTotals.set(event.route, (routeTotals.get(event.route) || 0) + Math.max(1, event.count)));
  const activeRoutes = [...routeTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  const generated = new Date().toISOString();

  const lines = [
    `# Trinity School operational audit — ${day}`,
    '',
    `Generated: ${generated}`,
    '',
    'This report contains aggregated runtime observations. Automated signals indicate where to investigate; they do not establish staff misconduct or a root cause by themselves.',
    '',
    '## Coverage',
    '',
    `- Summary documents: ${records.length}`,
    `- Recorded occurrences: ${occurrences}`,
    `- Error occurrences: ${errors.reduce((total, event) => total + event.count, 0)}`,
    `- Warning occurrences: ${warnings.reduce((total, event) => total + event.count, 0)}`,
    `- Read limit reached: ${limitReached ? 'Yes — later records may be absent' : 'No'}`,
    '',
    '## Incidents and observations',
    '',
    '| Time | Severity | Kind | Signal | Route | User | Count | Detail |',
    '|---|---|---|---|---|---|---:|---|',
    ...incidents.map(event => `| ${markdownCell(event.recordedAt.toISOString())} | ${markdownCell(event.severity)} | ${markdownCell(event.kind)} | ${markdownCell(event.name)} | ${markdownCell(event.route)} | ${markdownCell(`${event.actorName} (${event.actorRole})`)} | ${event.count} | ${markdownCell(event.message || durationLabel(event) || event.code || '')} |`),
    ...(incidents.length ? [] : ['| — | — | — | No incidents recorded | — | — | 0 | — |']),
    '',
    '## Slowest observed operations',
    '',
    '| Signal | Source | Route | Count | Average / maximum | User |',
    '|---|---|---|---:|---|---|',
    ...slow.map(event => `| ${markdownCell(event.name)} | ${markdownCell(event.source)} | ${markdownCell(event.route)} | ${event.count} | ${markdownCell(durationLabel(event))} | ${markdownCell(`${event.actorName} (${event.actorRole})`)} |`),
    ...(slow.length ? [] : ['| No timed operations recorded | — | — | 0 | — | — |']),
    '',
    '## Most active routes',
    '',
    '| Route | Recorded occurrences |',
    '|---|---:|',
    ...activeRoutes.map(([route, count]) => `| ${markdownCell(route)} | ${count} |`),
    ...(activeRoutes.length ? [] : ['| No routes recorded | 0 |']),
    '',
    '## Diagnostic notes',
    '',
    '- Query and mutation names are reduced to broad cache-key families; record IDs and form values are not included.',
    '- Routes have query strings removed and identifier-like path segments replaced.',
    '- Messages are shortened and scrubbed for URLs, email addresses, phone-like numbers, and long identifiers.',
    '- Duration values are browser-side elapsed times. They include network and client processing and are not Firestore billed-read counts.',
    '',
  ];
  return lines.join('\n');
}
