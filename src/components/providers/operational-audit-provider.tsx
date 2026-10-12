'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { auditRuntimeContext, auditObservationWindow, type OperationalAuditContext } from '@/lib/operational-audit/context';
import { workspaceSetupMarker, workspaceSetupScope } from '@/lib/startup/workspace-setup';
import {
  OperationalAuditService,
  type OperationalAuditActor,
  type OperationalAuditEvent,
} from '@/lib/services/operational-audit.service';
import {
  auditQueryFamily,
  isOperationalAuditTransportResource,
  mergeOperationalEvent,
  operationalEventKey,
  sanitizeAuditRoute,
  sanitizeAuditText,
} from '@/lib/operational-audit/core';

const FLUSH_INTERVAL_MS = 10 * 60 * 1000;
const MIN_EARLY_FLUSH_MS = 5 * 60 * 1000;
const PERSIST_INTERVAL_MS = 30 * 1000;
const SLOW_OPERATION_MS = 2000;
const MAX_BUFFER_KEYS = 39; // Reserve the fortieth key for combined signals.
const PENDING_PREFIX = 'trinity_operational_audit_pending_v1:';
const SESSION_KEY = 'trinity_operational_audit_session_v1';

type PendingPayload = {
  startedAt: string;
  savedAt: number;
  events: OperationalAuditEvent[];
  appVersion?: string;
  context?: OperationalAuditContext;
  device?: string;
  sessionId?: string;
};

function makeSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getSessionId() {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = makeSessionId();
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function getDeviceClass() {
  if (window.innerWidth < 640) return 'phone';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

function errorDetails(error: unknown) {
  if (!error || typeof error !== 'object') return { message: sanitizeAuditText(error) };
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown };
  return {
    message: sanitizeAuditText(candidate.message),
    code: sanitizeAuditText(candidate.code, 80),
    status: typeof candidate.status === 'number' ? candidate.status : undefined,
  };
}

export function OperationalAuditProvider() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const bufferRef = useRef(new Map<string, OperationalAuditEvent>());
  const activeRef = useRef(false);
  const flushingRef = useRef(false);
  const startedAtRef = useRef(new Date().toISOString());
  const routeRef = useRef(sanitizeAuditRoute(pathname));
  const routeVisibleSinceRef = useRef<number | null>(null);
  const routeVisibleElapsedRef = useRef(0);
  const routeHistoryRef = useRef([{ startedAt: 0, route: sanitizeAuditRoute(pathname) }]);
  const navigationRecordedRef = useRef(false);
  const activeOperationsRef = useRef(0);
  const offlineEpisodeRef = useRef<{
    startedAt: number;
    route: string;
    visibility: DocumentVisibilityState;
    activeOperations: number;
  } | null>(null);
  const actorRef = useRef<OperationalAuditActor>();
  const sessionIdRef = useRef('');
  const pendingKeyRef = useRef('');
  const contextRef = useRef<OperationalAuditContext>();
  const recoveryRef = useRef(new Map<string, PendingPayload>());
  const observedEntriesRef = useRef(new WeakSet<PerformanceEntry>());
  const accountRef = useRef('');
  const entryEpochRef = useRef(0);
  const appVersion = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local';

  const persist = useCallback(() => {
    if (!pendingKeyRef.current || typeof window === 'undefined') return;
    const events = [...bufferRef.current.values()];
    if (events.length === 0) {
      window.localStorage.removeItem(pendingKeyRef.current);
      return;
    }
    const payload: PendingPayload = { startedAt: startedAtRef.current, savedAt: Date.now(), events, appVersion,
      context: contextRef.current, device: getDeviceClass(), sessionId: sessionIdRef.current };
    try {
      window.localStorage.setItem(pendingKeyRef.current, JSON.stringify(payload));
    } catch {
      // Telemetry must never interfere with the application when storage is full or unavailable.
    }
  }, []);

  const addEvent = useCallback((event: Omit<OperationalAuditEvent, 'count' | 'firstAt' | 'lastAt'> & {
    count?: number;
    firstAt?: string;
    lastAt?: string;
  }) => {
    if (!activeRef.current) return;
    const now = new Date().toISOString();
    const normalized: OperationalAuditEvent = {
      ...event,
      route: sanitizeAuditRoute(event.route),
      count: Math.max(1, event.count || 1),
      firstAt: event.firstAt || now,
      lastAt: event.lastAt || now,
      message: sanitizeAuditText(event.message),
      code: sanitizeAuditText(event.code, 80),
    };
    let key = operationalEventKey(normalized);
    if (!bufferRef.current.has(key) && bufferRef.current.size >= MAX_BUFFER_KEYS
      && (normalized.source === 'workspace-timing' || normalized.name.startsWith('interaction-'))) {
      const disposable = [...bufferRef.current].find(([, item]) => item.source === 'react-query' && item.kind === 'performance' && item.severity === 'info');
      if (disposable) {
        bufferRef.current.delete(disposable[0]);
        const combined: OperationalAuditEvent = { ...disposable[1], kind: 'activity', name: 'additional_signals',
          source: 'collector', severity: 'info', route: '/multiple', message: 'Low-frequency signals were combined to keep the audit lightweight.' };
        const combinedKey = operationalEventKey(combined);
        bufferRef.current.set(combinedKey, mergeOperationalEvent(bufferRef.current.get(combinedKey), combined));
      }
    }
    if (!bufferRef.current.has(key) && bufferRef.current.size >= MAX_BUFFER_KEYS) {
      const priority = normalized.source === 'workspace-timing' || normalized.name.startsWith('interaction-');
      // A reserved combined key plus an evicted routine query leaves space for
      // a stage measurement. Errors retain their existing collector priority.
      if (!(priority && bufferRef.current.size < 40 && [...bufferRef.current.values()].some(item => item.name === 'additional_signals'))) {
      normalized.kind = 'activity';
      normalized.name = 'additional_signals';
      normalized.source = 'collector';
      normalized.severity = 'info';
      normalized.route = '/multiple';
      normalized.message = 'Additional low-frequency signals were combined to keep the audit lightweight.';
      normalized.code = undefined;
      normalized.status = undefined;
      key = operationalEventKey(normalized);
      }
    }
    bufferRef.current.set(key, mergeOperationalEvent(bufferRef.current.get(key), normalized));
  }, []);

  const pauseRouteTimer = useCallback(() => {
    if (routeVisibleSinceRef.current === null) return;
    routeVisibleElapsedRef.current += Math.max(0, Date.now() - routeVisibleSinceRef.current);
    routeVisibleSinceRef.current = null;
  }, []);

  const resumeRouteTimer = useCallback(() => {
    if (document.visibilityState === 'visible' && routeVisibleSinceRef.current === null) {
      routeVisibleSinceRef.current = Date.now();
    }
  }, []);

  const recordRouteTime = useCallback((route: string) => {
    pauseRouteTimer();
    const elapsed = routeVisibleElapsedRef.current;
    routeVisibleElapsedRef.current = 0;
    if (elapsed <= 0) return;
    addEvent({
      kind: 'activity',
      name: 'route_visible',
      severity: 'info',
      route,
      source: 'navigation',
      totalMs: elapsed,
      minMs: elapsed,
      maxMs: elapsed,
    });
  }, [addEvent, pauseRouteTimer]);

  const flush = useCallback(async () => {
    if (!activeRef.current || flushingRef.current) return;
    recordRouteTime(routeRef.current);
    resumeRouteTimer();
    if (bufferRef.current.size === 0 && recoveryRef.current.size === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      persist();
      return;
    }
    flushingRef.current = true;
    const account = accountRef.current, actor = actorRef.current, context = contextRef.current;
    const sessionId = sessionIdRef.current, pendingKey = pendingKeyRef.current;
    const recovered = [...recoveryRef.current];
    const events = [...bufferRef.current.values()];
    const startedAt = startedAtRef.current;
    // Keep this exact snapshot in local storage until Firestore accepts it. If
    // the tab closes during the request, a later session can recover it.
    persist();
    bufferRef.current.clear();
    startedAtRef.current = new Date().toISOString();
    try {
      // Recovered batches keep their original version/context and observation
      // timestamps. Never relabel old observations as measurements of this build.
      for (const [key, pending] of recovered) {
        if (account !== accountRef.current || !activeRef.current) return;
        try {
          await OperationalAuditService.writeSummary({ sessionId: pending.sessionId || 'recovered-legacy',
            startedAt: pending.startedAt, endedAt: new Date(pending.savedAt).toISOString(),
            appVersion: pending.appVersion || 'unknown', device: pending.device || 'unknown',
            context: pending.context, actor, events: pending.events });
          window.localStorage.removeItem(key); recoveryRef.current.delete(key);
        } catch { /* Keep the original disk batch for a later recovery attempt. */ }
      }
      if (account !== accountRef.current || !activeRef.current) return;
      await OperationalAuditService.writeSummary({
        sessionId,
        startedAt,
        endedAt: new Date().toISOString(),
        appVersion,
        device: getDeviceClass(),
        context,
        actor,
        events,
      });
      if (account === accountRef.current && activeRef.current) persist();
      else window.localStorage.removeItem(pendingKey);
    } catch {
      if (account !== accountRef.current || !activeRef.current) return;
      events.forEach(event => {
        const key = operationalEventKey(event);
        bufferRef.current.set(key, mergeOperationalEvent(bufferRef.current.get(key), event));
      });
      startedAtRef.current = startedAt;
      persist();
    } finally {
      flushingRef.current = false;
    }
  }, [persist, recordRouteTime, resumeRouteTimer]);

  useEffect(() => {
    activeRef.current = Boolean(isAuthenticated && user);
    if (!activeRef.current || !user) return;

    const accountChanged = accountRef.current !== user.id;
    if (accountRef.current && accountChanged) {
      bufferRef.current.clear(); recoveryRef.current.clear(); entryEpochRef.current = performance.now();
      routeVisibleElapsedRef.current = 0;
    }
    accountRef.current = user.id;
    let firstSetup: boolean | undefined;
    try { firstSetup = localStorage.getItem(workspaceSetupMarker(workspaceSetupScope(user.id, user.role))) !== 'complete'; } catch { /* Unknown if storage is restricted. */ }
    if (!contextRef.current || accountChanged) contextRef.current = auditRuntimeContext({ userAgent: navigator.userAgent,
      native: Boolean(window.TrinityOffline), standalone: window.matchMedia('(display-mode: standalone)').matches
        || !!(navigator as Navigator & { standalone?: boolean }).standalone, firstSetup });

    actorRef.current = {
      id: user.id,
      username: user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Signed-in user',
      role: user.role,
    };
    sessionIdRef.current = getSessionId();
    pendingKeyRef.current = `${PENDING_PREFIX}${user.id}:${sessionIdRef.current}:${appVersion}:${contextRef.current.startup}`;
    startedAtRef.current = new Date().toISOString();

    const matchingPrefix = `${PENDING_PREFIX}${user.id}:`;
    const pendingKeys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith(matchingPrefix)));
    pendingKeys.forEach(key => {
      try {
        const pending = JSON.parse(window.localStorage.getItem(key) || '') as PendingPayload;
        const isCurrentSession = key.startsWith(`${matchingPrefix}${sessionIdRef.current}`);
        const isAbandonedSession = typeof pending.savedAt === 'number' && Date.now() - pending.savedAt > 10 * 60 * 1000;
        if (!isCurrentSession && !isAbandonedSession) return;
        if (!Array.isArray(pending.events) || !Number.isFinite(pending.savedAt)) return;
        if (key !== pendingKeyRef.current) { recoveryRef.current.set(key, pending); return; }
        if (pending.startedAt < startedAtRef.current) startedAtRef.current = pending.startedAt;
        if (bufferRef.current.size === 0) pending.events.forEach(event => {
          const eventKey = operationalEventKey(event);
          bufferRef.current.set(eventKey, mergeOperationalEvent(bufferRef.current.get(eventKey), event));
        });
      } catch {
        // Ignore invalid telemetry only; application data is never stored here.
      }
    });
    persist();
    addEvent({
      kind: 'activity',
      name: 'session_active',
      severity: 'info',
      route: routeRef.current,
      source: 'browser',
    });

    return () => {
      recordRouteTime(routeRef.current);
      persist();
      activeRef.current = false;
    };
  }, [addEvent, isAuthenticated, persist, recordRouteTime, resumeRouteTimer, user]);

  useEffect(() => {
    if (!activeRef.current) return;
    const previousRoute = routeRef.current;
    const nextRoute = sanitizeAuditRoute(pathname);
    if (previousRoute && previousRoute !== nextRoute) recordRouteTime(previousRoute);
    routeRef.current = nextRoute;
    routeHistoryRef.current.push({ startedAt: performance.now(), route: nextRoute });
    routeHistoryRef.current = routeHistoryRef.current.slice(-30);
    resumeRouteTimer();
  }, [pathname, recordRouteTime, resumeRouteTimer]);

  useEffect(() => {
    if (!activeRef.current) return;
    const queryStarts = new Map<string, { startedAt: number; route: string; firstAt: string }>();
    const mutationStarts = new Map<number, { startedAt: number; route: string; firstAt: string }>();

    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      const observed = event.query;
      const hash = observed.queryHash;
      if (observed.state.fetchStatus === 'fetching') {
        if (!queryStarts.has(hash)) {
          queryStarts.set(hash, { startedAt: performance.now(), route: routeRef.current, firstAt: new Date().toISOString() });
          activeOperationsRef.current += 1;
        }
        return;
      }
      const operation = queryStarts.get(hash);
      if (!operation) return;
      queryStarts.delete(hash);
      activeOperationsRef.current = Math.max(0, activeOperationsRef.current - 1);
      const duration = Math.max(0, performance.now() - operation.startedAt);
      const failed = observed.state.status === 'error';
      const details = failed ? errorDetails(observed.state.error) : {};
      addEvent({
        kind: failed ? 'error' : 'performance',
        name: `query:${auditQueryFamily(observed.queryKey)}`,
        severity: failed ? 'error' : duration >= SLOW_OPERATION_MS ? 'warning' : 'info',
        route: operation.route,
        source: 'react-query',
        firstAt: operation.firstAt,
        totalMs: duration,
        minMs: duration,
        maxMs: duration,
        ...details,
      });
    });

    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      const observed = event.mutation;
      if (!observed) return;
      const id = observed.mutationId;
      if (observed.state.status === 'pending') {
        if (!mutationStarts.has(id)) {
          mutationStarts.set(id, { startedAt: performance.now(), route: routeRef.current, firstAt: new Date().toISOString() });
          activeOperationsRef.current += 1;
        }
        return;
      }
      const operation = mutationStarts.get(id);
      if (!operation) return;
      mutationStarts.delete(id);
      activeOperationsRef.current = Math.max(0, activeOperationsRef.current - 1);
      const duration = Math.max(0, performance.now() - operation.startedAt);
      const failed = observed.state.status === 'error';
      const mutationKey = Array.isArray(observed.options.mutationKey) ? observed.options.mutationKey : ['unnamed-mutation'];
      const details = failed ? errorDetails(observed.state.error) : {};
      addEvent({
        kind: failed ? 'error' : 'performance',
        name: `mutation:${auditQueryFamily(mutationKey)}`,
        severity: failed ? 'error' : duration >= SLOW_OPERATION_MS ? 'warning' : 'info',
        route: operation.route,
        source: 'react-query',
        firstAt: operation.firstAt,
        totalMs: duration,
        minMs: duration,
        maxMs: duration,
        ...details,
      });
    });

    return () => {
      activeOperationsRef.current = Math.max(
        0,
        activeOperationsRef.current - queryStarts.size - mutationStarts.size,
      );
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [addEvent, isAuthenticated, queryClient, user]);

  useEffect(() => {
    if (!activeRef.current) return;
    const onError = (event: ErrorEvent) => addEvent({
      kind: 'error',
      name: 'javascript_error',
      severity: 'error',
      route: routeRef.current,
      source: 'window',
      message: sanitizeAuditText(event.message),
    });
    const onRejection = (event: PromiseRejectionEvent) => {
      const details = errorDetails(event.reason);
      addEvent({
        kind: 'error',
        name: 'unhandled_promise',
        severity: 'error',
        route: routeRef.current,
        source: 'window',
        ...details,
      });
    };
    const connectionType = () => {
      const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
      return sanitizeAuditText(connection?.effectiveType, 20) || 'unknown';
    };
    const onOffline = () => {
      if (offlineEpisodeRef.current) return;
      offlineEpisodeRef.current = {
        startedAt: Date.now(),
        route: routeRef.current,
        visibility: document.visibilityState,
        activeOperations: activeOperationsRef.current,
      };
      addEvent({
        kind: 'network',
        name: 'offline_started',
        severity: 'warning',
        route: routeRef.current,
        source: `browser:${connectionType()}`,
        message: `Connection was lost while the tab was ${document.visibilityState}; ${activeOperationsRef.current} tracked operation(s) were active.`,
      });
    };
    const onOnline = () => {
      const episode = offlineEpisodeRef.current;
      offlineEpisodeRef.current = null;
      const duration = episode ? Math.max(0, Date.now() - episode.startedAt) : undefined;
      addEvent({
        kind: 'network',
        name: 'online_recovered',
        severity: 'info',
        route: episode?.route || routeRef.current,
        source: `browser:${connectionType()}`,
        message: episode
          ? `Connection recovered; it began while the tab was ${episode.visibility} with ${episode.activeOperations} tracked operation(s) active.`
          : 'Connection recovered after an interruption that began before this audit session.',
        totalMs: duration,
        minMs: duration,
        maxMs: duration,
      });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [addEvent, isAuthenticated, user]);

  useEffect(() => {
    if (!activeRef.current || typeof PerformanceObserver === 'undefined') return;
    const observers: PerformanceObserver[] = [];
    let disposeFallback = () => {};
    const observeOnce = (entry: PerformanceEntry) => {
      if (entry.startTime < entryEpochRef.current || observedEntriesRef.current.has(entry)) return false;
      observedEntriesRef.current.add(entry); return true;
    };
    const observation = (entry: PerformanceEntry) => auditObservationWindow(entry.startTime, entry.duration, performance.timeOrigin);
    try {
      const workspaceObserver = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          if (!entry.name.startsWith('trinity:workspace:')) return;
          if (!observeOnce(entry)) return;
          const detail = (entry as PerformanceMeasure).detail as { route?: string; observedEnd?: number } | null;
          addEvent({
            kind: 'performance',
            name: entry.name.slice('trinity:'.length),
            severity: entry.duration >= SLOW_OPERATION_MS ? 'warning' : 'info',
            route: detail?.route || routeRef.current,
            source: 'workspace-timing',
            totalMs: entry.duration, minMs: entry.duration, maxMs: entry.duration,
            ...auditObservationWindow(entry.startTime,
              typeof detail?.observedEnd === 'number' && Number.isFinite(detail.observedEnd) && detail.observedEnd >= entry.startTime
                ? detail.observedEnd - entry.startTime : entry.duration, performance.timeOrigin),
          });
        });
      });
      workspaceObserver.observe({ type: 'measure', buffered: true });
      observers.push(workspaceObserver);
    } catch { /* User Timing observers are unavailable in some WebViews. */ }
    try {
      const longTaskObserver = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          if (entry.duration < 50 || document.visibilityState !== 'visible') return;
          if (!observeOnce(entry)) return;
          addEvent({
            kind: 'performance',
            name: 'browser_long_task',
            severity: entry.duration >= 200 ? 'warning' : 'info',
            route: routeRef.current,
            source: 'browser',
            totalMs: entry.duration,
            minMs: entry.duration,
            maxMs: entry.duration,
            ...observation(entry),
          });
        });
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      observers.push(longTaskObserver);
    } catch { /* unsupported performance entry type */ }

    let interactionSupported = PerformanceObserver.supportedEntryTypes?.includes('event') || false;
    try {
      if (!interactionSupported) throw new Error('Event Timing unavailable');
      const interactionObserver = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          if (!['click', 'keydown'].includes(entry.name) || document.visibilityState !== 'visible') return;
          if (!observeOnce(entry)) return;
          const timing = entry as PerformanceEventTiming;
          addEvent({
            kind: 'performance', name: 'interaction-to-paint',
            severity: entry.duration >= 200 ? 'warning' : 'info',
            route: routeRef.current, source: 'browser',
            totalMs: entry.duration, minMs: entry.duration, maxMs: entry.duration,
            ...observation(entry),
          });
          const inputDelay = Math.max(0, timing.processingStart - timing.startTime);
          addEvent({ kind: 'performance', name: 'interaction-input-delay', severity: inputDelay >= 200 ? 'warning' : 'info',
            route: routeRef.current, source: 'browser', totalMs: inputDelay, minMs: inputDelay, maxMs: inputDelay, ...observation(entry) });
        });
      });
      interactionObserver.observe({ type: 'event', durationThreshold: 40 } as PerformanceObserverInit);
      observers.push(interactionObserver);
    } catch { interactionSupported = false; }

    if (!interactionSupported) {
      const scheduled = new Set<() => void>();
      const onClick = () => {
        if (document.visibilityState !== 'visible') return;
        const start = performance.now(), route = routeRef.current;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const cancel = () => { cancelAnimationFrame(frame); clearTimeout(timer); };
        const frame = requestAnimationFrame(() => { timer = setTimeout(() => {
          scheduled.delete(cancel);
          const duration = performance.now() - start;
          if (duration < 40 || document.visibilityState !== 'visible') return;
          addEvent({ kind: 'performance', name: 'click-handler-to-paint-opportunity', route, source: 'browser-fallback',
            severity: duration >= 200 ? 'warning' : 'info', totalMs: duration, minMs: duration, maxMs: duration,
            ...auditObservationWindow(start, duration, performance.timeOrigin) });
        }, 0); });
        scheduled.add(cancel);
      };
      window.addEventListener('click', onClick, true);
      disposeFallback = () => { window.removeEventListener('click', onClick, true); scheduled.forEach(cancel => cancel()); };
    }

    try {
      const resourceObserver = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          const resource = entry as PerformanceResourceTiming;
          if (resource.duration < SLOW_OPERATION_MS || isOperationalAuditTransportResource(resource.name)) return;
          if (!observeOnce(entry)) return;
          let target = 'resource';
          try {
            const url = new URL(resource.name);
            target = `${url.hostname}${sanitizeAuditRoute(url.pathname)}`.slice(0, 120);
          } catch { /* retain generic target */ }
          const startingRoute = [...routeHistoryRef.current]
            .reverse()
            .find(item => item.startedAt <= resource.startTime)?.route || routeRef.current;
          addEvent({
            kind: 'performance',
            name: `resource:${resource.initiatorType || 'other'}`,
            severity: 'warning',
            route: startingRoute,
            source: target,
            totalMs: resource.duration,
            minMs: resource.duration,
            maxMs: resource.duration,
            ...observation(entry),
          });
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      observers.push(resourceObserver);
    } catch { /* unsupported performance entry type */ }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.duration && !navigationRecordedRef.current) {
      navigationRecordedRef.current = true;
      addEvent({
        kind: 'performance',
        name: 'page_load',
        severity: navigation.duration >= 4000 ? 'warning' : 'info',
        route: routeRef.current,
        source: 'navigation',
        totalMs: navigation.duration,
        minMs: navigation.duration,
        maxMs: navigation.duration,
        ...observation(navigation),
      });
    }
    return () => { observers.forEach(observer => observer.disconnect()); disposeFallback(); };
  }, [addEvent, isAuthenticated, user]);

  useEffect(() => {
    if (!activeRef.current || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('trinity-operational-audit');
    let recorded = false;
    channel.onmessage = event => {
      if (event.data?.type === 'hello' && event.data?.sessionId !== sessionIdRef.current) {
        channel.postMessage({ type: 'present', sessionId: sessionIdRef.current });
      }
      if (!recorded && event.data?.type === 'present' && event.data?.sessionId !== sessionIdRef.current) {
        recorded = true;
        addEvent({
          kind: 'coordination',
          name: 'multiple_tabs_active',
          severity: 'info',
          route: routeRef.current,
          source: 'browser',
          message: 'The same browser had more than one application tab active.',
        });
      }
    };
    channel.postMessage({ type: 'hello', sessionId: sessionIdRef.current });
    return () => channel.close();
  }, [addEvent, isAuthenticated, user]);

  useEffect(() => {
    if (!activeRef.current) return;
    const persistTimer = window.setInterval(persist, PERSIST_INTERVAL_MS);
    const flushTimer = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    const flushIsDue = (allowImportantEarlyFlush: boolean) => {
      const age = Date.now() - new Date(startedAtRef.current).getTime();
      if (age >= FLUSH_INTERVAL_MS) return true;
      if (age < MIN_EARLY_FLUSH_MS || !allowImportantEarlyFlush) return false;
      return [...bufferRef.current.values()].some(event => event.severity !== 'info');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pauseRouteTimer();
      else resumeRouteTimer();
      persist();
      if (document.visibilityState === 'visible' && navigator.onLine && flushIsDue(false)) void flush();
    };
    const onPageHide = () => {
      recordRouteTime(routeRef.current);
      persist();
      if (navigator.onLine && flushIsDue(true)) void flush();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(persistTimer);
      window.clearInterval(flushTimer);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      persist();
    };
  }, [flush, isAuthenticated, pauseRouteTimer, persist, recordRouteTime, resumeRouteTimer, user]);

  return null;
}
