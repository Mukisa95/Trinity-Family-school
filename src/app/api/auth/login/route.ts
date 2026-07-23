import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateLegacyUser } from '@/lib/server/app-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  username: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(512),
});

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function clientAddress(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function withinRateLimit(request: NextRequest) {
  const key = clientAddress(request);
  const now = Date.now();
  if (attempts.size > 1_000) {
    for (const [address, attempt] of attempts) {
      if (attempt.resetAt <= now) attempts.delete(address);
    }
  }
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_ATTEMPTS;
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const requestHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    return Boolean(requestHost) && new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return response({ error: 'Cross-origin sign-in is not allowed.' }, 403);
  }

  if (!withinRateLimit(request)) {
    return response({ error: 'Too many sign-in attempts. Please wait one minute and try again.' }, 429);
  }

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return response({ error: 'Invalid username or password.' }, 400);

    const result = await authenticateLegacyUser(parsed.data.username, parsed.data.password);
    if (!result) return response({ error: 'Invalid username or password.' }, 401);

    return response(result);
  } catch (error) {
    console.error('Secure login failed:', error instanceof Error ? error.message : 'unknown error');
    return response({ error: 'Sign-in is temporarily unavailable. Please try again.' }, 503);
  }
}
