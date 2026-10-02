'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AlumniRegistryEntry, Profile, RegistrationReviewReason } from '@/types/database';
import { ROLE_LABELS } from '@/lib/utils';

export type AdminDirectoryUser = Pick<
  Profile,
  'id' | 'full_name' | 'role' | 'student_number' | 'university' | 'department' | 'graduation_year'
> & {
  registration_review_reason?: RegistrationReviewReason | null;
  registration_registry_entry_id?: number | null;
};

export type AdminRegistryEntry = AlumniRegistryEntry & {
  has_account: boolean;
  registry_kind?: 'alumni' | 'active_student';
  school_number?: string | null;
  current_grade?: string | null;
  class_section?: string | null;
  expected_graduation_year?: number | null;
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function includesSearch(value: unknown, query: string) {
  if (!query || value === null || value === undefined) return false;
  return String(value).toLocaleLowerCase('tr-TR').includes(query);
}

function ReviewBadges({ user }: { user: AdminDirectoryUser }) {
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
    <div className="mt-2 flex flex-wrap gap-1.5">
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

export function AdminDirectoryPanels({
  users,
  registryEntries,
}: {
  users: AdminDirectoryUser[];
  registryEntries: AdminRegistryEntry[];
}) {
  const [userQuery, setUserQuery] = useState('');
  const [registryQuery, setRegistryQuery] = useState('');

  const filteredUsers = useMemo(() => {
    const query = normalizeSearch(userQuery);
    if (!query) return users;
    return users.filter((user) =>
      [
        user.full_name,
        user.student_number,
        user.university,
        user.department,
        user.graduation_year,
      ].some((value) => includesSearch(value, query)),
    );
  }, [userQuery, users]);

  const filteredRegistry = useMemo(() => {
    const query = normalizeSearch(registryQuery);
    if (!query) return registryEntries;
    return registryEntries.filter((entry) =>
      [
        entry.full_name,
        entry.student_number,
        entry.field_of_study,
        entry.current_grade,
        entry.class_section,
        entry.school_number,
        entry.graduation_year,
      ].some((value) => includesSearch(value, query)),
    );
  }, [registryEntries, registryQuery]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card flex h-[26rem] flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-surface-900">Kullanıcı Ara</h2>
          <p className="mt-1 text-sm text-surface-500">
            {filteredUsers.length} / {users.length} kullanıcı gösteriliyor.
          </p>
        </div>
        <input
          value={userQuery}
          onChange={(event) => setUserQuery(event.target.value)}
          className="input"
          placeholder="İsim, okul no, okul veya bölüm ara..."
        />
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-surface-100">
          {filteredUsers.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {filteredUsers.map((user) => (
                <div key={user.id} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/profil/${user.id}`}
                      className="block truncate text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                    >
                      {user.full_name || 'İsimsiz kullanıcı'}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-surface-500">
                      {[user.student_number, user.department].filter(Boolean).join(' · ') || user.id}
                    </p>
                    <ReviewBadges user={user} />
                  </div>
                  <span className="badge badge-neutral shrink-0 text-xs">{ROLE_LABELS[user.role] || user.role}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center px-4 text-center text-sm text-surface-500">
              Bu aramayla kullanıcı bulunamadı.
            </div>
          )}
        </div>
      </section>

      <section className="card flex h-[26rem] flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-surface-900">Veri Tabanı</h2>
          <p className="mt-1 text-sm text-surface-500">
            {filteredRegistry.length} / {registryEntries.length} kayıt gösteriliyor.
          </p>
        </div>
        <input
          value={registryQuery}
          onChange={(event) => setRegistryQuery(event.target.value)}
          className="input"
          placeholder="İsim, öğrenci numarası, alan veya mezuniyet yılı ara..."
        />
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-surface-100">
          {filteredRegistry.length > 0 ? (
            <table className="w-full min-w-[680px] text-sm">
              <thead className="sticky top-0 z-10 bg-surface-50">
                <tr className="border-b border-surface-200 text-left text-xs text-surface-500">
                  <th className="px-4 py-3 font-medium">Tür</th>
                  <th className="px-4 py-3 font-medium">Öğr. No</th>
                  <th className="px-4 py-3 font-medium">Ad Soyad</th>
                  <th className="px-4 py-3 font-medium">Detay</th>
                  <th className="px-4 py-3 font-medium">Yıl</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredRegistry.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3"><span className="badge badge-neutral text-xs">{entry.registry_kind === 'active_student' ? 'Öğrenci' : 'Mezun'}</span></td>
                    <td className="px-4 py-3 text-surface-700">{entry.student_number}</td>
                    <td className="px-4 py-3 font-medium text-surface-900">{entry.full_name}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs text-surface-500">{entry.registry_kind === 'active_student' ? [entry.current_grade, entry.class_section && entry.class_section + ' Şube'].filter(Boolean).join(' · ') : entry.field_of_study}</td>
                    <td className="px-4 py-3 text-surface-700">{entry.registry_kind === 'active_student' ? entry.expected_graduation_year : entry.graduation_year}</td>
                    <td className="px-4 py-3">
                      {entry.has_account ? (
                        <span className="badge badge-brand text-xs">Hesap Oluşturdu</span>
                      ) : (
                        <span className="badge badge-neutral text-xs">Bekliyor</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center px-4 text-center text-sm text-surface-500">
              Bu aramayla mezun kaydı bulunamadı.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
