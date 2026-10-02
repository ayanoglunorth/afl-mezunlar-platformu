'use client';

import { useEffect, useMemo, useState } from 'react';
import { UserCircle } from '@phosphor-icons/react/dist/ssr';
import { useRealtime } from '@/components/realtime/RealtimeProvider';
import { getInitials } from '@/lib/utils';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

type RecentUser = {
  id: string;
  full_name: string;
  role: string;
  nickname: string;
  last_seen_at: string;
  is_admin?: boolean;
};

type RecentUserRow = RecentUser & {
  admin_privileges?: { user_id: string }[] | { user_id: string } | null;
};

function hasAdminPrivilege(value: RecentUserRow['admin_privileges']) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function isMissingSocialBoardRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_social_board_snapshot')
  );
}

export function SocialBoard() {
  const { onlineUsers, profile, onlineIds } = useRealtime();
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchRecentUsers() {
      if (!profile) return;

      const { data: snapshotData, error: snapshotError } = await supabase.rpc('get_social_board_snapshot');
      if (!snapshotError && snapshotData) {
        const snapshot = snapshotData as { recentUsers?: RecentUser[] };
        setRecentUsers((snapshot.recentUsers || []).filter((user) => !onlineIds.has(user.id)));
        return;
      }

      if (snapshotError && !isMissingSocialBoardRpc(snapshotError)) {
        return;
      }
      
      const query = supabase
        .from('profiles')
        .select('id, full_name, role, nickname, last_seen_at, admin_privileges!admin_privileges_user_id_fkey(user_id)')
        .not('last_seen_at', 'is', null)
        .order('last_seen_at', { ascending: false });
        
      if (onlineIds.size > 0) {
        query.not('id', 'in', `(${Array.from(onlineIds).join(',')})`);
      }
      
      const { data } = await query.limit(50);
      
      if (data) {
        const mappedRecent = (data as RecentUserRow[]).map((u) => ({
          ...u,
          is_admin: u.role === 'admin' || hasAdminPrivilege(u.admin_privileges)
        }));
        setRecentUsers(mappedRecent as RecentUser[]);
      }
    }
    
    // We can fetch this once on mount, and then maybe periodically or when onlineIds changes
    // But fetching on mount is usually sufficient for a "recently active" list
    void fetchRecentUsers();
  }, [profile, onlineIds, supabase]);

  // Sort users: current user first, then alphabetically
  const displayUsers = [...onlineUsers].sort((a, b) => {
    if (a.id === profile?.id) return -1;
    if (b.id === profile?.id) return 1;
    return a.full_name.localeCompare(b.full_name);
  });

  return (
    <aside
      className="group flex h-[34rem] max-h-[calc(100dvh-6rem)] self-start flex-col overflow-hidden rounded-2xl border border-surface-200/80 bg-white/95 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04),0_18px_42px_-36px_rgba(17,17,17,0.28)]"
      aria-label="Sosyal board"
    >
      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-surface-900">Sosyal</h2>
          <p className="mt-0.5 truncate text-xs leading-5 text-surface-500">Platformdaki aktif kullanıcılar</p>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 px-2.5 text-[11px] font-semibold text-surface-700">
          <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_0_3px_rgba(31,122,77,0.12)]" />
          {onlineUsers.length}
          <span className="text-surface-400">online</span>
        </span>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 relative z-10 pb-4">
        {displayUsers.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center text-center opacity-70">
            <UserCircle className="h-8 w-8 text-surface-300 mb-2" weight="duotone" />
            <p className="text-sm font-medium text-surface-600">Bağlanıyor...</p>
          </div>
        ) : (
          displayUsers.map((user) => (
            <Link
              href={user.id === profile?.id ? '/profil' : `/profil/${user.id}`}
              key={user.id}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-50 transition-colors"
            >
              <div className="relative shrink-0">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border font-bold text-xs ${
                  user.role === 'student' ? 'border-blue-100 bg-blue-50 text-blue-700' :
                  user.role === 'alumni' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' :
                  'border-surface-200 bg-surface-50 text-surface-800'
                }`}>
                  {getInitials(user.full_name)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-surface-900">
                    {user.full_name} {user.id === profile?.id && <span className="text-surface-400 font-normal">(Sen)</span>}
                  </p>
                  {user.role === 'alumni' && (
                    <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      Mezun
                    </span>
                  )}
                  {user.role === 'student' && (
                    <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      Öğrenci
                    </span>
                  )}
                  {user.is_admin && (
                    <span className="shrink-0 rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                      Yönetici
                    </span>
                  )}
                </div>
                {user.nickname && (
                  <p className="truncate text-xs text-surface-500">@{user.nickname}</p>
                )}
              </div>
            </Link>
          ))
        )}

        {recentUsers.length > 0 && (
          <div className="pt-4 mt-2 border-t border-surface-100">
            <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 px-1">Son Aktif Olanlar</h3>
            {recentUsers.map((user) => (
              <Link
                href={`/profil/${user.id}`}
                key={user.id}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-50 transition-colors opacity-80 hover:opacity-100"
              >
                <div className="relative shrink-0">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border font-bold text-xs ${
                    user.role === 'student' ? 'border-blue-100 bg-blue-50 text-blue-700' :
                    user.role === 'alumni' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' :
                    'border-surface-200 bg-surface-50 text-surface-800'
                  }`}>
                    {getInitials(user.full_name)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-surface-900">{user.full_name}</p>
                    {user.role === 'alumni' && (
                      <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        Mezun
                      </span>
                    )}
                    {user.role === 'student' && (
                      <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                        Öğrenci
                      </span>
                    )}
                    {user.is_admin && (
                      <span className="shrink-0 rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                        Yönetici
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-surface-500 mt-0.5">
                    {formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true, locale: tr })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <UserCircle className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 text-surface-100 opacity-50 z-0" weight="duotone" />
    </aside>
  );
}
