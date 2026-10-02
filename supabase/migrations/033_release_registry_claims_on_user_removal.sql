-- Release alumni registry claims when a user is rejected or deleted.
-- NIST: This protects identity availability and account recovery. Attack
-- scenario: someone starts a fake registration, claims a registry entry, then
-- the real owner cannot register with the same school identity later.

CREATE OR REPLACE FUNCTION public.release_alumni_registry_claim_for_deleted_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.alumni_registry
  SET is_claimed = FALSE,
      claimed_by = NULL
  WHERE claimed_by = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS release_alumni_registry_claim_before_profile_delete ON public.profiles;
CREATE TRIGGER release_alumni_registry_claim_before_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.release_alumni_registry_claim_for_deleted_profile();

ALTER TABLE public.alumni_registry
  DROP CONSTRAINT IF EXISTS alumni_registry_claimed_by_fkey,
  ADD CONSTRAINT alumni_registry_claimed_by_fkey
    FOREIGN KEY (claimed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
