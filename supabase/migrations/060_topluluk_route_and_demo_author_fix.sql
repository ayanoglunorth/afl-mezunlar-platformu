-- Migration 060: Topluluk URL support and demo author cleanup

CREATE OR REPLACE FUNCTION public.increment_forum_thread_view(p_thread_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_count INTEGER;
BEGIN
  IF NOT public.forum_is_verified_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only verified users can view community threads.';
  END IF;

  UPDATE public.forum_threads
  SET view_count = view_count + 1
  WHERE id = p_thread_id
    AND status = 'open'
    AND is_hidden = FALSE
  RETURNING view_count INTO next_count;

  RETURN COALESCE(next_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_forum_thread_view(UUID) TO authenticated;
