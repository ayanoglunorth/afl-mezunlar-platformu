import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChatCircleText, Eye, Fire, Lock, PushPin, Tag } from '@phosphor-icons/react/dist/ssr';
import { createClient } from '@/lib/supabase/server';
import { NewThreadPanel } from '@/components/forum/NewThreadPanel';
import { ForumPrivacyToggle } from '@/components/forum/ForumPrivacyProvider';
import { createForumThreadPreview } from '@/lib/forum';
import { getInitials, timeAgo } from '@/lib/utils';
import type { ForumCategory, ForumTag, ForumThread, Profile } from '@/types/database';

type CategoryPageProps = {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{ tag?: string; sort?: string }>;
};

type EnrichedThread = ForumThread & {
  author: Pick<Profile, 'id' | 'full_name' | 'role'> | null;
  tags: ForumTag[];
};

type CategoryDetailPayload = {
  currentUserId?: string | null;
  category?: ForumCategory | null;
  categories?: ForumCategory[];
  tags?: ForumTag[];
  threads?: EnrichedThread[];
};

const SORTS = [
  { key: 'latest', label: 'Son' },
  { key: 'popular', label: 'Popüler' },
  { key: 'unanswered', label: 'Cevapsız' },
];

const roleLabel = (role?: string) => {
  if (role === 'admin') return 'Yönetici';
  if (role === 'teacher') return 'Öğretmen';
  if (role === 'alumni') return 'Mezun';
  return 'Öğrenci';
};

function sortThreads(threads: EnrichedThread[], sort: string) {
  if (sort === 'popular') return [...threads].sort((a, b) => (b.reaction_count + b.comment_count) - (a.reaction_count + a.comment_count));
  if (sort === 'unanswered') return threads.filter((thread) => thread.comment_count === 0);
  return threads;
}

function isMissingCategoryDetailRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_forum_category_detail')
  );
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { categorySlug } = await params;
  const { tag = '', sort = 'latest' } = await searchParams;
  const supabase = await createClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_forum_category_detail', {
    p_category_slug: categorySlug,
    p_tag_slug: tag,
    p_sort: sort,
  });

  let currentUserId = null as string | null;
  let category: ForumCategory | null = null;
  let allCategories: ForumCategory[] = [];
  let tags: ForumTag[] = [];
  let enrichedThreads: EnrichedThread[] = [];

  if (!rpcError && rpcData) {
    const payload = rpcData as CategoryDetailPayload;
    currentUserId = payload.currentUserId || null;
    category = payload.category || null;
    allCategories = Array.isArray(payload.categories) ? payload.categories : [];
    tags = Array.isArray(payload.tags) ? payload.tags : [];
    enrichedThreads = Array.isArray(payload.threads) ? payload.threads : [];
  } else {
    if (rpcError && !isMissingCategoryDetailRpc(rpcError)) {
      throw rpcError;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentUserId = user?.id || null;

    const { data: categoryData } = await supabase
      .from('forum_categories')
      .select('*')
      .eq('slug', categorySlug)
      .eq('is_active', true)
      .single();

    category = categoryData as ForumCategory | null;
    if (!category) notFound();

    const [
      { data: allCategoriesData },
      { data: tagsData },
      { data: threadsData },
    ] = await Promise.all([
      supabase.from('forum_categories').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('forum_tags').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase
        .from('forum_threads_public')
        .select('*')
        .eq('category_id', category.id)
        .eq('status', 'open')
        .eq('is_hidden', false)
        .order('is_pinned', { ascending: false })
        .order('last_activity_at', { ascending: false }),
    ]);

    allCategories = (allCategoriesData || []) as ForumCategory[];
    tags = (tagsData || []) as ForumTag[];
    const threads = (threadsData || []) as ForumThread[];
    const threadIds = threads.map((thread) => thread.id);
    const authorIds = Array.from(new Set(threads.map((thread) => thread.author_id).filter(Boolean)));

    const [
      { data: authorsData },
      { data: threadTagsData },
    ] = await Promise.all([
      authorIds.length
        ? supabase.from('profiles').select('id, full_name, role').in('id', authorIds)
        : Promise.resolve({ data: [] }),
      threadIds.length
        ? supabase.from('forum_thread_tags').select('thread_id, tag_id').in('thread_id', threadIds)
        : Promise.resolve({ data: [] }),
    ]);

    const authorById = new Map(((authorsData || []) as Pick<Profile, 'id' | 'full_name' | 'role'>[]).map((author) => [author.id, author]));
    const tagById = new Map(tags.map((tagItem) => [tagItem.id, tagItem]));
    const tagsByThread = new Map<string, ForumTag[]>();
    (threadTagsData || []).forEach((row: { thread_id: string; tag_id: string }) => {
      const tagItem = tagById.get(row.tag_id);
      if (!tagItem) return;
      tagsByThread.set(row.thread_id, [...(tagsByThread.get(row.thread_id) || []), tagItem]);
    });

    enrichedThreads = threads.map((thread) => ({
      ...thread,
      author: thread.author_id ? authorById.get(thread.author_id) || null : null,
      tags: tagsByThread.get(thread.id) || [],
    }));
  }

  if (!category) notFound();

  const categoryTags = tags.filter((tagItem) => !tagItem.category_id || tagItem.category_id === category.id);
  const tagFilteredThreads = tag
    ? enrichedThreads.filter((thread) => thread.tags.some((tagItem) => tagItem.slug === tag))
    : enrichedThreads;
  const visibleThreads = sortThreads(tagFilteredThreads, sort);

  return (
    <div className="relative left-1/2 flex w-[calc(100vw-3rem)] max-w-7xl -translate-x-1/2 flex-col gap-6 pb-8 pt-4 fade-in lg:pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/topluluk" className="inline-flex items-center gap-2 text-sm font-bold text-surface-600 transition-colors hover:text-surface-950">
          <ArrowLeft className="h-4 w-4" weight="bold" />
          Topluluk
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ForumPrivacyToggle />
          <NewThreadPanel categories={allCategories} tags={tags} defaultCategoryId={category.id} variant="button" />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_22px_70px_-56px_rgba(17,17,17,0.42)]">
        <div className="p-6 sm:p-7" style={{ borderTop: `6px solid ${category.color}` }}>
          <p className="text-sm font-medium" style={{ color: category.color }}>Topluluk kanalı</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-surface-900">{category.name}</h1>
          <p className="mt-3 max-w-[72ch] text-base leading-7 text-surface-600">{category.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-xs font-bold text-surface-700">{visibleThreads.length} konu</span>
            <span className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-xs font-bold text-surface-700">{enrichedThreads.reduce((total, thread) => total + thread.comment_count, 0)} yanıt</span>
            {SORTS.map((item) => (
              <Link
                key={item.key}
                href={`/topluluk/${category.slug}?sort=${item.key}${tag ? `&tag=${tag}` : ''}`}
                className={
                  sort === item.key
                    ? 'rounded-xl bg-surface-900 px-3 py-2 text-xs font-bold text-white'
                    : 'rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-bold text-surface-600 hover:bg-surface-100'
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-surface-200 bg-white p-4">
            <h2 className="text-sm font-bold text-surface-900">Etiket filtresi</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/topluluk/${category.slug}?sort=${sort}`} className={!tag ? 'rounded-full bg-surface-900 px-3 py-1.5 text-xs font-bold text-white' : 'rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-bold text-surface-700'}>
                Tümü
              </Link>
              {categoryTags.map((tagItem) => (
                <Link
                  key={tagItem.id}
                  href={`/topluluk/${category.slug}?sort=${sort}&tag=${tagItem.slug}`}
                  className={tag === tagItem.slug ? 'rounded-full bg-surface-900 px-3 py-1.5 text-xs font-bold text-white' : 'rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-bold text-surface-700 hover:bg-white'}
                >
                  {tagItem.name}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_18px_58px_-50px_rgba(17,17,17,0.5)]">
          <div className="border-b border-surface-200 bg-surface-50 px-5 py-4">
            <h2 className="text-base font-bold text-surface-900">Konu listesi</h2>
          </div>

          {visibleThreads.length === 0 ? (
            <div className="p-10 text-center">
              <h2 className="text-base font-bold text-surface-900">Bu kategoride konu yok</h2>
              <p className="mt-2 text-sm text-surface-500">İlk konuyu açıp topluluğa alan açabilirsin.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {visibleThreads.map((thread) => (
                <article key={thread.id} className="group grid gap-4 px-5 py-4 transition-colors hover:bg-surface-50 sm:grid-cols-[2.5rem_minmax(0,1fr)_8rem]">
                  <Link
                    href={thread.is_anonymous ? `/topluluk/konu/${thread.id}` : thread.author?.id === currentUserId ? '/profil' : thread.author ? `/profil/${thread.author.id}` : `/topluluk/konu/${thread.id}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-xs font-bold text-brand-700 transition-colors hover:border-brand-200 hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-500/25"
                    aria-label={thread.author ? `${thread.author.full_name} profilini aç` : 'Konu yazar profili'}
                  >
                    {thread.is_anonymous ? 'A' : thread.author ? getInitials(thread.author.full_name) : '?'}
                  </Link>

                  <div className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      {thread.is_pinned && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700"><PushPin className="mr-1 inline h-3 w-3" weight="fill" />Sabit</span>}
                      {thread.is_locked && <span className="rounded-md bg-surface-100 px-2 py-0.5 text-[11px] font-bold text-surface-600"><Lock className="mr-1 inline h-3 w-3" weight="bold" />Kilitli</span>}
                      {thread.tags.slice(0, 3).map((tagItem) => (
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
                        <span className="font-semibold text-surface-700">Kullanıcı</span>
                      )}
                      {!thread.is_anonymous && thread.author && <span>{roleLabel(thread.author.role)}</span>}
                      <span>{timeAgo(thread.last_activity_at || thread.created_at)}</span>
                    </span>
                  </div>

                  <span className="grid grid-cols-3 gap-2 text-center sm:grid-cols-1 sm:content-center">
                    <span className="rounded-lg bg-surface-100 px-2 py-1.5 text-xs font-bold text-surface-700"><Fire className="mx-auto mb-0.5 h-3.5 w-3.5" />{thread.reaction_count}</span>
                    <span className="rounded-lg bg-surface-100 px-2 py-1.5 text-xs font-bold text-surface-700"><ChatCircleText className="mx-auto mb-0.5 h-3.5 w-3.5" />{thread.comment_count}</span>
                    <span className="rounded-lg bg-surface-100 px-2 py-1.5 text-xs font-bold text-surface-700"><Eye className="mx-auto mb-0.5 h-3.5 w-3.5" />{thread.view_count}</span>
                  </span>
                </article>
              ))}
            </div>
          )}
        </main>
      </section>
    </div>
  );
}

