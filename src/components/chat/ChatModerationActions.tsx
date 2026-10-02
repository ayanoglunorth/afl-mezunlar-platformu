'use client';

import { useMemo, useState } from 'react';
import { Flag, Star, X } from '@phosphor-icons/react';

type ChatMessageForModeration = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export function ChatModerationActions({
  kind,
  conversationId,
  otherUserId,
  otherUserName,
  messages,
  onNotice,
}: {
  kind: 'social' | 'mentorship';
  conversationId: string;
  otherUserId: string;
  otherUserName: string;
  messages: ChatMessageForModeration[];
  onNotice: (type: 'success' | 'error', message: string) => void;
}) {
  const [mode, setMode] = useState<'review' | 'report' | null>(null);
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const reportableMessages = useMemo(
    () => messages.filter((message) => message.sender_id === otherUserId).slice().reverse(),
    [messages, otherUserId],
  );

  function close() {
    if (submitting) return;
    setMode(null);
    setNote('');
    setSelectedMessageIds([]);
  }

  async function submitReview() {
    setSubmitting(true);
    const response = await fetch('/api/chat/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'review', kind, conversationId, rating, note }),
    });
    const result = await response.json() as { error?: string };
    setSubmitting(false);
    if (!response.ok) {
      onNotice('error', result.error || 'Değerlendirme kaydedilemedi.');
      return;
    }
    onNotice('success', 'Değerlendirmeniz yöneticiler için kaydedildi.');
    close();
  }

  async function submitReport() {
    setSubmitting(true);
    const response = await fetch('/api/chat/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'report',
        kind,
        conversationId,
        note,
        messageIds: selectedMessageIds,
      }),
    });
    const result = await response.json() as { error?: string };
    setSubmitting(false);
    if (!response.ok) {
      onNotice('error', result.error || 'Şikâyet gönderilemedi.');
      return;
    }
    onNotice('success', 'Şikâyetiniz ve seçtiğiniz mesajlar yöneticilere iletildi.');
    close();
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setMode('review')}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-surface-600 transition hover:bg-surface-100 hover:text-surface-900"
        >
          <Star className="h-4 w-4" weight="bold" />
          <span className="hidden sm:inline">Değerlendir</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('report')}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
        >
          <Flag className="h-4 w-4" weight="bold" />
          <span className="hidden sm:inline">Şikâyet Et</span>
        </button>
      </div>

      {mode && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-surface-900/35 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-surface-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-surface-900">
                  {mode === 'review' ? `${otherUserName} için değerlendirme` : 'Mesajları şikâyet et'}
                </h2>
                <p className="mt-1 text-sm leading-6 text-surface-500">
                  {mode === 'review'
                    ? 'Puan ve not yalnızca yöneticiler tarafından görülür.'
                    : 'Şikâyete eklenecek bir veya birkaç mesajı seçin.'}
                </p>
              </div>
              <button type="button" onClick={close} className="btn-ghost h-9 w-9 p-0" aria-label="Kapat">
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            {mode === 'review' ? (
              <div className="mt-5">
                <div className="flex gap-1" aria-label={`${rating} yıldız`}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className="rounded-lg p-1.5 text-amber-500 transition hover:bg-amber-50"
                      aria-label={`${value} puan`}
                    >
                      <Star className="h-7 w-7" weight={value <= rating ? 'fill' : 'regular'} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, 2000))}
                  className="input mt-4 min-h-28 resize-none"
                  placeholder="Kısa bir değerlendirme notu (opsiyonel)"
                />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-surface-200 bg-surface-50 p-2">
                  {reportableMessages.length === 0 ? (
                    <p className="p-3 text-sm text-surface-500">Şikâyet edilebilecek karşı taraf mesajı bulunamadı.</p>
                  ) : reportableMessages.map((message) => {
                    const selected = selectedMessageIds.includes(message.id);
                    return (
                      <label key={message.id} className="flex cursor-pointer gap-3 rounded-lg bg-white p-3 text-sm shadow-sm">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => setSelectedMessageIds((current) => (
                            selected ? current.filter((id) => id !== message.id) : [...current, message.id]
                          ))}
                          className="mt-0.5 h-4 w-4 accent-red-600"
                        />
                        <span className="break-words text-surface-700">{message.content}</span>
                      </label>
                    );
                  })}
                </div>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, 2000))}
                  className="input min-h-24 resize-none"
                  placeholder="Şikâyet açıklaması (opsiyonel)"
                />
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className="btn-secondary" disabled={submitting}>Vazgeç</button>
              <button
                type="button"
                onClick={mode === 'review' ? submitReview : submitReport}
                className={mode === 'review' ? 'btn-primary' : 'inline-flex items-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50'}
                disabled={submitting || (mode === 'report' && selectedMessageIds.length === 0)}
              >
                {submitting ? 'Gönderiliyor...' : mode === 'review' ? 'Değerlendirmeyi kaydet' : 'Şikâyeti gönder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
