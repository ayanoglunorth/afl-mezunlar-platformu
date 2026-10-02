-- Allow post creation to validate thread/parent visibility after base forum
-- SELECT privileges were removed for anonymous identity masking.

CREATE OR REPLACE FUNCTION public.forum_can_create_post(
  p_thread_id UUID,
  p_parent_post_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  thread_ok BOOLEAN;
  parent_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.forum_threads thread
    WHERE thread.id = p_thread_id
      AND thread.is_hidden = FALSE
      AND thread.is_locked = FALSE
      AND thread.status = 'open'
  )
  INTO thread_ok;

  IF thread_ok IS DISTINCT FROM TRUE THEN
    RETURN FALSE;
  END IF;

  IF p_parent_post_id IS NULL THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.forum_posts parent
    WHERE parent.id = p_parent_post_id
      AND parent.thread_id = p_thread_id
      AND parent.parent_post_id IS NULL
      AND parent.is_hidden = FALSE
      AND parent.status = 'open'
  )
  INTO parent_ok;

  RETURN parent_ok IS TRUE;
END;
$$;

DROP POLICY IF EXISTS "Verified users can create posts" ON public.forum_posts;

CREATE POLICY "Verified users can create posts"
  ON public.forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.forum_is_verified_user()
    AND author_id = auth.uid()
    AND is_hidden = FALSE
    AND public.forum_can_create_post(thread_id, parent_post_id)
  );

GRANT EXECUTE ON FUNCTION public.forum_can_create_post(UUID, UUID) TO authenticated;
