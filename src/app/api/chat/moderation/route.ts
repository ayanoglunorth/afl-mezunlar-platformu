import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type ConversationKind = 'social' | 'mentorship';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Oturum gerekli.' }, { status: 401 });

    const rateLimit = checkRateLimit(`chat-moderation:${user.id}:${getClientIp(request)}`, 15, 60_000);
    if (!rateLimit.allowed) {
      return Response.json({ error: 'Çok fazla işlem yapıldı. Lütfen biraz bekleyin.' }, { status: 429 });
    }

    const body = await request.json() as {
      action?: unknown;
      kind?: unknown;
      conversationId?: unknown;
      rating?: unknown;
      note?: unknown;
      messageIds?: unknown;
    };
    const action = body.action;
    const kind = body.kind as ConversationKind;
    const conversationId = String(body.conversationId || '');
    const note = String(body.note || '').trim().slice(0, 2000) || null;
    if ((kind !== 'social' && kind !== 'mentorship') || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
      return Response.json({ error: 'Sohbet bilgisi geçersiz.' }, { status: 400 });
    }

    if (action === 'review') {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return Response.json({ error: 'Puan 1 ile 5 arasında olmalı.' }, { status: 400 });
      }

      // Protects review ownership. Attack scenario: a user submits a rating for
      // a conversation they do not belong to; the RPC verifies membership.
      const { data, error } = await supabase.rpc('submit_conversation_review', {
        p_kind: kind,
        p_conversation_id: conversationId,
        p_rating: rating,
        p_note: note,
      });

      if (error) {
        console.error('Chat review RPC error:', error.message);
        return Response.json({ error: 'Değerlendirme kaydedilemedi.' }, { status: 500 });
      }
      if (!data) return Response.json({ error: 'Bu sohbet için işlem yetkiniz yok.' }, { status: 403 });

      return Response.json({ success: true });
    }

    if (action === 'report') {
      const messageIds = Array.isArray(body.messageIds)
        ? Array.from(new Set(body.messageIds.map(String))).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 20)
        : [];
      if (messageIds.length === 0) {
        return Response.json({ error: 'En az bir mesaj seçin.' }, { status: 400 });
      }

      // Protects report evidence integrity. Attack scenario: a user reports
      // messages from another chat or snapshots their own messages.
      const { data, error } = await supabase.rpc('submit_message_report', {
        p_kind: kind,
        p_conversation_id: conversationId,
        p_message_ids: messageIds,
        p_note: note,
      });

      if (error) {
        console.error('Chat report RPC error:', error.message);
        return Response.json({ error: 'Şikâyet oluşturulamadı.' }, { status: 500 });
      }
      if (!data) {
        return Response.json({ error: 'Seçilen mesajlardan biri şikâyet için uygun değil.' }, { status: 400 });
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'İşlem türü geçersiz.' }, { status: 400 });
  } catch (error) {
    console.error('Chat moderation error:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
  }
}
