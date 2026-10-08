import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { nativeDeviceInput } from '@/lib/server/native-push-contract';
import { testNativeDevice } from '@/lib/server/native-push';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request), input = nativeDeviceInput(await request.json(), false);
    const result = await testNativeDevice(input, actor.decoded.uid);
    return NextResponse.json(result, { status: result.accepted > 0 ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(code) ? 401 : code === 'INVALID_NATIVE_DEVICE' ? 400 : ['NATIVE_DEVICE_PROOF_REQUIRED', 'NATIVE_SCHOOL_MISMATCH', 'ACCOUNT_INACTIVE'].includes(code) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? 'The push test could not be sent.' : code }, { status });
  }
}
