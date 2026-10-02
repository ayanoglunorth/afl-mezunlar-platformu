-- ============================================
-- Migration 073: Atomic forum reaction toggle
-- ============================================

CREATE OR REPLACE FUNCTION public.toggle_forum_reaction(
  p_target_type TEXT,
  p_target_id UUID,
  p_reaction_type TEXT
)
RETURNS TABLE(active BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  existing_reaction_id UUID;
BEGIN
  IF current_user_id IS NULL OR NOT public.forum_is_verified_user(current_user_id) THEN
    RAISE EXCEPTION 'Topluluk yalnizca dogrulanmis platform kullanicilarina aciktir.';
  END IF;

  IF p_target_type NOT IN ('thread', 'post') THEN
    RAISE EXCEPTION 'Gecersiz reaksiyon hedefi.';
  END IF;

  IF p_reaction_type NOT IN ('like', 'heart', 'insightful', 'celebrate', 'thanks') THEN
    RAISE EXCEPTION 'Gecersiz reaksiyon.';
  END IF;

  IF p_target_type = 'thread' THEN
    SELECT id
    INTO existing_reaction_id
    FROM public.forum_reactions
    WHERE user_id = current_user_id
      AND target_thread_id = p_target_id
      AND reaction_type = p_reaction_type
    LIMIT 1;

    IF existing_reaction_id IS NOT NULL THEN
      DELETE FROM public.forum_reactions WHERE id = existing_reaction_id;
      RETURN QUERY SELECT FALSE;
      RETURN;
    END IF;

    INSERT INTO public.forum_reactions (
      user_id,
      target_type,
      target_thread_id,
      target_post_id,
      reaction_type
    )
    VALUES (
      current_user_id,
      'thread',
      p_target_id,
      NULL,
      p_reaction_type
    );

    RETURN QUERY SELECT TRUE;
    RETURN;
  END IF;

  SELECT id
  INTO existing_reaction_id
  FROM public.forum_reactions
  WHERE user_id = current_user_id
    AND target_post_id = p_target_id
    AND reaction_type = p_reaction_type
  LIMIT 1;

  IF existing_reaction_id IS NOT NULL THEN
    DELETE FROM public.forum_reactions WHERE id = existing_reaction_id;
    RETURN QUERY SELECT FALSE;
    RETURN;
  END IF;

  INSERT INTO public.forum_reactions (
    user_id,
    target_type,
    target_thread_id,
    target_post_id,
    reaction_type
  )
  VALUES (
    current_user_id,
    'post',
    NULL,
    p_target_id,
    p_reaction_type
  );

  RETURN QUERY SELECT TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_forum_reaction(TEXT, UUID, TEXT) TO authenticated;
