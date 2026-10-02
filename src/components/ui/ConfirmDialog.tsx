'use client';

import { WarningCircle, X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const isDanger = tone === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-5 shadow-[0_30px_90px_-42px_rgba(17,17,17,0.55)]">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            isDanger ? 'border-red-100 bg-red-50 text-red-700' : 'border-brand-100 bg-brand-50 text-brand-700'
          }`}>
            <WarningCircle className="h-5 w-5" weight="duotone" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-surface-900">{title}</h2>
            <div className="mt-1 text-sm leading-6 text-surface-600">{message}</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg p-2 text-surface-400 transition hover:bg-surface-100 hover:text-surface-700 disabled:opacity-50"
            aria-label="Pencereyi kapat"
          >
            <X className="h-4 w-4" weight="bold" />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary h-10 px-4 text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`btn-primary h-10 px-4 text-sm ${isDanger ? '!bg-red-600 hover:!bg-red-700 focus:ring-red-500' : ''}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
