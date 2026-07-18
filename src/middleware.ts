import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Bypass Next.js internal files, static assets, favicon, and the logs API endpoint
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/logs') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const origin = request.nextUrl.origin;
  
  // Fire-and-forget local fetch to record the activity logs in Node runtime
  fetch(`${origin}/api/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'REQUEST',
      level: 'INFO',
      message: `${request.method} ${pathname}${search}`
    })
  }).catch(() => {});

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
