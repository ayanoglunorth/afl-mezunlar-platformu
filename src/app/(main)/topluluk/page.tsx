import Link from 'next/link';
import {
  CalendarBlank,
  CaretDown,
  ChatCircleText,
  GlobeHemisphereWest,
  GraduationCap,
  ListPlus,
  Megaphone,
  TrendUp,
} from '@phosphor-icons/react/dist/ssr';
import { createClient } from '@/lib/supabase/server';
import { DeferredSocialBoard } from '@/components/dashboard/DeferredSocialBoard';
import { ForumHomeClient } from '@/components/forum/ForumHomeClient';
import { ForumPrivacyToggle } from '@/components/forum/ForumPrivacyProvider';
import type { ForumCategory, ForumTag, ForumThread, Profile } from '@/types/database';

type EnrichedThread = ForumThread & {
  author: Pick<Profile, 'id' | 'full_name' | 'role'> | null;
  category: ForumCategory | null;
  tags: ForumTag[];
};

type ChannelStats = { threadCount: number; messageCount: number; latest?: EnrichedThread };
type ForumOverviewPayload = {
  currentUserId?: string | null;
  categories?: ForumCategory[];
  tags?: ForumTag[];
  threads?: EnrichedThread[];
};

function isMissingForumOverviewRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_forum_overview')
  );
}

function CategoryIcon({ iconKey, className = 'h-5 w-5' }: { iconKey: string; className?: string }) {
  if (iconKey === 'graduation-cap') return <GraduationCap className={className} weight="duotone" />;
  if (iconKey === 'globe') return <GlobeHemisphereWest className={className} weight="duotone" />;
  if (iconKey === 'calendar') return <CalendarBlank className={className} weight="duotone" />;
  if (iconKey === 'briefcase') return <TrendUp className={className} weight="duotone" />;
  if (iconKey === 'megaphone') return <Megaphone className={className} weight="duotone" />;
  return <ChatCircleText className={className} weight="duotone" />;
}

function ChannelLink({ category, stats }: { category: ForumCategory; stats?: ChannelStats }) {
  return (
    <Link
      href={`/topluluk/${category.slug}`}
      className="group/channel grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 p-3 transition duration-200 hover:border-surface-300 hover:bg-white hover:shadow-[0_16px_34px_-30px_rgba(17,17,17,0.35)]"
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-[0_14px_26px_-20px_rgba(17,17,17,0.45)]"
        style={{ backgroundColor: category.color }}
      >
        <CategoryIcon iconKey={category.icon_key} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-surface-900 group-hover/channel:text-brand-700">{category.name}</span>
        <span className="mt-0.5 block line-clamp-1 text-xs leading-5 text-surface-500">{category.description}</span>
        <span className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-semibold text-surface-500">
          <span>{stats?.threadCount || 0} konu</span>
          <span>{stats?.messageCount || 0} yanıt</span>
          {stats?.latest && <span className="min-w-0 truncate text-surface-400">Son: {stats.latest.title}</span>}
        </span>
      </span>
    </Link>
  );
}

function OtherChannelsMenu({ categories }: { categories: Array<{ category: ForumCategory; stats?: ChannelStats }> }) {
  return (
    <details className="group relative overflow-visible rounded-xl border border-surface-200 bg-surface-50 transition duration-200 open:bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-bold text-surface-900 transition-colors hover:text-brand-700">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-white shadow-[0_14px_26px_-20px_rgba(17,17,17,0.45)]">
            <ListPlus className="h-4 w-4" weight="bold" />
          </span>
          <span className="min-w-0">
            <span className="block truncate">Diğer Kanallar</span>
            <span className="mt-0.5 block text-xs font-semibold leading-5 text-surface-500">
              Platform kullanıcıları tarafından oluşturulmuş diğer kanallar.
            </span>
          </span>
        </span>
        <CaretDown className="h-4 w-4 shrink-0 text-surface-400 transition-transform group-open:rotate-180" weight="bold" />
      </summary>

      <div className="absolute right-0 bottom-full z-20 mb-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-surface-200 bg-white p-2 shadow-[0_24px_48px_-24px_rgba(17,17,17,0.35)]">
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs font-semibold leading-5 text-surface-500">
              Henüz kullanıcı kanalı yok.
            </p>
          ) : (
            categories.map(({ category, stats }) => <ChannelLink key={category.id} category={category} stats={stats} />)
          )}
        </div>
      </div>
    </details>
  );
}

export default async function ForumPage() {
  const supabase = await createClient();
  const { data: overviewData, error: overviewError } = await supabase.rpc('get_forum_overview');
  let currentUserId = (overviewData as ForumOverviewPayload | null)?.currentUserId || undefined;
  let categories = ((overviewData as ForumOverviewPayload | null)?.categories || []) as ForumCategory[];
  let tags = ((overviewData as ForumOverviewPayload | null)?.tags || []) as ForumTag[];
  let enrichedThreads = ((overviewData as ForumOverviewPayload | null)?.threads || []) as EnrichedThread[];

  if (overviewError || !overviewData) {
    if (overviewError && !isMissingForumOverviewRpc(overviewError)) throw overviewError;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentUserId = user?.id;

    const [{ data: categoriesData }, { data: tagsData }, { data: threadsData }] = await Promise.all([
      supabase.from('forum_categories').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('forum_tags').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase
        .from('forum_threads_public')
        .select('*')
        .eq('status', 'open')
        .eq('is_hidden', false)
        .order('is_pinned', { ascending: false })
        .order('last_activity_at', { ascending: false })
        .limit(24),
    ]);

    categories = (categoriesData || []) as ForumCategory[];
    tags = (tagsData || []) as ForumTag[];
    const threads = (threadsData || []) as ForumThread[];
    const threadIds = threads.map((thread) => thread.id);
    const authorIds = Array.from(new Set(threads.map((thread) => thread.author_id).filter(Boolean)));
    const [{ data: authorsData }, { data: threadTagsData }] = await Promise.all([
      authorIds.length
        ? supabase.from('profiles').select('id, full_name, role').in('id', authorIds)
        : Promise.resolve({ data: [] }),
      threadIds.length
        ? supabase.from('forum_thread_tags').select('thread_id, tag_id').in('thread_id', threadIds)
        : Promise.resolve({ data: [] }),
    ]);

    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const tagById = new Map(tags.map((tagItem) => [tagItem.id, tagItem]));
    const authorById = new Map(((authorsData || []) as Pick<Profile, 'id' | 'full_name' | 'role'>[]).map((author) => [author.id, author]));
    const tagsByThread = new Map<string, ForumTag[]>();
    (threadTagsData || []).forEach((row: { thread_id: string; tag_id: string }) => {
      const tagItem = tagById.get(row.tag_id);
      if (!tagItem) return;
      tagsByThread.set(row.thread_id, [...(tagsByThread.get(row.thread_id) || []), tagItem]);
    });

    enrichedThreads = threads.map((thread) => ({
      ...thread,
      author: thread.author_id ? authorById.get(thread.author_id) || null : null,
      category: categoryById.get(thread.category_id) || null,
      tags: tagsByThread.get(thread.id) || [],
    }));
  }

  const defaultCategories = categories.filter((category) => !category.is_user_created);
  const userCreatedCategories = categories.filter((category) => category.is_user_created);

  const categoryStats = new Map<string, ChannelStats>();
  enrichedThreads.forEach((thread) => {
    const current = categoryStats.get(thread.category_id) || { threadCount: 0, messageCount: 0 };
    categoryStats.set(thread.category_id, {
      threadCount: current.threadCount + 1,
      messageCount: current.messageCount + thread.comment_count,
      latest: current.latest || thread,
    });
  });

  const otherChannelItems = userCreatedCategories.map((category) => ({
    category,
    stats: categoryStats.get(category.id),
  }));

  return (
    <div className="relative left-1/2 w-[calc(100vw-3rem)] max-w-7xl -translate-x-1/2 space-y-8 pb-8 pt-4 fade-in lg:pt-2">
      <div className="flex justify-end"><ForumPrivacyToggle /></div>
      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 space-y-6">
          <ForumHomeClient categories={categories} tags={tags} threads={enrichedThreads} currentUserId={currentUserId} />
        </div>

        <div id="topluluk-right-column" className="space-y-4">
          <DeferredSocialBoard />
          <section id="topluluk-kanallari" className="rounded-2xl border border-surface-200 bg-white p-4 shadow-[0_18px_52px_-44px_rgba(17,17,17,0.35)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ChatCircleText className="h-5 w-5 shrink-0 text-surface-500" weight="duotone" />
                <h2 className="truncate text-base font-bold text-surface-900">Topluluk Kanalları</h2>
              </div>
              <span className="shrink-0 text-xs font-semibold text-surface-500">{categories.length} kategori</span>
            </div>

            <div className="space-y-2">
              {defaultCategories.map((category) => (
                <ChannelLink key={category.id} category={category} stats={categoryStats.get(category.id)} />
              ))}

              <OtherChannelsMenu categories={otherChannelItems} />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}


