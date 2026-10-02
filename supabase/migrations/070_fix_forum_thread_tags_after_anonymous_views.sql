-- Tag insertion needs to validate thread ownership after base forum_threads
-- SELECT was removed from authenticated users for anonymous identity masking.

CREATE OR REPLACE FUNCTION public.forum_can_tag_thread(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.forum_threads thread
    WHERE thread.id = p_thread_id
      AND thread.author_id = auth.uid()
      AND thread.is_hidden = FALSE
      AND thread.status = 'open'
  );
$$;

DROP POLICY IF EXISTS "Verified users can manage own thread tags" ON public.forum_thread_tags;

CREATE POLICY "Verified users can manage own thread tags"
  ON public.forum_thread_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    public.forum_is_verified_user()
    AND public.forum_can_tag_thread(thread_id)
  );

GRANT EXECUTE ON FUNCTION public.forum_can_tag_thread(UUID) TO authenticated;
