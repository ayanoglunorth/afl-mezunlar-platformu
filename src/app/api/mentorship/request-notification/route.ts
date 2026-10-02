import { createAdminClientAsync } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/ses';
import { mentorshipRequestReceivedHtml } from '@/lib/email-templates';

export const runtime = 'nodejs';

function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || 'https://aflmezunlar.org';
  return value.replace(/\/$/, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { mentorId?: string; studentName?: string; requestMessage?: string };
    const { mentorId, studentName, requestMessage } = body;

    if (!mentorId || !requestMessage) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const finalStudentName = studentName?.trim() || 'Bir öğrenci';

    const supabase = await createAdminClientAsync();

    const [{ data: mentor }, { data: mentorProfile }] = await Promise.all([
      supabase.auth.admin.getUserById(mentorId),
      supabase.from('profiles').select('full_name').eq('id', mentorId).single(),
    ]);

    const email = mentor.user?.email;
    if (!email) {
      return Response.json({ error: 'Mentor email not found' }, { status: 404 });
    }

    const mentorName = mentorProfile?.full_name || 'Mentor';
    const dashboardUrl = `${siteUrl()}/eslesmeler`;

    const html = mentorshipRequestReceivedHtml(mentorName, finalStudentName, requestMessage, dashboardUrl);
    const result = await sendEmail({
      to: email,
      subject: 'AFL Mezun Platformu: Yeni mentorluk isteği',
      html,
    });

    if (!result.success) {
      console.error('Failed to send request notification:', result.error);
      return Response.json({ error: 'Email send failed' }, { status: 502 });
    }

    return Response.json({ sent: true, messageId: result.messageId });
  } catch (err) {
    console.error('Request notification error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
