import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

function createAnonAuthClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Session required.' }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`delete-request:${user.id}:${getClientIp(request)}`, 3, 60 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
  }

  const origin = new URL(request.url).origin;
  const { error } = await createAnonAuthClient().auth.signInWithOtp({
    email: user.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/ayarlar`,
    },
  });

  if (error) {
    return NextResponse.json({ error: 'Doğrulama kodu gönderilemedi.' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
