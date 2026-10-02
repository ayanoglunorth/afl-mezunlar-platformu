'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowClockwise,
  CrownSimple,
  MagnifyingGlass,
  ShieldCheck,
  ShieldSlash,
  SpinnerGap,
  Trash,
  UserGear,
} from '@phosphor-icons/react';
import { getAdminActionLabel } from '@/lib/admin-audit';
import type { AdminAuditLog, AdminPrivilege, Profile, RegistrationReviewReason, UserRole } from '@/types/database';
import { SiteNotice } from '@/components/ui/SiteNotice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type AdminUser = Pick<
  Profile,
  | 'id'
  | 'full_name'
  | 'role'
  | 'student_number'
  | 'university'
  | 'department'
  | 'graduation_year'
  | 'is_profile_complete'
  | 'created_at'
> & {
  registration_review_reason?: RegistrationReviewReason | null;
  registration_registry_entry_id?: number | null;
  admin_privilege: AdminPrivilege | null;
  is_platform_admin: boolean;
  can_manage_admins: boolean;
  email: string | null;
};

type UsersResponse = {
  users: AdminUser[];
  auditLogs: (AdminAuditLog & { actor_name?: string | null; target_name?: string | null })[];
  currentUserId: string;
  canManageAdmins: boolean;
  totalCount: number;
  adminCount: number;
  adminManagerCount: number;
  hasMore: boolean;
  nextOffset: number;
};

type ConfirmAction = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  user: AdminUser;
  action: string;
  demoteTo?: UserRole;
} | null;

const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Öğrenci',
  alumni: 'Mezun',
  teacher: 'Öğretmen',
  admin: 'Eski admin rolü',
};

const PAGE_SIZE = 5000;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function RegistrationReviewBadges({ user }: { user: AdminUser }) {
  if (!user.registration_review_reason) return null;

  const reasonLabel = user.registration_review_reason === 'transferred_from_school'
    ? 'Nakil ile ayrıldı'
    : 'Okul numarasını hatırlamıyor';
  const registryLabel = user.registration_review_reason === 'forgot_school_number'
    ? user.registration_registry_entry_id
      ? 'Veritabanında isim bulundu'
      : 'Doğrulanmış eşleşme yok'
    : null;

  return (
    <div className="mt-2 flex max-w-[280px] flex-wrap gap-1.5">
      <span className="inline-flex rounded-lg bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">
        {reasonLabel}
      </span>
      {registryLabel && (
        <span className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold ${user.registration_registry_entry_id ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-surface-600'}`}>
          {registryLabel}
        </span>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const userById = useMemo(() => {
    return new Map((data?.users || []).map((user) => [user.id, user]));
  }, [data?.users]);

  async function loadUsers(search = query, offset = 0, append = false) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));

    const response = await fetch(`/api/admin/users?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || 'Kullanıcılar alınamadı.');
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    setData((current) => {
      if (!append || !current) return payload;
      return {
        ...payload,
        users: [...current.users, ...payload.users],
      };
    });
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    if (!query.trim() && !data) {
      const initialTimeout = window.setTimeout(() => {
        void loadUsers('', 0, false);
      }, 0);
      return () => window.clearTimeout(initialTimeout);
    }

    const timeout = window.setTimeout(() => {
      void loadUsers(query, 0, false);
    }, 180);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function runAction(user: AdminUser, action: string, demoteTo?: UserRole) {
    setPendingAction(`${action}:${user.id}`);
    setError('');

    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        targetUserId: user.id,
        demoteTo,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || 'İşlem tamamlanamadı.');
      setPendingAction(null);
      return;
    }

    await loadUsers(query, 0, false);
    setPendingAction(null);
  }

  function handleGrantAdmin(user: AdminUser) {
    setConfirmAction({
      title: 'Adminlik verilsin mi?',
      message: `${user.full_name} kullanıcısına adminlik verilecek.`,
      confirmLabel: 'Admin yap',
      user,
      action: 'grant_admin',
    });
  }

  function handleRevokeAdmin(user: AdminUser) {
    const demoteTo = user.role === 'admin' ? 'alumni' : undefined;
    const extra = user.role === 'admin' ? ' Eski admin rolü mezun rolüne çekilecek.' : '';
    setConfirmAction({
      title: 'Adminlik alınsın mı?',
      message: `${user.full_name} kullanıcısının adminliği alınacak.${extra}`,
      confirmLabel: 'Adminliği al',
      user,
      action: 'revoke_admin',
      demoteTo,
    });
  }

  function handleManagerToggle(user: AdminUser) {
    const action = user.can_manage_admins ? 'revoke_manager' : 'grant_manager';
    const label = user.can_manage_admins ? 'admin yönetme yetkisi alınacak.' : 'admin yönetme yetkisi verilecek.';
    setConfirmAction({
      title: user.can_manage_admins ? 'Yetki alınsın mı?' : 'Yetki verilsin mi?',
      message: `${user.full_name} kullanıcısına ${label}`,
      confirmLabel: user.can_manage_admins ? 'Yetkiyi al' : 'Yetki ver',
      user,
      action,
    });
  }

  function handleDeleteUser(user: AdminUser) {
    const label = user.full_name || user.email || user.id;
    const adminWarning = user.is_platform_admin ? ' Bu kullanıcı admin olduğu için yetkileri de kaldırılacak.' : '';
    setConfirmAction({
      title: 'Kullanıcı silinsin mi?',
      message: `${label} kullanıcısı kalıcı olarak silinecek. Bu işlem geri alınamaz.${adminWarning}`,
      confirmLabel: 'Kalıcı sil',
      tone: 'danger',
      user,
      action: 'delete_user',
    });
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    const currentAction = confirmAction;
    setConfirmAction(null);
    await runAction(currentAction.user, currentAction.action, currentAction.demoteTo);
  }

  const loadedCount = data?.users.length || 0;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Kullanıcı Yönetimi</h1>
          <p className="mt-1 max-w-[70ch] text-sm leading-6 text-surface-500">
            Adminlik ayrı bir yetki olarak tutulur. Admin verme, yetki alma ve kullanıcı silme işlemlerini yalnızca admin yöneticileri yapabilir.
          </p>
        </div>
        <button type="button" onClick={() => loadUsers(query, 0, false)} className="btn-secondary h-11 px-4" disabled={loading}>
          <ArrowClockwise className="h-4 w-4" weight="bold" />
          Yenile
        </button>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" weight="bold" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input pl-10"
              placeholder="İsim, e-posta, okul no veya bölüm ara..."
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-surface-500">
            <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700">
              {data?.adminCount || 0} admin
            </span>
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">
              {data?.adminManagerCount || 0} admin yöneticisi
            </span>
            {data && (
              <span className="rounded-lg bg-surface-100 px-2.5 py-1 text-surface-600">
                {loadedCount} / {data.totalCount} gösteriliyor
              </span>
            )}
          </div>
        </div>

        {error && <SiteNotice type="error" message={error} onDismiss={() => setError('')} />}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="max-h-[42rem] overflow-auto rounded-xl border border-surface-100">
              <table className="w-full min-w-[1240px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[27%]" />
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                  <col className="w-[9%]" />
                  <col className="w-[39%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-surface-200 text-left text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">
                    <th className="px-4 pb-3 pt-1">Kullanıcı</th>
                    <th className="px-3 pb-3 pt-1">Rol</th>
                    <th className="px-3 pb-3 pt-1">Admin</th>
                    <th className="px-3 pb-3 pt-1">Profil</th>
                    <th className="px-4 pb-3 pt-1 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {(data?.users || []).map((user) => {
                    const canAct = Boolean(data?.canManageAdmins) && user.id !== data?.currentUserId;
                    const adminActionKey = `${user.is_platform_admin ? 'revoke_admin' : 'grant_admin'}:${user.id}`;
                    const managerActionKey = `${user.can_manage_admins ? 'revoke_manager' : 'grant_manager'}:${user.id}`;
                    const deleteActionKey = `delete_user:${user.id}`;

                    return (
                      <tr key={user.id} className="align-top">
                        <td className="px-4 py-4">
                          <Link
                            href={`/profil/${user.id}`}
                            className="font-semibold text-surface-900 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                          >
                            {user.full_name || 'İsimsiz kullanıcı'}
                          </Link>
                          <div className="mt-1 text-xs text-surface-500">{user.email || user.student_number || user.id}</div>
                          <div className="mt-1 max-w-[280px] truncate text-xs text-surface-400">
                            {[user.university, user.department].filter(Boolean).join(' · ') || 'Ek bilgi yok'}
                          </div>
                          <RegistrationReviewBadges user={user} />
                        </td>
                        <td className="px-3 py-4">
                          <span className="badge badge-neutral">{ROLE_LABELS[user.role]}</span>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-col gap-2">
                            <span className={user.is_platform_admin ? 'badge badge-brand w-fit' : 'badge badge-neutral w-fit'}>
                              {user.is_platform_admin ? 'Admin' : 'Normal kullanıcı'}
                            </span>
                            {user.can_manage_admins && (
                              <span className="inline-flex w-fit items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                <CrownSimple className="h-3.5 w-3.5" weight="fill" />
                                Admin yöneticisi
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <span className={user.is_profile_complete ? 'badge badge-brand' : 'badge badge-neutral'}>
                            {user.is_profile_complete ? 'Tamam' : 'Eksik'}
                          </span>
                          <div className="mt-1 text-xs text-surface-400">{formatDate(user.created_at)}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-nowrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => user.is_platform_admin ? handleRevokeAdmin(user) : handleGrantAdmin(user)}
                              disabled={!canAct || pendingAction === adminActionKey}
                              className={`${user.is_platform_admin ? 'btn-secondary' : 'btn-primary'} h-9 shrink-0 px-3 text-xs whitespace-nowrap`}
                            >
                              {pendingAction === adminActionKey ? (
                                <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                              ) : user.is_platform_admin ? (
                                <ShieldSlash className="h-4 w-4" weight="bold" />
                              ) : (
                                <ShieldCheck className="h-4 w-4" weight="bold" />
                              )}
                              {user.is_platform_admin ? 'Adminliği al' : 'Admin yap'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleManagerToggle(user)}
                              disabled={!canAct || !user.is_platform_admin || pendingAction === managerActionKey}
                              className="btn-secondary h-9 shrink-0 px-3 text-xs whitespace-nowrap"
                            >
                              {pendingAction === managerActionKey ? (
                                <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                              ) : (
                                <UserGear className="h-4 w-4" weight="bold" />
                              )}
                              {user.can_manage_admins ? 'Yetkiyi al' : 'Yönetebilir yap'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              disabled={!canAct || pendingAction === deleteActionKey}
                              className="btn-secondary h-9 shrink-0 px-3 text-xs whitespace-nowrap text-red-700 hover:border-red-200 hover:bg-red-50"
                            >
                              {pendingAction === deleteActionKey ? (
                                <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                              ) : (
                                <Trash className="h-4 w-4" weight="bold" />
                              )}
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data?.hasMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  className="btn-secondary h-10 px-4 text-sm"
                  disabled={loadingMore}
                  onClick={() => loadUsers(query, data.nextOffset, true)}
                >
                  {loadingMore ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : null}
                  Daha fazla yükle
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="text-base font-semibold text-surface-900">Son admin işlemleri</h2>
          <p className="mt-1 text-sm text-surface-500">Adminlik ve admin yönetme yetkisi değişiklikleri burada izlenir.</p>
        </div>

        {data?.auditLogs.length ? (
          <div className="space-y-2">
            {data.auditLogs.map((log) => {
              const actor = log.actor_id ? userById.get(log.actor_id) : null;
              const target = log.target_id ? userById.get(log.target_id) : null;
              return (
                <div key={log.id} className="rounded-xl border border-surface-100 bg-surface-50 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-surface-900">
                      {log.actor_name || actor?.full_name || log.actor_id || 'Sistem'} · {getAdminActionLabel(log.action)}
                    </p>
                    <span className="text-xs font-medium text-surface-400">{formatDate(log.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-surface-500">
                    Hedef: {log.target_name || target?.full_name || log.target_id || 'Bilinmiyor'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-surface-500">Henüz admin işlemi kaydı yok.</p>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmLabel={confirmAction?.confirmLabel}
        cancelLabel="Vazgeç"
        tone={confirmAction?.tone}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
