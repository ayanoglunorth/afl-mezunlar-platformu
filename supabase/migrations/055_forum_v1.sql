-- ============================================
-- Migration 055: Forum V1
-- ============================================

CREATE OR REPLACE FUNCTION public.forum_is_verified_user(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND is_verified = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.forum_is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.admin_privileges
    WHERE user_id = p_user_id
  );
$$;

ALTER TABLE public.forum_categories
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#2b8950',
  ADD COLUMN IF NOT EXISTS icon_key TEXT NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.forum_categories
SET
  name = 'Üniversite Seçenekleri',
  description = 'Üniversite tercihleri, bölümler, şehirler ve başvuru süreçleri.',
  color = '#2563eb',
  icon_key = 'graduation-cap',
  is_active = TRUE
WHERE slug = 'universite-secenekleri';

UPDATE public.forum_categories
SET
  name = 'Erasmus Seçenekleri',
  description = 'Erasmus deneyimleri, başvuru ipuçları ve ülke/okul önerileri.',
  color = '#7c3aed',
  icon_key = 'globe',
  is_active = TRUE
WHERE slug = 'erasmus-secenekleri';

UPDATE public.forum_categories
SET
  name = 'Kulüp ve Etkinlikler',
  description = 'Kulüpler, yarışmalar, sosyal etkinlikler ve okul topluluğu.',
  color = '#d97706',
  icon_key = 'calendar',
  is_active = TRUE
WHERE slug = 'kulup-ve-etkinlikler';

INSERT INTO public.forum_categories (slug, name, description, sort_order, color, icon_key, is_active)
VALUES
  ('kariyer-ve-staj', 'Kariyer ve Staj', 'Staj, iş, sektör deneyimi ve kariyer tavsiyeleri.', 4, '#0f766e', 'briefcase', TRUE),
  ('duyurular', 'Duyurular', 'Platform, okul ve topluluk duyuruları.', 5, '#be123c', 'megaphone', TRUE)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  color = EXCLUDED.color,
  icon_key = EXCLUDED.icon_key,
  is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS public.forum_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#525252',
  category_id UUID REFERENCES public.forum_categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.forum_tags (slug, name, color, sort_order)
VALUES
  ('tercih', 'Tercih', '#2563eb', 1),
  ('soru', 'Soru', '#7c3aed', 2),
  ('deneyim', 'Deneyim', '#0f766e', 3),
  ('burs', 'Burs', '#d97706', 4),
  ('erasmus', 'Erasmus', '#7c3aed', 5),
  ('staj', 'Staj', '#0f766e', 6),
  ('duyuru', 'Duyuru', '#be123c', 7),
  ('kulup', 'Kulüp', '#d97706', 8)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, color = EXCLUDED.color, sort_order = EXCLUDED.sort_order, is_active = TRUE;

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reaction_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

UPDATE public.forum_threads
SET last_activity_at = COALESCE(updated_at, created_at, NOW())
WHERE last_activity_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'forum_threads_status_check'
  ) THEN
    ALTER TABLE public.forum_threads
      ADD CONSTRAINT forum_threads_status_check CHECK (status IN ('open', 'hidden', 'archived'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.forum_thread_tags (
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.forum_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reply_count INTEGER NOT NULL DEFAULT 0,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.forum_posts (id, thread_id, author_id, content, parent_post_id, reaction_count, created_at, updated_at)
SELECT id, thread_id, author_id, content, parent_comment_id, upvote_count, created_at, created_at
FROM public.forum_comments
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.forum_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('thread', 'post')),
  target_thread_id UUID REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  target_post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'heart', 'insightful', 'celebrate', 'thanks')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (target_type = 'thread' AND target_thread_id IS NOT NULL AND target_post_id IS NULL)
    OR
    (target_type = 'post' AND target_post_id IS NOT NULL AND target_thread_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS forum_reactions_thread_unique
  ON public.forum_reactions(user_id, target_thread_id, reaction_type)
  WHERE target_thread_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS forum_reactions_post_unique
  ON public.forum_reactions(user_id, target_post_id, reaction_type)
  WHERE target_post_id IS NOT NULL;

INSERT INTO public.forum_reactions (user_id, target_type, target_thread_id, reaction_type, created_at)
SELECT user_id, 'thread', thread_id, 'like', created_at
FROM public.upvotes
WHERE thread_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.forum_reactions (user_id, target_type, target_post_id, reaction_type, created_at)
SELECT user_id, 'post', comment_id, 'like', created_at
FROM public.upvotes
WHERE comment_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.forum_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentioned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS forum_mentions_thread_unique
  ON public.forum_mentions(thread_id, mentioned_user_id, mentioned_by)
  WHERE post_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS forum_mentions_post_unique
  ON public.forum_mentions(post_id, mentioned_user_id, mentioned_by)
  WHERE post_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.forum_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('thread', 'post')),
  target_thread_id UUID REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  target_post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'abuse', 'privacy', 'off_topic', 'other')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (target_type = 'thread' AND target_thread_id IS NOT NULL AND target_post_id IS NULL)
    OR
    (target_type = 'post' AND target_post_id IS NOT NULL AND target_thread_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_thread_unique_open
  ON public.forum_reports(reporter_id, target_thread_id)
  WHERE target_thread_id IS NOT NULL AND status IN ('open', 'reviewing');

CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_post_unique_open
  ON public.forum_reports(reporter_id, target_post_id)
  WHERE target_post_id IS NOT NULL AND status IN ('open', 'reviewing');

CREATE INDEX IF NOT EXISTS idx_forum_threads_category_activity ON public.forum_threads(category_id, is_pinned DESC, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_status_activity ON public.forum_threads(status, is_hidden, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_thread_created ON public.forum_posts(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_posts_parent ON public.forum_posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_forum_mentions_user ON public.forum_mentions(mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON public.forum_reports(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_forum_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  IF TG_TABLE_NAME = 'forum_threads' THEN
    NEW.edited_at = CASE WHEN OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN NOW() ELSE OLD.edited_at END;
  ELSIF TG_TABLE_NAME = 'forum_posts' THEN
    NEW.edited_at = CASE WHEN OLD.content IS DISTINCT FROM NEW.content THEN NOW() ELSE OLD.edited_at END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_forum_threads_updated_at ON public.forum_threads;
CREATE TRIGGER set_forum_threads_updated_at
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_forum_updated_at();

DROP TRIGGER IF EXISTS set_forum_posts_updated_at ON public.forum_posts;
CREATE TRIGGER set_forum_posts_updated_at
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_forum_updated_at();

CREATE OR REPLACE FUNCTION public.recount_forum_thread_posts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_thread UUID;
BEGIN
  affected_thread := COALESCE(NEW.thread_id, OLD.thread_id);

  UPDATE public.forum_threads
  SET
    comment_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.forum_posts
      WHERE thread_id = affected_thread
        AND is_hidden = FALSE
    ),
    last_activity_at = NOW()
  WHERE id = affected_thread;

  IF COALESCE(NEW.parent_post_id, OLD.parent_post_id) IS NOT NULL THEN
    UPDATE public.forum_posts parent
    SET reply_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.forum_posts child
      WHERE child.parent_post_id = parent.id
        AND child.is_hidden = FALSE
    )
    WHERE parent.id = COALESCE(NEW.parent_post_id, OLD.parent_post_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recount_forum_thread_posts ON public.forum_posts;
CREATE TRIGGER recount_forum_thread_posts
  AFTER INSERT OR UPDATE OF is_hidden, parent_post_id OR DELETE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.recount_forum_thread_posts();

CREATE OR REPLACE FUNCTION public.recount_forum_reactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.target_type, OLD.target_type) = 'thread' THEN
    UPDATE public.forum_threads
    SET reaction_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.forum_reactions
      WHERE target_thread_id = COALESCE(NEW.target_thread_id, OLD.target_thread_id)
    )
    WHERE id = COALESCE(NEW.target_thread_id, OLD.target_thread_id);
  ELSE
    UPDATE public.forum_posts
    SET reaction_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.forum_reactions
      WHERE target_post_id = COALESCE(NEW.target_post_id, OLD.target_post_id)
    )
    WHERE id = COALESCE(NEW.target_post_id, OLD.target_post_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recount_forum_reactions ON public.forum_reactions;
CREATE TRIGGER recount_forum_reactions
  AFTER INSERT OR DELETE ON public.forum_reactions
  FOR EACH ROW EXECUTE FUNCTION public.recount_forum_reactions();

UPDATE public.forum_threads thread
SET comment_count = (
  SELECT COUNT(*)::INTEGER
  FROM public.forum_posts post
  WHERE post.thread_id = thread.id
    AND post.is_hidden = FALSE
);

UPDATE public.forum_threads thread
SET reaction_count = (
  SELECT COUNT(*)::INTEGER
  FROM public.forum_reactions reaction
  WHERE reaction.target_thread_id = thread.id
);

UPDATE public.forum_posts post
SET reaction_count = (
  SELECT COUNT(*)::INTEGER
  FROM public.forum_reactions reaction
  WHERE reaction.target_post_id = post.id
);

UPDATE public.forum_posts parent
SET reply_count = (
  SELECT COUNT(*)::INTEGER
  FROM public.forum_posts child
  WHERE child.parent_post_id = parent.id
    AND child.is_hidden = FALSE
);

ALTER TABLE public.forum_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_thread_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Forum categories are public" ON public.forum_categories;
DROP POLICY IF EXISTS "Forum threads are viewable by authenticated users" ON public.forum_threads;
DROP POLICY IF EXISTS "Authenticated users can create threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Authors can update own threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Admins can manage threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Admins can delete threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Forum comments are viewable by authenticated users" ON public.forum_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.forum_comments;
DROP POLICY IF EXISTS "Authors can update own comments" ON public.forum_comments;
DROP POLICY IF EXISTS "Admins can delete comments" ON public.forum_comments;
DROP POLICY IF EXISTS "Upvotes are viewable" ON public.upvotes;
DROP POLICY IF EXISTS "Users can upvote" ON public.upvotes;
DROP POLICY IF EXISTS "Users can remove own upvotes" ON public.upvotes;

CREATE POLICY "Verified users can read active forum categories"
  ON public.forum_categories FOR SELECT
  TO authenticated
  USING (public.forum_is_verified_user() AND is_active = TRUE);

CREATE POLICY "Verified users can read active forum tags"
  ON public.forum_tags FOR SELECT
  TO authenticated
  USING (public.forum_is_verified_user() AND is_active = TRUE);

CREATE POLICY "Verified users can read thread tags"
  ON public.forum_thread_tags FOR SELECT
  TO authenticated
  USING (public.forum_is_verified_user());

CREATE POLICY "Verified users can manage own thread tags"
  ON public.forum_thread_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    public.forum_is_verified_user()
    AND EXISTS (
      SELECT 1 FROM public.forum_threads
      WHERE id = thread_id
        AND author_id = auth.uid()
        AND is_hidden = FALSE
    )
  );

CREATE POLICY "Verified users can read visible threads"
  ON public.forum_threads FOR SELECT
  TO authenticated
  USING (
    public.forum_is_verified_user()
    AND (
      is_hidden = FALSE
      OR author_id = auth.uid()
      OR public.forum_is_admin()
    )
  );

CREATE POLICY "Verified users can create threads"
  ON public.forum_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    public.forum_is_verified_user()
    AND author_id = auth.uid()
    AND is_hidden = FALSE
    AND status = 'open'
  );

CREATE POLICY "Authors can edit own visible threads"
  ON public.forum_threads FOR UPDATE
  TO authenticated
  USING (public.forum_is_verified_user() AND author_id = auth.uid() AND is_hidden = FALSE)
  WITH CHECK (
    author_id = auth.uid()
    AND is_hidden = FALSE
    AND is_pinned = FALSE
    AND is_locked = FALSE
    AND status = 'open'
  );

CREATE POLICY "Admins can moderate threads"
  ON public.forum_threads FOR UPDATE
  TO authenticated
  USING (public.forum_is_admin())
  WITH CHECK (public.forum_is_admin());

CREATE POLICY "Admins can delete forum threads"
  ON public.forum_threads FOR DELETE
  TO authenticated
  USING (public.forum_is_admin());

CREATE POLICY "Verified users can read visible posts"
  ON public.forum_posts FOR SELECT
  TO authenticated
  USING (
    public.forum_is_verified_user()
    AND (
      is_hidden = FALSE
      OR author_id = auth.uid()
      OR public.forum_is_admin()
    )
  );

CREATE POLICY "Verified users can create posts"
  ON public.forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.forum_is_verified_user()
    AND author_id = auth.uid()
    AND is_hidden = FALSE
    AND EXISTS (
      SELECT 1
      FROM public.forum_threads
      WHERE id = thread_id
        AND is_hidden = FALSE
        AND is_locked = FALSE
        AND status = 'open'
    )
    AND (
      parent_post_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.forum_posts parent
        WHERE parent.id = parent_post_id
          AND parent.thread_id = thread_id
          AND parent.parent_post_id IS NULL
          AND parent.is_hidden = FALSE
      )
    )
  );

CREATE POLICY "Authors can edit own visible posts"
  ON public.forum_posts FOR UPDATE
  TO authenticated
  USING (public.forum_is_verified_user() AND author_id = auth.uid() AND is_hidden = FALSE)
  WITH CHECK (author_id = auth.uid() AND is_hidden = FALSE);

CREATE POLICY "Admins can moderate posts"
  ON public.forum_posts FOR UPDATE
  TO authenticated
  USING (public.forum_is_admin())
  WITH CHECK (public.forum_is_admin());

CREATE POLICY "Admins can delete forum posts"
  ON public.forum_posts FOR DELETE
  TO authenticated
  USING (public.forum_is_admin());

CREATE POLICY "Verified users can read reactions"
  ON public.forum_reactions FOR SELECT
  TO authenticated
  USING (public.forum_is_verified_user());

CREATE POLICY "Verified users can create reactions"
  ON public.forum_reactions FOR INSERT
  TO authenticated
  WITH CHECK (public.forum_is_verified_user() AND user_id = auth.uid());

CREATE POLICY "Users can remove own forum reactions"
  ON public.forum_reactions FOR DELETE
  TO authenticated
  USING (public.forum_is_verified_user() AND user_id = auth.uid());

CREATE POLICY "Verified users can read mentions involving them"
  ON public.forum_mentions FOR SELECT
  TO authenticated
  USING (
    public.forum_is_verified_user()
    AND (mentioned_user_id = auth.uid() OR mentioned_by = auth.uid() OR public.forum_is_admin())
  );

CREATE POLICY "Verified users can create mentions"
  ON public.forum_mentions FOR INSERT
  TO authenticated
  WITH CHECK (public.forum_is_verified_user() AND mentioned_by = auth.uid());

CREATE POLICY "Admins can manage mentions"
  ON public.forum_mentions FOR ALL
  TO authenticated
  USING (public.forum_is_admin())
  WITH CHECK (public.forum_is_admin());

CREATE POLICY "Users can read own reports and admins read all"
  ON public.forum_reports FOR SELECT
  TO authenticated
  USING (public.forum_is_verified_user() AND (reporter_id = auth.uid() OR public.forum_is_admin()));

CREATE POLICY "Verified users can create forum reports"
  ON public.forum_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.forum_is_verified_user() AND reporter_id = auth.uid() AND status = 'open');

CREATE POLICY "Admins can update forum reports"
  ON public.forum_reports FOR UPDATE
  TO authenticated
  USING (public.forum_is_admin())
  WITH CHECK (public.forum_is_admin());

GRANT EXECUTE ON FUNCTION public.forum_is_verified_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forum_is_admin(UUID) TO authenticated;
