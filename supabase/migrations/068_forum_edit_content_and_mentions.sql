-- Let authors edit their own forum content and safely expose edit capability
-- without revealing anonymous author identities.

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
  (author_id = auth.uid()) AS can_edit,
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
  (author_id = auth.uid()) AS can_edit,
  edited_at,
  created_at,
  updated_at
FROM public.forum_posts
WHERE is_hidden = FALSE OR author_id = auth.uid() OR public.is_platform_admin(auth.uid());

GRANT SELECT ON public.forum_threads_public TO authenticated;
GRANT SELECT ON public.forum_posts_public TO authenticated;
REVOKE ALL ON public.forum_threads_public FROM anon;
REVOKE ALL ON public.forum_posts_public FROM anon;

CREATE OR REPLACE FUNCTION public.edit_forum_thread_content(
  p_thread_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_mention_ids UUID[]
)
RETURNS TABLE (
  ok BOOLEAN,
  thread_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_title TEXT := btrim(coalesce(p_title, ''));
  clean_content TEXT := btrim(coalesce(p_content, ''));
  mention_id UUID;
BEGIN
  IF NOT public.forum_is_verified_user(auth.uid()) THEN
    RAISE EXCEPTION 'Topluluk yalnızca doğrulanmış platform kullanıcılarına açıktır.';
  END IF;

  IF length(clean_title) < 6 OR length(clean_content) < 10 THEN
    RAISE EXCEPTION 'Başlık ve içerik alanlarını doldurmalısın.';
  END IF;

  UPDATE public.forum_threads
  SET title = left(clean_title, 140),
      content = left(clean_content, 8000)
  WHERE id = p_thread_id
    AND author_id = auth.uid()
    AND is_hidden = FALSE
    AND status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bu konuyu düzenleyemezsin.';
  END IF;

  DELETE FROM public.forum_mentions
  WHERE thread_id = p_thread_id
    AND post_id IS NULL
    AND mentioned_by = auth.uid();

  FOREACH mention_id IN ARRAY coalesce(p_mention_ids, ARRAY[]::UUID[]) LOOP
    IF mention_id IS NOT NULL THEN
      INSERT INTO public.forum_mentions (thread_id, post_id, mentioned_user_id, mentioned_by)
      VALUES (p_thread_id, NULL, mention_id, auth.uid())
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY SELECT TRUE, p_thread_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_forum_post_content(
  p_post_id UUID,
  p_content TEXT,
  p_mention_ids UUID[]
)
RETURNS TABLE (
  ok BOOLEAN,
  thread_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_content TEXT := btrim(coalesce(p_content, ''));
  target_thread_id UUID;
  mention_id UUID;
BEGIN
  IF NOT public.forum_is_verified_user(auth.uid()) THEN
    RAISE EXCEPTION 'Topluluk yalnızca doğrulanmış platform kullanıcılarına açıktır.';
  END IF;

  IF length(clean_content) < 2 THEN
    RAISE EXCEPTION 'Yanıt içeriği boş olamaz.';
  END IF;

  UPDATE public.forum_posts post
  SET content = left(clean_content, 8000)
  FROM public.forum_threads thread
  WHERE post.id = p_post_id
    AND post.thread_id = thread.id
    AND post.author_id = auth.uid()
    AND post.is_hidden = FALSE
    AND post.status = 'open'
    AND thread.is_hidden = FALSE
    AND thread.status = 'open'
  RETURNING post.thread_id INTO target_thread_id;

  IF target_thread_id IS NULL THEN
    RAISE EXCEPTION 'Bu yanıtı düzenleyemezsin.';
  END IF;

  DELETE FROM public.forum_mentions
  WHERE post_id = p_post_id
    AND mentioned_by = auth.uid();

  FOREACH mention_id IN ARRAY coalesce(p_mention_ids, ARRAY[]::UUID[]) LOOP
    IF mention_id IS NOT NULL THEN
      INSERT INTO public.forum_mentions (thread_id, post_id, mentioned_user_id, mentioned_by)
      VALUES (target_thread_id, p_post_id, mention_id, auth.uid())
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY SELECT TRUE, target_thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.edit_forum_thread_content(UUID, TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_forum_post_content(UUID, TEXT, UUID[]) TO authenticated;
