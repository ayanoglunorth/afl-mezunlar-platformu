import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function createPublicServerClient() {
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
    const rateLimit = checkRateLimit(`student-number:${getClientIp(request)}`, 12, 60_000);
    if (!rateLimit.allowed) {
      return Response.json({ available: false, error: 'Çok fazla deneme yapıldı.' }, { status: 429 });
    }

    const body = await request.json() as { studentNumber?: unknown };
    const studentNumber = String(body.studentNumber || '').trim();
    if (!/^\d{2,16}$/.test(studentNumber)) {
      return Response.json({ available: false, error: 'Okul numarası formatı geçersiz.' }, { status: 400 });
    }

    const { data, error } = await createPublicServerClient().rpc(
      'is_student_number_available_for_registration',
      { p_student_number: studentNumber },
    );

    if (error) {
      console.error('Student number availability RPC failed:', error.message);
      return Response.json({ available: false, error: 'Kontrol tamamlanamadı.' }, { status: 500 });
    }

    const available = Boolean(data);
    return Response.json({
      available,
      error: available ? undefined : 'Bu okul numarasıyla daha önce bir hesap oluşturulmuş.',
    }, { status: available ? 200 : 409 });
  } catch {
    return Response.json({ available: false, error: 'Kontrol tamamlanamadı.' }, { status: 500 });
  }
}
