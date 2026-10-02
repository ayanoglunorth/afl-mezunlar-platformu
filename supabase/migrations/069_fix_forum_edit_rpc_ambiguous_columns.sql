-- Qualify mention columns in edit RPCs so OUT columns do not shadow table
-- columns inside PL/pgSQL statements.

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

  UPDATE public.forum_threads AS thread
  SET title = left(clean_title, 140),
      content = left(clean_content, 8000)
  WHERE thread.id = p_thread_id
    AND thread.author_id = auth.uid()
    AND thread.is_hidden = FALSE
    AND thread.status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bu konuyu düzenleyemezsin.';
  END IF;

  DELETE FROM public.forum_mentions AS mention
  WHERE mention.thread_id = p_thread_id
    AND mention.post_id IS NULL
    AND mention.mentioned_by = auth.uid();

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

  UPDATE public.forum_posts AS post
  SET content = left(clean_content, 8000)
  FROM public.forum_threads AS thread
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

  DELETE FROM public.forum_mentions AS mention
  WHERE mention.post_id = p_post_id
    AND mention.mentioned_by = auth.uid();

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
