-- Keep forum creation atomic from the UI perspective: a thread/post should not
-- remain saved when tags or mentions fail afterwards.

CREATE OR REPLACE FUNCTION public.create_forum_thread_with_details(
  p_thread_id UUID,
  p_category_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_is_anonymous BOOLEAN,
  p_tag_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_mention_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (
  thread_id UUID,
  category_slug TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  selected_category_slug TEXT;
  tag_id UUID;
  mention_id UUID;
BEGIN
  IF current_user_id IS NULL OR NOT public.forum_is_verified_user(current_user_id) THEN
    RAISE EXCEPTION 'Topluluk yalnızca doğrulanmış platform kullanıcılarına açıktır.';
  END IF;

  SELECT category.slug
  INTO selected_category_slug
  FROM public.forum_categories AS category
  WHERE category.id = p_category_id
    AND category.is_active = TRUE;

  IF selected_category_slug IS NULL THEN
    RAISE EXCEPTION 'Geçerli bir kategori seçmelisin.';
  END IF;

  INSERT INTO public.forum_threads (
    id,
    category_id,
    author_id,
    is_anonymous,
    title,
    content,
    status,
    is_pinned,
    is_locked,
    is_hidden
  )
  VALUES (
    p_thread_id,
    p_category_id,
    current_user_id,
    COALESCE(p_is_anonymous, FALSE),
    p_title,
    p_content,
    'open',
    FALSE,
    FALSE,
    FALSE
  );

  FOREACH tag_id IN ARRAY COALESCE(p_tag_ids, ARRAY[]::UUID[]) LOOP
    IF tag_id IS NOT NULL THEN
      INSERT INTO public.forum_thread_tags (thread_id, tag_id)
      VALUES (p_thread_id, tag_id);
    END IF;
  END LOOP;

  FOREACH mention_id IN ARRAY COALESCE(p_mention_ids, ARRAY[]::UUID[]) LOOP
    IF mention_id IS NOT NULL THEN
      INSERT INTO public.forum_mentions (thread_id, post_id, mentioned_user_id, mentioned_by)
      VALUES (p_thread_id, NULL, mention_id, current_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY SELECT p_thread_id, selected_category_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_forum_post_with_mentions(
  p_post_id UUID,
  p_thread_id UUID,
  p_parent_post_id UUID,
  p_content TEXT,
  p_is_anonymous BOOLEAN,
  p_mention_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (
  post_id UUID,
  thread_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  mention_id UUID;
BEGIN
  IF current_user_id IS NULL OR NOT public.forum_is_verified_user(current_user_id) THEN
    RAISE EXCEPTION 'Topluluk yalnızca doğrulanmış platform kullanıcılarına açıktır.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.forum_threads AS thread
    WHERE thread.id = p_thread_id
      AND thread.is_hidden = FALSE
      AND thread.is_locked = FALSE
      AND thread.status = 'open'
  ) THEN
    RAISE EXCEPTION 'Bu konuya yanıt yazılamaz.';
  END IF;

  IF p_parent_post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.forum_posts AS parent
    WHERE parent.id = p_parent_post_id
      AND parent.thread_id = p_thread_id
      AND parent.parent_post_id IS NULL
      AND parent.is_hidden = FALSE
      AND parent.status = 'open'
  ) THEN
    RAISE EXCEPTION 'Yanıt verilecek içerik bulunamadı.';
  END IF;

  INSERT INTO public.forum_posts (
    id,
    thread_id,
    author_id,
    is_anonymous,
    content,
    parent_post_id,
    is_hidden,
    status
  )
  VALUES (
    p_post_id,
    p_thread_id,
    current_user_id,
    COALESCE(p_is_anonymous, FALSE),
    p_content,
    p_parent_post_id,
    FALSE,
    'open'
  );

  FOREACH mention_id IN ARRAY COALESCE(p_mention_ids, ARRAY[]::UUID[]) LOOP
    IF mention_id IS NOT NULL THEN
      INSERT INTO public.forum_mentions (thread_id, post_id, mentioned_user_id, mentioned_by)
      VALUES (p_thread_id, p_post_id, mention_id, current_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY SELECT p_post_id, p_thread_id;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_moderate_forum_content(TEXT, UUID, TEXT);

CREATE FUNCTION public.admin_moderate_forum_content(
  p_target_type TEXT,
  p_target_id UUID,
  p_action TEXT
)
RETURNS TABLE (
  ok BOOLEAN,
  thread_id UUID,
  deleted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_thread_id UUID;
  affected_rows INTEGER := 0;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gerekir.';
  END IF;

  IF p_target_type NOT IN ('thread', 'post')
    OR p_action NOT IN ('toggle_pin', 'toggle_lock', 'archive', 'restore_archive', 'delete') THEN
    RAISE EXCEPTION 'Geçersiz moderasyon işlemi.';
  END IF;

  IF p_target_type = 'thread' THEN
    target_thread_id := p_target_id;

    IF p_action = 'toggle_pin' THEN
      UPDATE public.forum_threads
      SET is_pinned = NOT is_pinned
      WHERE id = p_target_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
    ELSIF p_action = 'toggle_lock' THEN
      UPDATE public.forum_threads
      SET is_locked = NOT is_locked
      WHERE id = p_target_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
    ELSIF p_action = 'archive' THEN
      UPDATE public.forum_threads
      SET is_hidden = TRUE,
          status = 'archived'
      WHERE id = p_target_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
    ELSIF p_action = 'restore_archive' THEN
      UPDATE public.forum_threads
      SET is_hidden = FALSE,
          status = 'open'
      WHERE id = p_target_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
    ELSIF p_action = 'delete' THEN
      DELETE FROM public.forum_threads
      WHERE id = p_target_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
    END IF;
  ELSE
    SELECT post.thread_id
    INTO target_thread_id
    FROM public.forum_posts AS post
    WHERE post.id = p_target_id;

    IF target_thread_id IS NULL THEN
      RAISE EXCEPTION 'İçerik bulunamadı.';
    END IF;

    IF p_action = 'archive' THEN
      UPDATE public.forum_posts
      SET is_hidden = TRUE,
          status = 'archived'
      WHERE id = p_target_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
    ELSIF p_action = 'restore_archive' THEN
      UPDATE public.forum_posts
      SET is_hidden = FALSE,
          status = 'open'
      WHERE id = p_target_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
    ELSIF p_action = 'delete' THEN
      DELETE FROM public.forum_posts
      WHERE id = p_target_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
    ELSE
      RAISE EXCEPTION 'Bu işlem yanıtlar için geçerli değil.';
    END IF;
  END IF;

  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'İçerik bulunamadı.';
  END IF;

  RETURN QUERY SELECT TRUE, target_thread_id, p_action = 'delete';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_forum_thread_with_details(UUID, UUID, TEXT, TEXT, BOOLEAN, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_forum_post_with_mentions(UUID, UUID, UUID, TEXT, BOOLEAN, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_forum_content(TEXT, UUID, TEXT) TO authenticated;
