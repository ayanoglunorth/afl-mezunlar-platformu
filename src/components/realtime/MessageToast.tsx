'use client';

import Link from 'next/link';
import { X } from '@phosphor-icons/react';
import { useRealtime } from './RealtimeProvider';

export function MessageToast() {
  const { toast, dismissToast } = useRealtime();
  if (!toast) return null;
  return (
    <div 
      className="fixed left-4 right-4 sm:left-auto sm:right-4 top-20 z-[100] sm:w-96 animate-in slide-in-from-top-4 sm:slide-in-from-right-4 fade-in duration-200" 
      role="status" 
      aria-live="polite"
    >
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-[0_20px_50px_-24px_rgba(17,17,17,.45)]">
        <div className="flex gap-3">
          <Link href={toast.href} onClick={dismissToast} className="min-w-0 flex-1">
            <p className="text-sm font-bold text-surface-900">{toast.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-surface-600">{toast.message}</p>
            <p className="mt-3 text-xs font-semibold text-brand-700">{toast.href.startsWith('/topluluk/') ? 'Konuyu aç' : 'Sohbeti aç'} →</p>
          </Link>
          <button type="button" onClick={dismissToast} className="h-8 w-8 rounded-lg text-surface-500 hover:bg-surface-100" aria-label="Bildirimi kapat">
            <X className="m-auto h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
