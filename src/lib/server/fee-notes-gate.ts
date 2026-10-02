import 'server-only';
import {createHash} from 'crypto';
import {getFirebaseAdminApp} from '@/lib/firebase-admin';

// This gate deliberately lives outside Firestore. Missing settings mean off.
// Use the server namespace so pupil switches are never exposed to app clients.
const PARAMETER = 'fee_notes_enabled_pupils';
type Template = {parameters?: Record<string, any>; [key: string]: any};
export type FeeNotesGate = {anyEnabled: boolean; isEnabled: (pupilId: string) => boolean};
let pending: Promise<{template: Template; etag: string; url: string; token: string}> | undefined;
const fingerprint = (pupilId: string) => createHash('sha256').update(pupilId).digest('hex');
async function fetchTemplate() {
  const app = getFirebaseAdminApp();
  if (!app.options.projectId || !app.options.credential) throw new Error('Fee notes switch service is unavailable.');
  const {access_token: token} = await app.options.credential.getAccessToken();
  const url = `https://firebaseremoteconfig.googleapis.com/v1/projects/${encodeURIComponent(app.options.projectId)}/namespaces/firebase-server/remoteConfig`;
  const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}, cache: 'no-store', signal: AbortSignal.timeout(8_000)});
  if (!response.ok) throw new Error(`Fee notes switch lookup failed (${response.status}).`);
  return {template: await response.json() as Template, etag: response.headers.get('etag') || '', url, token};
}
function switches(template: Template): string[] {
  const raw = template.parameters?.[PARAMETER]?.defaultValue?.value;
  if (raw === undefined) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) throw new Error('Invalid fee notes switch configuration.');
  return value;
}
export async function readFeeNotesGate(): Promise<FeeNotesGate> {
  // Coalesce simultaneous requests only. A completed lookup is never cached:
  // another server instance must see a switch-off immediately on its next call.
  const request = pending ||= fetchTemplate();
  try {
    const {template} = await request, enabled = new Set(switches(template));
    return {anyEnabled: enabled.size > 0, isEnabled: pupilId => enabled.has(fingerprint(pupilId))};
  } finally {if (pending === request) pending = undefined;}
}
export async function publishFeeNotesSwitch(pupilId: string, enabled: boolean) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const {template, etag, url, token} = await fetchTemplate();
    if (!etag) throw new Error('Fee notes switch version is unavailable.');
    const ids = new Set(switches(template)), id = fingerprint(pupilId);
    if (enabled) ids.add(id); else ids.delete(id);
    const updated = {...template, parameters: {...template.parameters,
      [PARAMETER]: {defaultValue: {value: JSON.stringify([...ids].sort())}, valueType: 'STRING', description: 'Explicitly enabled pupil fee notes; absent pupils are off.'}}};
    const response = await fetch(url, {method: 'PUT', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'If-Match': etag},
      body: JSON.stringify(updated), signal: AbortSignal.timeout(8_000)});
    if ([409, 412].includes(response.status)) continue;
    if (!response.ok) throw new Error(`Unable to save the fee notes switch (${response.status}).`);
    pending = undefined;
    return;
  }
  throw new Error('Another user changed a notes switch. Please try again.');
}
