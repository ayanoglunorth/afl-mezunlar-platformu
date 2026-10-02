-- Expose only safe public mention display data for visible forum content.
-- This keeps anonymous author identities and mention actor identities private.

CREATE OR REPLACE FUNCTION public.get_forum_public_mentions(p_thread_id UUID)
RETURNS TABLE (
  thread_id UUID,
  post_id UUID,
  id UUID,
  full_name TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_user_is_admin BOOLEAN := public.is_platform_admin(auth.uid());
  thread_is_visible BOOLEAN;
BEGIN
  IF current_user_id IS NULL OR NOT public.forum_is_verified_user(current_user_id) THEN
    RAISE EXCEPTION 'Topluluk yalnızca doğrulanmış platform kullanıcılarına açıktır.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.forum_threads AS thread
    WHERE thread.id = p_thread_id
      AND (
        thread.is_hidden = FALSE
        OR thread.author_id = current_user_id
        OR current_user_is_admin
      )
  )
  INTO thread_is_visible;

  IF NOT thread_is_visible THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (mention.thread_id, mention.post_id, profile.id)
    mention.thread_id,
    mention.post_id,
    profile.id,
    profile.full_name,
    profile.role::TEXT
  FROM public.forum_mentions AS mention
  JOIN public.profiles AS profile ON profile.id = mention.mentioned_user_id
  LEFT JOIN public.forum_posts AS post ON post.id = mention.post_id
  WHERE mention.thread_id = p_thread_id
    AND profile.is_verified = TRUE
    AND (
      mention.post_id IS NULL
      OR post.id IS NOT NULL
    )
    AND (
      mention.post_id IS NULL
      OR post.is_hidden = FALSE
      OR post.author_id = current_user_id
      OR current_user_is_admin
    )
    AND (
      mention.post_id IS NULL
      OR post.status = 'open'
      OR current_user_is_admin
    )
  ORDER BY mention.thread_id, mention.post_id, profile.id, mention.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forum_public_mentions(UUID) TO authenticated;
