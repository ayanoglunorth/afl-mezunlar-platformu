-- Forum archiving, durable in-app notifications, and forum mention email jobs.

ALTER TYPE notification_conversation_kind ADD VALUE IF NOT EXISTS 'forum_mention';

CREATE TABLE IF NOT EXISTS public.forum_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'mention' CHECK (kind IN ('mention')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipient_id, actor_id, thread_id, post_id, kind)
);

ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'forum_posts_status_check'
  ) THEN
    ALTER TABLE public.forum_posts
      ADD CONSTRAINT forum_posts_status_check CHECK (status IN ('open', 'archived'));
  END IF;
END $$;

UPDATE public.forum_posts SET status = 'archived' WHERE is_hidden = TRUE;
CREATE INDEX IF NOT EXISTS forum_notifications_unique_target
  ON public.forum_notifications(recipient_id, actor_id, thread_id, COALESCE(post_id, '00000000-0000-0000-0000-000000000000'::uuid), kind);

CREATE INDEX IF NOT EXISTS forum_notifications_recipient_created
  ON public.forum_notifications(recipient_id, is_read, created_at DESC);

ALTER TABLE public.forum_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own forum notifications" ON public.forum_notifications;
CREATE POLICY "Users can read own forum notifications"
  ON public.forum_notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own forum notifications" ON public.forum_notifications;
CREATE POLICY "Users can update own forum notifications"
  ON public.forum_notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_forum_mention_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mentioned_user_id = NEW.mentioned_by THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.forum_notifications
    WHERE recipient_id = NEW.mentioned_user_id
      AND actor_id = NEW.mentioned_by
      AND thread_id = NEW.thread_id
      AND post_id IS NOT DISTINCT FROM NEW.post_id
      AND kind = 'mention'
  ) THEN
    INSERT INTO public.forum_notifications (recipient_id, actor_id, thread_id, post_id)
    VALUES (NEW.mentioned_user_id, NEW.mentioned_by, NEW.thread_id, NEW.post_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_mention_notifications ON public.forum_mentions;
CREATE TRIGGER forum_mention_notifications
  AFTER INSERT ON public.forum_mentions
  FOR EACH ROW EXECUTE FUNCTION public.create_forum_mention_notifications();

GRANT SELECT, UPDATE ON public.forum_notifications TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- The old hidden flag is retained for backward compatibility with historic rows,
-- but all new moderation flows use the explicit archived status.
UPDATE public.forum_threads SET status = 'archived' WHERE is_hidden = TRUE AND status = 'hidden';
UPDATE public.forum_posts SET is_hidden = FALSE WHERE is_hidden = TRUE;
