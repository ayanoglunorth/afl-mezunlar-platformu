'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Archive, CheckCircle, Trash } from '@phosphor-icons/react';
import { moderateForumContent } from '@/app/(main)/topluluk/actions';

type ModerationAction = 'toggle_pin' | 'toggle_lock' | 'archive' | 'restore_archive' | 'delete';

type AdminModerationButtonProps = {
  targetType: 'thread' | 'post';
  targetId: string;
  action: ModerationAction;
  currentValue?: boolean;
  label: string;
  confirmTitle: string;
  confirmDescription: string;
  tone?: 'neutral' | 'danger';
  groupId?: string;
};

const GROUP_EVENT = 'forum-moderation-open';

export function AdminModerationButton({
  targetType,
  targetId,
  action,
  currentValue,
  label,
  confirmTitle,
  confirmDescription,
  tone = 'neutral',
  groupId = targetId,
}: AdminModerationButtonProps) {
  const router = useRouter();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    const closeOther = (event: Event) => {
      const detail = (event as CustomEvent<{ groupId: string; menuId: string }>).detail;
      if (detail.groupId === groupId && detail.menuId !== menuId) setOpen(false);
    };
    window.addEventListener(GROUP_EVENT, closeOther);
    return () => window.removeEventListener(GROUP_EVENT, closeOther);
  }, [groupId, menuId]);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 32);
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

  function toggleOpen() {
    setError('');
    const next = !open;
    setOpen(next);
    if (next) window.dispatchEvent(new CustomEvent(GROUP_EVENT, { detail: { groupId, menuId } }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current) return;
    setError('');
    const formData = new FormData(event.currentTarget);
    submitLockRef.current = true;
    setIsSubmitting(true);
    startTransition(async () => {
      try {
        const result = await moderateForumContent(formData);
        setOpen(false);
        if (result.deleted && result.targetType === 'thread') {
          router.push('/topluluk');
        } else {
          router.refresh();
          submitLockRef.current = false;
          setIsSubmitting(false);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'İşlem tamamlanamadı.');
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    });
  }

  const icon = action === 'delete' ? <Trash className="h-3.5 w-3.5" weight="bold" /> : action.includes('archive') ? <Archive className="h-3.5 w-3.5" weight="bold" /> : <CheckCircle className="h-3.5 w-3.5" weight="bold" />;
  const buttonClassName = tone === 'danger'
    ? 'rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25'
    : 'rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-bold text-surface-700 transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25';

  return (
    <div className="relative">
      <button ref={buttonRef} type="button" onClick={toggleOpen} aria-expanded={open} className={buttonClassName}>
        {label}
      </button>

      {open && createPortal(
        <div style={panelStyle} className="fixed z-[100] rounded-xl border border-surface-200 bg-white p-4 text-left shadow-[0_22px_48px_-28px_rgba(17,17,17,0.36)]">
          <p className="flex items-center gap-2 text-sm font-bold text-surface-900">{icon}{confirmTitle}</p>
          <p className="mt-1 text-xs leading-5 text-surface-500">{confirmDescription}</p>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-3 py-2 text-xs" disabled={isPending || isSubmitting}>Vazgeç</button>
            <form onSubmit={submit}>
              <input type="hidden" name="targetType" value={targetType} />
              <input type="hidden" name="targetId" value={targetId} />
              <input type="hidden" name="action" value={action} />
              {typeof currentValue === 'boolean' && <input type="hidden" name="currentValue" value={String(currentValue)} />}
              <button type="submit" disabled={isPending || isSubmitting} className={tone === 'danger' ? 'btn-primary bg-red-600 px-3 py-2 text-xs hover:bg-red-700 disabled:opacity-60' : 'btn-primary px-3 py-2 text-xs disabled:opacity-60'}>
                {isPending || isSubmitting ? 'Kaydediliyor…' : 'Onayla'}
              </button>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
