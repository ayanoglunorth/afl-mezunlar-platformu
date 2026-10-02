'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PaperPlaneTilt, X } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import type { MentorshipConversation, MentorshipMessage, MentorshipRequest, MentorshipReview, Profile } from '@/types/database';
import { getInitials, timeAgo } from '@/lib/utils';
import { SiteNotice, type SiteNoticeType } from '@/components/ui/SiteNotice';
import { ChatModerationActions } from '@/components/chat/ChatModerationActions';

const CONTACT_PATTERN = /(\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b)|(\+?\d[\d\s().-]{7,}\d)|(https?:\/\/|www\.)/i;

type MentorshipConversationDetailPayload = {
  currentUserId: string;
  conversation: MentorshipConversation;
  request: MentorshipRequest;
  other_profile: Profile;
  messages: MentorshipMessage[];
  review: MentorshipReview | null;
};

export default function ChatRoomPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const supabase = useMemo(() => createClient(), []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<MentorshipMessage[]>([]);
  const [conversation, setConversation] = useState<MentorshipConversation | null>(null);
  const [request, setRequest] = useState<MentorshipRequest | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [review, setReview] = useState<MentorshipReview | null>(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
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

    const { data, error } = await supabase.rpc('mark_mentorship_messages_read', { p_conversation_id: conversationId });

    if (error || !Array.isArray(data) || data.length === 0) return;

    window.dispatchEvent(new Event('message-read-state-changed'));
  }, [conversationId, supabase]);

  const loadConversation = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    const { data, error } = await supabase.rpc('get_mentorship_conversation_detail', {
      p_conversation_id: conversationId,
    });

    if (error) {
      setNotice({ type: 'error', message: error.message });
      setLoading(false);
      return;
    }

    const detail = data as MentorshipConversationDetailPayload | null;
    if (!detail?.conversation || !detail.request || !detail.other_profile) {
      setConversation(null);
      setRequest(null);
      setOtherProfile(null);
      setMessages([]);
      setReview(null);
      setNotice({ type: 'error', message: 'Sohbet bulunamadı ya da erişim iznin yok.' });
      setLoading(false);
      return;
    }

    setUserId(detail.currentUserId);
    setConversation(detail.conversation);
    setOtherProfile(detail.other_profile);
    setRequest(detail.request);
    setMessages(detail.messages || []);
    setReview(detail.review || null);
    void markIncomingMessagesRead();

    setLoading(false);
    setTimeout(() => scrollToBottom('auto'), 100);
  }, [conversationId, markIncomingMessagesRead, scrollToBottom, supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadConversation();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadConversation]);

  useEffect(() => {

    const channel = supabase
      .channel(`mentorship-conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mentorship_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: MentorshipMessage }) => {
          const message = payload.new as MentorshipMessage;
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
          if (userId && message.sender_id !== userId) void markIncomingMessagesRead();
          setTimeout(() => scrollToBottom('smooth'), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, markIncomingMessagesRead, scrollToBottom, supabase, userId]);

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

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!newMessage.trim() || sending || request?.status !== 'accepted') return;

    setSending(true);
    const { data: sentMessage, error } = await supabase.from('mentorship_messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: newMessage.trim(),
      is_read: false,
    }).select('*').single();

    let sent = false;
    if (!error) {
      setNewMessage('');
      sent = true;
      if (sentMessage) {
        setMessages((current) => current.some((item) => item.id === sentMessage.id) ? current : [...current, sentMessage as MentorshipMessage]);
        setTimeout(() => scrollToBottom('smooth'), 100);
      }
    }
    else setNotice({ type: 'error', message: error.message });
    setSending(false);
    if (sent) refocusMessageInput();
  }

  async function markCompleted() {
    if (!request) return false;
    setCompleting(true);
    const { error } = await supabase
      .from('mentorship_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', request.id);

    if (!error) {
      setRequest({ ...request, status: 'completed', completed_at: new Date().toISOString() });
    } else {
      setNotice({ type: 'error', message: error.message });
    }
    setCompleting(false);
    return !error;
  }

  async function submitReview() {
    if (!request || !conversation || conversation.student_id !== userId || review) return true;
    setSendingReview(true);
    const { error } = await supabase.from('mentorship_reviews').insert({
      request_id: request.id,
      student_id: conversation.student_id,
      mentor_id: conversation.mentor_id,
      rating,
      feedback: feedback.trim() || null,
    });

    if (!error) {
      setReview({
        id: 'local',
        request_id: request.id,
        student_id: conversation.student_id,
        mentor_id: conversation.mentor_id,
        rating,
        feedback: feedback.trim() || null,
        created_at: new Date().toISOString(),
      });
      setFeedback('');
    } else {
      setNotice({ type: 'error', message: error.message });
    }
    setSendingReview(false);
    return !error;
  }

  async function finishConversation() {
    if (!request || completing || sendingReview) return;

    if (conversation?.student_id === userId && !review) {
      const reviewSaved = await submitReview();
      if (!reviewSaved) return;
    }

    const completed = await markCompleted();
    if (completed) setShowEndDialog(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-4rem)]">
        <div className="skeleton h-16 rounded-xl" />
        <div className="flex-1 space-y-3 py-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className={`skeleton h-12 ${item % 2 === 0 ? 'ml-auto w-2/3' : 'w-2/3'}`} />
          ))}
        </div>
      </div>
    );
  }

  if (!conversation || !otherProfile || !request) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-base font-semibold text-surface-900">Sohbet bulunamadı</h3>
        <Link href="/mesajlar" className="btn-primary inline-flex mt-4">Mesajlara dön</Link>
      </div>
    );
  }

  const hasContactWarning = CONTACT_PATTERN.test(newMessage);
  const isCompleted = request.status === 'completed';
  const canReview = conversation.student_id === userId;

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-4rem)]">
      {notice && (
        <SiteNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
          className="mb-3"
        />
      )}
      <div className="card flex items-center gap-4 rounded-b-none border-b-0 bg-white/95 shadow-sm">
        <Link href="/mesajlar" className="btn-ghost p-1.5 rounded-lg lg:hidden">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <Link
          href={`/profil/${otherProfile.id}`}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          aria-label={`${otherProfile.full_name} profilini aç`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-500/15 bg-brand-50">
            <span className="text-sm font-bold text-brand-500">{getInitials(otherProfile.full_name)}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold text-surface-900 transition-colors group-hover:text-brand-700">{otherProfile.full_name}</h2>
              {!isCompleted && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />}
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-surface-500">
              {otherProfile.university || otherProfile.field_of_study || 'AFL tercih mentoru'}
            </p>
          </div>
        </Link>
        <ChatModerationActions
          kind="mentorship"
          conversationId={conversation.id}
          otherUserId={otherProfile.id}
          otherUserName={otherProfile.full_name}
          messages={messages}
          onNotice={(type, message) => setNotice({ type, message })}
        />
        {isCompleted ? (
          <span className="badge bg-emerald-500/10 text-emerald-600">Tamamlandı</span>
        ) : (
          <button onClick={() => setShowEndDialog(true)} disabled={completing} className="btn-secondary text-xs px-3 py-2">
            {completing ? 'Bitiriliyor...' : 'Görüşmeyi sonlandır'}
          </button>
        )}
      </div>

      {hasContactWarning && (
        <div className="bg-amber-500/10 border-x border-surface-200 px-4 py-2.5">
          <p className="text-xs text-amber-700 font-medium">
            Dikkat: Telefon, e-posta veya link paylaşımı platform dışına çıkmana neden olabilir. Kişisel bilgileri paylaşmadan önce iki kez düşün.
          </p>
        </div>
      )}

      {isCompleted && (
        <div className="bg-emerald-500/10 border-x border-surface-200 px-4 py-2.5">
          <p className="text-xs text-emerald-700 font-medium">
            Bu mentorluk tamamlandı olarak işaretlendi. Sohbet geçmişi iki taraf için görünür kalır.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto border-x border-surface-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8faf8_100%)] px-4 py-5 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-surface-500">Henüz mesaj yok. İlk mesajı gönder!</p>
          </div>
        )}
        {messages.map((message) => {
          const isOwn = message.sender_id === userId;
          return (
            <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${
                isOwn
                  ? 'bg-brand-500 text-white rounded-br-md shadow-brand-500/15'
                  : 'border border-surface-200 bg-white text-surface-900 rounded-bl-md shadow-surface-900/[0.03]'
              }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/70' : 'text-surface-500'}`}>
                  {timeAgo(message.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="card rounded-t-none border-t flex items-center gap-3 p-3">
        <input
          ref={messageInputRef}
          type="text"
          value={newMessage}
          onChange={(event) => setNewMessage(event.target.value)}
          placeholder={isCompleted ? 'Tamamlanmış mentorluk' : 'Mesaj yaz...'}
          disabled={isCompleted}
          className="input h-12 flex-1 rounded-xl"
          autoFocus
        />
        <button
          type="submit"
          onMouseDown={(event) => event.preventDefault()}
          disabled={isCompleted || sending || !newMessage.trim()}
          aria-label="Mesaj gönder"
          className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm shadow-brand-500/20 transition hover:bg-brand-600 active:translate-y-px disabled:cursor-not-allowed disabled:bg-surface-200 disabled:text-surface-400 disabled:shadow-none"
        >
          <PaperPlaneTilt size={20} weight="bold" />
        </button>
      </form>

      {showEndDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-900/35 px-4 py-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-surface-200 bg-white p-5 shadow-xl shadow-surface-900/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-surface-900">Görüşmeyi sonlandır?</h3>
                <p className="mt-1.5 text-sm leading-6 text-surface-600">
                  Bu mentorluk tamamlandı olarak işaretlenecek. Sohbet geçmişi iki taraf için görünür kalmaya devam eder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEndDialog(false)}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-surface-500 transition hover:bg-surface-100 hover:text-surface-900"
                aria-label="Kapat"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {canReview && !review && (
              <div className="mt-5 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4">
                <div>
                  <label htmlFor="mentorship-rating" className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">
                    Değerlendirme
                  </label>
                  <p className="mt-1 text-sm text-surface-600">
                    Bu not yalnızca admin tarafında görünür, herkese açık puana dönüşmez.
                  </p>
                </div>
                <select
                  id="mentorship-rating"
                  value={rating}
                  onChange={(event) => setRating(parseInt(event.target.value, 10))}
                  className="input bg-white"
                >
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}/5</option>)}
                </select>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  className="input min-h-24 resize-none bg-white"
                  placeholder="Mentorluk değerlendirmesi (opsiyonel)"
                />
              </div>
            )}

            {canReview && review && (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-500/10 px-4 py-3">
                <p className="text-sm font-medium text-emerald-700">Değerlendirmen kayıtlı. Görüşmeyi sonlandırabilirsin.</p>
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowEndDialog(false)}
                className="btn-secondary justify-center"
                disabled={completing || sendingReview}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={finishConversation}
                className="btn-primary justify-center"
                disabled={completing || sendingReview}
              >
                {completing || sendingReview ? 'Bitiriliyor...' : canReview && !review ? 'Değerlendir ve bitir' : 'Görüşmeyi bitir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
