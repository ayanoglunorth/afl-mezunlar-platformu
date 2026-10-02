import { createAdminClientAsync } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/ses';
import { mentorshipRequestAcceptedHtml } from '@/lib/email-templates';

export const runtime = 'nodejs';

function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || 'https://aflmezunlar.org';
  return value.replace(/\/$/, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { studentId?: string; mentorName?: string; conversationId?: string };
    const { studentId, mentorName, conversationId } = body;

    if (!studentId || !conversationId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const finalMentorName = mentorName?.trim() || 'Bir mentor';

    const supabase = await createAdminClientAsync();

    const [{ data: student }, { data: studentProfile }] = await Promise.all([
      supabase.auth.admin.getUserById(studentId),
      supabase.from('profiles').select('full_name').eq('id', studentId).single(),
    ]);

    const email = student.user?.email;
    if (!email) {
      return Response.json({ error: 'Student email not found' }, { status: 404 });
    }

    const studentName = studentProfile?.full_name || 'Öğrenci';
    const chatUrl = `${siteUrl()}/sohbet/${conversationId}`;

    const html = mentorshipRequestAcceptedHtml(studentName, finalMentorName, chatUrl);
    const result = await sendEmail({
      to: email,
      subject: 'AFL Mezun Platformu: Mentorluk isteğin kabul edildi!',
      html,
    });

    if (!result.success) {
      console.error('Failed to send accept notification:', result.error);
      return Response.json({ error: 'Email send failed' }, { status: 502 });
    }

    return Response.json({ sent: true, messageId: result.messageId });
  } catch (err) {
    console.error('Accept notification error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
