'use client';

import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react';

export type SiteNoticeType = 'success' | 'error' | 'info' | 'warning';

const styles: Record<SiteNoticeType, string> = {
  success: 'border-brand-200/80 bg-white text-brand-900 shadow-brand-900/[0.06] before:bg-brand-500',
  error: 'border-red-200/80 bg-white text-red-900 shadow-red-900/[0.06] before:bg-red-500',
  info: 'border-blue-200/80 bg-white text-blue-950 shadow-blue-900/[0.06] before:bg-blue-500',
  warning: 'border-amber-200/80 bg-white text-amber-950 shadow-amber-900/[0.06] before:bg-amber-500',
};

const iconStyles: Record<SiteNoticeType, string> = {
  success: 'bg-brand-50 text-brand-700 ring-brand-200/80',
  error: 'bg-red-50 text-red-700 ring-red-200/80',
  info: 'bg-blue-50 text-blue-700 ring-blue-200/80',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200/80',
};

export function SiteNotice({
  type = 'info',
  message,
  onDismiss,
  className = '',
}: {
  type?: SiteNoticeType;
  message: string;
  onDismiss?: () => void;
  className?: string;
}) {
  const Icon = type === 'success' ? CheckCircle : WarningCircle;

  return (
    <div className={`relative flex items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 text-sm shadow-[0_18px_46px_-34px] before:absolute before:inset-y-0 before:left-0 before:w-1 ${styles[type]} ${className}`}>
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1 ${iconStyles[type]}`}>
        <Icon className="h-4 w-4" weight="fill" />
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-line leading-5">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 opacity-70 transition hover:bg-white/60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/20"
          aria-label="Bildirimi kapat"
        >
          <X className="h-4 w-4" weight="bold" />
        </button>
      )}
    </div>
  );
}
