import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes and their required modules
const PROTECTED_ROUTES: Record<string, { module: string; permission?: 'view_only' | 'edit' | 'full_access' }> = {
  '/pupils': { module: 'pupils' },
  '/staff': { module: 'staff' },
  '/classes': { module: 'classes' },
  '/subjects': { module: 'subjects' },
  '/fees': { module: 'fees' },
  '/exams': { module: 'exams' },
  '/attendance': { module: 'attendance' },
  '/events': { module: 'events' },
  '/users': { module: 'users' },
  '/academic-years': { module: 'academic_years' },
  '/banking': { module: 'banking' },
  '/bulk-sms': { module: 'bulk_sms' },
  '/notifications': { module: 'notifications' },
  '/procurement': { module: 'procurement' },
  '/requirements': { module: 'requirements' },
  '/uniforms': { module: 'uniforms' },
  '/about-school': { module: 'settings' },
  
  // Sub-routes with specific permissions
  '/fees/collect': { module: 'fees', permission: 'edit' },
  '/staff/form': { module: 'staff', permission: 'edit' },
};

// Public routes that don't need authentication
const PUBLIC_ROUTES = [
  '/login',
  '/admin/setup',
  '/test-firebase',
  '/api/auth',
  '/api/setup',
  '/_next',
  '/favicon.ico',
  '/api/health',
  '/parent', // Allow parent routes
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for public routes, static files, and Next.js internals
  if (
    PUBLIC_ROUTES.some(route => pathname.startsWith(route)) ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // For now, we'll let the client-side ProtectedRoute components handle the actual permission checking
  // This middleware serves as a documentation of protected routes and can be enhanced later
  // with server-side session validation if needed
  
  // Log access attempts for debugging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    const isProtectedRoute = Object.keys(PROTECTED_ROUTES).some(route => pathname.startsWith(route));
    
    if (isProtectedRoute) {
      console.log(`🔒 Protected route accessed: ${pathname}`);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 