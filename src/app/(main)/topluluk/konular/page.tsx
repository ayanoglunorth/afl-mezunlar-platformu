import { createClient } from '@/lib/supabase/server';
import { ForumAllThreadsClient } from '@/components/forum/ForumAllThreadsClient';
import type { ForumCategory, ForumTag, ForumThread, Profile } from '@/types/database';

type EnrichedThread = ForumThread & {
  author: Pick<Profile, 'id' | 'full_name' | 'role'> | null;
  category: ForumCategory | null;
  tags: ForumTag[];
};

type ForumThreadsListPayload = {
  currentUserId?: string | null;
  categories?: ForumCategory[];
  tags?: ForumTag[];
  threads?: EnrichedThread[];
};

function isMissingForumThreadsListRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_forum_threads_list')
  );
}

export default async function CommunityThreadsPage() {
  const supabase = await createClient();
  const { data: listData, error: listError } = await supabase.rpc('get_forum_threads_list', { p_limit: 250 });
  let currentUserId = (listData as ForumThreadsListPayload | null)?.currentUserId || undefined;
  let categories = ((listData as ForumThreadsListPayload | null)?.categories || []) as ForumCategory[];
  let tags = ((listData as ForumThreadsListPayload | null)?.tags || []) as ForumTag[];
  let enrichedThreads = ((listData as ForumThreadsListPayload | null)?.threads || []) as EnrichedThread[];

  if (listError || !listData) {
    if (listError && !isMissingForumThreadsListRpc(listError)) throw listError;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentUserId = user?.id;

    const [
      { data: categoriesData },
      { data: tagsData },
      { data: threadsData },
    ] = await Promise.all([
      supabase.from('forum_categories').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('forum_tags').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase
        .from('forum_threads_public')
        .select('*')
        .eq('status', 'open')
        .eq('is_hidden', false)
        .order('is_pinned', { ascending: false })
        .order('last_activity_at', { ascending: false })
        .limit(250),
    ]);

    categories = (categoriesData || []) as ForumCategory[];
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

  return (
    <ForumAllThreadsClient
      categories={categories}
      tags={tags}
      threads={enrichedThreads}
      currentUserId={currentUserId}
    />
  );
}

