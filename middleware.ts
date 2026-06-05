import { NextResponse, type NextRequest } from 'next/server';

const guardedProductionPrefixes = [
  '/admin/auth-debug',
  '/admin/cleanup',
  '/admin/cleanup-banking',
  '/admin/cleanup-photos',
  '/admin/fix-parent-accounts',
  '/admin/fix-photo-urls',
  '/admin/migrate-data',
  '/debug-permissions',
  '/dev-tools',
  '/test-db',
  '/test-firebase',
  '/test-notifications',
  '/test-signatures',
  '/api/debug-exams',
  '/api/test-storage',
  '/api/test-storage-rules',
  '/api/test-upload',
  '/api/maintenance',
];

const guardedProductionFiles = [
  '/camera-test.html',
  '/permission-test.html',
  '/test-notifications.html',
  '/test-push.html',
  '/test-push-debug.html',
  '/test-pwa-icons.html',
];

function isGuardedPath(pathname: string) {
  return (
    guardedProductionPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    guardedProductionFiles.includes(pathname)
  );
}

export function middleware(request: NextRequest) {
  const allowMaintenanceRoutes = process.env.NEXT_PUBLIC_ENABLE_MAINTENANCE_ROUTES === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !allowMaintenanceRoutes && isGuardedPath(request.nextUrl.pathname)) {
    return new NextResponse('Not found', { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/debug-permissions/:path*',
    '/dev-tools/:path*',
    '/test-db/:path*',
    '/test-firebase/:path*',
    '/test-notifications/:path*',
    '/test-signatures/:path*',
    '/api/debug-exams/:path*',
    '/api/test-storage/:path*',
    '/api/test-storage-rules/:path*',
    '/api/test-upload/:path*',
    '/api/maintenance/:path*',
    '/camera-test.html',
    '/permission-test.html',
    '/test-notifications.html',
    '/test-push.html',
    '/test-push-debug.html',
    '/test-pwa-icons.html',
  ],
};
