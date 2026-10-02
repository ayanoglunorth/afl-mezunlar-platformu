-- ============================================
-- Migration 074: Forum thread detail payload RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.get_forum_thread_detail(p_thread_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_user_is_admin BOOLEAN := FALSE;
  thread_row public.forum_threads%ROWTYPE;
  next_view_count INTEGER;
  visible_post_ids UUID[];
  result JSONB;
BEGIN
  IF current_user_id IS NULL OR NOT public.forum_is_verified_user(current_user_id) THEN
    RAISE EXCEPTION 'Topluluk yalnizca dogrulanmis platform kullanicilarina aciktir.';
  END IF;

  current_user_is_admin := public.is_platform_admin(current_user_id);

  SELECT *
  INTO thread_row
  FROM public.forum_threads AS thread
  WHERE thread.id = p_thread_id
    AND (
      thread.is_hidden = FALSE
      OR thread.author_id = current_user_id
      OR current_user_is_admin
    );

  IF thread_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.forum_threads AS thread
  SET view_count = thread.view_count + 1
  WHERE thread.id = thread_row.id
    AND thread.status = 'open'
    AND thread.is_hidden = FALSE
  RETURNING thread.view_count INTO next_view_count;

  IF next_view_count IS NOT NULL THEN
    thread_row.view_count := next_view_count;
  END IF;

  WITH visible_posts AS (
    SELECT post.*
    FROM public.forum_posts AS post
    WHERE post.thread_id = thread_row.id
      AND (
        CASE
          WHEN current_user_is_admin THEN TRUE
          ELSE post.is_hidden = FALSE AND post.status = 'open'
        END
      )
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO visible_post_ids
  FROM visible_posts;

  WITH visible_posts AS (
    SELECT post.*
    FROM public.forum_posts AS post
    WHERE post.thread_id = thread_row.id
      AND (
        CASE
          WHEN current_user_is_admin THEN TRUE
          ELSE post.is_hidden = FALSE AND post.status = 'open'
        END
      )
  ),
  post_author_ids AS (
    SELECT DISTINCT post.author_id
    FROM visible_posts AS post
    WHERE post.author_id IS NOT NULL
      AND post.is_anonymous = FALSE
  )
  SELECT jsonb_build_object(
    'isAdmin', current_user_is_admin,
    'thread', jsonb_build_object(
      'id', thread_row.id,
      'category_id', thread_row.category_id,
      'author_id', CASE WHEN thread_row.is_anonymous THEN NULL ELSE thread_row.author_id END,
      'title', thread_row.title,
      'content', thread_row.content,
      'status', thread_row.status,
      'is_pinned', thread_row.is_pinned,
      'is_locked', thread_row.is_locked,
      'is_hidden', thread_row.is_hidden,
      'is_anonymous', thread_row.is_anonymous,
      'can_edit', thread_row.author_id = current_user_id,
      'upvote_count', thread_row.upvote_count,
      'comment_count', thread_row.comment_count,
      'view_count', thread_row.view_count,
      'reaction_count', thread_row.reaction_count,
      'last_activity_at', thread_row.last_activity_at,
      'created_at', thread_row.created_at,
      'updated_at', thread_row.updated_at,
      'edited_at', thread_row.edited_at
    ),
    'category', (
      SELECT to_jsonb(category)
      FROM public.forum_categories AS category
      WHERE category.id = thread_row.category_id
        AND category.is_active = TRUE
    ),
    'author', (
      SELECT jsonb_build_object('id', profile.id, 'full_name', profile.full_name, 'role', profile.role)
      FROM public.profiles AS profile
      WHERE profile.id = thread_row.author_id
        AND thread_row.is_anonymous = FALSE
    ),
    'tags', COALESCE((
      SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.sort_order ASC, tag.name ASC)
      FROM public.forum_thread_tags AS thread_tag
      JOIN public.forum_tags AS tag ON tag.id = thread_tag.tag_id
      WHERE thread_tag.thread_id = thread_row.id
        AND tag.is_active = TRUE
    ), '[]'::JSONB),
    'posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', post.id,
        'thread_id', post.thread_id,
        'author_id', CASE WHEN post.is_anonymous THEN NULL ELSE post.author_id END,
        'content', post.content,
        'parent_post_id', post.parent_post_id,
        'reply_count', post.reply_count,
        'reaction_count', post.reaction_count,
        'is_hidden', post.is_hidden,
        'status', post.status,
        'is_anonymous', post.is_anonymous,
        'can_edit', post.author_id = current_user_id,
        'edited_at', post.edited_at,
        'created_at', post.created_at,
        'updated_at', post.updated_at
      ) ORDER BY post.created_at ASC)
      FROM visible_posts AS post
    ), '[]'::JSONB),
    'postAuthors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', profile.id, 'full_name', profile.full_name, 'role', profile.role) ORDER BY profile.full_name ASC)
      FROM post_author_ids AS author_id
      JOIN public.profiles AS profile ON profile.id = author_id.author_id
    ), '[]'::JSONB),
    'reactions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', reaction.user_id,
        'target_thread_id', reaction.target_thread_id,
        'target_post_id', reaction.target_post_id,
        'reaction_type', reaction.reaction_type
      ) ORDER BY reaction.created_at ASC)
      FROM public.forum_reactions AS reaction
      WHERE reaction.target_thread_id = thread_row.id
        OR reaction.target_post_id = ANY(visible_post_ids)
    ), '[]'::JSONB),
    'mentions', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
        'thread_id', mention.thread_id,
        'post_id', mention.post_id,
        'id', profile.id,
        'full_name', profile.full_name,
        'role', profile.role
      ))
      FROM public.forum_mentions AS mention
      JOIN public.profiles AS profile ON profile.id = mention.mentioned_user_id
      LEFT JOIN visible_posts AS post ON post.id = mention.post_id
      WHERE mention.thread_id = thread_row.id
        AND profile.is_verified = TRUE
        AND (
          mention.post_id IS NULL
          OR post.id IS NOT NULL
        )
    ), '[]'::JSONB)
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forum_thread_detail(UUID) TO authenticated;
