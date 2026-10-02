grant delete on public.event_interests to authenticated;
grant delete on public.event_interests to service_role;

drop policy if exists "event_interests_delete_own" on public.event_interests;
create policy "event_interests_delete_own"
  on public.event_interests
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
