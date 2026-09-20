import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COLLECTION_NAME = 'operationalAuditLogs';
const MAX_READ_DOCUMENTS = 2000;

export type OperationalAuditKind =
  | 'performance'
  | 'error'
  | 'network'
  | 'coordination'
  | 'activity';

export type OperationalAuditSeverity = 'info' | 'warning' | 'error';

export type OperationalAuditEvent = {
  kind: OperationalAuditKind;
  name: string;
  severity: OperationalAuditSeverity;
  route: string;
  source: string;
  count: number;
  firstAt: string;
  lastAt: string;
  totalMs?: number;
  minMs?: number;
  maxMs?: number;
  message?: string;
  code?: string;
  status?: number;
};

export type OperationalAuditActor = {
  id?: string;
  username?: string;
  role?: string;
};

export type OperationalAuditSummaryInput = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  appVersion: string;
  device: string;
  actor?: OperationalAuditActor;
  events: OperationalAuditEvent[];
};

export type OperationalAuditRecord = OperationalAuditSummaryInput & {
  id: string;
  ts: Date;
};

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function clampLimit(value: number) {
  return Math.max(1, Math.min(Math.floor(value), MAX_READ_DOCUMENTS));
}

function cleanEvent(event: OperationalAuditEvent): OperationalAuditEvent {
  const optionalEntries = Object.entries({
    totalMs: event.totalMs,
    minMs: event.minMs,
    maxMs: event.maxMs,
    message: event.message,
    code: event.code,
    status: event.status,
  }).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return {
    kind: event.kind,
    name: event.name.slice(0, 160),
    severity: event.severity,
    route: event.route.slice(0, 160),
    source: event.source.slice(0, 160),
    count: Math.max(1, Math.floor(event.count || 1)),
    firstAt: event.firstAt,
    lastAt: event.lastAt,
    ...Object.fromEntries(optionalEntries),
  } as OperationalAuditEvent;
}

export function getLocalDayBounds(day: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error('Select a valid audit date.');
  const start = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(start.getTime())) throw new Error('Select a valid audit date.');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export class OperationalAuditService {
  static async writeSummary(input: OperationalAuditSummaryInput): Promise<void> {
    if (input.events.length === 0) return;
    await addDoc(collection(db, COLLECTION_NAME), {
      v: 1,
      ts: Timestamp.now(),
      sid: input.sessionId.slice(0, 80),
      from: input.startedAt,
      to: input.endedAt,
      av: input.appVersion.slice(0, 80),
      device: input.device.slice(0, 30),
      uid: input.actor?.id?.slice(0, 80) || '',
      un: input.actor?.username?.slice(0, 80) || '',
      ur: input.actor?.role?.slice(0, 40) || '',
      events: input.events.slice(0, 40).map(cleanEvent),
    });
  }

  static async recordObservation(input: {
    actor?: OperationalAuditActor;
    category: string;
    severity: OperationalAuditSeverity;
    message: string;
    route?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.writeSummary({
      sessionId: `observation-${Date.now()}`,
      startedAt: now,
      endedAt: now,
      appVersion: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local',
      device: 'manual',
      actor: input.actor,
      events: [{
        kind: input.category === 'performance' ? 'performance' : 'coordination',
        name: `manual_${input.category.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}`,
        severity: input.severity,
        route: input.route || '/history-log/system-audit',
        source: 'manual',
        count: 1,
        firstAt: now,
        lastAt: now,
        message: input.message.trim().replace(/\s+/g, ' ').slice(0, 500),
      }],
    });
  }

  static async getForDay(day: string, requestedLimit = MAX_READ_DOCUMENTS): Promise<{
    records: OperationalAuditRecord[];
    limitReached: boolean;
  }> {
    const { start, end } = getLocalDayBounds(day);
    const readLimit = clampLimit(requestedLimit);
    const snapshot = await getDocs(query(
      collection(db, COLLECTION_NAME),
      where('ts', '>=', Timestamp.fromDate(start)),
      where('ts', '<', Timestamp.fromDate(end)),
      orderBy('ts', 'desc'),
      limit(readLimit),
    ));

    const records = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ts: asDate(data.ts),
        sessionId: String(data.sid || ''),
        startedAt: String(data.from || ''),
        endedAt: String(data.to || ''),
        appVersion: String(data.av || 'unknown'),
        device: String(data.device || 'unknown'),
        actor: {
          id: String(data.uid || ''),
          username: String(data.un || ''),
          role: String(data.ur || ''),
        },
        events: Array.isArray(data.events) ? data.events as OperationalAuditEvent[] : [],
      };
    });

    return { records, limitReached: snapshot.size >= readLimit };
  }
}
