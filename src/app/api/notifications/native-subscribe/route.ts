import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { nativeDeviceInput } from '@/lib/server/native-push-contract';
import { updateNativeDevice } from '@/lib/server/native-push';

export const dynamic = 'force-dynamic';
async function handle(request: NextRequest, action: 'register' | 'rotate' | 'deactivate') {
  try {
    const actor = action === 'register' ? await requireAppUser(request) : undefined;
    const raw = await request.json(), input = nativeDeviceInput(raw, action !== 'deactivate');
    if (actor && raw.userId && raw.userId !== actor.decoded.uid) return NextResponse.json({ error: 'ACCOUNT_MISMATCH' }, { status: 403 });
    return NextResponse.json(await updateNativeDevice(input, action, actor?.decoded.uid), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(code) ? 401 : code === 'INVALID_NATIVE_DEVICE' || error instanceof SyntaxError ? 400
      : ['NATIVE_SCHOOL_MISMATCH', 'NATIVE_DEVICE_PROOF_REQUIRED', 'ACCOUNT_INACTIVE'].includes(code) ? 403 : code === 'NATIVE_DEVICE_NOT_REGISTERED' ? 410 : 500;
    return NextResponse.json({ error: status === 500 ? 'Native registration is temporarily unavailable.' : code }, { status });
  }
}
export const POST = (request: NextRequest) => handle(request, request.headers.get('x-native-operation') === 'rotate' ? 'rotate' : 'register');
export const PATCH = (request: NextRequest) => handle(request, 'rotate');
export const DELETE = (request: NextRequest) => handle(request, 'deactivate');
