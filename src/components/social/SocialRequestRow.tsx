'use client';

import { Check, X } from '@phosphor-icons/react';
import { getInitials, timeAgo } from '@/lib/utils';
import type { Profile } from '@/types/database';

export type SocialRequestRowData = {
  id: string;
  created_at: string;
  other_profile: Profile;
  request_note: string;
};

type SocialRequestRowProps = {
  request: SocialRequestRowData;
  actionLoading: boolean;
  onAccept: () => void;
  onReject: () => void;
};

export function SocialRequestRow({ request, actionLoading, onAccept, onReject }: SocialRequestRowProps) {
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
            <button type="button" onClick={onAccept} disabled={actionLoading} className="btn-primary">
              <Check className="h-4 w-4" weight="bold" />
              Kabul Et
            </button>
            <button type="button" onClick={onReject} disabled={actionLoading} className="btn-secondary">
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
