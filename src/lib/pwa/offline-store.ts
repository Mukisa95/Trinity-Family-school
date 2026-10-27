import { isAndroidOfflineSnapshot, type AndroidOfflineSession, type AndroidOfflineSnapshot } from '@/lib/offline/android-contracts';
import { offlineSections, type OfflineSection } from './sections';

const DATABASE = 'trinity-home-screen-v1';
const KEY = 'workspace';
const CHANGED = 'trinity-pwa-offline-changed';
type SavedWorkspace = { session: AndroidOfflineSession; snapshot?: AndroidOfflineSnapshot; sections?: OfflineSection[]; shellBuild?: string; shellPreparedAt?: string };
let generation = 0;
let connection: Promise<IDBDatabase> | undefined;

function database() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = undefined; };
      resolve(db);
    };
    request.onerror = () => { connection = undefined; reject(new Error('Saved storage is unavailable.')); };
    request.onblocked = () => { connection = undefined; reject(new Error('Close other school app windows and try again.')); };
  });
  return connection;
}

async function update<T>(operation: (store: IDBObjectStore, done: (value: T) => void) => void, mode: IDBTransactionMode = 'readwrite'): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('workspace', mode);
    let result: T;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = transaction.onabort = () => reject(new Error('Unable to save offline access. Check available iPhone storage.'));
    try { operation(transaction.objectStore('workspace'), value => { result = value; }); }
    catch { transaction.abort(); }
  });
}

function validSession(value: unknown): value is AndroidOfflineSession {
  const session = value as AndroidOfflineSession | null;
  return !!session && session.schema === 1 && typeof session.accountId === 'string' && typeof session.role === 'string'
    && typeof session.timeZone === 'string' && Number.isFinite(Date.parse(session.issuedAt))
    && Date.parse(session.expiresAt) > Date.now() && Date.parse(session.expiresAt) - Date.parse(session.issuedAt) <= 7 * 86400_000
    && Array.isArray(session.pupilIds) && session.pupilIds.every(id => typeof id === 'string')
    && !!session.grants && ['dashboard', 'pupils', 'timetable'].every(key => typeof session.grants[key as 'dashboard'] === 'boolean')
    && Array.isArray(session.grants.pupilFields) && Array.isArray(session.grants.dashboardCounts);
}

function loadSaved(store: IDBObjectStore, callback: (saved?: SavedWorkspace) => void) {
  const request = store.get(KEY);
  request.onsuccess = () => {
    try { callback(request.result as SavedWorkspace | undefined); }
    catch { store.transaction.abort(); }
  };
}

function announce() { window.dispatchEvent(new Event(CHANGED)); }

export async function clearBrowserOfflineAccess() {
  generation++;
  await update<void>((store, done) => { store.delete(KEY); done(); });
  announce();
}

export async function readBrowserWorkspace(): Promise<SavedWorkspace | null> {
  return update<SavedWorkspace | null>((store, done) => {
    loadSaved(store, saved => {
      done(saved && validSession(saved.session) ? saved : null);
    });
  }, 'readonly');
}

/** Same server-derived grants as Android; credentials are never written to disk. */
export async function browserOfflineRequest(action: string, data: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  if (action === 'clear') { await clearBrowserOfflineAccess(); return { id, success: true }; }
  if (action === 'connect') {
    const captured = ++generation;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch('/api/offline/session', { cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${String(data.token || '')}`, 'X-Trinity-Offline-Features': 'events,duty-service' } });
      if (captured !== generation) throw new Error('The account changed during preparation.');
      if (response.status === 401 || response.status === 403) await clearBrowserOfflineAccess();
      if (!response.ok) throw new Error('Connect and sign in to prepare offline access.');
      const session: unknown = await response.json();
      if (!validSession(session) || session.accountId !== data.accountId) throw new Error('The saved access response was invalid.');
      await update<void>((store, done) => {
        if (captured !== generation) throw new Error('The account changed during preparation.');
        loadSaved(store, old => {
          const sameAccess = old && old.session.accountId === session.accountId && old.session.role === session.role
            && JSON.stringify(old.session.grants) === JSON.stringify(session.grants)
            && JSON.stringify(old.session.circumference) === JSON.stringify(session.circumference)
            && JSON.stringify(old.session.pupilIds) === JSON.stringify(session.pupilIds);
          store.put({ ...(sameAccess ? old : {}), session }, KEY); done();
        });
      });
      announce();
      return { id, success: true, session };
    } finally { clearTimeout(timer); }
  }
  if (action === 'save' || action === 'shellReady') {
    const captured = generation;
    await update<void>((store, done) => {
      loadSaved(store, saved => {
        if (captured !== generation || !saved || !validSession(saved.session)) { store.transaction.abort(); return; }
        if (action === 'save') {
          if (!isAndroidOfflineSnapshot(data.snapshot, saved.session)) { store.transaction.abort(); return; }
          saved.sections = offlineSections(saved.session, data.snapshot);
          // The pages already own protected pupil/parent caches. The companion
          // needs only a small agenda, never another copy of photos or fee data.
          const agenda = { ...data.snapshot.datasets };
          delete agenda.pupils; delete agenda.parent; delete agenda.teachers;
          saved.snapshot = saved.session.role === 'Parent' ? undefined : { ...data.snapshot, datasets: agenda };
        } else { saved.shellBuild = String(data.build || ''); saved.shellPreparedAt = new Date().toISOString(); }
        store.put(saved, KEY); done();
      });
    });
    announce();
    return { id, success: true };
  }
  if (action === 'status') return { id, success: true, session: (await readBrowserWorkspace())?.session };
  throw new Error('This device feature requires the Android app.');
}
