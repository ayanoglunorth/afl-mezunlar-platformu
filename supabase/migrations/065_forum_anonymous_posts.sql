-- Forum anonymous publishing with public identity masking.

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_forum_threads_anonymous
  ON public.forum_threads(is_anonymous, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_posts_anonymous
  ON public.forum_posts(is_anonymous, created_at DESC);

DROP VIEW IF EXISTS public.forum_posts_public;
DROP VIEW IF EXISTS public.forum_threads_public;

CREATE VIEW public.forum_threads_public AS
SELECT
  id,
  category_id,
  CASE WHEN is_anonymous THEN NULL ELSE author_id END AS author_id,
  title,
  content,
  status,
  is_pinned,
  is_locked,
  is_hidden,
  is_anonymous,
  upvote_count,
  comment_count,
  view_count,
  reaction_count,
  last_activity_at,
  created_at,
  updated_at,
  edited_at
FROM public.forum_threads
WHERE is_hidden = FALSE OR author_id = auth.uid() OR public.is_platform_admin(auth.uid());

CREATE VIEW public.forum_posts_public AS
SELECT
  id,
  thread_id,
  CASE WHEN is_anonymous THEN NULL ELSE author_id END AS author_id,
  content,
  parent_post_id,
  reply_count,
  reaction_count,
  is_hidden,
  status,
  is_anonymous,
  edited_at,
  created_at,
  updated_at
FROM public.forum_posts
WHERE is_hidden = FALSE OR author_id = auth.uid() OR public.is_platform_admin(auth.uid());

GRANT SELECT ON public.forum_threads_public TO authenticated;
GRANT SELECT ON public.forum_posts_public TO authenticated;
REVOKE SELECT ON public.forum_threads FROM authenticated;
REVOKE SELECT ON public.forum_posts FROM authenticated;

CREATE OR REPLACE FUNCTION public.reveal_forum_anonymous_identity(
  p_target_type TEXT,
  p_target_id UUID
)
RETURNS TABLE (
  target_type TEXT,
  target_id UUID,
  author_id UUID,
  full_name TEXT,
  nickname TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_author_id UUID;
  target_is_anonymous BOOLEAN;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Yalnızca yöneticiler anonim kimliği görüntüleyebilir';
  END IF;

  IF p_target_type = 'thread' THEN
    SELECT t.author_id, t.is_anonymous
    INTO target_author_id, target_is_anonymous
    FROM public.forum_threads t
    WHERE t.id = p_target_id;
  ELSIF p_target_type = 'post' THEN
    SELECT p.author_id, p.is_anonymous
    INTO target_author_id, target_is_anonymous
    FROM public.forum_posts p
    WHERE p.id = p_target_id;
  ELSE
    RAISE EXCEPTION 'Geçersiz forum içerik türü';
  END IF;

  IF target_author_id IS NULL OR target_is_anonymous IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'İçerik anonim değil veya bulunamadı';
  END IF;

  INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
  VALUES (
    auth.uid(),
    target_author_id,
    'forum_anonymous_identity_revealed',
    jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id)
  );

  RETURN QUERY
  SELECT
    p_target_type,
    p_target_id,
    p.id,
    p.full_name,
    p.nickname,
    p.role::TEXT
  FROM public.profiles p
  WHERE p.id = target_author_id;
END;
$$;

REVOKE ALL ON public.forum_threads_public FROM anon;
REVOKE ALL ON public.forum_posts_public FROM anon;
GRANT EXECUTE ON FUNCTION public.reveal_forum_anonymous_identity(TEXT, UUID) TO authenticated;
