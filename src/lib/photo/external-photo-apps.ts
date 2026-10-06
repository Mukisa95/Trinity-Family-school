export interface CameraApp { id: string; label: string }
interface NativeReply { id: string; ok: boolean; cancelled?: boolean; error?: string; cameras?: CameraApp[]; photoUrl?: string; apiVersion?: number }
interface PhotoBridge { postMessage: (message: string) => void; onmessage: ((event: { data: string }) => void) | null }
declare global { interface Window { TrinityPhoto?: PhotoBridge } }

const pending = new Map<string, { resolve: (value: NativeReply) => void; reject: (error: Error) => void }>();
let installedBridge: PhotoBridge | undefined;

export function hasNativePhotoBridge() {
  return typeof window !== "undefined" && typeof window.TrinityPhoto?.postMessage === "function";
}

export function nativePhotoRequest(action: "cameras" | "capture" | "share", payload: Record<string, unknown> = {}, signal?: AbortSignal): Promise<NativeReply> {
  const bridge = typeof window !== "undefined" ? window.TrinityPhoto : undefined;
  if (!bridge) return Promise.reject(new Error("Camera app selection requires the Trinity Android companion."));
  if (signal?.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  if (installedBridge !== bridge) {
    installedBridge = bridge;
    bridge.onmessage = event => {
      try {
        const reply = JSON.parse(event.data) as NativeReply;
        if (typeof reply.id !== "string") return;
        const request = pending.get(reply.id);
        if (!request) return;
        if (reply.ok || reply.cancelled) request.resolve(reply);
        else request.reject(new Error(reply.error || "The phone could not complete this action."));
      } catch { /* Ignore unrelated or malformed messages. */ }
    };
  }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); pending.delete(id); signal?.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("The camera did not return a photo. Try again or upload the saved photo.")); }, action === "capture" ? 300_000 : 15_000);
    pending.set(id, { resolve: value => { cleanup(); resolve(value); }, reject: error => { cleanup(); reject(error); } });
    signal?.addEventListener("abort", abort, { once: true });
    try { bridge.postMessage(JSON.stringify({ id, action, ...payload })); }
    catch (error) { cleanup(); reject(error instanceof Error ? error : new Error("Unable to contact the phone.")); }
  });
}

// A native result must come from the companion's private, same-origin endpoint.
// Never fetch a URL supplied by a camera app or a different website.
export function validateNativePhotoUrl(value: string, origin: string): string {
  const url = new URL(value, origin);
  if (url.origin !== origin || !/^\/__native_photo\/[0-9a-f-]{36}\.jpg$/.test(url.pathname) || url.search || url.hash) {
    throw new Error("The camera returned an invalid photo address.");
  }
  return url.href;
}

export async function captureWithCamera(cameraId: string, signal: AbortSignal): Promise<File | undefined> {
  const reply = await nativePhotoRequest("capture", { cameraId }, signal);
  if (reply.cancelled || signal.aborted) return undefined;
  if (!reply.photoUrl) throw new Error("The camera did not return a full-size photo.");
  const url = validateNativePhotoUrl(reply.photoUrl, window.location.origin);
  const response = await fetch(url, { signal, cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error("The camera photo expired. Please take it again.");
  const blob = await response.blob();
  if (!blob.size || blob.size > 30 * 1024 * 1024 || blob.type !== "image/jpeg") throw new Error("The camera returned an unsupported photo.");
  return new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
}

export function canSharePhoto(file: File): boolean {
  if (hasNativePhotoBridge()) return true;
  try { return typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }) === true; }
  catch { return false; }
}

export function isPhotoActionCancelled(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
