'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChatCircleText, PaperPlaneTilt, SpinnerGap } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { repairTurkishText } from '@/lib/turkish-text';
import { getInitials, timeAgo } from '@/lib/utils';
import type { ChatRoom, Message, Profile } from '@/types/database';
import { SiteNotice, type SiteNoticeType } from '@/components/ui/SiteNotice';
import { ChatModerationActions } from '@/components/chat/ChatModerationActions';

type ChatMessage = Message & {
  sender?: Pick<Profile, 'id' | 'full_name'>;
};

type SocialConversationDetailPayload = {
  currentUserId: string;
  room: ChatRoom;
  other_profile: Profile;
  messages: ChatMessage[];
};

export default function GeneralChatPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params.roomId;
  const supabase = useMemo(() => createClient(), []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ type: SiteNoticeType; message: string } | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const refocusMessageInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const input = messageInputRef.current;
        if (!input || input.disabled) return;
        input.focus({ preventScroll: true });
        input.setSelectionRange(input.value.length, input.value.length);
      });
    });
  }, []);

  const markIncomingMessagesRead = useCallback(async () => {
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
    const { data, error } = await supabase.rpc('mark_social_messages_read', { p_room_id: roomId });

    if (error || !Array.isArray(data) || data.length === 0) return;

    window.dispatchEvent(new Event('message-read-state-changed'));
  }, [roomId, supabase]);

  const loadChat = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    const { data, error } = await supabase.rpc('get_social_conversation_detail', {
      p_room_id: roomId,
    });

    if (error) {
      if (error.message.toLowerCase().includes('authentication required')) {
        router.replace('/giris');
        return;
      }
      setNotice({ type: 'error', message: error.message });
      setLoading(false);
      return;
    }

    const detail = data as SocialConversationDetailPayload | null;
    if (!detail?.room || !detail.other_profile) {
      setRoom(null);
      setOtherProfile(null);
      setMessages([]);
      setNotice({ type: 'error', message: 'Sohbet bulunamadı ya da erişim iznin yok.' });
      setLoading(false);
      return;
    }

    setUserId(detail.currentUserId);
    setRoom(detail.room);
    setOtherProfile(detail.other_profile);
    setMessages(detail.messages || []);
    setLoading(false);
    await markIncomingMessagesRead();
    window.setTimeout(() => scrollToBottom('auto'), 60);
  }, [markIncomingMessagesRead, roomId, router, scrollToBottom, supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadChat();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadChat]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`general-chat:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload: { new: Record<string, unknown> }) => {
          const message = payload.new as unknown as ChatMessage;
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
          if (message.sender_id !== userId) void markIncomingMessagesRead();
          window.setTimeout(() => scrollToBottom('smooth'), 60);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [markIncomingMessagesRead, roomId, scrollToBottom, supabase, userId]);

  useEffect(() => {
    if (!userId) return;
    const markWhenVisible = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        void markIncomingMessagesRead();
      }
    };
    document.addEventListener('visibilitychange', markWhenVisible);
    window.addEventListener('focus', markWhenVisible);
    return () => {
      document.removeEventListener('visibilitychange', markWhenVisible);
      window.removeEventListener('focus', markWhenVisible);
    };
  }, [markIncomingMessagesRead, userId]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || !userId || !room) return;

    const cleanedContent = repairTurkishText(content).trim();
    setSending(true);
    setNotice(null);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id: room.id,
        sender_id: userId,
        content: cleanedContent,
        is_read: false,
      })
      .select()
      .single();

    let sent = false;
    if (error) {
      setNotice({ type: 'error', message: error.message });
    } else if (data) {
      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as ChatMessage]);
      setContent('');
      sent = true;
      window.setTimeout(() => scrollToBottom('smooth'), 60);
    }

    setSending(false);
    if (sent) refocusMessageInput();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-[28rem] rounded-2xl" />
      </div>
    );
  }

  if (!room || !otherProfile) {
    return (
      <div className="card py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 text-surface-500">
          <ChatCircleText className="h-7 w-7" weight="duotone" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-surface-900">Sohbet açılamadı</h1>
        {notice && <SiteNotice type={notice.type} message={notice.message} className="mx-auto mt-4 max-w-lg text-left" />}
        <Link href="/" className="btn-primary mt-5 inline-flex">Dashboarda dön</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-4xl flex-col fade-in">
      <div className="card flex items-center gap-4 rounded-b-none border-b-0 bg-white/95 shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-200 text-surface-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          aria-label="Geri dön"
        >
          <ArrowLeft className="h-4 w-4" weight="bold" />
        </button>
        <Link
          href={`/profil/${otherProfile.id}`}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          aria-label={`${otherProfile.full_name} profilini aç`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-sm font-bold text-brand-700">
            {getInitials(otherProfile.full_name)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-surface-900 transition-colors group-hover:text-brand-700">{otherProfile.full_name}</h1>
            <p className="truncate text-xs text-surface-500">
              {[otherProfile.university, otherProfile.department || otherProfile.field_of_study].filter(Boolean).join(' · ') || 'AFL Mezunlar Platformu'}
            </p>
          </div>
        </Link>
        <ChatModerationActions
          kind="social"
          conversationId={room.id}
          otherUserId={otherProfile.id}
          otherUserName={otherProfile.full_name}
          messages={messages}
          onNotice={(type, message) => setNotice({ type, message })}
        />
      </div>

      {notice && (
        <SiteNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
          className="rounded-none border-x border-t border-surface-200"
        />
      )}

      <div className="flex-1 overflow-y-auto border-x border-surface-200 bg-surface-50/70 p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-surface-400 shadow-sm">
                <ChatCircleText className="h-7 w-7" weight="duotone" />
              </div>
              <p className="mt-3 text-sm font-semibold text-surface-900">Henüz mesaj yok</p>
              <p className="mt-1 text-xs text-surface-500">Sohbeti başlatmak için kısa bir mesaj yaz.</p>
            </div>
          </div>
        )}

        {messages.map((message) => {
          const isOwn = message.sender_id === userId;

          return (
            <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`mb-3 max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                  isOwn
                    ? 'rounded-br-md bg-brand-600 text-white'
                    : 'rounded-bl-md border border-surface-200 bg-white text-surface-900'
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                <p className={`mt-1 text-[11px] ${isOwn ? 'text-white/70' : 'text-surface-400'}`}>
                  {timeAgo(message.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="card flex items-center gap-3 rounded-t-none border-t p-3">
        <input
          ref={messageInputRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Mesaj yaz..."
          className="input h-12 flex-1 rounded-xl"
          autoFocus
          disabled={sending || room.is_expired}
        />
        <button
          type="submit"
          onMouseDown={(event) => event.preventDefault()}
          disabled={sending || !content.trim() || room.is_expired}
          className="btn-primary h-12 px-4"
        >
          {sending ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : <PaperPlaneTilt className="h-4 w-4" weight="bold" />}
          Gönder
        </button>
      </form>
    </div>
  );
}
