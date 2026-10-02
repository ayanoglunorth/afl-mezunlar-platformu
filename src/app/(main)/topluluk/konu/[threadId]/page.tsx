import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChatCircleText, Eye, Lock, PushPin, Tag, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { createClient } from '@/lib/supabase/server';
import { ForumReactionBar } from '@/components/forum/ForumReactionBar';
import { ForumReplyForm } from '@/components/forum/ForumReplyForm';
import { ForumReportDialog } from '@/components/forum/ForumReportDialog';
import { AdminModerationButton } from '@/components/forum/AdminModerationButton';
import { ForumEditDialog } from '@/components/forum/ForumEditDialog';
import { ForumMentionedContent, type ForumMentionDisplay } from '@/components/forum/ForumMentionedContent';
import { ForumPrivacyToggle } from '@/components/forum/ForumPrivacyProvider';
import { getInitials, timeAgo } from '@/lib/utils';
import type {
  ForumCategory,
  ForumPost,
  ForumPostWithAuthor,
  ForumReaction,
  ForumReactionType,
  ForumTag,
  ForumThread,
  Profile,
} from '@/types/database';

type ThreadPageProps = {
  params: Promise<{ threadId: string }>;
};

type ThreadAuthor = Pick<Profile, 'id' | 'full_name' | 'role'>;
type ReactionRow = Pick<ForumReaction, 'user_id' | 'target_thread_id' | 'target_post_id' | 'reaction_type'>;

const REACTION_TYPES: ForumReactionType[] = ['like', 'heart', 'insightful', 'celebrate', 'thanks'];

type ThreadDetailPayload = {
  thread: ForumThread | null;
  category: ForumCategory | null;
  author: ThreadAuthor | null;
  tags: ForumTag[];
  posts: ForumPost[];
  postAuthors: ThreadAuthor[];
  reactionAuthors?: ThreadAuthor[];
  reactions: ReactionRow[];
  mentions: ForumMentionDisplay[];
  isAdmin: boolean;
};

type LoadedThreadDetail = {
  thread: ForumThread;
  category: ForumCategory | null;
  author: ThreadAuthor | null;
  tags: ForumTag[];
  posts: ForumPostWithAuthor[];
  reactionAuthors: ThreadAuthor[];
  reactions: ReactionRow[];
  mentions: ForumMentionDisplay[];
  isAdmin: boolean;
};

function isMissingThreadDetailRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || message.includes('could not find the function')
    || message.includes('function public.get_forum_thread_detail')
  );
}

function normalizeThreadDetailPayload(payload: ThreadDetailPayload): LoadedThreadDetail | null {
  if (!payload.thread) return null;

  const postAuthorById = new Map((payload.postAuthors || []).map((postAuthor) => [postAuthor.id, postAuthor]));
  const posts = (payload.posts || []).map((post) => ({
    ...post,
    author: post.author_id ? postAuthorById.get(post.author_id) || null : null,
  })) as ForumPostWithAuthor[];

  return {
    thread: payload.thread,
    category: payload.category,
    author: payload.author,
    tags: payload.tags || [],
    posts,
    reactionAuthors: payload.reactionAuthors || [],
    reactions: payload.reactions || [],
    mentions: payload.mentions || [],
    isAdmin: Boolean(payload.isAdmin),
  };
}

const roleLabel = (role?: string) => {
  if (role === 'admin') return 'Yönetici';
  if (role === 'teacher') return 'Öğretmen';
  if (role === 'alumni') return 'Mezun';
  return 'Öğrenci';
};

function getReactionCounts(reactions: ReactionRow[], targetType: 'thread' | 'post', targetId: string) {
  return REACTION_TYPES.reduce<Partial<Record<ForumReactionType, number>>>((counts, type) => {
    counts[type] = reactions.filter((reaction) => (
      reaction.reaction_type === type
      && (targetType === 'thread' ? reaction.target_thread_id === targetId : reaction.target_post_id === targetId)
    )).length;
    return counts;
  }, {});
}

function getActiveReactions(reactions: ReactionRow[], targetType: 'thread' | 'post', targetId: string, userId: string) {
  return reactions
    .filter((reaction) => (
      reaction.user_id === userId
      && (targetType === 'thread' ? reaction.target_thread_id === targetId : reaction.target_post_id === targetId)
    ))
    .map((reaction) => reaction.reaction_type);
}

function getReactionPeopleByType(
  reactions: ReactionRow[],
  reactionAuthors: ThreadAuthor[],
  targetType: 'thread' | 'post',
  targetId: string,
) {
  const authorById = new Map(reactionAuthors.map((authorItem) => [authorItem.id, authorItem]));
  return REACTION_TYPES.reduce<Partial<Record<ForumReactionType, ThreadAuthor[]>>>((peopleByType, type) => {
    const seen = new Set<string>();
    peopleByType[type] = reactions.flatMap((reaction) => {
      const matchesTarget = targetType === 'thread'
        ? reaction.target_thread_id === targetId
        : reaction.target_post_id === targetId;
      if (!matchesTarget || reaction.reaction_type !== type || seen.has(reaction.user_id)) return [];
      const authorItem = authorById.get(reaction.user_id);
      if (!authorItem) return [];
      seen.add(reaction.user_id);
      return [authorItem];
    });
    return peopleByType;
  }, {});
}

function AdminThreadControls({ thread, isAdmin }: { thread: ForumThread; isAdmin: boolean }) {
  if (!isAdmin) return null;

  return (
    <div className="flex flex-wrap gap-2" aria-label="Konu moderasyon işlemleri">
      <AdminModerationButton
        targetType="thread"
        targetId={thread.id}
        action="toggle_pin"
        currentValue={thread.is_pinned}
        groupId={thread.id}
        label={thread.is_pinned ? 'Sabiti kaldır' : 'Sabitle'}
        confirmTitle={thread.is_pinned ? 'Sabiti kaldır?' : 'Konuyu sabitle?'}
        confirmDescription={thread.is_pinned ? 'Bu konu artık toplulukta sabitlenenler arasında görünmeyecek.' : 'Bu konu toplulukta sabitlenenler arasında öne çıkarılacak.'}
      />
      <AdminModerationButton
        targetType="thread"
        targetId={thread.id}
        action="toggle_lock"
        currentValue={thread.is_locked}
        groupId={thread.id}
        label={thread.is_locked ? 'Kilidi aç' : 'Kilitle'}
        confirmTitle={thread.is_locked ? 'Konu kilidini aç?' : 'Konuyu kilitle?'}
        confirmDescription={thread.is_locked ? 'Kullanıcılar bu konuya yeniden yanıt yazabilecek.' : 'Kullanıcılar bu konuya yeni yanıt yazamayacak.'}
      />
      <AdminModerationButton
        targetType="thread"
        targetId={thread.id}
        action={thread.status === 'archived' ? 'restore_archive' : 'archive'}
        groupId={thread.id}
        label={thread.status === 'archived' ? 'Arşivden çıkar' : 'Arşivle'}
        confirmTitle={thread.status === 'archived' ? 'Konuyu arşivden çıkar?' : 'Konuyu arşivle?'}
        confirmDescription={thread.status === 'archived' ? 'Konu topluluk akışında yeniden görünecek.' : 'Konu normal kullanıcı akışından kaldırılacak; adminler geri alabilir.'}
        tone="danger"
      />
      <AdminModerationButton
        targetType="thread"
        targetId={thread.id}
        action="delete"
        label="Sil"
        confirmTitle="Konuyu kalıcı olarak sil?"
        confirmDescription="Konu, yanıtları, reaksiyonları ve etiketleri geri alınamayacak şekilde silinecek."
        groupId={thread.id}
        tone="danger"
      />
    </div>
  );
}

function AdminPostControls({ post, isAdmin }: { post: ForumPost; isAdmin: boolean }) {
  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-1">
      <AdminModerationButton
        targetType="post"
        targetId={post.id}
        action={post.status === 'archived' ? 'restore_archive' : 'archive'}
        groupId={post.thread_id}
        label={post.status === 'archived' ? 'Arşivden çıkar' : 'Arşivle'}
        confirmTitle={post.status === 'archived' ? 'Yanıtı arşivden çıkar?' : 'Yanıtı arşivle?'}
        confirmDescription={post.status === 'archived' ? 'Yanıt yeniden görünür olacak.' : 'Yanıt normal kullanıcılar için akıştan kaldırılacak.'}
        tone="danger"
      />
      <AdminModerationButton
        targetType="post"
        targetId={post.id}
        action="delete"
        groupId={post.thread_id}
        label="Sil"
        confirmTitle="Yanıtı kalıcı olarak sil?"
        confirmDescription="Yanıt, alt yanıtları, reaksiyonları ve rapor kayıtlarıyla birlikte geri alınamayacak şekilde silinecek."
        tone="danger"
      />
    </div>
  );
}

function AuthorPanel({
  author,
  createdAt,
  currentUserId,
  label = 'Yazar',
}: {
  author: ThreadAuthor | null;
  createdAt: string;
  currentUserId: string;
  label?: string;
}) {
  const profileHref = author?.id === currentUserId ? '/profil' : author ? `/profil/${author.id}` : null;
  const authorBlock = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-sm font-bold text-brand-700 transition-colors group-hover:border-brand-200 group-hover:bg-brand-100 md:h-14 md:w-14">
        {author ? getInitials(author.full_name) : 'A'}
      </span>
      <div className="min-w-0 md:mt-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-surface-400">{label}</p>
        <p className="mt-1 truncate text-sm font-bold text-surface-900 group-hover:text-brand-700">{author?.full_name || 'Anonim kullanıcı'}</p>
        {author && <p className="mt-1 text-xs font-semibold text-surface-500">{roleLabel(author.role)}</p>}
        <p className="mt-1 text-xs text-surface-500">{timeAgo(createdAt)}</p>
      </div>
    </>
  );

  return (
    profileHref ? (
      <Link href={profileHref} className="group flex gap-3 rounded-xl outline-none transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-brand-500/25 md:block md:p-1">
        {authorBlock}
      </Link>
    ) : (
      <div className="flex gap-3 md:block">{authorBlock}</div>
    )
  );
}

function PostCard({
  post,
  threadId,
  reactions,
  reactionAuthors,
  userId,
  isAdmin,
  replies = [],
  locked,
  mentionsByPostId,
}: {
  post: ForumPostWithAuthor;
  threadId: string;
  reactions: ReactionRow[];
  reactionAuthors: ThreadAuthor[];
  userId: string;
  isAdmin: boolean;
  replies?: ForumPostWithAuthor[];
  locked: boolean;
  mentionsByPostId: Map<string, ForumMentionDisplay[]>;
}) {
  return (
    <article className={post.status === 'archived' ? 'border-b border-amber-100 bg-amber-50/50' : 'border-b border-surface-100 bg-white last:border-b-0'}>
      <div className="grid gap-4 p-5 md:grid-cols-[10rem_minmax(0,1fr)]">
        <AuthorPanel author={post.author} createdAt={post.created_at} currentUserId={userId} label="Yanıt" />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {post.status === 'archived' ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                <WarningCircle className="h-3.5 w-3.5" weight="bold" />
                Arşivlenmiş içerik
              </span>
            ) : <span />}
            <div className="flex items-center gap-1">
              {post.can_edit && (
                <ForumEditDialog
                  targetType="post"
                  targetId={post.id}
                  content={post.content}
                  mentions={mentionsByPostId.get(post.id) || []}
                />
              )}
              <ForumReportDialog targetType="post" targetId={post.id} />
              <AdminPostControls post={post} isAdmin={isAdmin} />
            </div>
          </div>

          <ForumMentionedContent
            content={post.content}
            mentions={mentionsByPostId.get(post.id) || []}
            className="mt-3 whitespace-pre-wrap text-sm leading-7 text-surface-700"
          />
          {post.edited_at && <p className="mt-2 text-xs font-semibold text-surface-400">Düzenlendi · {timeAgo(post.edited_at)}</p>}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <ForumReactionBar
              targetType="post"
              targetId={post.id}
              counts={getReactionCounts(reactions, 'post', post.id)}
              activeReactions={getActiveReactions(reactions, 'post', post.id, userId)}
              peopleByReaction={getReactionPeopleByType(reactions, reactionAuthors, 'post', post.id)}
              compact
            />
            {!locked && post.status !== 'archived' && <ForumReplyForm threadId={threadId} parentPostId={post.id} compact />}
          </div>

          {replies.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-xl border border-surface-200">
              {replies.map((reply) => (
                <PostCard
                  key={reply.id}
                  post={reply}
                  threadId={threadId}
                  reactions={reactions}
                  reactionAuthors={reactionAuthors}
                  userId={userId}
                  isAdmin={isAdmin}
                  locked={locked}
                  mentionsByPostId={mentionsByPostId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

async function loadThreadDetailFallback({
  supabase,
  userId,
  threadId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  threadId: string;
}): Promise<LoadedThreadDetail | null> {
  const [
    { data: threadData },
    { data: isAdminData },
  ] = await Promise.all([
    supabase.from('forum_threads_public').select('*').eq('id', threadId).single(),
    supabase.rpc('is_platform_admin', { p_user_id: userId }),
  ]);

  if (!threadData) return null;

  let thread = threadData as ForumThread;
  const isAdmin = Boolean(isAdminData);

  const { data: nextViewCount } = await supabase.rpc('increment_forum_thread_view', { p_thread_id: thread.id });
  if (typeof nextViewCount === 'number') {
    thread = { ...thread, view_count: nextViewCount };
  }

  const [
    { data: categoryData },
    { data: authorData },
    { data: threadTagsData },
    { data: postsData },
    { data: threadReactionsData },
    { data: mentionsData },
  ] = await Promise.all([
    supabase.from('forum_categories').select('*').eq('id', thread.category_id).single(),
    thread.author_id
      ? supabase.from('profiles').select('id, full_name, role').eq('id', thread.author_id).single()
      : Promise.resolve({ data: null }),
    supabase.from('forum_thread_tags').select('tag_id').eq('thread_id', thread.id),
    supabase.from('forum_posts_public').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true }),
    supabase
      .from('forum_reactions')
      .select('user_id, target_thread_id, target_post_id, reaction_type')
      .or(`target_thread_id.eq.${thread.id}`),
    supabase
      .rpc('get_forum_public_mentions', { p_thread_id: thread.id }),
  ]);

  const tagIds = (threadTagsData || []).map((row: { tag_id: string }) => row.tag_id);
  const [{ data: tagsData }, { data: postReactionsData }] = await Promise.all([
    tagIds.length
      ? supabase.from('forum_tags').select('*').in('id', tagIds)
      : Promise.resolve({ data: [] }),
    postsData?.length
      ? supabase.from('forum_reactions').select('user_id, target_thread_id, target_post_id, reaction_type').in('target_post_id', postsData.map((post: ForumPost) => post.id))
      : Promise.resolve({ data: [] }),
  ]);

  const allPosts = (postsData || []) as ForumPost[];
  const visiblePosts = (isAdmin ? allPosts : allPosts.filter((post) => post.status !== 'archived' && !post.is_hidden)) as ForumPost[];
  const postAuthorIds = Array.from(new Set(visiblePosts.map((post) => post.author_id).filter(Boolean)));
  const allReactions = [
    ...((threadReactionsData || []) as ReactionRow[]),
    ...((postReactionsData || []) as ReactionRow[]),
  ];
  const reactionAuthorIds = Array.from(new Set(allReactions.map((reaction) => reaction.user_id).filter(Boolean)));
  const profileIds = Array.from(new Set([...postAuthorIds, ...reactionAuthorIds]));
  const { data: profileRows } = profileIds.length
    ? await supabase.from('profiles').select('id, full_name, role').in('id', profileIds)
    : { data: [] };
  const profiles = (profileRows || []) as ThreadAuthor[];
  const reactionAuthorIdSet = new Set(reactionAuthorIds);

  return normalizeThreadDetailPayload({
    thread,
    category: categoryData as ForumCategory | null,
    author: authorData as ThreadAuthor | null,
    tags: (tagsData || []) as ForumTag[],
    posts: visiblePosts,
    postAuthors: profiles.filter((profile) => postAuthorIds.includes(profile.id)),
    reactionAuthors: profiles.filter((profile) => reactionAuthorIdSet.has(profile.id)),
    reactions: allReactions,
    mentions: (mentionsData || []) as ForumMentionDisplay[],
    isAdmin,
  });
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { threadId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_forum_thread_detail', { p_thread_id: threadId });

  const detail = rpcError && isMissingThreadDetailRpc(rpcError)
    ? await loadThreadDetailFallback({ supabase, userId: user.id, threadId })
    : normalizeThreadDetailPayload((rpcData || { thread: null }) as ThreadDetailPayload);

  if (rpcError && !isMissingThreadDetailRpc(rpcError)) {
    throw new Error(rpcError.message || 'Konu detaylari alinamadi.');
  }

  if (!detail) notFound();

  const {
    thread,
    category,
    author,
    tags,
    posts: enrichedPosts,
    reactionAuthors,
    reactions,
    mentions,
    isAdmin,
  } = detail;
  const topLevelPosts = enrichedPosts.filter((post) => !post.parent_post_id);
  const repliesByParent = new Map<string, ForumPostWithAuthor[]>();
  enrichedPosts.filter((post) => post.parent_post_id).forEach((post) => {
    const parentId = post.parent_post_id!;
    repliesByParent.set(parentId, [...(repliesByParent.get(parentId) || []), post]);
  });

  const threadMentions: ForumMentionDisplay[] = [];
  const mentionsByPostId = new Map<string, ForumMentionDisplay[]>();
  mentions.forEach((profile) => {
    if (!profile.post_id) {
      threadMentions.push(profile);
      return;
    }
    mentionsByPostId.set(profile.post_id, [...(mentionsByPostId.get(profile.post_id) || []), profile]);
  });

  return (
    <div className="relative left-1/2 flex w-[calc(100vw-3rem)] max-w-7xl -translate-x-1/2 flex-col gap-5 pb-8 pt-4 fade-in lg:pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={category ? `/topluluk/${category.slug}` : '/topluluk'} className="inline-flex items-center gap-2 text-sm font-bold text-surface-600 transition-colors hover:text-surface-950">
          <ArrowLeft className="h-4 w-4" weight="bold" />
          {category?.name || 'Topluluk'}
        </Link>
        <div className="flex flex-wrap items-center gap-3"><ForumPrivacyToggle /><AdminThreadControls thread={thread} isAdmin={isAdmin} /></div>
      </div>

      <article className={thread.is_hidden ? 'overflow-hidden rounded-2xl border border-red-100 bg-white shadow-[0_18px_58px_-50px_rgba(17,17,17,0.45)]' : 'overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_18px_58px_-50px_rgba(17,17,17,0.45)]'}>
        <div className="grid gap-0 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
          <aside className="border-b border-surface-200 bg-surface-50 p-5 lg:border-b-0 lg:border-r">
            <AuthorPanel author={author} createdAt={thread.created_at} currentUserId={user.id} />
            <div className="mt-5 grid grid-cols-2 gap-2 text-center md:grid-cols-1">
              <span className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-bold text-surface-700">
                <ChatCircleText className="mx-auto mb-1 h-4 w-4 text-surface-400" weight="bold" />
                {thread.comment_count} yanıt
              </span>
              <span className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-bold text-surface-700">
                <Eye className="mx-auto mb-1 h-4 w-4 text-surface-400" weight="bold" />
                {thread.view_count} görüntülenme
              </span>
            </div>
          </aside>

          <main className="min-w-0 p-6 sm:p-8" style={{ borderTop: `6px solid ${category?.color || '#2b8950'}` }}>
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <span className="rounded-md px-2.5 py-1 text-xs font-bold" style={{ color: category.color, backgroundColor: `${category.color}12` }}>
                  {category.name}
                </span>
              )}
              {thread.is_pinned && <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"><PushPin className="mr-1 inline h-3 w-3" weight="fill" />Sabit</span>}
              {thread.is_locked && <span className="rounded-md bg-surface-100 px-2.5 py-1 text-xs font-bold text-surface-600"><Lock className="mr-1 inline h-3 w-3" weight="bold" />Kilitli</span>}
              {thread.status === 'archived' && <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Arşivlenmiş</span>}
              {tags.map((tagItem) => (
                <span key={tagItem.id} className="rounded-md bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600">
                  <Tag className="mr-1 inline h-3 w-3" weight="bold" />
                  {tagItem.name}
                </span>
              ))}
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">{thread.title}</h1>
            <ForumMentionedContent
              content={thread.content}
              mentions={threadMentions}
              className="mt-5 whitespace-pre-wrap text-base leading-8 text-surface-700"
            />
            {thread.edited_at && <p className="mt-3 text-xs font-semibold text-surface-400">Düzenlendi · {timeAgo(thread.edited_at)}</p>}

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 pt-4">
              <ForumReactionBar
                targetType="thread"
                targetId={thread.id}
                counts={getReactionCounts(reactions, 'thread', thread.id)}
                activeReactions={getActiveReactions(reactions, 'thread', thread.id, user.id)}
                peopleByReaction={getReactionPeopleByType(reactions, reactionAuthors, 'thread', thread.id)}
              />
              <div className="flex items-center gap-1">
                {thread.can_edit && (
                  <ForumEditDialog
                    targetType="thread"
                    targetId={thread.id}
                    title={thread.title}
                    content={thread.content}
                    mentions={threadMentions}
                  />
                )}
                <ForumReportDialog targetType="thread" targetId={thread.id} />
              </div>
            </div>
          </main>
        </div>
      </article>

      <section className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_18px_58px_-50px_rgba(17,17,17,0.45)]">
        <div className="flex items-center justify-between border-b border-surface-200 bg-surface-50 px-5 py-4">
          <h2 className="text-base font-bold text-surface-900">Yanıtlar</h2>
          <span className="text-xs font-bold text-surface-500">{topLevelPosts.length} ana yanıt</span>
        </div>

        {topLevelPosts.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="text-base font-bold text-surface-900">Henüz yanıt yok</h3>
            <p className="mt-2 text-sm text-surface-500">İlk yanıtı yazarak konuyu canlandırabilirsin.</p>
          </div>
        ) : (
          <div>
            {topLevelPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                threadId={thread.id}
                reactions={reactions}
                reactionAuthors={reactionAuthors}
                userId={user.id}
                isAdmin={isAdmin}
                replies={repliesByParent.get(post.id) || []}
                locked={thread.is_locked}
                mentionsByPostId={mentionsByPostId}
              />
            ))}
          </div>
        )}
      </section>

      {thread.is_locked ? (
        <div className="rounded-2xl border border-surface-200 bg-surface-100 p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-surface-500" weight="bold" />
          <p className="mt-2 text-sm font-bold text-surface-700">Bu konu kilitli. Yeni yanıt yazılamaz.</p>
        </div>
      ) : (
        <ForumReplyForm threadId={thread.id} />
      )}
    </div>
  );
}

