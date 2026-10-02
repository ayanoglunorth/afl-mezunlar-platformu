alter table public.dashboard_feedback
  alter column user_id drop not null;

create or replace function public.submit_registration_feedback(
  p_sender_name text,
  p_sender_email text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_name text := nullif(btrim(p_sender_name), '');
  v_sender_email text := lower(nullif(btrim(p_sender_email), ''));
  v_message text := nullif(btrim(p_message), '');
  v_feedback_id uuid;
begin
  if v_sender_name is null or char_length(v_sender_name) < 2 or char_length(v_sender_name) > 120 then
    raise exception 'invalid_sender_name' using errcode = '22023';
  end if;

  if v_sender_email is null or char_length(v_sender_email) > 254 or v_sender_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_sender_email' using errcode = '22023';
  end if;

  if v_message is null or char_length(v_message) < 8 or char_length(v_message) > 1200 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  insert into public.dashboard_feedback (
    user_id,
    sender_name,
    sender_email,
    sender_role,
    message
  )
  values (
    null,
    v_sender_name,
    v_sender_email,
    'Kayıt ekranı',
    v_message
  )
  returning id into v_feedback_id;

  return v_feedback_id;
end;
$$;

revoke all on function public.submit_registration_feedback(text, text, text) from public, anon, authenticated;
grant execute on function public.submit_registration_feedback(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
