-- ============================================
-- Migration 078: Keep forum home overview payload small
-- ============================================

CREATE OR REPLACE FUNCTION public.get_forum_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'currentUserId', current_user_id,
    'categories', COALESCE((
      SELECT jsonb_agg(to_jsonb(category) ORDER BY category.sort_order ASC, category.name ASC)
      FROM public.forum_categories AS category
      WHERE category.is_active = TRUE
    ), '[]'::JSONB),
    'tags', COALESCE((
      SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.sort_order ASC, tag.name ASC)
      FROM public.forum_tags AS tag
      WHERE tag.is_active = TRUE
    ), '[]'::JSONB),
    'threads', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(thread)
        || jsonb_build_object(
          'author', CASE
            WHEN thread.author_id IS NULL THEN NULL
            ELSE jsonb_build_object('id', author.id, 'full_name', author.full_name, 'role', author.role)
          END,
          'category', to_jsonb(category),
          'tags', COALESCE(thread_tags.tags, '[]'::JSONB)
        )
        ORDER BY thread.is_pinned DESC, thread.last_activity_at DESC
      )
      FROM (
        SELECT *
        FROM public.forum_threads_public
        WHERE status = 'open'
          AND is_hidden = FALSE
        ORDER BY is_pinned DESC, last_activity_at DESC
        LIMIT 24
      ) AS thread
      LEFT JOIN public.profiles AS author ON author.id = thread.author_id
      LEFT JOIN public.forum_categories AS category ON category.id = thread.category_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.sort_order ASC, tag.name ASC) AS tags
        FROM public.forum_thread_tags AS thread_tag
        JOIN public.forum_tags AS tag ON tag.id = thread_tag.tag_id
        WHERE thread_tag.thread_id = thread.id
          AND tag.is_active = TRUE
      ) AS thread_tags ON TRUE
    ), '[]'::JSONB)
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forum_overview() TO authenticated;
