'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChatCircleText, Eye, Fire, MagnifyingGlass, Tag } from '@phosphor-icons/react';
import { NewThreadPanel } from '@/components/forum/NewThreadPanel';
import { ForumPrivacyToggle } from '@/components/forum/ForumPrivacyProvider';
import { createForumThreadPreview } from '@/lib/forum';
import { getInitials, timeAgo } from '@/lib/utils';
import type { ForumCategory, ForumTag, ForumThread, Profile } from '@/types/database';

type EnrichedThread = ForumThread & {
  author: Pick<Profile, 'id' | 'full_name' | 'role'> | null;
  category: ForumCategory | null;
  tags: ForumTag[];
};

type ForumFilterKey = 'latest' | 'popular' | 'unanswered' | 'pinned';

type ForumAllThreadsClientProps = {
  categories: ForumCategory[];
  tags: ForumTag[];
  threads: EnrichedThread[];
  currentUserId?: string;
};

const FILTERS: { key: ForumFilterKey; label: string }[] = [
  { key: 'latest', label: 'Tümü' },
  { key: 'popular', label: 'Popüler' },
  { key: 'unanswered', label: 'Cevapsız' },
  { key: 'pinned', label: 'Sabitlenen' },
];

function roleLabel(role?: Profile['role']) {
  if (role === 'student') return 'Öğrenci';
  if (role === 'alumni') return 'Mezun';
  if (role === 'teacher') return 'Öğretmen';
  if (role === 'admin') return 'Yönetici';
  return 'Üye';
}

function filterThreads(threads: EnrichedThread[], filter: ForumFilterKey, query: string) {
  let result = threads;
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');

  if (normalizedQuery) {
    result = result.filter((thread) => (
      thread.title.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
      || thread.content.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
      || thread.author?.full_name.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
      || thread.category?.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
      || thread.tags.some((tagItem) => tagItem.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
    ));
  }

  if (filter === 'popular') return [...result].sort((a, b) => (b.reaction_count + b.comment_count) - (a.reaction_count + a.comment_count));
  if (filter === 'unanswered') return result.filter((thread) => thread.comment_count === 0);
  if (filter === 'pinned') return result.filter((thread) => thread.is_pinned);
  return result;
}

export function ForumAllThreadsClient({ categories, tags, threads, currentUserId }: ForumAllThreadsClientProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ForumFilterKey>('latest');
  const visibleThreads = useMemo(() => filterThreads(threads, filter, query), [filter, query, threads]);

  return (
    <div className="relative left-1/2 w-[calc(100vw-3rem)] max-w-7xl -translate-x-1/2 space-y-6 pb-8 pt-4 fade-in lg:pt-2">
      <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-[0_20px_50px_-40px_rgba(17,17,17,0.35)] sm:p-7">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Link href="/topluluk" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-surface-500 transition-colors hover:text-brand-700">
                <ArrowLeft className="h-4 w-4" weight="bold" />
                Topluluğa dön
              </Link>
              <h1 className="text-3xl font-bold tracking-tight text-surface-900">Tüm Konular</h1>
              <p className="mt-3 max-w-[66ch] text-base leading-7 text-surface-600">
                Topluluktaki bütün açık konuları ara, filtrele ve detayına gir.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              <ForumPrivacyToggle />
              <NewThreadPanel categories={categories} tags={tags} variant="button" />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="relative min-w-0">
              <MagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" weight="bold" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 w-full rounded-xl border border-surface-200 bg-surface-50 pl-11 pr-4 text-sm font-medium text-surface-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                placeholder="Konu, etiket, kategori veya kişi ara"
                aria-label="Tüm topluluk konularında ara"
              />
            </div>
            <span className="inline-flex h-12 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 px-4 text-xs font-bold text-surface-600">
              {visibleThreads.length} konu
            </span>
          </div>

          <nav className="flex flex-wrap gap-2" aria-label="Tüm konu filtreleri">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={
                  filter === item.key
                    ? 'rounded-xl bg-surface-900 px-4 py-2 text-xs font-bold text-white shadow-[0_12px_24px_-20px_rgba(17,17,17,0.45)]'
                    : 'rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-xs font-bold text-surface-600 transition-colors hover:border-surface-300 hover:bg-white hover:text-surface-900'
                }
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_18px_58px_-50px_rgba(17,17,17,0.5)]">
        <div className="flex items-center justify-between gap-3 border-b border-surface-200 bg-surface-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <Fire className="h-5 w-5 text-surface-500" weight="duotone" />
            <h2 className="text-base font-bold text-surface-900">Konular</h2>
          </div>
        </div>

        {visibleThreads.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="text-base font-bold text-surface-900">Konu bulunamadı</h3>
            <p className="mt-2 text-sm text-surface-500">Aramanı veya filtreyi değiştirerek tekrar deneyebilirsin.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {visibleThreads.map((thread) => (
              <article
                key={thread.id}
                className="group grid gap-4 px-5 py-4 transition-colors hover:bg-surface-50 md:grid-cols-[2.75rem_minmax(0,1fr)_9rem]"
              >
                <Link
                  href={thread.is_anonymous ? `/topluluk/konu/${thread.id}` : thread.author?.id === currentUserId ? '/profil' : thread.author ? `/profil/${thread.author.id}` : `/topluluk/konu/${thread.id}`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-xs font-bold text-brand-700 transition-colors hover:border-brand-200 hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-500/25"
                  aria-label={thread.is_anonymous ? 'Anonim kullanıcı' : thread.author ? `${thread.author.full_name} profilini aç` : 'Konu yazar profili'}
                >
                  {thread.is_anonymous ? 'A' : thread.author ? getInitials(thread.author.full_name || 'Üye') : '?'}
                </Link>

                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    {thread.category && (
                      <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ color: thread.category.color, backgroundColor: `${thread.category.color}12` }}>
                        {thread.category.name}
                      </span>
                    )}
                    {thread.tags.slice(0, 4).map((tagItem) => (
                      <span key={tagItem.id} className="rounded-md bg-surface-100 px-2 py-0.5 text-[11px] font-semibold text-surface-600">
                        <Tag className="mr-1 inline h-3 w-3" weight="bold" />
                        {tagItem.name}
                      </span>
                    ))}
                  </span>
                  <Link href={`/topluluk/konu/${thread.id}`} className="mt-2 block truncate text-base font-bold tracking-tight text-surface-900 transition-colors hover:text-brand-700">
                    {thread.title}
                  </Link>
                  <Link
                    href={`/topluluk/konu/${thread.id}`}
                    className="mt-1 block text-sm leading-6 text-surface-600 transition-colors hover:text-surface-800"
                    aria-label={`${thread.title} konusunun tamamını aç`}
                  >
                    {createForumThreadPreview(thread.content)}
                  </Link>
                  <span className="mt-3 flex flex-wrap items-center gap-2 text-xs text-surface-500">
                    {thread.is_anonymous ? (
                      <span className="font-semibold text-surface-700">Anonim kullanıcı</span>
                    ) : thread.author ? (
                      <Link href={thread.author.id === currentUserId ? '/profil' : `/profil/${thread.author.id}`} className="font-semibold text-surface-700 transition-colors hover:text-brand-700">
                        {thread.author.full_name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-surface-700">İsimsiz kullanıcı</span>
                    )}
                    {!thread.is_anonymous && thread.author && <span>{roleLabel(thread.author.role)}</span>}
                    <span>{timeAgo(thread.last_activity_at || thread.created_at)}</span>
                  </span>
                </span>

                <span className="grid grid-cols-3 gap-2 text-center md:grid-cols-1 md:content-center">
                  <span className="rounded-lg bg-surface-100 px-2 py-1.5 text-xs font-bold tabular-nums text-surface-700"><Fire className="mx-auto mb-0.5 h-3.5 w-3.5" />{thread.reaction_count}</span>
                  <span className="rounded-lg bg-surface-100 px-2 py-1.5 text-xs font-bold tabular-nums text-surface-700"><ChatCircleText className="mx-auto mb-0.5 h-3.5 w-3.5" />{thread.comment_count}</span>
                  <span className="rounded-lg bg-surface-100 px-2 py-1.5 text-xs font-bold tabular-nums text-surface-700"><Eye className="mx-auto mb-0.5 h-3.5 w-3.5" />{thread.view_count}</span>
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
