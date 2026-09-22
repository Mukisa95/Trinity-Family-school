import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditQueryFamily,
  buildOperationalAuditMarkdown,
  isOperationalAuditTransportEvent,
  isOperationalAuditTransportResource,
  mergeOperationalEvent,
  sanitizeAuditRoute,
  sanitizeAuditText,
} from '../src/lib/operational-audit/core';
import type { OperationalAuditEvent, OperationalAuditRecord } from '../src/lib/services/operational-audit.service';

function event(overrides: Partial<OperationalAuditEvent> = {}): OperationalAuditEvent {
  return {
    kind: 'performance',
    name: 'query:pupils/list',
    severity: 'warning',
    route: '/pupils/:record',
    source: 'react-query',
    count: 1,
    firstAt: '2026-09-20T07:00:00.000Z',
    lastAt: '2026-09-20T07:00:00.000Z',
    totalMs: 2500,
    minMs: 2500,
    maxMs: 2500,
    ...overrides,
  };
}

test('route and error sanitizers remove query values and identifier-like data', () => {
  assert.equal(
    sanitizeAuditRoute('https://example.test/fees/collect/B8kN5uXr3pQw7tYz2LmV?token=secret'),
    '/fees/collect/:record',
  );
  const cleaned = sanitizeAuditText('Failed for pupil@example.com +256 700 123 456 at https://host/private with abcdefghijklmnopqrstuvwxyz123456');
  assert.equal(cleaned, 'Failed for [email] [number] at [url] with [identifier]');
  assert.equal(sanitizeAuditRoute('/fees/family/David-Kirabo'), '/fees/family/:record');
  assert.equal(sanitizeAuditRoute('/pupils/David'), '/pupils/:record');
  assert.equal(auditQueryFamily(['fees', 'pupil', 'B8kN5uXr3pQw7tYz2LmV']), 'fees/pupil');
});

test('repeated operational signals aggregate counts and duration boundaries', () => {
  const first = event();
  const merged = mergeOperationalEvent(first, event({
    firstAt: '2026-09-20T07:01:00.000Z',
    lastAt: '2026-09-20T07:01:00.000Z',
    totalMs: 5000,
    minMs: 5000,
    maxMs: 5000,
  }));
  assert.equal(merged.count, 2);
  assert.equal(merged.totalMs, 7500);
  assert.equal(merged.minMs, 2500);
  assert.equal(merged.maxMs, 5000);
  assert.equal(merged.firstAt, first.firstAt);
});

test('persistent Firebase transports and connectivity probes are not treated as request latency', () => {
  assert.equal(
    isOperationalAuditTransportResource('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel'),
    true,
  );
  assert.equal(isOperationalAuditTransportResource('https://securetoken.googleapis.com/v1/token'), true);
  assert.equal(isOperationalAuditTransportResource('https://www.gstatic.com/generate_204'), true);
  assert.equal(isOperationalAuditTransportResource('https://app.test/api/report'), false);
  assert.equal(isOperationalAuditTransportEvent(event({
    name: 'resource:fetch',
    source: 'firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
  })), true);
});

test('Markdown export explains limits and includes diagnostic evidence', () => {
  const records: OperationalAuditRecord[] = [{
    id: 'summary-1',
    ts: new Date('2026-09-20T07:05:00.000Z'),
    sessionId: 'session-1',
    startedAt: '2026-09-20T07:00:00.000Z',
    endedAt: '2026-09-20T07:05:00.000Z',
    appVersion: 'review-sha',
    device: 'desktop',
    actor: { username: 'Administrator', role: 'Admin' },
    events: [
      event(),
      event({
        kind: 'coordination',
        name: 'manual_coordination',
        severity: 'warning',
        source: 'manual',
        message: 'Two staff members edited the same register.',
        totalMs: undefined,
        minMs: undefined,
        maxMs: undefined,
      }),
      event({
        kind: 'error',
        name: 'query:parent-results/:record',
        severity: 'error',
        message: 'internal',
        code: 'functions/internal',
        status: 500,
        totalMs: undefined,
        minMs: undefined,
        maxMs: undefined,
      }),
      event({
        kind: 'activity',
        name: 'route_visible',
        severity: 'info',
        route: '/fees/collect',
        source: 'navigation',
        totalMs: 60_000,
        minMs: 60_000,
        maxMs: 60_000,
      }),
      event({
        name: 'resource:fetch',
        source: 'firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
        count: 4,
        totalMs: 400_000,
        minMs: 50_000,
        maxMs: 200_000,
      }),
    ],
  }];
  const markdown = buildOperationalAuditMarkdown(records, '2026-09-20', true);
  assert.match(markdown, /# Trinity School operational audit/);
  assert.match(markdown, /later records may be absent/);
  assert.match(markdown, /Two staff members edited the same register/);
  assert.match(markdown, /2500 ms avg \/ 2500 ms max/);
  assert.match(markdown, /do not establish staff misconduct/);
  assert.match(markdown, /Application versions: review-sha/);
  assert.match(markdown, /Transport observations excluded: 4/);
  assert.match(markdown, /internal; code: functions\/internal; status: 500/);
  assert.match(markdown, /## Time spent on pages/);
  assert.match(markdown, /## Coordination observations/);
  assert.match(markdown, /## Routes generating the most audit signals/);
  assert.match(markdown, /\| \/fees\/collect \| review-sha \|/);
  assert.doesNotMatch(markdown, /## Most active routes/);

  const slowSection = markdown.slice(
    markdown.indexOf('## Slowest observed operations'),
    markdown.indexOf('## Time spent on pages'),
  );
  assert.doesNotMatch(slowSection, /route_visible|Listen\/channel/);
});
