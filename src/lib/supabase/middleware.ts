import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname === '/giris' || pathname === '/kayit' || pathname === '/email-dogrulama';
  const publicRoutes = [
    '/',
    '/giris',
    '/kayit',
    '/email-dogrulama',
    '/sifremi-unuttum',
    '/sifre-yenile',
    '/onay-bekliyor',
    '/api/auth/verify-registry',
    '/api/auth/verify-active-student',
    '/api/auth/check-student-number',
    '/api/contact',
    '/api/notifications/process',
    '/api/notifications/schedule',
    '/api/notifications/cancel',
    '/api/social/message-notification',
    '/api/mentorship/message-notification',
    '/api/mentorship/request-notification',
    '/api/mentorship/accept-notification',
    '/auth/callback',
    '/opengraph-image',
    '/icon.svg',
    '/kullanici-sozlesmesi',
    '/kvkk',
  ];
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith('/auth/') || pathname.startsWith('/opengraph-image'));
  const isFetchServerAction = request.method === 'POST' && Boolean(request.headers.get('next-action'));

  if (isPublicRoute && !isAuthRoute) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null;

  if (!userId && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/giris';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (userId && (pathname === '/giris' || pathname === '/kayit' || pathname === '/email-dogrulama')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Admin route protection
  if (pathname.startsWith('/admin') && !isFetchServerAction) {
    if (!userId) {
      const url = request.nextUrl.clone();
      url.pathname = '/giris';
      return NextResponse.redirect(url);
    }

    const { data: isAdmin } = await supabase.rpc('is_platform_admin', { p_user_id: userId });

    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  const isPageRoute = !pathname.startsWith('/api/');
  if (userId && isPageRoute && !isFetchServerAction && pathname !== '/onay-bekliyor' && !pathname.startsWith('/auth/')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_verified')
      .eq('id', userId)
      .single();

    if (profile?.role === 'alumni' && !profile.is_verified) {
      const url = request.nextUrl.clone();
      url.pathname = '/onay-bekliyor';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
