-- Fix sign-up trigger: PL/pgSQL evaluates the record expression even when FOUND is false.
DO $$
DECLARE
  definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) INTO definition;
  IF definition ~ E'  active_student_matches := FOUND\\s+AND metadata_student_number IS NOT NULL\\s+AND BTRIM\\(active_student_entry\\.student_number\\) = metadata_student_number;' THEN
    definition := regexp_replace(
      definition,
      E'  active_student_matches := FOUND\\s+AND metadata_student_number IS NOT NULL\\s+AND BTRIM\\(active_student_entry\\.student_number\\) = metadata_student_number;',
      E'  IF FOUND THEN\\n    active_student_matches := metadata_student_number IS NOT NULL\\n      AND BTRIM(active_student_entry.student_number) = metadata_student_number;\\n  ELSE\\n    active_student_matches := FALSE;\\n  END IF;',
      'n'
    );
    EXECUTE definition;
  END IF;
END;
$$;

-- Direct chats are intentionally not backed by a social match.
ALTER TABLE public.chat_rooms ALTER COLUMN match_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_direct_pair_unique
  ON public.chat_rooms (LEAST(user_a, user_b), GREATEST(user_a, user_b))
  WHERE match_id IS NULL AND is_expired = FALSE;

CREATE OR REPLACE FUNCTION public.admin_open_direct_chat(p_recipient_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  room_id UUID;
  user_a_id UUID;
  user_b_id UUID;
BEGIN
  IF current_user_id IS NULL OR NOT public.is_platform_admin(current_user_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;
  IF p_recipient_id IS NULL OR p_recipient_id = current_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A different recipient is required.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Recipient not found.';
  END IF;

  user_a_id := LEAST(current_user_id, p_recipient_id);
  user_b_id := GREATEST(current_user_id, p_recipient_id);
  SELECT id INTO room_id
  FROM public.chat_rooms
  WHERE user_a = user_a_id AND user_b = user_b_id AND match_id IS NULL AND is_expired = FALSE
  LIMIT 1;

  IF room_id IS NULL THEN
    INSERT INTO public.chat_rooms (match_id, user_a, user_b, expires_at, is_expired)
    VALUES (NULL, user_a_id, user_b_id, NOW() + INTERVAL '14 days', FALSE)
    RETURNING id INTO room_id;
  END IF;

  RETURN room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_open_direct_chat(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_open_direct_chat(UUID) TO authenticated;

-- API clients must not read raw forum rows, which contain anonymous authors' IDs.
ALTER VIEW public.forum_threads_public SET (security_invoker = false);
ALTER VIEW public.forum_posts_public SET (security_invoker = false);
REVOKE SELECT ON public.forum_threads, public.forum_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.forum_threads_public, public.forum_posts_public TO authenticated;
DROP FUNCTION IF EXISTS public.reveal_forum_anonymous_identity(TEXT, UUID);

NOTIFY pgrst, 'reload schema';
