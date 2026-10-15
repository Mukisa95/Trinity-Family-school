type Reply = { id: string; ok: boolean; supported?: boolean; userId?: string; error?: string };
type Bridge = { postMessage(message: string): void; onmessage?: (event: { data: string }) => void };
declare global { interface Window { TrinityDeviceUnlock?: Bridge } }

const pending = new Map<string, { resolve(value: Reply): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
let attached: Bridge | undefined;
export function hasNativeDeviceUnlock() {
  return typeof window !== 'undefined' && Boolean(window.TrinityDeviceUnlock);
}

function request(action: string, userId?: string): Promise<Reply> {
  const bridge = typeof window !== 'undefined' ? window.TrinityDeviceUnlock : undefined;
  if (!bridge) return Promise.reject(new Error('Update the Android app to use device unlock.'));
  if (attached !== bridge) {
    attached = bridge;
    bridge.onmessage = event => {
      try {
        const reply = JSON.parse(event.data) as Reply;
        const entry = pending.get(reply.id);
        if (!entry) return;
        pending.delete(reply.id); clearTimeout(entry.timer);
        if (reply.ok === true) entry.resolve(reply);
        else entry.reject(new Error(reply.error || 'Access remains locked.'));
      } catch { /* Ignore unrelated or malformed responses. */ }
    };
  }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      if (action === 'authenticate') {
        try { bridge.postMessage(JSON.stringify({ id: crypto.randomUUID(), action: 'cancel' })); } catch { /* Closed document. */ }
      }
      reject(new Error('Device unlock timed out. Please try again.'));
    }, action === 'status' ? 5_000 : 120_000);
    pending.set(id, { resolve, reject, timer });
    try { bridge.postMessage(JSON.stringify({ id, action, userId })); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}

export async function nativeDeviceUnlockAvailable() {
  return hasNativeDeviceUnlock() && (await request('status')).supported === true;
}
export async function authenticateNativeDevice(userId: string) {
  const result = await request('authenticate', userId);
  if (result.userId !== userId) throw new Error('This unlock does not belong to the current session.');
  return true;
}
