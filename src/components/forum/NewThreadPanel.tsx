'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Plus, X } from '@phosphor-icons/react';
import { createForumCategory } from '@/app/(main)/topluluk/actions';
import { ForumComposer } from '@/components/forum/ForumComposer';
import { useForumPrivacy } from '@/components/forum/ForumPrivacyProvider';
import type { ForumCategory, ForumTag } from '@/types/database';

const NEW_CATEGORY_VALUE = '__new_category__';

type NewThreadPanelProps = {
  categories: ForumCategory[];
  tags: ForumTag[];
  defaultCategoryId?: string;
  variant?: 'card' | 'button';
};

export function NewThreadPanel({ categories, tags, defaultCategoryId, variant = 'card' }: NewThreadPanelProps) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [categoryNotice, setCategoryNotice] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [localCategories, setLocalCategories] = useState(categories);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCreatingCategory, startCategoryTransition] = useTransition();
  const submitLockRef = useRef(false);
  const { isAnonymous } = useForumPrivacy();
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultCategoryId || categories[0]?.id || '');
  const showNewCategoryFields = selectedCategoryId === NEW_CATEGORY_VALUE;

  const visibleTags = tags.filter((tag) => !tag.category_id || tag.category_id === selectedCategoryId);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current) return;
    setError('');
    if (showNewCategoryFields) {
      setCategoryError('Konu paylaşmadan önce yeni kategoriyi eklemelisin.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    submitLockRef.current = true;
    setIsSubmitting(true);
    startTransition(async () => {
      try {
        const response = await fetch('/api/forum/threads', {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' },
        });
        const result = await response.json().catch(() => null) as { ok?: boolean; href?: string; error?: string } | null;
        if (!response.ok || !result?.ok || !result.href) {
          throw new Error(result?.error || 'Konu oluşturulamadı.');
        }
        setOpen(false);
        router.push(result.href);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Konu oluşturulamadı.';
        setError(message);
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    });
  }

  function createCategory() {
    const formData = new FormData();
    formData.set('categoryName', newCategoryName);
    setCategoryError('');
    setCategoryNotice('');

    startCategoryTransition(async () => {
      try {
        const category = await createForumCategory(formData);
        setLocalCategories((current) => (
          current.some((item) => item.id === category.id)
            ? current
            : [...current, category]
        ));
        setSelectedCategoryId(category.id);
        setNewCategoryName('');
        setCategoryNotice(`${category.name} kategorisi seçildi.`);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Kategori oluşturulamadı.';
        setCategoryError(message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('');
          setCategoryError('');
          setCategoryNotice('');
          setOpen(true);
        }}
        className={
          variant === 'button'
            ? 'btn-primary px-5 py-3 text-sm'
            : 'flex min-h-24 w-full items-center justify-between gap-4 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-left shadow-[0_14px_36px_-30px_rgba(17,17,17,0.45)] transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-surface-300 hover:bg-surface-50'
        }
      >
        {variant === 'button' ? (
          <>
            <Plus className="h-4 w-4" weight="bold" />
            Yeni konu aç
          </>
        ) : (
          <>
            <span>
              <span className="block text-sm font-bold text-surface-900">Yeni konu aç</span>
              <span className="mt-1 block text-xs leading-5 text-surface-500">Soru sor, deneyim paylaş veya fikir al.</span>
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-900 text-white">
              <Plus className="h-4 w-4" weight="bold" />
            </span>
          </>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center bg-surface-950/45 px-4 py-5" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="flex max-h-[calc(100dvh-5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_28px_80px_-38px_rgba(17,17,17,0.55)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-surface-200 px-5 py-4">
              <div>
                <h2 id={titleId} className="text-lg font-bold text-surface-900">Yeni konu aç</h2>
                <p className="mt-1 text-sm text-surface-500">Konu başlığını net tut, doğru kategori ve etiketleri seç.</p>
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
              <input type="hidden" name="isAnonymous" value={String(isAnonymous)} />
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {isAnonymous && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                    Anonim paylaşım açık. Adın, kullanıcı adın ve profil bağlantın diğer kullanıcılara gösterilmez.
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
                  <div>
                    <label htmlFor="forum-thread-title" className="label">Başlık</label>
                    <input
                      id="forum-thread-title"
                      name="title"
                      className="input"
                      minLength={6}
                      maxLength={140}
                      required
                      placeholder="Örn. tercih listem için fikre ihtiyacım var"
                    />
                  </div>

                  <div>
                    <label htmlFor="forum-thread-category" className="label">Kategori</label>
                    <select
                      id="forum-thread-category"
                      name="categoryId"
                      value={selectedCategoryId}
                      onChange={(event) => {
                        setSelectedCategoryId(event.target.value);
                        setCategoryError('');
                        setCategoryNotice('');
                      }}
                      className="input cursor-pointer"
                      required
                    >
                      {localCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                      <option value={NEW_CATEGORY_VALUE}>Diğer / yeni kategori oluştur</option>
                    </select>

                    {showNewCategoryFields && (
                      <div className="mt-2 rounded-xl border border-surface-200 bg-surface-50 p-2">
                        <label htmlFor="forum-new-category-name" className="sr-only">Yeni kategori adı</label>
                        <div className="flex gap-2">
                          <input
                            id="forum-new-category-name"
                            value={newCategoryName}
                            onChange={(event) => {
                              setNewCategoryName(event.target.value);
                              setCategoryError('');
                              setCategoryNotice('');
                            }}
                            className="min-w-0 flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-surface-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                            maxLength={40}
                            placeholder="Yeni kategori adı"
                          />
                          <button
                            type="button"
                            onClick={createCategory}
                            disabled={isCreatingCategory || newCategoryName.trim().length < 3}
                            className="shrink-0 rounded-lg bg-surface-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-surface-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isCreatingCategory ? 'Ekleniyor...' : 'Ekle'}
                          </button>
                        </div>
                        {(categoryError || categoryNotice) && (
                          <p
                            role={categoryError ? 'alert' : 'status'}
                            aria-live="polite"
                            className={categoryError ? 'mt-2 text-xs font-semibold text-red-700' : 'mt-2 text-xs font-semibold text-brand-700'}
                          >
                            {categoryError || categoryNotice}
                          </p>
                        )}
                      </div>
                    )}
                    {!showNewCategoryFields && categoryNotice && (
                      <p role="status" aria-live="polite" className="mt-2 text-xs font-semibold text-brand-700">
                        {categoryNotice}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">Etiketler</label>
                  <div className="max-h-24 overflow-y-auto rounded-xl border border-surface-200 bg-surface-50 p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {visibleTags.map((tag) => (
                        <label key={tag.id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-surface-700 transition-colors hover:border-surface-300 hover:bg-surface-100">
                          <input type="checkbox" name="tagIds" value={tag.id} className="h-3.5 w-3.5 accent-brand-600" />
                          {tag.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">İçerik</label>
                  <ForumComposer rows={3} placeholder="@ ile birini etiketleyebilir, konuyu netçe anlatabilirsin." />
                </div>
              </div>

              {error && <p role="alert" className="mx-5 mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">{error}</p>}
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-surface-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-4 py-2.5" disabled={isSubmitting}>
                  Vazgeç
                </button>
                <button type="submit" disabled={isPending || isSubmitting} className="btn-primary px-5 py-2.5 disabled:cursor-wait disabled:opacity-60">
                  {isPending || isSubmitting ? 'Paylaşılıyor...' : 'Konuyu paylaş'}
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
