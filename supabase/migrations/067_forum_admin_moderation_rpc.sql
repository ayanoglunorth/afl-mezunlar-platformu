-- Admin forum moderation runs through a narrow SECURITY DEFINER RPC so local
-- and production server actions do not need a service-role client for UI
-- moderation.

CREATE OR REPLACE FUNCTION public.admin_moderate_forum_content(
  p_target_type TEXT,
  p_target_id UUID,
  p_action TEXT
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
  target_thread_id UUID;
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
    ELSIF p_action = 'toggle_lock' THEN
      UPDATE public.forum_threads
      SET is_locked = NOT is_locked
      WHERE id = p_target_id;
    ELSIF p_action = 'archive' THEN
      UPDATE public.forum_threads
      SET is_hidden = TRUE,
          status = 'archived'
      WHERE id = p_target_id;
    ELSIF p_action = 'restore_archive' THEN
      UPDATE public.forum_threads
      SET is_hidden = FALSE,
          status = 'open'
      WHERE id = p_target_id;
    ELSIF p_action = 'delete' THEN
      DELETE FROM public.forum_threads
      WHERE id = p_target_id;
    END IF;
  ELSE
    SELECT post.thread_id
    INTO target_thread_id
    FROM public.forum_posts post
    WHERE post.id = p_target_id;

    IF p_action = 'archive' THEN
      UPDATE public.forum_posts
      SET is_hidden = TRUE,
          status = 'archived'
      WHERE id = p_target_id;
    ELSIF p_action = 'restore_archive' THEN
      UPDATE public.forum_posts
      SET is_hidden = FALSE,
          status = 'open'
      WHERE id = p_target_id;
    ELSIF p_action = 'delete' THEN
      DELETE FROM public.forum_posts
      WHERE id = p_target_id;
    ELSE
      RAISE EXCEPTION 'Bu işlem yanıtlar için geçerli değil.';
    END IF;
  END IF;

  IF NOT FOUND AND p_action <> 'delete' THEN
    RAISE EXCEPTION 'İçerik bulunamadı.';
  END IF;

  RETURN QUERY SELECT TRUE, target_thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_moderate_forum_content(TEXT, UUID, TEXT) TO authenticated;
