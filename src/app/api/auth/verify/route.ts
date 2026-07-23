import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAppUser, verifyLegacyCredentials } from '@/lib/server/app-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  username: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(512),
});

export async function POST(request: NextRequest) {
  try {
    await requireAppUser(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid credentials.' }, { status: 400 });

    const user = await verifyLegacyCredentials(parsed.data.username, parsed.data.password);
    if (!user) return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });

    return NextResponse.json({ user }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }
}

