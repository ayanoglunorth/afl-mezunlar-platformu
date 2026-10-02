import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

// Cloudflare/OpenNext currently requires Edge Middleware. Next.js 16 recommends
// Proxy for Node deployments, but its Node.js runtime is not supported by the
// deployed adapter yet.
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
