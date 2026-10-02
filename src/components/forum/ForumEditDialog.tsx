'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { NotePencil, X } from '@phosphor-icons/react';
import { editForumPost, editForumThread } from '@/app/(main)/topluluk/actions';
import { ForumComposer } from '@/components/forum/ForumComposer';
import type { Profile } from '@/types/database';

type MentionUser = Pick<Profile, 'id' | 'full_name' | 'role'>;

type ForumEditDialogProps = {
  targetType: 'thread' | 'post';
  targetId: string;
  title?: string;
  content: string;
  mentions: MentionUser[];
};

export function ForumEditDialog({ targetType, targetId, title = '', content, mentions }: ForumEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const isThread = targetType === 'thread';

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPending, open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        if (isThread) {
          await editForumThread(formData);
        } else {
          await editForumPost(formData);
        }
        setOpen(false);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Düzenleme kaydedilemedi.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(''); setOpen(true); }}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25"
      >
        <NotePencil className="h-3.5 w-3.5" weight="bold" />
        Düzenle
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[110] flex min-h-[100dvh] items-center justify-center bg-surface-950/45 px-4 py-5"
          role="dialog"
          aria-modal="true"
          aria-label={isThread ? 'Konuyu düzenle' : 'Yanıtı düzenle'}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) setOpen(false);
          }}
        >
          <div ref={dialogRef} className="flex max-h-[calc(100dvh-3rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_28px_80px_-38px_rgba(17,17,17,0.55)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-surface-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-surface-900">{isThread ? 'Konuyu düzenle' : 'Yanıtı düzenle'}</h2>
                <p className="mt-1 text-sm text-surface-500">İçeriği ve etiketlediğin kişileri güncelleyebilirsin.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name={isThread ? 'threadId' : 'postId'} value={targetId} />
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {isThread && (
                  <div>
                    <label htmlFor={`forum-edit-title-${targetId}`} className="label">Başlık</label>
                    <input
                      id={`forum-edit-title-${targetId}`}
                      name="title"
                      className="input"
                      minLength={6}
                      maxLength={140}
                      required
                      defaultValue={title}
                    />
                  </div>
                )}
                <div>
                  <label className="label">İçerik</label>
                  <ForumComposer
                    rows={isThread ? 5 : 4}
                    placeholder="İçeriğini düzenle. @ ile birini etiketleyebilirsin."
                    initialValue={content}
                    initialMentions={mentions}
                  />
                </div>
              </div>

              {error && <p role="alert" className="mx-5 mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">{error}</p>}
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-surface-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-4 py-2.5" disabled={isPending}>
                  Vazgeç
                </button>
                <button type="submit" disabled={isPending} className="btn-primary px-5 py-2.5 disabled:cursor-wait disabled:opacity-60">
                  {isPending ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
