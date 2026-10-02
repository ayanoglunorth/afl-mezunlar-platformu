'use client';

import { useState, useTransition } from 'react';
import type { Profile } from '@/types/database';
import { approveAlumni, rejectAlumni } from './actions';
import Image from 'next/image';
import Link from 'next/link';
import { SiteNotice } from '@/components/ui/SiteNotice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

function RegistrationReviewBadges({ alumni }: { alumni: Profile }) {
  if (!alumni.registration_review_reason) return null;

  const reasonLabel = alumni.registration_review_reason === 'transferred_from_school'
    ? 'Nakil ile ayrıldı'
    : 'Okul numarasını hatırlamıyor';
  const registryLabel = alumni.registration_review_reason === 'forgot_school_number'
    ? alumni.registration_registry_entry_id
      ? 'Veritabanında isim bulundu'
      : 'Doğrulanmış eşleşme yok'
    : null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="inline-flex rounded-lg bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">
        {reasonLabel}
      </span>
      {registryLabel && (
        <span className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold ${alumni.registration_registry_entry_id ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-surface-600'}`}>
          {registryLabel}
        </span>
      )}
    </div>
  );
}

export function PendingAlumniList({ initialAlumni }: { initialAlumni: Profile[] }) {
  const [alumniList, setAlumniList] = useState<Profile[]>(initialAlumni);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Profile | null>(null);

  if (alumniList.length === 0) {
    return (
      <div className="py-12 text-center text-surface-500">
        Onay bekleyen mezun bulunmuyor.
      </div>
    );
  }

  const handleApprove = (id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await approveAlumni(id);
        if (res.success) {
          setAlumniList((prev) => prev.filter((a) => a.id !== id));
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Onay sırasında bir hata oluştu');
      }
    });
  };

  const handleReject = (id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await rejectAlumni(id);
        if (res.success) {
          setAlumniList((prev) => prev.filter((a) => a.id !== id));
          setRejectTarget(null);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Kayıt reddedilemedi.');
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <SiteNotice type="error" message={error} onDismiss={() => setError(null)} />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
              <th className="pb-3 pr-4">Mezun Bilgileri</th>
              <th className="pb-3 pr-4">Mezuniyet / Üniversite</th>
              <th className="pb-3 pr-4">Kayıt Tarihi</th>
              <th className="pb-3 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200">
            {alumniList.map((alumni) => (
              <tr key={alumni.id}>
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0 overflow-hidden border border-surface-200">
                      {alumni.avatar_url ? (
                        <Image src={alumni.avatar_url} alt={alumni.full_name} fill className="object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-brand-700">
                          {alumni.full_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <Link
                        href={`/profil/${alumni.id}`}
                        className="font-medium text-surface-900 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                      >
                        {alumni.full_name}
                      </Link>
                      <p className="text-xs text-surface-500">{alumni.nickname ? `@${alumni.nickname}` : 'Nickname yok'}</p>
                      <RegistrationReviewBadges alumni={alumni} />
                    </div>
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <p className="font-medium text-surface-900">{alumni.graduation_year || 'Belirtilmemiş'}</p>
                  <p className="text-xs text-surface-500 max-w-[200px] truncate">{alumni.university || 'Belirtilmemiş'}</p>
                </td>
                <td className="py-4 pr-4">
                  <p className="text-surface-700">{new Date(alumni.created_at).toLocaleDateString('tr-TR')}</p>
                </td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleApprove(alumni.id)}
                      disabled={isPending}
                      className="btn-primary py-1.5 px-3 text-xs disabled:opacity-50"
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectTarget(alumni)}
                      disabled={isPending}
                      className="btn-secondary py-1.5 px-3 text-xs text-red-700 hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reddet
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Kayıt reddedilsin mi?"
        message={`${rejectTarget?.full_name || 'Bu kullanıcı'} hesabı silinecek ve bu kayıt denemesi platformda kilit bırakmayacak şekilde temizlenecek.`}
        confirmLabel="Reddet ve temizle"
        cancelLabel="Vazgeç"
        tone="danger"
        loading={isPending}
        onConfirm={() => {
          if (rejectTarget) handleReject(rejectTarget.id);
        }}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}
