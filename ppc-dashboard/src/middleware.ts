import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Authentication Middleware
 * 
 * Protects all routes except:
 * - /login - Login page
 * - /api/auth/* - Authentication endpoints
 * - /api/cron/* - Cron job endpoints (protected by CRON_SECRET)
 * - Static files (_next, favicon, etc.)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Skip auth for auth API routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Skip auth for cron routes (they have their own auth via CRON_SECRET)
  if (pathname.startsWith('/api/cron')) {
    return NextResponse.next();
  }

  // Skip auth for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('dashboard-auth');
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  // If no password is set in env, allow access (development mode)
  if (!expectedPassword) {
    return NextResponse.next();
  }

  // Verify auth cookie
  if (!authCookie || authCookie.value !== expectedPassword) {
    // Redirect to login page
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
  ],
};
