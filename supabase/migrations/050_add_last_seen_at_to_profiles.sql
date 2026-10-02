-- ============================================
-- Migration 050: Add last_seen_at to profiles
-- ============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- RPC to update the last_seen_at for the currently authenticated user
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if the user is authenticated
  IF auth.uid() IS NOT NULL THEN
    UPDATE public.profiles
    SET last_seen_at = NOW()
    WHERE id = auth.uid();
  END IF;
END;
$$;

-- Allow authenticated users to execute the RPC
GRANT EXECUTE ON FUNCTION public.update_last_seen() TO authenticated;
