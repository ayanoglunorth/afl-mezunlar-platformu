-- ============================================
-- Migration 064: User-created forum categories
-- ============================================

ALTER TABLE public.forum_categories
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_user_created BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.forum_categories
SET is_user_created = FALSE
WHERE is_user_created IS DISTINCT FROM FALSE
  AND created_by IS NULL;

DROP POLICY IF EXISTS "Verified users can create user forum categories" ON public.forum_categories;
CREATE POLICY "Verified users can create user forum categories"
  ON public.forum_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    public.forum_is_verified_user()
    AND created_by = auth.uid()
    AND is_user_created = TRUE
    AND is_active = TRUE
    AND color = '#2b8950'
    AND icon_key = 'chat'
    AND sort_order >= 1000
  );

