import { test } from "node:test";
import assert from "node:assert/strict";
import { nativePhotoRequest, validateNativePhotoUrl, canSharePhoto, isPhotoActionCancelled } from "../src/lib/photo/external-photo-apps";

test("native camera results only use private opaque same-origin photo URLs", () => {
  const origin = "https://trinityfamilyschool.vercel.app";
  const path = "/__native_photo/10fd9272-f097-4b03-9b12-6048e72d3d7a.jpg";
  assert.equal(validateNativePhotoUrl(path, origin), origin + path);
  for (const value of ["https://evil.test" + path, "/private/photo.jpg", "file:///private/photo.jpg", path + "?photo=other", path + "#other", "/__native_photo/../../private.jpg"]) {
    assert.throws(() => validateNativePhotoUrl(value, origin));
  }
});

test("native requests correlate responses and ignore stale results after cancellation", async () => {
  let sent: { id: string; action: string }[] = [];
  const bridge = { onmessage: null as ((event: { data: string }) => void) | null, postMessage(message: string) { sent.push(JSON.parse(message)); } };
  (globalThis as any).window = { TrinityPhoto: bridge };
  const abort = new AbortController();
  const first = nativePhotoRequest("capture", { cameraId: "test.camera/Capture" }, abort.signal);
  const second = nativePhotoRequest("cameras");
  bridge.onmessage!({ data: "malformed" });
  bridge.onmessage!({ data: JSON.stringify({ id: sent[1].id, ok: true, apiVersion: 1, cameras: [] }) });
  assert.equal((await second).apiVersion, 1);
  abort.abort();
  await assert.rejects(first, error => isPhotoActionCancelled(error));
  bridge.onmessage!({ data: JSON.stringify({ id: sent[0].id, ok: true, photoUrl: "/unexpected" }) });
  const third = nativePhotoRequest("capture");
  bridge.onmessage!({ data: JSON.stringify({ id: sent[2].id, ok: false, error: "Camera removed" }) });
  await assert.rejects(third, /Camera removed/);
  const cancelled = nativePhotoRequest("capture");
  bridge.onmessage!({ data: JSON.stringify({ id: sent[3].id, ok: true, cancelled: true }) });
  assert.equal((await cancelled).cancelled, true);
  delete (globalThis as any).window;
});

test("file sharing requires actual file support and handles browser failures", () => {
  const file = new File(["jpeg"], "source.jpg", { type: "image/jpeg" });
  const navigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share() {}, canShare: () => false } });
  assert.equal(canSharePhoto(file), false);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share() {}, canShare: () => true } });
  assert.equal(canSharePhoto(file), true);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share() {}, canShare() { throw new Error("Denied"); } } });
  assert.equal(canSharePhoto(file), false);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigator });
});
