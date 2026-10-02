alter table public.dashboard_feedback
  alter column user_id drop not null;

grant insert on public.dashboard_feedback to anon;

drop policy if exists "dashboard_feedback_insert_registration_anon" on public.dashboard_feedback;
create policy "dashboard_feedback_insert_registration_anon"
  on public.dashboard_feedback
  for insert
  to anon
  with check (
    user_id is null
    and sender_role = 'Kayıt ekranı'
    and sender_name is not null
    and sender_email is not null
  );

notify pgrst, 'reload schema';
