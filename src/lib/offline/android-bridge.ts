type Reply = { id: string; success: boolean; error?: string; session?: import('./android-contracts').AndroidOfflineSession };
type Bridge = { postMessage: (message: string) => void; onmessage?: (event: { data: string }) => void };
declare global { interface Window { TrinityOffline?: Bridge } }
const pending = new Map<string, { resolve: (reply: Reply) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let attached: Bridge | undefined;

export function hasAndroidOfflineBridge() { return typeof window !== 'undefined' && Boolean(window.TrinityOffline); }

export async function androidOfflineRequest(action: string, data: Record<string, unknown> = {}): Promise<Reply> {
  const bridge = typeof window !== 'undefined' ? window.TrinityOffline : undefined;
  if (!bridge) throw new Error('Android offline access is unavailable.');
  if (attached !== bridge) {
    attached = bridge;
    bridge.onmessage = event => {
      try {
        const reply = JSON.parse(event.data) as Reply;
        const entry = pending.get(reply.id);
        if (!entry) return;
        clearTimeout(entry.timer); pending.delete(reply.id);
        if (reply.success) entry.resolve(reply);
        else entry.reject(new Error(reply.error || 'Android offline preparation failed.'));
      } catch { /* Ignore malformed/unrelated native messages. */ }
    };
  }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Android offline preparation timed out.')); }, 30_000);
    pending.set(id, { resolve, reject, timer });
    try { bridge.postMessage(JSON.stringify({ id, action, ...data })); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}

/** Called before logout/account clearing, even if the app is currently offline. */
export async function clearAndroidOfflineAccess() {
  if (hasAndroidOfflineBridge()) await androidOfflineRequest('clear');
}
