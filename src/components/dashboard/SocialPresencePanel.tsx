'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChatCircleText, Eye, PaperPlaneTilt, SpinnerGap, UserPlus, X } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { repairTurkishText } from '@/lib/turkish-text';
import { getInitials, timeAgo } from '@/lib/utils';
import type { ChatRoom, Match, Profile } from '@/types/database';
import { SiteNotice, type SiteNoticeType } from '@/components/ui/SiteNotice';
import { useRealtime } from '@/components/realtime/RealtimeProvider';

type SocialProfile = Pick<
  Profile,
  | 'id'
  | 'full_name'
  | 'nickname'
  | 'role'
  | 'university'
  | 'department'
  | 'field_of_study'
  | 'current_grade'
  | 'target_field'
  | 'bio'
  | 'graduation_year'
  | 'company_name'
  | 'work_title'
  | 'linkedin_url'
  | 'avatar_url'
  | 'updated_at'
>;

type SocialMatch = Pick<Match, 'id' | 'user_a' | 'user_b' | 'status' | 'requested_by' | 'match_reasons'>;

const ROLE_LABELS: Record<Profile['role'], string> = {
  student: 'Öğrenci',
  alumni: 'Mezun',
  teacher: 'Öğretmen',
  admin: 'Yönetici',
};

function getProfileLine(profile: SocialProfile) {
  return [
    profile.university,
    profile.department || profile.field_of_study || profile.target_field || profile.current_grade,
  ].filter(Boolean).join(' · ');
}

function getSortedPair(currentUserId: string, otherUserId: string) {
  return [currentUserId, otherUserId].sort();
}

function getOtherId(item: { user_a: string; user_b: string }, currentUserId: string) {
  return item.user_a === currentUserId ? item.user_b : item.user_a;
}

function getRequestNote(match?: SocialMatch) {
  return match?.match_reasons.find((reason) => reason.startsWith('Mesaj: '))?.replace('Mesaj: ', '') || '';
}

export function SocialPresencePanel({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { onlineIds: platformOnlineIds, isPlatformAdmin } = useRealtime();
  const [people, setPeople] = useState<SocialProfile[]>([]);
  const [matchByUser, setMatchByUser] = useState<Map<string, SocialMatch>>(new Map());
  const [roomByUser, setRoomByUser] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [menuPerson, setMenuPerson] = useState<SocialProfile | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [profilePerson, setProfilePerson] = useState<SocialProfile | null>(null);
  const [requestPerson, setRequestPerson] = useState<SocialProfile | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: SiteNoticeType; message: string } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadPeople = useCallback(async () => {
    setLoading(true);

    const [{ data: profilesData }, { data: matchesData }, { data: roomsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, nickname, role, university, department, field_of_study, current_grade, target_field, bio, graduation_year, company_name, work_title, linkedin_url, avatar_url, updated_at')
        .neq('id', profile.id)
        .eq('is_profile_complete', true)
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('matches')
        .select('id, user_a, user_b, status, requested_by, match_reasons')
        .or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`),
      supabase
        .from('chat_rooms')
        .select('id, match_id, user_a, user_b, expires_at, is_expired, created_at')
        .or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`)
        .eq('is_expired', false),
    ]);

    const matchMap = new Map<string, SocialMatch>();
    const matches = (matchesData || []) as SocialMatch[];
    matches.forEach((match) => {
      matchMap.set(getOtherId(match, profile.id), match);
    });

    const receivedRequestIds = matches
      .filter((match) => match.status === 'pending' && match.requested_by !== profile.id)
      .map((match) => match.id);
    if (receivedRequestIds.length > 0) {
      void fetch('/api/notifications/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: receivedRequestIds }),
      });
    }

    const roomMap = new Map<string, string>();
    ((roomsData || []) as ChatRoom[]).forEach((room) => {
      roomMap.set(getOtherId(room, profile.id), room.id);
    });

    setPeople((profilesData || []) as SocialProfile[]);
    setMatchByUser(matchMap);
    setRoomByUser(roomMap);
    setLoading(false);
  }, [profile.id, supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPeople();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadPeople]);

  useEffect(() => {
    const refresh = () => {
      void loadPeople();
    };

    const channel = supabase
      .channel(`dashboard-social-data:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPeople, profile.id, supabase]);

  useEffect(() => {
    const onlineProfileIds = [...platformOnlineIds].filter((id) => id !== profile.id);
    if (onlineProfileIds.length === 0) return;

    let active = true;
    void supabase
      .from('profiles')
      .select('id, full_name, nickname, role, university, department, field_of_study, current_grade, target_field, bio, graduation_year, company_name, work_title, linkedin_url, avatar_url, updated_at')
      .in('id', onlineProfileIds)
      .eq('is_profile_complete', true)
      .then(({ data }: { data: SocialProfile[] | null }) => {
        if (!active || !data) return;
        const onlineProfiles = data as SocialProfile[];
        const onlineProfileSet = new Set(onlineProfiles.map((item) => item.id));
        setPeople((current) => [
          ...onlineProfiles,
          ...current.filter((item) => !onlineProfileSet.has(item.id)),
        ].slice(0, 50));
      });

    return () => {
      active = false;
    };
  }, [platformOnlineIds, profile.id, supabase]);

  useEffect(() => {
    function handleOutsideClick(event: globalThis.MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuPerson(null);
        setMenuPosition(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuPerson(null);
        setMenuPosition(null);
      }
    }

    if (menuPerson) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuPerson]);

  async function sendRequest() {
    if (!requestPerson || !requestMessage.trim()) return;

    setPendingAction(`request:${requestPerson.id}`);
    setNotice(null);

    const cleanedMessage = repairTurkishText(requestMessage).trim();
    const [userA, userB] = getSortedPair(profile.id, requestPerson.id);
    const { error } = await supabase.from('matches').insert({
      user_a: userA,
      user_b: userB,
      status: 'pending',
      requested_by: profile.id,
      match_score: 0,
      match_reasons: ['Dashboard sosyal panel', `Mesaj: ${cleanedMessage}`],
    });

    if (error) {
      setNotice({
        type: 'error',
        message: error.message.includes('duplicate') ? 'Bu kişiyle zaten açık bir isteğin var.' : error.message,
      });
    } else {
      setNotice({ type: 'success', message: 'Mesaj isteği gönderildi. Kabul edildiğinde sohbet açılacak.' });
      setRequestPerson(null);
      setRequestMessage('');
      await loadPeople();
    }

    setPendingAction(null);
  }

  async function acceptRequest(person: SocialProfile, match: SocialMatch) {
    setPendingAction(`accept:${match.id}`);
    setNotice(null);

    void fetch('/api/notifications/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceIds: [match.id] }),
    });

    const { error } = await supabase
      .from('matches')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', match.id);

    if (error) {
      setNotice({ type: 'error', message: error.message });
      setPendingAction(null);
      return;
    }

    const { data: roomData } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('match_id', match.id)
      .maybeSingle();

    setNotice({ type: 'success', message: 'İstek kabul edildi. Sohbet açıldı.' });
    setPendingAction(null);
    setMenuPerson(null);
    await loadPeople();

    if (roomData?.id) {
      window.location.assign(`/sohbet/genel/${roomData.id}`);
    } else {
      setProfilePerson(person);
    }
  }

  async function openAdminDirectChat(person: SocialProfile) {
    setPendingAction(`direct:${person.id}`);
    setNotice(null);
    const { data, error } = await supabase.rpc('admin_open_direct_chat', { p_recipient_id: person.id });
    setPendingAction(null);
    if (error || !data) {
      setNotice({ type: 'error', message: error?.message || 'Sohbet açılamadı.' });
      return;
    }
    window.location.assign(`/sohbet/genel/${data}`);
  }

  function openRequestModal(person: SocialProfile) {
    setMenuPerson(null);
    setRequestPerson(person);
    setRequestMessage('');
  }

  function getConnectionLabel(person: SocialProfile) {
    const roomId = roomByUser.get(person.id);
    if (roomId) return 'Mesajlaşma açık';

    const match = matchByUser.get(person.id);
    if (match?.status === 'pending') {
      return match.requested_by === profile.id ? 'İstek bekliyor' : 'Gelen istek';
    }

    return 'Mesaj isteği gönderilebilir';
  }

  const onlineIds = useMemo(() => new Set([...platformOnlineIds].filter((id) => id !== profile.id)), [platformOnlineIds, profile.id]);
  const onlineCount = onlineIds.size;
  const visiblePeople = [...people]
    .sort((first, second) => Number(onlineIds.has(second.id)) - Number(onlineIds.has(first.id)))
    .slice(0, 50);

  const activeMatch = menuPerson ? matchByUser.get(menuPerson.id) : undefined;
  const activeRoomId = menuPerson ? roomByUser.get(menuPerson.id) : undefined;
  const requestNote = getRequestNote(activeMatch);

  function openPersonMenu(person: SocialProfile, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const menuWidth = 240;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(rect.right - menuWidth, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding,
    );
    const top = Math.min(rect.top + 6, window.innerHeight - 260);

    setMenuPerson(person);
    setMenuPosition({ top, left });
  }

  return (
    <aside className="flex h-full min-h-[30rem] flex-col rounded-2xl border border-surface-200/80 bg-white/95 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04),0_18px_42px_-36px_rgba(17,17,17,0.28)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-surface-900">Sosyal</h2>
          <p className="mt-0.5 truncate text-xs leading-5 text-surface-500">Aktif ve son aktif kullanıcılar</p>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 px-2.5 text-[11px] font-semibold text-surface-700">
          <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_0_3px_rgba(31,122,77,0.12)]" />
          {onlineCount}
          <span className="text-surface-400">online</span>
        </span>
      </div>

      {notice && (
        <SiteNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
          className="mt-3"
        />
      )}

      <div className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {loading ? (
          [1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-14 rounded-xl" />)
        ) : visiblePeople.length === 0 ? (
          <div className="rounded-xl border border-surface-100 bg-surface-50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-surface-900">Şu an listelenecek kişi yok</p>
            <p className="mt-1 text-xs leading-5 text-surface-500">Profiller tamamlandıkça burada görünür.</p>
          </div>
        ) : (
          visiblePeople.map((person) => {
            const isOnline = onlineIds.has(person.id);

            return (
              <div
                key={person.id}
                role="button"
                tabIndex={0}
                onClick={(event) => openPersonMenu(person, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPersonMenu(person, event.currentTarget);
                  }
                }}
                className="flex w-full cursor-pointer select-none items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
              >
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 text-xs font-bold text-surface-800">
                    {getInitials(person.full_name || 'Kullanıcı')}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                      isOnline ? 'bg-brand-500' : 'bg-surface-300'
                    }`}
                    title={isOnline ? 'Online' : 'Çevrimdışı'}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-surface-900">{person.full_name || 'İsimsiz kullanıcı'}</p>
                    <span className={`shrink-0 text-[11px] font-medium ${isOnline ? 'text-brand-600' : 'text-surface-400'}`}>
                      {isOnline ? 'online' : timeAgo(person.updated_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-surface-500">
                    {ROLE_LABELS[person.role]} · {getProfileLine(person) || getConnectionLabel(person)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {menuPerson && menuPosition && (
        <div
          ref={menuRef}
          className="fixed z-[70] w-60 overflow-hidden rounded-2xl border border-surface-200 bg-white p-2 shadow-[0_24px_48px_-24px_rgba(17,17,17,0.32)]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-bold text-surface-900">{menuPerson.full_name || 'İsimsiz kullanıcı'}</p>
            <p className="mt-0.5 truncate text-xs text-surface-500">{getConnectionLabel(menuPerson)}</p>
          </div>

          {requestNote && activeMatch?.requested_by !== profile.id && (
            <div className="mx-2 mb-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {requestNote}
            </div>
          )}

          <div className="grid gap-1">
              <button
                type="button"
                onClick={() => {
                  setProfilePerson(menuPerson);
                  setMenuPerson(null);
                  setMenuPosition(null);
                }}
                className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-surface-700 transition hover:bg-surface-100 hover:text-surface-900"
              >
                <Eye className="h-4 w-4" weight="bold" />
                <span>Profili görüntüle</span>
              </button>

              {activeRoomId ? (
                <Link href={`/sohbet/genel/${activeRoomId}`} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
                  <ChatCircleText className="h-4 w-4" weight="bold" />
                  <span>Mesaj</span>
                </Link>
              ) : isPlatformAdmin ? (
                <button
                  type="button"
                  onClick={() => void openAdminDirectChat(menuPerson)}
                  disabled={pendingAction === `direct:${menuPerson.id}`}
                  className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === `direct:${menuPerson.id}` ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : <ChatCircleText className="h-4 w-4" weight="bold" />}
                  <span>Mesaj gönder</span>
                </button>
              ) : activeMatch?.status === 'pending' && activeMatch.requested_by !== profile.id ? (
                <button
                  type="button"
                  onClick={() => void acceptRequest(menuPerson, activeMatch)}
                  disabled={pendingAction === `accept:${activeMatch.id}`}
                  className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === `accept:${activeMatch.id}` ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : null}
                  <span>İsteği kabul et</span>
                </button>
              ) : activeMatch?.status === 'pending' ? (
                <span className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-amber-700">
                  İstek bekliyor
                </span>
              ) : (
                <button type="button" onClick={() => openRequestModal(menuPerson)} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
                  <UserPlus className="h-4 w-4" weight="bold" />
                  <span>Mesaj isteği</span>
                </button>
              )}
          </div>
        </div>
      )}

      {profilePerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_30px_80px_-40px_rgba(17,17,17,0.5)]">
            <div className="flex items-start justify-between gap-4 bg-brand-600 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/95 text-sm font-bold text-brand-700">
                  {getInitials(profilePerson.full_name || 'Kullanıcı')}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-white">{profilePerson.full_name || 'İsimsiz kullanıcı'}</h3>
                  <p className="mt-0.5 text-sm text-white/75">
                    {ROLE_LABELS[profilePerson.role]} · {onlineIds.has(profilePerson.id) ? 'online' : timeAgo(profilePerson.updated_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfilePerson(null)}
                className="cursor-pointer rounded-lg p-2 text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                aria-label="Profili kapat"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            <dl className="m-5 grid gap-3 rounded-xl border border-surface-100 bg-surface-50 p-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-400">Profil</dt>
                <dd className="mt-1 font-medium text-surface-900">{getProfileLine(profilePerson) || 'AFL Mezunlar Platformu'}</dd>
              </div>
              {profilePerson.graduation_year && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-400">Mezuniyet</dt>
                  <dd className="mt-1 font-medium text-surface-900">{profilePerson.graduation_year}</dd>
                </div>
              )}
              {(profilePerson.work_title || profilePerson.company_name) && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-400">Kariyer</dt>
                  <dd className="mt-1 font-medium text-surface-900">
                    {[profilePerson.work_title, profilePerson.company_name].filter(Boolean).join(' · ')}
                  </dd>
                </div>
              )}
              {profilePerson.bio && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-400">Hakkında</dt>
                  <dd className="mt-1 leading-6 text-surface-700">{profilePerson.bio}</dd>
                </div>
              )}
            </dl>

            <div className="flex justify-end px-5 pb-5">
              <button type="button" onClick={() => setProfilePerson(null)} className="btn-secondary">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {requestPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-surface-200 bg-white p-5 shadow-[0_30px_80px_-40px_rgba(17,17,17,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-surface-900">{requestPerson.full_name} için mesaj isteği</h3>
                <p className="mt-1 text-sm leading-6 text-surface-500">
                  İstek gönderirken kısa bir not yaz. Kabul edildiğinde sohbet otomatik açılır.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestPerson(null)}
                className="rounded-lg p-2 text-surface-400 transition hover:bg-surface-100 hover:text-surface-700"
                aria-label="İstek penceresini kapat"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            <textarea
              value={requestMessage}
              onChange={(event) => setRequestMessage(event.target.value)}
              className="input mt-4 min-h-32 resize-none"
              placeholder="Merhaba, platform üzerinden tanışıp sohbet etmek isterim..."
            />

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRequestPerson(null)} className="btn-secondary">
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void sendRequest()}
                disabled={pendingAction === `request:${requestPerson.id}` || !requestMessage.trim()}
                className="btn-primary"
              >
                {pendingAction === `request:${requestPerson.id}` ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : <PaperPlaneTilt className="h-4 w-4" weight="bold" />}
                İsteği gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
