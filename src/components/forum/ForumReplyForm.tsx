'use client';

import { useState, useTransition } from 'react';
import { ChatCircleText } from '@phosphor-icons/react';
import { createForumPost } from '@/app/(main)/topluluk/actions';
import { ForumComposer } from '@/components/forum/ForumComposer';
import { useForumPrivacy } from '@/components/forum/ForumPrivacyProvider';

type ForumReplyFormProps = {
  threadId: string;
  parentPostId?: string;
  compact?: boolean;
};

export function ForumReplyForm({ threadId, parentPostId, compact = false }: ForumReplyFormProps) {
  const [open, setOpen] = useState(!compact);
  const [error, setError] = useState('');
  const [composerResetSignal, setComposerResetSignal] = useState(0);
  const [composerFocusSignal, setComposerFocusSignal] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { isAnonymous } = useForumPrivacy();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
      >
        <ChatCircleText className="h-3.5 w-3.5" weight="bold" />
        Yanıtla
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            await createForumPost(formData);
            setComposerResetSignal((current) => current + 1);
            if (compact) {
              setOpen(false);
            } else {
              setComposerFocusSignal((current) => current + 1);
            }
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Yanıt gönderilemedi.');
          }
        });
      }}
      className={compact ? 'mt-3 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-3' : 'card space-y-4'}
    >
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="isAnonymous" value={String(isAnonymous)} />
      {parentPostId && <input type="hidden" name="parentPostId" value={parentPostId} />}
      {!compact && <h3 className="text-sm font-bold text-surface-900">Yanıt yaz</h3>}
      {isAnonymous && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">Anonim paylaşım açık. Kimliğin diğer kullanıcılara gösterilmez.</p>}
      <ForumComposer
        rows={compact ? 3 : 4}
        placeholder="Düşünceni paylaş. @ ile birini etiketleyebilirsin."
        resetSignal={composerResetSignal}
        focusSignal={composerFocusSignal}
      />
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        {compact && (
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-3 py-2 text-xs">
            Vazgeç
          </button>
        )}
        <button type="submit" disabled={isPending} className="btn-primary px-4 py-2 text-xs disabled:opacity-60">
          {isPending ? 'Gönderiliyor…' : 'Gönder'}
        </button>
      </div>
    </form>
  );
}
