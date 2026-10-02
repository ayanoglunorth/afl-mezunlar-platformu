'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { SiteNotice } from '@/components/ui/SiteNotice';
import { reviewProfileNameChange } from './actions';

export type PendingNameChangeItem = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_role: string | null;
  old_full_name: string;
  requested_full_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
};

export function PendingNameChangeList({ initialRequests }: { initialRequests: PendingNameChangeItem[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleReview = (requestId: string, action: 'approve' | 'reject') => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await reviewProfileNameChange(requestId, action);
        if (result.success) {
          setRequests((current) => current.filter((request) => request.id !== requestId));
        }
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : 'Talep işlenemedi.');
      }
    });
  };

  if (!requests.length) {
    return (
      <div className="py-10 text-center text-sm text-surface-500">
        Onay bekleyen ad soyad değişikliği bulunmuyor.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <SiteNotice type="error" message={error} onDismiss={() => setError(null)} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
              <th className="pb-3 pr-4">Kullanıcı</th>
              <th className="pb-3 pr-4">Mevcut Ad</th>
              <th className="pb-3 pr-4">Talep Edilen Ad</th>
              <th className="pb-3 pr-4">Tarih</th>
              <th className="pb-3 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200">
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="py-4 pr-4">
                  <Link
                    href={`/profil/${request.user_id}`}
                    className="font-medium text-surface-900 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                  >
                    {request.user_name || request.user_id}
                  </Link>
                  <p className="mt-1 text-xs text-surface-500">{request.user_role || 'Rol yok'}</p>
                </td>
                <td className="py-4 pr-4 font-medium text-surface-700">{request.old_full_name}</td>
                <td className="py-4 pr-4 font-semibold text-surface-900">{request.requested_full_name}</td>
                <td className="py-4 pr-4 text-surface-600">
                  {new Date(request.created_at).toLocaleDateString('tr-TR')}
                </td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleReview(request.id, 'approve')}
                      disabled={isPending}
                      className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview(request.id, 'reject')}
                      disabled={isPending}
                      className="btn-secondary px-3 py-1.5 text-xs text-red-700 hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
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
    </div>
  );
}
