import type {
  OperationalAuditEvent,
  OperationalAuditRecord,
  OperationalAuditSeverity,
} from '@/lib/services/operational-audit.service';
import type { OperationalAuditContext } from './context';

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

/**
 * Browser resource timing reports persistent Firebase transports when their
 * connection eventually closes. Those durations describe connection lifetime,
 * not application latency, so they must never be ranked as slow operations.
 */
export function isOperationalAuditTransportResource(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return (
    normalized.includes('firestore.googleapis.com/google.firestore.v1.firestore/listen/channel') ||
    normalized.includes('firestore.googleapis.com/google.firestore.v1.firestore/write/channel') ||
    normalized.includes('securetoken.googleapis.com/v1/token') ||
    normalized.includes('/generate_204') ||
    normalized.includes('/images/cleardot.gif')
  );
}

export function isOperationalAuditTransportEvent(event: Pick<OperationalAuditEvent, 'name' | 'source'>): boolean {
  return event.name.startsWith('resource:') && isOperationalAuditTransportResource(event.source);
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
  context?: OperationalAuditContext;
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
    context: record.context,
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

function eventDetailLabel(event: OperationalAuditEvent) {
  return [
    event.message,
    event.code ? `code: ${event.code}` : '',
    typeof event.status === 'number' ? `status: ${event.status}` : '',
    durationLabel(event),
  ].filter(Boolean).join('; ');
}

function severityRank(severity: OperationalAuditSeverity) {
  return severity === 'error' ? 3 : severity === 'warning' ? 2 : 1;
}

function contextLabel(event: FlatOperationalEvent) {
  return event.context ? `${event.context.runtime}; ${event.context.browser}; ${event.context.os}; ${event.context.startup}` : `${event.device}; runtime/startup unknown (older collector)`;
}

export function buildOperationalAuditMarkdown(
  records: OperationalAuditRecord[],
  day: string,
  limitReached: boolean,
): string {
  const allEvents = flattenOperationalRecords(records);
  const excludedTransportEvents = allEvents.filter(isOperationalAuditTransportEvent);
  const events = allEvents.filter(event => !isOperationalAuditTransportEvent(event));
  const occurrences = events.reduce((total, event) => total + Math.max(1, event.count), 0);
  const errors = events.filter(event => event.severity === 'error');
  const warnings = events.filter(event => event.severity === 'warning');
  const slow = events
    .filter(event => event.kind === 'performance' && event.name !== 'route_visible' && typeof event.maxMs === 'number')
    .sort((a, b) => (b.maxMs || 0) - (a.maxMs || 0))
    .slice(0, 40);
  const routeTime = events
    .filter(event => event.name === 'route_visible' && typeof event.maxMs === 'number')
    .sort((a, b) => (b.maxMs || 0) - (a.maxMs || 0))
    .slice(0, 40);
  const coordination = events
    .filter(event => event.kind === 'coordination')
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
  const incidents = [...events]
    .filter(event => event.severity !== 'info' || event.source === 'manual')
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.recordedAt.getTime() - a.recordedAt.getTime());
  const routeTotals = new Map<string, { route: string; version: string; count: number }>();
  events.forEach(event => {
    const key = `${event.route}\u0000${event.appVersion}`;
    const existing = routeTotals.get(key);
    routeTotals.set(key, {
      route: event.route,
      version: event.appVersion,
      count: (existing?.count || 0) + Math.max(1, event.count),
    });
  });
  const activeRoutes = [...routeTotals.values()].sort((a, b) => b.count - a.count).slice(0, 30);
  const appVersions = [...new Set(events.map(event => event.appVersion || 'unknown'))].sort();
  const measurements = events.filter(event => event.source === 'workspace-timing' || event.name.startsWith('interaction-') || event.name === 'click-handler-to-paint-opportunity')
    .sort((a, b) => a.name.localeCompare(b.name) || a.firstAt.localeCompare(b.firstAt)).slice(0, 200);
  const environments = new Map<string, number>();
  records.forEach(record => {
    const label = record.context ? `${record.appVersion}; ${record.context.runtime}; ${record.context.browser}; ${record.context.os}; ${record.context.startup}` : `${record.appVersion}; ${record.device}; runtime/startup unknown`;
    environments.set(label, (environments.get(label) || 0) + 1);
  });
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
    `- Application versions: ${appVersions.map(markdownCell).join(', ') || 'none'}`,
    `- Transport observations excluded: ${excludedTransportEvents.reduce((total, event) => total + Math.max(1, event.count), 0)}`,
    `- Read limit reached: ${limitReached ? 'Yes — later records may be absent' : 'No'}`,
    ...[...environments].map(([label, count]) => `- Environment: ${markdownCell(label)} — ${count} summary document(s)`),
    '',
    '## Incidents and observations',
    '',
    '| Observed first | Observed last | Batch saved | Environment | Version | Severity | Kind | Signal | Route | User | Count | Detail |',
    '|---|---|---|---|---|---|---|---|---|---|---:|---|',
    ...incidents.map(event => `| ${markdownCell(event.firstAt || 'unknown')} | ${markdownCell(event.lastAt || 'unknown')} | ${markdownCell(event.recordedAt.toISOString())} | ${markdownCell(contextLabel(event))} | ${markdownCell(event.appVersion)} | ${markdownCell(event.severity)} | ${markdownCell(event.kind)} | ${markdownCell(event.name)} | ${markdownCell(event.route)} | ${markdownCell(`${event.actorName} (${event.actorRole})`)} | ${event.count} | ${markdownCell(eventDetailLabel(event))} |`),
    ...(incidents.length ? [] : ['| — | — | — | — | — | — | — | No incidents recorded | — | — | 0 | — |']),
    '',
    '## Startup, data readiness, offline preparation and clicks',
    '',
    '| Signal | Route | Version | Environment | Observed first / last | Batch saved | Count | Average / maximum |',
    '|---|---|---|---|---|---|---:|---|',
    ...measurements.map(event => `| ${markdownCell(event.name)} | ${markdownCell(event.route)} | ${markdownCell(event.appVersion)} | ${markdownCell(contextLabel(event))} | ${markdownCell(`${event.firstAt} / ${event.lastAt}`)} | ${markdownCell(event.recordedAt.toISOString())} | ${event.count} | ${markdownCell(durationLabel(event))} |`),
    ...(measurements.length ? [] : ['| No stage measurements recorded (older collector or unsupported API) | — | — | — | — | — | 0 | — |']),
    '',
    '## Slowest observed operations',
    '',
    '| Signal | Source | Route | Version | Count | Average / maximum | User |',
    '|---|---|---|---|---:|---|---|',
    ...slow.map(event => `| ${markdownCell(event.name)} | ${markdownCell(event.source)} | ${markdownCell(event.route)} | ${markdownCell(event.appVersion)} | ${event.count} | ${markdownCell(durationLabel(event))} | ${markdownCell(`${event.actorName} (${event.actorRole})`)} |`),
    ...(slow.length ? [] : ['| No timed operations recorded | — | — | — | 0 | — | — |']),
    '',
    '## Time spent on pages',
    '',
    'Corrected collector versions count visible route time. Older records may include background time. These values are not page-load durations.',
    '',
    '| Route | Version | Count | Average / maximum | User |',
    '|---|---|---:|---|---|',
    ...routeTime.map(event => `| ${markdownCell(event.route)} | ${markdownCell(event.appVersion)} | ${event.count} | ${markdownCell(durationLabel(event))} | ${markdownCell(`${event.actorName} (${event.actorRole})`)} |`),
    ...(routeTime.length ? [] : ['| No completed route visits recorded | — | 0 | — | — |']),
    '',
    '## Coordination observations',
    '',
    '| Observed first / last | Batch saved | Environment | Version | Signal | Route | User | Count | Detail |',
    '|---|---|---|---|---|---|---|---:|---|',
    ...coordination.map(event => `| ${markdownCell(`${event.firstAt} / ${event.lastAt}`)} | ${markdownCell(event.recordedAt.toISOString())} | ${markdownCell(contextLabel(event))} | ${markdownCell(event.appVersion)} | ${markdownCell(event.name)} | ${markdownCell(event.route)} | ${markdownCell(`${event.actorName} (${event.actorRole})`)} | ${event.count} | ${markdownCell(eventDetailLabel(event))} |`),
    ...(coordination.length ? [] : ['| — | — | — | — | No coordination observations recorded | — | — | 0 | — |']),
    '',
    '## Routes generating the most audit signals',
    '',
    '| Route | Version | Recorded occurrences |',
    '|---|---|---:|',
    ...activeRoutes.map(item => `| ${markdownCell(item.route)} | ${markdownCell(item.version)} | ${item.count} |`),
    ...(activeRoutes.length ? [] : ['| No routes recorded | — | 0 |']),
    '',
    '## Diagnostic notes',
    '',
    '- Query and mutation names are reduced to broad cache-key families; record IDs and form values are not included.',
    '- Routes have query strings removed and identifier-like path segments replaced.',
    '- Messages are shortened and scrubbed for URLs, email addresses, phone-like numbers, and long identifiers.',
    '- Duration values are browser-side elapsed times. They include network and client processing and are not Firestore billed-read counts.',
    '- Persistent Firestore transports, token refreshes, and connectivity probes are excluded from resource-latency rankings.',
    '- Time spent on pages is reported separately and must not be interpreted as page-load latency.',
    '- Observed first/last are the boundaries of aggregated observations. Batch saved is the later summary write time; identical batch timestamps do not imply simultaneous incidents. Older collector timestamps can reflect callback observation time.',
    '- Stage measurements separate identity restoration, workspace visibility, page data readiness, a first visible paint opportunity, and Android snapshot export/serialization/post/save acknowledgement. The save acknowledgement includes bridge and native storage time; app-shell preparation includes downloads.',
    '- First-data-visible is measured after a frame and task while the document is visible and the startup/welcome overlay is closed. It is a paint opportunity, not a screenshot, a guarantee of financial freshness or a complete rendering trace.',
    '- First-data-visible retains total elapsed time, including background pauses. Foreground-to-visible excludes document-hidden time; background-wait reports that excluded time separately. Foreground time can still include a visible startup overlay. Observation boundaries span the actual visit, even when an active duration excludes pauses.',
    '- Pupil-cache-access signals are broad eligibility/publication reasons, not loading durations. Missing/expired receipts, changed scope and missing/incomplete snapshots explain why saved viewing was unavailable; no receipt, account ID or pupil content is exported.',
    '- Android cache-read, record-projection and photo-preparation break down snapshot export. Photo hashing, decode, encode and thumbnail-cache read/write identify its expensive steps. Async elapsed time includes cooperative navigation/background pauses and must not be called continuous CPU blocking.',
    '- Event Timing captures slower click/key interactions when supported; input delay is separated from total interaction-to-paint. The unsupported-browser fallback measures handler-to-paint opportunity and cannot measure input queue delay.',
    '- First-setup identifies the welcome marker at session start; repeat-startup means preferences were previously completed. Neither proves a cold download or complete offline preparation. Native context refers to the web workspace; standalone native offline screens are outside this collector.',
    '',
  ];
  return lines.join('\n');
}
