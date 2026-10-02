'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Flag } from '@phosphor-icons/react';
import { reportForumContent } from '@/app/(main)/topluluk/actions';
import { SiteNotice } from '@/components/ui/SiteNotice';
import type { ForumReactionTargetType } from '@/types/database';

type ForumReportDialogProps = { targetType: ForumReactionTargetType; targetId: string };

export function ForumReportDialog({ targetType, targetId }: ForumReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [isPending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(352, window.innerWidth - 32);
      const left = Math.min(Math.max(16, rect.right - width), window.innerWidth - width - 16);
      setPanelStyle({ left, top: rect.bottom + 8, width });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await reportForumContent(formData);
        setOpen(false);
        setMessage('Raporun alındı. Admin ekibi inceleyecek.');
      } catch (reason) {
        setMessage(reason instanceof Error ? reason.message : 'Rapor gönderilemedi.');
      }
    });
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { setOpen((current) => !current); setMessage(''); }}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25"
      >
        <Flag className="h-3.5 w-3.5" weight="bold" />
        Raporla
      </button>

      {message && !open && (
        <div className="absolute right-0 top-full z-[65] mt-2 w-[min(24rem,calc(100vw-2rem))]">
          <SiteNotice type={message.startsWith('Raporun') ? 'success' : 'error'} message={message} onDismiss={() => setMessage('')} />
        </div>
      )}

      {open && createPortal(
        <form
          onSubmit={submit}
          style={panelStyle}
          className="fixed z-[100] max-h-[min(32rem,calc(100dvh-2rem))] space-y-3 overflow-y-auto rounded-xl border border-surface-200 bg-white p-4 text-left shadow-[0_22px_48px_-28px_rgba(17,17,17,0.36)]"
        >
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <div>
            <label htmlFor={`report-reason-${targetId}`} className="label">Neden</label>
            <select id={`report-reason-${targetId}`} name="reason" className="input" defaultValue="off_topic">
              <option value="spam">Spam</option>
              <option value="abuse">Kırıcı veya uygunsuz içerik</option>
              <option value="privacy">Gizlilik ihlali</option>
              <option value="off_topic">Konu dışı</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div>
            <label htmlFor={`report-note-${targetId}`} className="label">Not</label>
            <textarea id={`report-note-${targetId}`} name="note" rows={4} maxLength={1000} className="input relative z-10 min-h-24 resize-y bg-white" placeholder="Kısa bir açıklama ekleyebilirsin." />
          </div>
          {message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">{message}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-3 py-2 text-xs" disabled={isPending}>Vazgeç</button>
            <button type="submit" disabled={isPending} className="btn-primary px-3 py-2 text-xs disabled:opacity-60">{isPending ? 'Gönderiliyor…' : 'Gönder'}</button>
          </div>
        </form>,
        document.body,
      )}
    </div>
  );
}
