import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const payload = (await request.json().catch(() => null)) as {
      message?: unknown;
      senderName?: unknown;
      senderEmail?: unknown;
      source?: unknown;
    } | null;
    const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
    const isRegistrationSource = payload?.source === 'registration';
    const senderName = typeof payload?.senderName === 'string' ? payload.senderName.trim() : '';
    const senderEmail = typeof payload?.senderEmail === 'string' ? payload.senderEmail.trim().toLocaleLowerCase('tr-TR') : '';

    if (message.length < 8) {
      return Response.json({ error: 'Mesaj biraz daha açıklayıcı olmalı.' }, { status: 400 });
    }

    if (message.length > 1200) {
      return Response.json({ error: 'Mesaj 1200 karakterden kısa olmalı.' }, { status: 400 });
    }

    if (!user) {
      if (!isRegistrationSource) {
        return Response.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
      }

      if (senderName.length < 2 || senderName.length > 120) {
        return Response.json({ error: 'Ad soyad alanını doldurmalısın.' }, { status: 400 });
      }

      if (!EMAIL_PATTERN.test(senderEmail) || senderEmail.length > 254) {
        return Response.json({ error: 'Geçerli bir e-posta adresi yazmalısın.' }, { status: 400 });
      }

      const ip = getClientIp(request);
      const rateLimit = checkRateLimit(`contact:registration:${ip}`, 5, 60 * 60 * 1000);
      if (!rateLimit.allowed) {
        return Response.json(
          { error: 'Çok fazla mesaj gönderildi. Lütfen biraz sonra tekrar dene.' },
          { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds ?? 3600) } },
        );
      }

      const { error } = await supabase.rpc('submit_registration_feedback', {
        p_sender_name: senderName,
        p_sender_email: senderEmail,
        p_message: message,
      });

      if (error) {
        console.error('Registration feedback insert failed:', error.message);
        return Response.json({ error: 'Mesaj iletilemedi.' }, { status: 500 });
      }

      return Response.json({ saved: true });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Dashboard feedback profile lookup failed:', profileError?.message || user.id);
      return Response.json({ error: 'Mesaj iletilemedi.' }, { status: 500 });
    }

    const { error } = await supabase.from('dashboard_feedback').insert({
      user_id: user.id,
      sender_name: profile.full_name || null,
      sender_email: user.email || null,
      sender_role: profile.role || null,
      message,
    });

    if (error) {
      console.error('Dashboard feedback insert failed:', error.message);
      return Response.json({ error: 'Mesaj iletilemedi.' }, { status: 500 });
    }

    return Response.json({ saved: true });
  } catch (error) {
    console.error('Dashboard feedback route failed:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Mesaj iletilemedi.' }, { status: 500 });
  }
}
