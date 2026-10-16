import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAppUser } from '@/lib/server/app-auth';
import { CircumferenceError, readWithinCircumference } from '@/lib/server/circumference';
import { isCircumferenceCollection } from '@/lib/access/scoped-collections';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const field = z.string().min(1).max(120).regex(/^[\w.-]+$/);
const scalar = z.union([z.string().max(512), z.number().finite(), z.boolean(), z.null(), z.object({timestampMillis: z.number().finite().min(-8640000000000000).max(8640000000000000)}).strict()]);
const schema = z.object({ collection: z.string().refine(name => isCircumferenceCollection(name)),
  id: z.string().min(1).max(160).refine(id => !id.includes('/')).optional(),
  filters: z.array(z.object({ field, op: z.enum(['==', 'in', '<', '<=', '>', '>=', '!=', 'array-contains', 'array-contains-any', 'not-in']), value: z.union([scalar, z.array(scalar).min(1).max(30)]) })).max(12).optional(),
  order: z.array(z.object({ field, direction: z.enum(['asc', 'desc']) })).max(4).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
}).strict();
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid scoped data request.' }, { status: 400 });
    const fromWire = (value: any): any => Array.isArray(value) ? value.map(fromWire) : value && typeof value === 'object' ? Timestamp.fromMillis(value.timestampMillis) : value;
    const records = await readWithinCircumference(actor, {...parsed.data, preserveTimestamps: true, filters: parsed.data.filters?.map(filter => ({...filter, value: fromWire(filter.value)}))});
    return NextResponse.json({ records }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = error instanceof CircumferenceError ? error.status : String(error).includes('AUTH') || String(error).includes('INACTIVE') ? 401 : 500;
    return NextResponse.json({ error: status === 500 ? 'Could not load your scoped data.' : error instanceof Error ? error.message : 'Access denied.' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
