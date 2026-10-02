-- Queue forum mention email jobs after the enum value introduced in 062 is committed.

CREATE OR REPLACE FUNCTION public.queue_forum_mention_email_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mentioned_user_id = NEW.mentioned_by THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_jobs (recipient_id, conversation_kind, conversation_id, first_message_id, scheduled_for)
  VALUES (NEW.mentioned_user_id, 'forum_mention', NEW.thread_id, NEW.id, NOW())
  ON CONFLICT (recipient_id, conversation_kind, conversation_id)
    WHERE status IN ('pending', 'processing', 'failed')
  DO UPDATE SET updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_mention_email_jobs ON public.forum_mentions;
CREATE TRIGGER forum_mention_email_jobs
  AFTER INSERT ON public.forum_mentions
  FOR EACH ROW EXECUTE FUNCTION public.queue_forum_mention_email_job();
