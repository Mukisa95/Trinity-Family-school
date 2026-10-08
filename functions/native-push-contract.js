"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/server/native-push-contract.ts
var native_push_contract_exports = {};
__export(native_push_contract_exports, {
  assertNativeSchool: () => assertNativeSchool,
  expiredNativeToken: () => expiredNativeToken,
  nativeBindingOwner: () => nativeBindingOwner,
  nativeDeviceId: () => nativeDeviceId,
  nativeDeviceInput: () => nativeDeviceInput,
  nativeMessageData: () => nativeMessageData,
  nativeSecretHash: () => nativeSecretHash,
  nativeSecretMatches: () => nativeSecretMatches
});
module.exports = __toCommonJS(native_push_contract_exports);
var import_node_crypto = require("node:crypto");
function nativeDeviceInput(value, tokenRequired = true) {
  const input = value;
  if (!input || typeof input.installationId !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input.installationId) || typeof input.deviceSecret !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.deviceSecret) || typeof input.applicationId !== "string" || !/^[a-z][a-z0-9_.]{5,180}$/.test(input.applicationId) || typeof input.projectId !== "string" || !/^[a-z][a-z0-9-]{4,100}$/.test(input.projectId) || tokenRequired && (typeof input.token !== "string" || !/^[A-Za-z0-9:_-]{80,4096}$/.test(input.token))) throw new Error("INVALID_NATIVE_DEVICE");
  return {
    installationId: input.installationId,
    deviceSecret: input.deviceSecret,
    applicationId: input.applicationId,
    projectId: input.projectId,
    ...tokenRequired ? { token: input.token } : {}
  };
}
var nativeDeviceId = (input) => `native-${(0, import_node_crypto.createHash)("sha256").update(`${input.applicationId}:${input.installationId}`).digest("hex")}`;
var nativeSecretHash = (secret) => (0, import_node_crypto.createHash)("sha256").update(secret).digest("hex");
function nativeSecretMatches(secret, stored) {
  if (typeof stored !== "string" || !/^[a-f0-9]{64}$/.test(stored)) return false;
  return (0, import_node_crypto.timingSafeEqual)(Buffer.from(nativeSecretHash(secret), "hex"), Buffer.from(stored, "hex"));
}
function assertNativeSchool(input, applicationId, projectId, runtimeProjectId) {
  if (input.applicationId !== applicationId || input.projectId !== projectId || input.projectId !== runtimeProjectId) throw new Error("NATIVE_SCHOOL_MISMATCH");
}
function nativeBindingOwner(input, previous, action, verifiedUserId) {
  if (previous && (!nativeSecretMatches(input.deviceSecret, previous.deviceSecretHash) || previous.transport !== "android-fcm")) throw new Error("NATIVE_DEVICE_PROOF_REQUIRED");
  if (action !== "register" && !previous || action === "rotate" && !previous?.isActive) throw new Error("NATIVE_DEVICE_NOT_REGISTERED");
  if (action === "register" && !verifiedUserId) throw new Error("AUTH_REQUIRED");
  return action === "register" ? verifiedUserId : String(previous.userId);
}
function boundedText(value, bytes) {
  return typeof value === "string" ? Buffer.from(value).subarray(0, bytes).toString("utf8").replace(/\uFFFD$/, "") : "";
}
function nativeMessageData(userId, projectId, payload) {
  const extras = {};
  for (const [key, value] of Object.entries(payload.data || {}).slice(0, 6)) {
    if (/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key) && !/^(google|gcm)/i.test(key)) extras[key] = boundedText(value, 80);
  }
  const url = typeof payload.url === "string" && /^\/(?!\/)/.test(payload.url) && !/[\\\r\n]/.test(payload.url) ? payload.url : "/push-notifications";
  const message = {
    ...extras,
    title: boundedText(payload.title, 200),
    body: boundedText(payload.body, 1500),
    url: boundedText(url, 500),
    tag: boundedText(payload.tag || "school-announcement", 150),
    timestamp: String(payload.timestamp || Date.now()),
    recipientId: userId,
    schoolProjectId: projectId
  };
  while (Buffer.byteLength(JSON.stringify(message)) > 3500 && message.body) message.body = boundedText(message.body, Math.max(0, Buffer.byteLength(message.body) - 200));
  return message;
}
var expiredNativeToken = (code) => code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  assertNativeSchool,
  expiredNativeToken,
  nativeBindingOwner,
  nativeDeviceId,
  nativeDeviceInput,
  nativeMessageData,
  nativeSecretHash,
  nativeSecretMatches
});
