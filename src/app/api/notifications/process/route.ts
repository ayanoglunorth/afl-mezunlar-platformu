import { createAdminClientAsync } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/ses';
import { forumMentionHtml, mentorshipFirstMessageHtml, mentorshipUnreadReminderHtml } from '@/lib/email-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Job = {
  id: string;
  recipient_id: string;
  conversation_kind: 'social' | 'mentorship' | 'forum_mention';
  conversation_id: string;
  first_message_id: string;
  attempt_count: number;
};

function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || 'https://aflmezunlar.org';
  return value.replace(/\/$/, '');
}

function hasServiceRoleKey() {
  return Boolean(process.env['SUPABASE_SERVICE_ROLE_KEY']);
}

function hasSesConfig() {
  return Boolean(process.env['AWS_SES_ACCESS_KEY_ID'] && process.env['AWS_SES_SECRET_ACCESS_KEY'] && process.env['AWS_SES_REGION']);
}

export async function POST(request: Request) {
  const secret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.NOTIFICATION_CRON_SECRET || secret !== process.env.NOTIFICATION_CRON_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const emailFrom = process.env.EMAIL_FROM;
  if (!hasSesConfig() || !emailFrom) return Response.json({ error: 'email is not configured' }, { status: 503 });
  if (!hasServiceRoleKey()) return Response.json({ error: 'notification worker is not configured' }, { status: 503 });

  const supabase = await createAdminClientAsync();
  const { data: jobs, error } = await supabase.rpc('claim_due_notification_jobs', { p_limit: 5 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const job of (jobs || []) as Job[]) {
    if (job.conversation_kind === 'forum_mention') {
      const [{ data: recipient }, { data: mention }, { data: recipientProfile }] = await Promise.all([
        supabase.auth.admin.getUserById(job.recipient_id),
        supabase.from('forum_mentions').select('mentioned_by, thread_id, post_id').eq('id', job.first_message_id).maybeSingle(),
        supabase.from('profiles').select('full_name').eq('id', job.recipient_id).maybeSingle(),
      ]);
      if (!mention) {
        await supabase.from('notification_jobs').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', job.id);
        continue;
      }
      const [{ data: thread }, { data: targetThread }, { data: targetPost }] = await Promise.all([
        supabase.from('forum_threads_public').select('title').eq('id', mention.thread_id).maybeSingle(),
        supabase.from('forum_threads_public').select('is_anonymous').eq('id', mention.thread_id).maybeSingle(),
        mention.post_id ? supabase.from('forum_posts_public').select('is_anonymous').eq('id', mention.post_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const email = recipient.user?.email;
      if (!email || !thread) {
        await supabase.from('notification_jobs').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), last_error: !email ? 'Recipient email is missing.' : 'Forum thread is missing.' }).eq('id', job.id);
        continue;
      }
      const forumUrl = `${siteUrl()}/topluluk/konu/${mention.thread_id}`;
      const result = await sendEmail({
        to: email,
        subject: 'AFL Mezun Platformu: Toplulukta etiketlendin',
        html: forumMentionHtml(recipientProfile?.full_name || 'Kullanıcı', targetPost?.is_anonymous || targetThread?.is_anonymous ? 'Anonim kullanıcı' : 'Bir kullanıcı', thread.title, forumUrl),
      });
      if (result.success) {
        await supabase.from('notification_jobs').update({ status: 'sent', sent_at: new Date().toISOString(), locked_at: null, last_error: null }).eq('id', job.id).eq('status', 'processing');
        sent += 1;
      } else {
        await supabase.from('notification_jobs').update({ status: 'failed', locked_at: null, scheduled_for: new Date(Date.now() + 5 * 60_000).toISOString(), last_error: (result.error || 'Unknown error').slice(0, 2000) }).eq('id', job.id).eq('status', 'processing');
      }
      continue;
    }
    const table = job.conversation_kind === 'social' ? 'messages' : 'mentorship_messages';
    const foreignKey = job.conversation_kind === 'social' ? 'room_id' : 'conversation_id';
    const [{ data: recipient }, { data: unread }, { data: recipientProfile }] = await Promise.all([
      supabase.auth.admin.getUserById(job.recipient_id),
      supabase.from(table).select('id, content, sender_id').eq(foreignKey, job.conversation_id).eq('is_read', false).neq('sender_id', job.recipient_id).order('created_at', { ascending: false }).limit(5),
      supabase.from('profiles').select('full_name').eq('id', job.recipient_id).single(),
    ]);
    if (!unread?.length) {
      await supabase.from('notification_jobs').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', job.id);
      continue;
    }
    const email = recipient.user?.email;
    if (!email) {
      await supabase.from('notification_jobs').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        last_error: 'Recipient email is missing.',
      }).eq('id', job.id).eq('status', 'processing');
      continue;
    }

    const href = job.conversation_kind === 'social' ? `/sohbet/genel/${job.conversation_id}` : `/sohbet/${job.conversation_id}`;
    const chatUrl = `${siteUrl()}${href}`;
    const messagePreview = unread[0].content.length > 300 ? `${unread[0].content.slice(0, 300)}…` : unread[0].content;
    const recipientName = recipientProfile?.full_name || 'Kullanıcı';

    let html: string;
    let subject: string;

    // Detect first-message scenario for mentorship conversations.
    let isFirstMessage = false;
    if (job.conversation_kind === 'mentorship') {
      const { count } = await supabase.from('mentorship_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', job.conversation_id);
      isFirstMessage = (count ?? 0) <= 1;
    }

    if (isFirstMessage && job.conversation_kind === 'mentorship') {
      const senderId = unread[0].sender_id;
      const { data: senderProfile } = await supabase.from('profiles').select('full_name').eq('id', senderId).single();
      const senderName = senderProfile?.full_name || 'Mentorluk eşleşmesi';
      html = mentorshipFirstMessageHtml(recipientName, senderName, messagePreview, chatUrl);
      subject = `AFL Mezun Platformu: ${senderName} sana mesaj gönderdi`;
    } else {
      html = mentorshipUnreadReminderHtml(recipientName, unread.length, messagePreview, chatUrl);
      subject = unread.length > 1
        ? `AFL Mezun Platformu: ${unread.length} okunmamış mesajın var`
        : 'AFL Mezun Platformu: yeni mesajın var';
    }

    const result = await sendEmail({ to: email, subject, html });

    if (result.success) {
      await supabase.from('notification_jobs').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        locked_at: null,
        last_error: null,
      }).eq('id', job.id).eq('status', 'processing');
      sent += 1;
    } else {
      const retryMinutes = Math.min(60, Math.max(5, 2 ** Math.min(job.attempt_count, 5)));
      await supabase.from('notification_jobs').update({
        status: 'failed',
        locked_at: null,
        scheduled_for: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
        last_error: (result.error || 'Unknown error').slice(0, 2000),
      }).eq('id', job.id).eq('status', 'processing');
    }
  }
  return Response.json({ processed: jobs?.length || 0, sent });
}

