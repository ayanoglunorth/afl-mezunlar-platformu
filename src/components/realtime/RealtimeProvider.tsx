'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

type Toast = { id: string; title: string; message: string; href: string };
type RealtimeProfile = Pick<Profile, 'id' | 'full_name' | 'nickname' | 'role'> & { is_admin?: boolean };
type PresencePayload = Partial<RealtimeProfile> & {
  user_id?: string;
};
type RealtimeProfilePayload = RealtimeProfile & {
  is_admin: boolean | null;
};
type InboxCountsPayload = {
  social_unread: number | null;
  mentor_unread: number | null;
  forum_unread: number | null;
  social_request_count: number | null;
  mentorship_request_count: number | null;
  unread_messages_total: number | null;
  pending_matches_total: number | null;
};
type RealtimeContextValue = {
  profile: RealtimeProfile | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  onlineIds: Set<string>;
  onlineUsers: RealtimeProfile[];
  unreadMessages: number;
  pendingMatches: number;
  unreadNotifications: number;
  toast: Toast | null;
  dismissToast: () => void;
  refreshInbox: () => Promise<void>;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);
const PROFILE_CACHE_KEY = 'afl:realtime-profile:v1';

function readCachedRealtimeProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(PROFILE_CACHE_KEY) || 'null') as RealtimeProfilePayload | null;
    if (!cached?.id || !cached.full_name || !cached.role) return null;
    return {
      profile: {
        id: cached.id,
        full_name: cached.full_name,
        nickname: cached.nickname,
        role: cached.role,
        is_admin: Boolean(cached.is_admin),
      },
      isPlatformAdmin: Boolean(cached.is_admin) || cached.role === 'admin',
    };
  } catch {
    return null;
  }
}

function writeCachedRealtimeProfile(profile: RealtimeProfile, isPlatformAdmin: boolean) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
    id: profile.id,
    full_name: profile.full_name,
    nickname: profile.nickname,
    role: profile.role,
    is_admin: isPlatformAdmin,
  }));
}

function clearCachedRealtimeProfile() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
}

function isMessageRoute(pathname: string) {
  return pathname === '/mesajlar' || pathname.startsWith('/mesajlar/');
}

function isMissingInboxCountsRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_inbox_counts')
  );
}

function isMissingRealtimeProfileRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_realtime_profile')
  );
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const cachedRealtimeProfile = useMemo(() => readCachedRealtimeProfile(), []);
  const [profile, setProfile] = useState<RealtimeProfile | null>(cachedRealtimeProfile?.profile || null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(Boolean(cachedRealtimeProfile?.isPlatformAdmin));
  const [loading, setLoading] = useState(!cachedRealtimeProfile?.profile);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<RealtimeProfile[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingMatches, setPendingMatches] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | null>(null);
  const seenEventIds = useRef(new Set<string>());
  const refreshInFlight = useRef(false);
  const refreshQueued = useRef(false);
  const refreshTimer = useRef<number | null>(null);
  const lastRefreshStartedAt = useRef(0);
  const pendingRefreshReasons = useRef(new Set<string>());
  const [backgroundReady, setBackgroundReady] = useState(false);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((next: Omit<Toast, 'id'>) => {
    if (isMessageRoute(pathname)) return;
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ ...next, id: crypto.randomUUID() });
    toastTimer.current = window.setTimeout(() => setToast(null), 10000);
  }, [pathname]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Temporary perf guard uses refs and a follow-up call to coalesce realtime bursts.
  const runRefreshInbox = useCallback(async (reason = 'direct'): Promise<void> => {
    if (!profile) return;
    if (refreshInFlight.current) {
      refreshQueued.current = true;
      pendingRefreshReasons.current.add(reason);
      return;
    }

    refreshInFlight.current = true;
    lastRefreshStartedAt.current = Date.now();
    pendingRefreshReasons.current.clear();
    try {
      const { data: inboxCountsData, error: inboxCountsError } = await supabase.rpc('get_inbox_counts').maybeSingle();
      const shouldFallback = isMissingInboxCountsRpc(inboxCountsError);

      if (!inboxCountsError && inboxCountsData) {
        const counts = inboxCountsData as InboxCountsPayload;
        setUnreadMessages(counts.unread_messages_total || 0);
        setPendingMatches(counts.pending_matches_total || 0);
        setUnreadNotifications(counts.forum_unread || 0);
        return;
      }

      if (inboxCountsError && !shouldFallback) {
        throw inboxCountsError;
      }

      const [{ data: socialRooms }, { data: mentorRooms }, { count: socialRequests }, { count: mentorshipRequests }] = await Promise.all([
        supabase.from('chat_rooms').select('id').or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`).eq('is_expired', false),
        supabase.from('mentorship_conversations').select('id').or(`student_id.eq.${profile.id},mentor_id.eq.${profile.id}`),
        supabase.from('matches').select('id', { count: 'exact', head: true }).or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`).eq('status', 'pending').neq('requested_by', profile.id),
        supabase.from('mentorship_requests').select('id', { count: 'exact', head: true }).eq('mentor_id', profile.id).eq('status', 'pending'),
      ]);
      const socialIds = (socialRooms || []).map((item: { id: string }) => item.id);
      const mentorIds = (mentorRooms || []).map((item: { id: string }) => item.id);
      const [{ count: socialUnread }, { count: mentorUnread }, { count: forumUnread }] = await Promise.all([
        socialIds.length ? supabase.from('messages').select('id', { count: 'exact', head: true }).in('room_id', socialIds).eq('is_read', false).neq('sender_id', profile.id) : Promise.resolve({ count: 0 }),
        mentorIds.length ? supabase.from('mentorship_messages').select('id', { count: 'exact', head: true }).in('conversation_id', mentorIds).eq('is_read', false).neq('sender_id', profile.id) : Promise.resolve({ count: 0 }),
        supabase.from('forum_notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', profile.id).eq('is_read', false),
      ]);
      const socialRequestCount = socialRequests || 0;
      setUnreadMessages((socialUnread || 0) + (mentorUnread || 0) + socialRequestCount);
      setPendingMatches(socialRequestCount + (mentorshipRequests || 0));
      setUnreadNotifications(forumUnread || 0);
    } catch (error) {
      console.error('Inbox counts could not be refreshed.', error);
    } finally {
      refreshInFlight.current = false;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        window.setTimeout(() => void runRefreshInbox('queued-after-flight'), 250);
      }
    }
  }, [profile, supabase]);

  const requestInboxRefresh = useCallback((reason: string, delayMs = 650) => {
    if (!profile || !backgroundReady) return Promise.resolve();
    pendingRefreshReasons.current.add(reason);
    if (refreshTimer.current) {
      window.clearTimeout(refreshTimer.current);
    }

    const elapsedSinceStart = Date.now() - lastRefreshStartedAt.current;
    const effectiveDelay = refreshInFlight.current || elapsedSinceStart < 500
      ? Math.max(delayMs, 900)
      : delayMs;

    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      void runRefreshInbox(reason);
    }, effectiveDelay);

    return Promise.resolve();
  }, [backgroundReady, profile, runRefreshInbox]);

  const refreshInbox = useCallback(() => requestInboxRefresh('manual', 0), [requestInboxRefresh]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: realtimeProfileData, error: realtimeProfileError } = await supabase.rpc('get_realtime_profile').maybeSingle();
        const shouldFallback = isMissingRealtimeProfileRpc(realtimeProfileError);

        if (!realtimeProfileError && realtimeProfileData) {
          const nextProfile = realtimeProfileData as RealtimeProfilePayload;
          const normalizedProfile: RealtimeProfile = {
            id: nextProfile.id,
            full_name: nextProfile.full_name,
            nickname: nextProfile.nickname,
            role: nextProfile.role,
            is_admin: Boolean(nextProfile.is_admin),
          };
          if (active) {
            setProfile(normalizedProfile);
            setIsPlatformAdmin(Boolean(nextProfile.is_admin) || normalizedProfile.role === 'admin');
            setLoading(false);
            writeCachedRealtimeProfile(normalizedProfile, Boolean(nextProfile.is_admin) || normalizedProfile.role === 'admin');
          }
          return;
        }

        if (realtimeProfileError && !shouldFallback) {
          throw realtimeProfileError;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (active) {
            setProfile(null);
            setIsPlatformAdmin(false);
            setOnlineIds(new Set());
            setOnlineUsers([]);
            setUnreadMessages(0);
            setPendingMatches(0);
            setUnreadNotifications(0);
            setLoading(false);
            clearCachedRealtimeProfile();
          }
          return;
        }
        const [{ data }, { data: adminAccess }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, nickname, role').eq('id', user.id).maybeSingle(),
          supabase.rpc('is_platform_admin', { p_user_id: user.id }),
        ]);
        if (active) {
          const nextProfile = data as RealtimeProfile | null;
          setProfile(nextProfile);
          setIsPlatformAdmin(Boolean(adminAccess) || nextProfile?.role === 'admin');
          setLoading(false);
          if (nextProfile) writeCachedRealtimeProfile(nextProfile, Boolean(adminAccess) || nextProfile.role === 'admin');
          else clearCachedRealtimeProfile();
        }
      } catch (error) {
        if (active) {
          setProfile(null);
          setIsPlatformAdmin(false);
          setOnlineIds(new Set());
          setOnlineUsers([]);
          setUnreadMessages(0);
          setPendingMatches(0);
          setUnreadNotifications(0);
          setLoading(false);
          clearCachedRealtimeProfile();
        }
        console.error('Realtime profile could not be loaded.', error);
      }
    }
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'INITIAL_SESSION') return;
      if (active) setLoading(true);
      void load();
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    if (!profile) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setBackgroundReady(true);
      void runRefreshInbox('profile-ready');
    }, 900);
    return () => window.clearTimeout(timer);
  }, [profile, runRefreshInbox]);

  useEffect(() => {
    if (!profile || !backgroundReady || !pathname.startsWith('/topluluk')) return;
    void supabase
      .from('forum_notifications')
      .update({ is_read: true })
      .eq('recipient_id', profile.id)
      .eq('is_read', false)
      .then(() => {
        void requestInboxRefresh('forum-notifications-mark-read', 500);
      });
  }, [backgroundReady, pathname, profile, requestInboxRefresh, supabase]);

  useEffect(() => {
    if (!profile || !backgroundReady) return;
    const channel = supabase.channel('platform-presence', { config: { presence: { key: profile.id } } });
    
    const sync = () => {
      const state = channel.presenceState();
      
      // Extract unique user profiles from the presence state
      const uniqueUsers = new Map<string, RealtimeProfile>();
      
      Object.values(state).forEach((presences) => {
        (presences as PresencePayload[]).forEach((presence) => {
          const id = presence.id || presence.user_id;
          if (id && !uniqueUsers.has(id)) {
            uniqueUsers.set(id, {
              id: id,
              full_name: presence.full_name || 'Bilinmeyen Kullanıcı',
              role: presence.role || 'student',
              nickname: presence.nickname || '',
              is_admin: presence.is_admin || false
            });
          }
        });
      });
      
      setOnlineIds(new Set(Object.keys(state)));
      setOnlineUsers(Array.from(uniqueUsers.values()));
    };

    channel.on('presence', { event: 'sync' }, sync)
           .on('presence', { event: 'join' }, sync)
           .on('presence', { event: 'leave' }, sync)
           .subscribe(async (status: string) => { 
             if (status === 'SUBSCRIBED') {
               // Update last_seen_at in DB
               void supabase.rpc('update_last_seen').then();
               
               await channel.track({ 
                 id: profile.id,
                 full_name: profile.full_name,
                 nickname: profile.nickname,
                 role: profile.role,
                 is_admin: isPlatformAdmin
               });
             }
           });
           
    // Periodically update last_seen_at every 5 minutes
    const interval = setInterval(() => {
      void supabase.rpc('update_last_seen');
    }, 5 * 60 * 1000);
           
    return () => { 
      clearInterval(interval);
      void channel.untrack(); 
      void supabase.removeChannel(channel); 
    };
  }, [backgroundReady, profile, isPlatformAdmin, supabase]);

  useEffect(() => {
    if (!profile || !backgroundReady) return;
    const handleEvent = (id: string, callback: () => void) => {
      if (seenEventIds.current.has(id)) return;
      seenEventIds.current.add(id);
      if (seenEventIds.current.size > 300) seenEventIds.current.clear();
      callback();
      window.setTimeout(() => void requestInboxRefresh(`event:${id.split(':')[0]}`, 350), 150);
    };
    const channel = supabase.channel(`inbox-events:${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload: { new: { id: string; room_id: string; sender_id: string } }) => {
        const message = payload.new;
        if (message.sender_id !== profile.id) {
          const { data: sender } = await supabase.from('profiles').select('full_name').eq('id', message.sender_id).single();
          const title = sender?.full_name ? `${sender.full_name}'den yeni mesaj` : 'Yeni mesaj';
        handleEvent(`social:${message.id}`, () => showToast({ title, message: 'Sana yeni bir mesaj geldi.', href: `/sohbet/genel/${message.room_id}` }));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mentorship_messages' }, async (payload: { new: { id: string; conversation_id: string; sender_id: string } }) => {
        const message = payload.new;
        if (message.sender_id !== profile.id) {
          const { data: sender } = await supabase.from('profiles').select('full_name').eq('id', message.sender_id).single();
          const title = sender?.full_name ? `${sender.full_name}'den mentorluk mesajı` : 'Yeni mentorluk mesajı';
        handleEvent(`mentor:${message.id}`, () => showToast({ title, message: 'Sana yeni bir mentorluk mesajı geldi.', href: `/sohbet/${message.conversation_id}` }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => void requestInboxRefresh('matches-change', 400))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentorship_requests' }, () => void requestInboxRefresh('mentorship-requests-change', 400))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => void requestInboxRefresh('chat-rooms-change', 400))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentorship_conversations' }, () => void requestInboxRefresh('mentorship-conversations-change', 400))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_notifications', filter: `recipient_id=eq.${profile.id}` }, async (payload: { new: { id: string; thread_id: string; post_id?: string | null; actor_id: string } }) => {
        const [{ data: thread }, { data: targetPost }] = await Promise.all([
          supabase.from('forum_threads_public').select('title').eq('id', payload.new.thread_id).maybeSingle(),
          payload.new.post_id ? supabase.from('forum_posts_public').select('is_anonymous').eq('id', payload.new.post_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        const { data: targetThread } = await supabase.from('forum_threads_public').select('is_anonymous').eq('id', payload.new.thread_id).maybeSingle();
        const anonymous = Boolean(targetPost?.is_anonymous || targetThread?.is_anonymous);
        handleEvent(`forum:${payload.new.id}`, () => showToast({ title: anonymous ? 'Anonim kullanıcı seni etiketledi' : 'Yeni topluluk bildirimi', message: thread?.title || 'Bir topluluk konusunda etiketlendin.', href: `/topluluk/konu/${payload.new.thread_id}` }));
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') void requestInboxRefresh('inbox-channel-subscribed', 400);
      });
    const catchUp = () => {
      if (document.visibilityState === 'visible') void requestInboxRefresh('visibility-or-focus', 600);
    };
    document.addEventListener('visibilitychange', catchUp);
    window.addEventListener('focus', catchUp);
    window.addEventListener('message-read-state-changed', catchUp);
    return () => { document.removeEventListener('visibilitychange', catchUp); window.removeEventListener('focus', catchUp); window.removeEventListener('message-read-state-changed', catchUp); void supabase.removeChannel(channel); };
  }, [backgroundReady, profile, requestInboxRefresh, showToast, supabase]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
  }, []);

  return <RealtimeContext.Provider value={{ profile, loading, isPlatformAdmin, onlineIds, onlineUsers, unreadMessages, pendingMatches, unreadNotifications, toast, dismissToast, refreshInbox }}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used inside RealtimeProvider');
  return context;
}

