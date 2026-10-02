'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChatCircleText, Check, X } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import type { ChatRoom, Match, MentorshipConversation, MentorshipMessage, MentorshipRequest, Message, Profile } from '@/types/database';
import { getInitials, timeAgo } from '@/lib/utils';

type ConversationListItem = MentorshipConversation & {
  other_profile: MessageProfile;
  request: ConversationRequest;
  last_message?: MentorshipMessage;
  unread_count: number;
};

type GeneralRoomListItem = ChatRoom & {
  other_profile: MessageProfile;
  last_message?: Message;
  unread_count: number;
};

type SocialRequestListItem = Match & {
  other_profile: MessageProfile;
  request_note: string;
};

type MessageProfile = Pick<Profile, 'id' | 'full_name' | 'university' | 'department' | 'field_of_study'>;
type ConversationRequest = Pick<MentorshipRequest, 'id' | 'status'>;
type MessagesOverviewPayload = {
  currentUserId?: string;
  mentorshipConversations?: ConversationListItem[];
  generalRooms?: GeneralRoomListItem[];
  socialRequests?: SocialRequestListItem[];
};

function isMissingMessagesOverviewRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_messages_overview')
  );
}

function normalizeMessagesOverview(data: unknown) {
  const payload = (data || {}) as MessagesOverviewPayload;
  return {
    currentUserId: typeof payload.currentUserId === 'string' ? payload.currentUserId : null,
    mentorshipConversations: Array.isArray(payload.mentorshipConversations) ? payload.mentorshipConversations : [],
    generalRooms: Array.isArray(payload.generalRooms) ? payload.generalRooms : [],
    socialRequests: Array.isArray(payload.socialRequests) ? payload.socialRequests : [],
  };
}

export default function MessagesPage() {
  const supabase = useMemo(() => createClient(), []);
  const refreshTimeoutRef = useRef<number | null>(null);
  const loadInFlightRef = useRef(false);
  const loadQueuedRef = useRef(false);
  const lastLoadStartedAtRef = useRef(0);
  const pendingLoadReasonsRef = useRef(new Set<string>());
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [generalRooms, setGeneralRooms] = useState<GeneralRoomListItem[]>([]);
  const [socialRequests, setSocialRequests] = useState<SocialRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingRequestAction, setPendingRequestAction] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Temporary perf guard coalesces realtime bursts without changing message list behavior.
  const loadConversations = useCallback(async (showLoading = true, reason = 'manual') => {
    if (loadInFlightRef.current) {
      loadQueuedRef.current = true;
      pendingLoadReasonsRef.current.add(reason);
      return;
    }

    loadInFlightRef.current = true;
    lastLoadStartedAtRef.current = Date.now();
    pendingLoadReasonsRef.current.clear();
    if (showLoading) setLoading(true);
    try {
    const { data: overviewData, error: overviewError } = await supabase.rpc('get_messages_overview');
    const shouldFallback = isMissingMessagesOverviewRpc(overviewError);

    if (!overviewError && overviewData) {
      const overview = normalizeMessagesOverview(overviewData);
      setConversations(overview.mentorshipConversations);
      setGeneralRooms(overview.generalRooms);
      setSocialRequests(overview.socialRequests);
      setUserId(overview.currentUserId);
      if (overview.socialRequests.length > 0) {
        void fetch('/api/notifications/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceIds: overview.socialRequests.map((request) => request.id) }),
        });
      }
      if (showLoading) setLoading(false);
      return;
    }

    if (overviewError && !shouldFallback) {
      throw overviewError;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const [{ data: roomsData }, { data: generalRoomsData }, { data: socialRequestsData }] = await Promise.all([
      supabase
        .from('mentorship_conversations')
        .select('*')
        .or(`student_id.eq.${user.id},mentor_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false }),
      supabase
        .from('chat_rooms')
        .select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('is_expired', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('matches')
        .select('id, user_a, user_b, status, match_score, match_reasons, requested_by, created_at, responded_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('status', 'pending')
        .neq('requested_by', user.id)
        .order('created_at', { ascending: false }),
    ]);

    const mentorshipConversations = (roomsData || []) as MentorshipConversation[];
    const mentorshipIds = mentorshipConversations.map((conversation) => conversation.id);
    const requestIds = mentorshipConversations.map((conversation) => conversation.request_id);
    const mentorshipOtherIds = mentorshipConversations.map((conversation) =>
      conversation.student_id === user.id ? conversation.mentor_id : conversation.student_id
    );

    const generalConversations = (generalRoomsData || []) as ChatRoom[];
    const generalRoomIds = generalConversations.map((room) => room.id);
    const generalOtherIds = generalConversations.map((room) => room.user_a === user.id ? room.user_b : room.user_a);
    const pendingSocialRequests = (socialRequestsData || []) as Match[];
    const socialRequestOtherIds = pendingSocialRequests.map((request) => (
      request.user_a === user.id ? request.user_b : request.user_a
    ));

    const [
      { data: mentorshipProfilesData },
      { data: requestsData },
      { data: mentorshipMessagesData },
      { data: mentorshipUnreadData },
      { data: generalProfilesData },
      { data: generalMessagesData },
      { data: generalUnreadData },
      { data: socialRequestProfilesData },
    ] = await Promise.all([
      mentorshipOtherIds.length > 0
        ? supabase.from('profiles').select('id, full_name, university, department, field_of_study').in('id', mentorshipOtherIds)
        : Promise.resolve({ data: [] }),
      requestIds.length > 0
        ? supabase.from('mentorship_requests').select('id, status').in('id', requestIds)
        : Promise.resolve({ data: [] }),
      mentorshipIds.length > 0
        ? supabase
          .from('mentorship_messages')
          .select('*')
          .in('conversation_id', mentorshipIds)
          .order('created_at', { ascending: false })
          .limit(Math.max(mentorshipIds.length * 3, 20))
        : Promise.resolve({ data: [] }),
      mentorshipIds.length > 0
        ? supabase
          .from('mentorship_messages')
          .select('conversation_id')
          .in('conversation_id', mentorshipIds)
          .eq('is_read', false)
          .neq('sender_id', user.id)
        : Promise.resolve({ data: [] }),
      generalOtherIds.length > 0
        ? supabase.from('profiles').select('id, full_name, university, department, field_of_study').in('id', generalOtherIds)
        : Promise.resolve({ data: [] }),
      generalRoomIds.length > 0
        ? supabase
          .from('messages')
          .select('*')
          .in('room_id', generalRoomIds)
          .order('created_at', { ascending: false })
          .limit(Math.max(generalRoomIds.length * 3, 20))
        : Promise.resolve({ data: [] }),
      generalRoomIds.length > 0
        ? supabase
          .from('messages')
          .select('room_id')
          .in('room_id', generalRoomIds)
          .eq('is_read', false)
          .neq('sender_id', user.id)
        : Promise.resolve({ data: [] }),
      socialRequestOtherIds.length > 0
        ? supabase.from('profiles').select('id, full_name, university, department, field_of_study').in('id', socialRequestOtherIds)
        : Promise.resolve({ data: [] }),
    ]);

    const mentorshipProfileById = new Map(((mentorshipProfilesData || []) as MessageProfile[]).map((item) => [item.id, item]));
    const requestById = new Map(((requestsData || []) as ConversationRequest[]).map((request) => [request.id, request]));
    const lastMentorshipMessageByConversation = new Map<string, MentorshipMessage>();
    ((mentorshipMessagesData || []) as MentorshipMessage[]).forEach((message) => {
      if (!lastMentorshipMessageByConversation.has(message.conversation_id)) {
        lastMentorshipMessageByConversation.set(message.conversation_id, message);
      }
    });
    const mentorshipUnreadByConversation = new Map<string, number>();
    ((mentorshipUnreadData || []) as Pick<MentorshipMessage, 'conversation_id'>[]).forEach((message) => {
      mentorshipUnreadByConversation.set(message.conversation_id, (mentorshipUnreadByConversation.get(message.conversation_id) || 0) + 1);
    });

    const generalProfileById = new Map(((generalProfilesData || []) as MessageProfile[]).map((item) => [item.id, item]));
    const lastGeneralMessageByRoom = new Map<string, Message>();
    ((generalMessagesData || []) as Message[]).forEach((message) => {
      if (!lastGeneralMessageByRoom.has(message.room_id)) {
        lastGeneralMessageByRoom.set(message.room_id, message);
      }
    });
    const generalUnreadByRoom = new Map<string, number>();
    ((generalUnreadData || []) as Pick<Message, 'room_id'>[]).forEach((message) => {
      generalUnreadByRoom.set(message.room_id, (generalUnreadByRoom.get(message.room_id) || 0) + 1);
    });
    const socialRequestProfileById = new Map(((socialRequestProfilesData || []) as MessageProfile[]).map((item) => [item.id, item]));

    const nextConversations = mentorshipConversations.map((conversation) => {
      const otherId = conversation.student_id === user.id ? conversation.mentor_id : conversation.student_id;

      return {
        ...conversation,
        other_profile: mentorshipProfileById.get(otherId) as MessageProfile,
        request: requestById.get(conversation.request_id) as ConversationRequest,
        last_message: lastMentorshipMessageByConversation.get(conversation.id),
        unread_count: mentorshipUnreadByConversation.get(conversation.id) || 0,
      };
    }).filter((item) => item.other_profile && item.request);
    nextConversations.sort((left, right) => {
      const leftTime = left.last_message?.created_at || left.last_message_at || left.created_at;
      const rightTime = right.last_message?.created_at || right.last_message_at || right.created_at;
      return new Date(rightTime).getTime() - new Date(leftTime).getTime();
    });
    setConversations(nextConversations);

    const nextGeneralRooms = generalConversations.map((room) => {
      const otherId = room.user_a === user.id ? room.user_b : room.user_a;

      return {
        ...room,
        other_profile: generalProfileById.get(otherId) as MessageProfile,
        last_message: lastGeneralMessageByRoom.get(room.id),
        unread_count: generalUnreadByRoom.get(room.id) || 0,
      };
    }).filter((item) => item.other_profile);
    nextGeneralRooms.sort((left, right) => {
      const leftTime = left.last_message?.created_at || left.created_at;
      const rightTime = right.last_message?.created_at || right.created_at;
      return new Date(rightTime).getTime() - new Date(leftTime).getTime();
    });
    setGeneralRooms(nextGeneralRooms);

    setSocialRequests(pendingSocialRequests.map((request) => {
      const otherId = request.user_a === user.id ? request.user_b : request.user_a;
      const requestNote = request.match_reasons.find((reason) => reason.startsWith('Mesaj:'))?.replace(/^Mesaj:\s*/, '').trim()
        || 'Seninle iletişime geçmek istiyor.';

      return {
        ...request,
        other_profile: socialRequestProfileById.get(otherId) as MessageProfile,
        request_note: requestNote,
      };
    }).filter((item) => item.other_profile));

    if (pendingSocialRequests.length > 0) {
      void fetch('/api/notifications/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: pendingSocialRequests.map((request) => request.id) }),
      });
    }

    if (showLoading) setLoading(false);
    } catch {
      if (showLoading) setLoading(false);
    } finally {
      loadInFlightRef.current = false;
      if (loadQueuedRef.current) {
        loadQueuedRef.current = false;
        if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = window.setTimeout(() => {
          refreshTimeoutRef.current = null;
          void loadConversations(false, 'queued-after-flight');
        }, 300);
      }
    }
  }, [supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadConversations(true, 'initial');
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadConversations]);

  useEffect(() => {
    if (!userId) return;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
      const elapsedSinceStart = Date.now() - lastLoadStartedAtRef.current;
      const delayMs = loadInFlightRef.current || elapsedSinceStart < 500 ? 500 : 250;
      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshTimeoutRef.current = null;
        void loadConversations(false, 'realtime-event');
      }, delayMs);
    };

    const channel = supabase
      .channel(`messages-page:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentorship_messages' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentorship_conversations' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [loadConversations, supabase, userId]);

  const totalUnread = [
    ...conversations.map((conversation) => conversation.unread_count),
    ...generalRooms.map((room) => room.unread_count),
    socialRequests.length,
  ].reduce((total, count) => total + count, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        {[1, 2, 3].map((item) => <div key={item} className="skeleton h-24" />)}
      </div>
    );
  }

  const hasAnyConversation = conversations.length > 0 || generalRooms.length > 0 || socialRequests.length > 0;

  async function respondToSocialRequest(matchId: string, action: 'accepted' | 'rejected') {
    setPendingRequestAction(`${action}:${matchId}`);
    const { error } = await supabase
      .from('matches')
      .update({ status: action, responded_at: new Date().toISOString() })
      .eq('id', matchId);

    setPendingRequestAction(null);
    if (!error) {
      void loadConversations(false, 'social-request-response');
    }
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Mesajlar</h1>
        </div>
        {totalUnread > 0 && (
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-brand-500/15 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
            <span className="flex h-2.5 w-2.5 rounded-full bg-brand-500" />
            {totalUnread} okunmamış mesaj
          </div>
        )}
      </div>

      {!hasAnyConversation ? (
        <div className="card py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100">
            <ChatCircleText className="h-7 w-7 text-surface-400" weight="duotone" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-surface-900">Henüz sohbet yok</h3>
          <p className="mt-1.5 text-sm text-surface-500">Bir istek kabul edildiğinde platform içi sohbet otomatik açılır.</p>
          <Link href="/" className="btn-primary mt-4 inline-flex">
            Sosyal panele git
          </Link>
        </div>
      ) : (
        <div className="space-y-7">
          {socialRequests.length > 0 && (
            <MessageSection title="Gelen Mesaj İstekleri">
              {socialRequests.map((request) => (
                <SocialRequestRow
                  key={request.id}
                  request={request}
                  actionLoading={pendingRequestAction === `accepted:${request.id}` || pendingRequestAction === `rejected:${request.id}`}
                  onAccept={() => { void respondToSocialRequest(request.id, 'accepted'); }}
                  onReject={() => { void respondToSocialRequest(request.id, 'rejected'); }}
                />
              ))}
            </MessageSection>
          )}

          {generalRooms.length > 0 && (
            <MessageSection title="Sosyal Sohbetler">
              {generalRooms.map((room) => (
                <MessageRow
                  key={room.id}
                  href={`/sohbet/genel/${room.id}`}
                  profile={room.other_profile}
                  subtitle={[room.other_profile.university, room.other_profile.department || room.other_profile.field_of_study].filter(Boolean).join(' · ') || 'AFL Mezunlar Platformu'}
                  preview={room.last_message?.content || 'Henüz mesaj yok'}
                  time={room.last_message ? timeAgo(room.last_message.created_at) : timeAgo(room.created_at)}
                  unreadCount={room.unread_count}
                  badge="Sosyal"
                />
              ))}
            </MessageSection>
          )}

          {conversations.length > 0 && (
            <MessageSection title="Mentorluk Sohbetleri">
              {conversations.map((conversation) => (
                <MessageRow
                  key={conversation.id}
                  href={`/sohbet/${conversation.id}`}
                  profile={conversation.other_profile}
                  subtitle={[conversation.other_profile.university, conversation.other_profile.department || conversation.other_profile.field_of_study].filter(Boolean).join(' · ') || 'AFL tercih mentoru'}
                  preview={conversation.last_message?.content || 'Henüz mesaj yok'}
                  time={conversation.last_message ? timeAgo(conversation.last_message.created_at) : timeAgo(conversation.created_at)}
                  unreadCount={conversation.unread_count}
                  badge={conversation.request.status === 'completed' ? 'Tamamlandı' : 'Aktif'}
                />
              ))}
            </MessageSection>
          )}
        </div>
      )}
    </div>
  );
}

function SocialRequestRow({
  request,
  actionLoading,
  onAccept,
  onReject,
}: {
  request: SocialRequestListItem;
  actionLoading: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-2xl border border-brand-500/20 bg-brand-50/50 p-4 shadow-sm shadow-brand-500/5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-500/20 bg-white text-brand-700">
          <span className="text-sm font-bold">{getInitials(request.other_profile.full_name)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-surface-900">{request.other_profile.full_name}</h3>
              <p className="mt-0.5 text-xs text-surface-500">
                {[request.other_profile.university, request.other_profile.department || request.other_profile.field_of_study].filter(Boolean).join(' · ') || 'AFL Mezunlar Platformu'}
              </p>
            </div>
            <span className="badge badge-brand">Yeni istek</span>
          </div>

          <p className="mt-3 text-sm text-surface-700">{request.request_note}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={onAccept} disabled={actionLoading} className="btn-primary">
              <Check className="h-4 w-4" weight="bold" />
              Kabul Et
            </button>
            <button onClick={onReject} disabled={actionLoading} className="btn-secondary">
              <X className="h-4 w-4" weight="bold" />
              Reddet
            </button>
            <span className="text-[11px] font-medium text-surface-400">{timeAgo(request.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-surface-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function MessageRow({
  href,
  profile,
  subtitle,
  preview,
  time,
  unreadCount,
  badge,
}: {
  href: string;
  profile: MessageProfile;
  subtitle: string;
  preview: string;
  time: string;
  unreadCount: number;
  badge: string;
}) {
  const hasUnread = unreadCount > 0;

  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        hasUnread
          ? 'border-brand-500/25 bg-brand-50/60 shadow-brand-500/5'
          : 'border-surface-200 bg-white shadow-surface-900/[0.03] hover:border-surface-300'
      }`}
    >
      <div className="relative shrink-0">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
          hasUnread
            ? 'border-brand-500/25 bg-white text-brand-600'
            : 'border-surface-200 bg-surface-50 text-surface-700'
        }`}>
          <span className="text-sm font-bold">{getInitials(profile.full_name)}</span>
        </div>
        {hasUnread && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 rounded-full border-2 border-white bg-brand-500" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`truncate text-sm text-surface-900 ${hasUnread ? 'font-bold' : 'font-semibold'}`}>
              {profile.full_name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-surface-500">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasUnread && (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
            <span className="badge badge-brand">{badge}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <ChatCircleText size={16} weight={hasUnread ? 'fill' : 'regular'} className={hasUnread ? 'text-brand-600' : 'text-surface-400'} />
          <p className={`min-w-0 flex-1 truncate text-sm ${hasUnread ? 'font-semibold text-surface-900' : 'text-surface-500'}`}>
            {preview}
          </p>
          <p className="shrink-0 text-[11px] font-medium text-surface-400">{time}</p>
        </div>
      </div>
    </Link>
  );
}
