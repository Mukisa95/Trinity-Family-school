import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const targetSchema = z.enum(['production', 'preview', 'development']);
const variableSchema = z.object({
  key: z.string().trim().min(1).max(256).regex(/^[A-Z0-9_]+$/, 'Variable names may only contain A-Z, 0-9, and underscores.'),
  value: z.string().min(1).max(64 * 1024),
  type: z.enum(['plain', 'encrypted', 'sensitive']).default('sensitive'),
  target: z.array(targetSchema).min(1).max(3),
  comment: z.string().trim().max(500).optional(),
});

const connectionSchema = z.object({
  vercelToken: z.string().trim().min(10).max(2048),
  projectId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._-]+$/),
  teamId: z.string().trim().max(160).optional().default(''),
});

const requestSchema = z.discriminatedUnion('action', [
  connectionSchema.extend({ action: z.literal('inspect') }),
  connectionSchema.extend({
    action: z.literal('upsert'),
    variables: z.array(variableSchema).min(1).max(75),
    preserveExisting: z.boolean().default(true),
  }),
  connectionSchema.extend({
    action: z.literal('seedFirebase'),
    webConfigJson: z.string().min(2).max(24 * 1024),
    serviceAccountJson: z.string().min(2).max(72 * 1024),
    target: z.array(targetSchema).min(1).max(3),
    preserveExisting: z.boolean().default(true),
  }),
  z.object({
    action: z.literal('deploy'),
    deployHookUrl: z.string().url().max(2048),
  }),
]);

type VercelEnvironmentVariable = {
  id?: string;
  key?: string;
  type?: string;
  target?: string[];
  gitBranch?: string;
  createdAt?: number;
  updatedAt?: number;
};

const attempts = new Map<string, { count: number; resetAt: number }>();
const ATTEMPT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 30;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function requestFingerprint(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function withinRateLimit(request: NextRequest) {
  const key = requestFingerprint(request);
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_ATTEMPTS_PER_WINDOW;
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const originUrl = new URL(origin);
  if (originUrl.host !== request.nextUrl.host || originUrl.protocol !== request.nextUrl.protocol) {
    throw new Error('CROSS_ORIGIN_REQUEST');
  }
}

function assertControlSecret(request: NextRequest) {
  const expected = process.env.DEPLOYMENT_CONTROL_SECRET;
  if (!expected || expected.length < 24) throw new Error('CONTROL_NOT_CONFIGURED');

  const supplied = request.headers.get('x-deployment-control-secret') || '';
  const expectedHash = createHash('sha256').update(expected).digest();
  const suppliedHash = createHash('sha256').update(supplied).digest();
  if (!timingSafeEqual(expectedHash, suppliedHash)) throw new Error('CONTROL_UNAUTHORIZED');
}

function buildVercelUrl(path: string, teamId?: string) {
  const url = new URL(path, 'https://api.vercel.com');
  if (teamId) url.searchParams.set('teamId', teamId);
  return url;
}

async function vercelRequest(
  path: string,
  token: string,
  teamId?: string,
  init: RequestInit = {},
) {
  const response = await fetch(buildVercelUrl(path, teamId), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(25_000),
  });

  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    const code = typeof payload?.error?.code === 'string' ? payload.error.code : 'upstream_error';
    // Deliberately do not relay upstream messages: Vercel validation errors can
    // echo the value that was submitted.
    throw new Error(`VERCEL_${response.status}_${code}`);
  }
  return payload;
}

function environmentList(payload: Record<string, any>): VercelEnvironmentVariable[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.envs)) return payload.envs;
  return [];
}

function publicEnvironmentList(payload: Record<string, any>) {
  return environmentList(payload)
    .filter(item => typeof item.key === 'string')
    .map(item => ({
      id: item.id,
      key: item.key,
      type: item.type || 'encrypted',
      target: Array.isArray(item.target) ? item.target : [],
      gitBranch: item.gitBranch || null,
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
      configured: true,
    }))
    .sort((a, b) => a.key!.localeCompare(b.key!));
}

function validateVariableTargets(variable: z.infer<typeof variableSchema>) {
  if (variable.type === 'sensitive' && variable.target.includes('development')) {
    throw new Error(`Sensitive variable ${variable.key} cannot target Vercel Development.`);
  }
  if (variable.key.startsWith('NEXT_PUBLIC_') && /(PASSWORD|SECRET|PRIVATE|TOKEN|CREDENTIAL|CRON|WEBHOOK)/i.test(variable.key)) {
    throw new Error('PUBLIC_SECRET_NAME_BLOCKED');
  }
  if (variable.key === 'SCHOOLPAY_REQUIRE_WEBHOOK_SIGNATURE' && variable.target.includes('production') && variable.value !== 'true') {
    throw new Error('SCHOOLPAY_SIGNATURE_REQUIRED');
  }
}

async function upsertVariables(
  connection: z.infer<typeof connectionSchema>,
  variables: Array<z.infer<typeof variableSchema>>,
  preserveExisting = true,
) {
  const unique = new Map<string, z.infer<typeof variableSchema>>();
  variables.forEach(variable => {
    validateVariableTargets(variable);
    unique.set(variable.key, { ...variable, target: Array.from(new Set(variable.target)) });
  });

  let variablesToWrite = Array.from(unique.values());
  let skippedKeys: string[] = [];

  if (preserveExisting) {
    const currentEnvironment = await vercelRequest(
      `/v9/projects/${encodeURIComponent(connection.projectId)}/env`,
      connection.vercelToken,
      connection.teamId,
    );
    const existingKeys = new Set(
      environmentList(currentEnvironment)
        .map(item => item.key)
        .filter((key): key is string => typeof key === 'string'),
    );
    skippedKeys = variablesToWrite
      .filter(variable => existingKeys.has(variable.key))
      .map(variable => variable.key)
      .sort();
    variablesToWrite = variablesToWrite.filter(variable => !existingKeys.has(variable.key));
  }

  if (variablesToWrite.length === 0) {
    return { updatedKeys: [] as string[], skippedKeys };
  }

  const query = connection.teamId ? '&teamId=' + encodeURIComponent(connection.teamId) : '';
  await vercelRequest(
    `/v10/projects/${encodeURIComponent(connection.projectId)}/env?upsert=true${query}`,
    connection.vercelToken,
    undefined,
    {
      method: 'POST',
      body: JSON.stringify(variablesToWrite),
    },
  );
  return {
    updatedKeys: variablesToWrite.map(variable => variable.key).sort(),
    skippedKeys,
  };
}

const firebaseWebConfigSchema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.union([z.string(), z.number()]).transform(String),
  appId: z.string().min(1),
});

const firebaseServiceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().min(40),
});

async function validateAndBuildFirebaseVariables(
  webConfigJson: string,
  serviceAccountJson: string,
  requestedTargets: Array<z.infer<typeof targetSchema>>,
) {
  let rawWebConfig: unknown;
  let rawServiceAccount: unknown;
  try {
    rawWebConfig = JSON.parse(webConfigJson);
    rawServiceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('FIREBASE_JSON_INVALID');
  }

  const web = firebaseWebConfigSchema.parse(rawWebConfig);
  const service = firebaseServiceAccountSchema.parse(rawServiceAccount);
  if (web.projectId !== service.project_id) throw new Error('FIREBASE_PROJECT_MISMATCH');

  const validationApp = initializeApp({
    credential: cert({
      projectId: service.project_id,
      clientEmail: service.client_email,
      privateKey: service.private_key,
    }),
    projectId: service.project_id,
    storageBucket: web.storageBucket,
  }, `deployment-validation-${randomUUID()}`);

  try {
    await getFirestore(validationApp).listCollections();
  } finally {
    await deleteApp(validationApp).catch(() => undefined);
  }

  const publicTargets = Array.from(new Set(requestedTargets));
  const secretTargets = publicTargets.filter(target => target !== 'development');
  if (secretTargets.length === 0) throw new Error('FIREBASE_SECRET_TARGET_REQUIRED');

  const publicVariables: Array<z.infer<typeof variableSchema>> = [
    ['NEXT_PUBLIC_FIREBASE_API_KEY', web.apiKey],
    ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', web.authDomain],
    ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', web.projectId],
    ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', web.storageBucket],
    ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', web.messagingSenderId],
    ['NEXT_PUBLIC_FIREBASE_APP_ID', web.appId],
  ].map(([key, value]) => ({
    key,
    value,
    type: 'encrypted' as const,
    target: publicTargets,
    comment: 'Firebase browser configuration managed by Trinity deployment control',
  }));

  // Seed both the current FIREBASE_ADMIN_* names and the legacy names still
  // consumed by notification services, keeping active components compatible.
  const secretVariables: Array<z.infer<typeof variableSchema>> = [
    ['FIREBASE_ADMIN_PROJECT_ID', service.project_id],
    ['FIREBASE_ADMIN_CLIENT_EMAIL', service.client_email],
    ['FIREBASE_ADMIN_PRIVATE_KEY', service.private_key],
    ['FIREBASE_ADMIN_STORAGE_BUCKET', web.storageBucket],
    ['FIREBASE_PROJECT_ID', service.project_id],
    ['FIREBASE_CLIENT_EMAIL', service.client_email],
    ['FIREBASE_PRIVATE_KEY', service.private_key],
  ].map(([key, value]) => ({
    key,
    value,
    type: 'sensitive' as const,
    target: secretTargets,
    comment: 'Firebase server credential managed by Trinity deployment control',
  }));

  return {
    projectId: web.projectId,
    variables: [...publicVariables, ...secretVariables],
  };
}

function validateDeployHook(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'api.vercel.com' || !url.pathname.startsWith('/v1/integrations/deploy/')) {
    throw new Error('DEPLOY_HOOK_INVALID');
  }
  return url;
}

async function triggerDeployHook(rawUrl: string) {
  const response = await fetch(validateDeployHook(rawUrl), {
    method: 'POST',
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`DEPLOY_HOOK_${response.status}`);
  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  return {
    jobId: typeof payload?.job?.id === 'string' ? payload.job.id : null,
    state: typeof payload?.job?.state === 'string' ? payload.job.state : 'PENDING',
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!withinRateLimit(request)) return json({ error: 'Too many control-panel requests. Try again in one minute.' }, 429);
    assertSameOrigin(request);
    assertControlSecret(request);

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'The request contains invalid or incomplete deployment settings.' }, 400);
    const input = parsed.data;

    if (input.action === 'deploy') {
      const deployment = await triggerDeployHook(input.deployHookUrl);
      console.info('[deployment-control] deploy hook triggered', { requestId: randomUUID(), state: deployment.state });
      return json({ ok: true, deployment });
    }

    if (input.action === 'inspect') {
      const [userPayload, projectPayload, envPayload] = await Promise.all([
        vercelRequest('/v2/user', input.vercelToken),
        vercelRequest(`/v9/projects/${encodeURIComponent(input.projectId)}`, input.vercelToken, input.teamId),
        vercelRequest(`/v9/projects/${encodeURIComponent(input.projectId)}/env`, input.vercelToken, input.teamId),
      ]);
      const user = userPayload.user || userPayload;
      return json({
        ok: true,
        account: { username: user.username || null, email: user.email || null },
        project: {
          id: projectPayload.id || null,
          name: projectPayload.name || input.projectId,
          framework: projectPayload.framework || null,
          updatedAt: projectPayload.updatedAt || null,
        },
        variables: publicEnvironmentList(envPayload),
      });
    }

    if (input.action === 'upsert') {
      const result = await upsertVariables(input, input.variables, input.preserveExisting);
      console.info('[deployment-control] variables updated', {
        requestId: randomUUID(),
        projectId: input.projectId,
        keys: result.updatedKeys,
        preservedKeys: result.skippedKeys,
      });
      return json({ ok: true, ...result, requiresRedeploy: result.updatedKeys.length > 0 });
    }

    const firebase = await validateAndBuildFirebaseVariables(
      input.webConfigJson,
      input.serviceAccountJson,
      input.target,
    );
    const result = await upsertVariables(input, firebase.variables, input.preserveExisting);
    console.info('[deployment-control] Firebase project seeded', {
      requestId: randomUUID(),
      projectId: input.projectId,
      firebaseProjectId: firebase.projectId,
      keys: result.updatedKeys,
      preservedKeys: result.skippedKeys,
    });
    return json({
      ok: true,
      firebaseProjectId: firebase.projectId,
      ...result,
      requiresRedeploy: result.updatedKeys.length > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'CONTROL_NOT_CONFIGURED') {
      return json({ error: 'Deployment control is not bootstrapped. Add DEPLOYMENT_CONTROL_SECRET once on the current host.' }, 503);
    }
    if (message === 'CONTROL_UNAUTHORIZED') return json({ error: 'Deployment control authorization failed.' }, 401);
    if (message === 'CROSS_ORIGIN_REQUEST') return json({ error: 'Cross-origin control requests are blocked.' }, 403);
    if (message === 'FIREBASE_JSON_INVALID') return json({ error: 'One of the Firebase JSON documents is invalid.' }, 400);
    if (message === 'FIREBASE_PROJECT_MISMATCH') return json({ error: 'The Firebase web configuration and service account belong to different projects.' }, 400);
    if (message === 'FIREBASE_SECRET_TARGET_REQUIRED') return json({ error: 'Firebase server credentials must target Production or Preview.' }, 400);
    if (message === 'PUBLIC_SECRET_NAME_BLOCKED') return json({ error: 'A secret cannot be saved under a NEXT_PUBLIC_* name because browser users can read it.' }, 400);
    if (message === 'SCHOOLPAY_SIGNATURE_REQUIRED') return json({ error: 'SchoolPay webhook signature verification must remain true for Production.' }, 400);
    if (message === 'DEPLOY_HOOK_INVALID') return json({ error: 'Use an official HTTPS Vercel deploy-hook URL.' }, 400);
    if (message.startsWith('VERCEL_')) return json({ error: `Vercel rejected the request (${message.replace('VERCEL_', '')}). No secret values were returned.` }, 502);
    if (message.startsWith('DEPLOY_HOOK_')) return json({ error: `Vercel could not start the deployment (${message.replace('DEPLOY_HOOK_', '')}).` }, 502);
    if (error instanceof z.ZodError) return json({ error: 'The supplied credential document is missing required fields.' }, 400);

    console.error('[deployment-control] request failed', { code: message.slice(0, 120) });
    return json({ error: 'The deployment-control operation failed safely. No changes were confirmed.' }, 500);
  }
}
