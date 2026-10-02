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
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Session required.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { nonce?: unknown };
    const nonce = typeof body.nonce === 'string' ? body.nonce.trim() : '';
    if (!nonce) {
      return NextResponse.json({ error: 'E-posta doğrulama kodu gerekli.' }, { status: 400 });
    }

    const rateLimit = checkRateLimit(`delete:${user.id}:${getClientIp(request)}`, 3, 60 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
    }

    // Protects account deletion confirmation; attack scenario: an unattended
    // authenticated browser session is used to delete the account without access
    // to the user's mailbox.
    const { data: verifiedOtp, error: otpError } = await createAnonAuthClient().auth.verifyOtp({
      email: user.email,
      token: nonce,
      type: 'email',
    });

    if (otpError || verifiedOtp.user?.id !== user.id) {
      return NextResponse.json({ error: 'E-posta doğrulama kodu geçersiz veya süresi dolmuş.' }, { status: 400 });
    }

    // Protects account deletion accountability; attack scenario: a hijacked
    // session deletes data and the platform has no trace of the critical action.
    const { data, error } = await supabase.rpc('user_delete_own_account');

    if (error || !data) {
      console.error('User deletion error:', error?.message || 'delete RPC returned false');
      return NextResponse.json({ error: 'Account could not be deleted.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Server error deleting user:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
