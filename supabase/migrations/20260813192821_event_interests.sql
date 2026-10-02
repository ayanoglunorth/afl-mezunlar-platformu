create table if not exists public.event_interests (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  interest_type text not null check (interest_type in ('team', 'player', 'support')),
  team_name text,
  estimated_player_count integer check (estimated_player_count is null or (estimated_player_count between 1 and 20)),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_key, user_id)
);

alter table public.event_interests enable row level security;

grant select, insert, update, delete on public.event_interests to authenticated;
grant select, insert, update, delete on public.event_interests to service_role;

create or replace function public.set_event_interests_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_event_interests_updated_at() from public, anon, authenticated;

drop trigger if exists set_event_interests_updated_at on public.event_interests;
create trigger set_event_interests_updated_at
  before update on public.event_interests
  for each row
  execute function public.set_event_interests_updated_at();

drop policy if exists "event_interests_select_own_or_admin" on public.event_interests;
create policy "event_interests_select_own_or_admin"
  on public.event_interests
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_platform_admin((select auth.uid())));

drop policy if exists "event_interests_insert_own" on public.event_interests;
create policy "event_interests_insert_own"
  on public.event_interests
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "event_interests_update_own" on public.event_interests;
create policy "event_interests_update_own"
  on public.event_interests
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "event_interests_delete_own" on public.event_interests;
create policy "event_interests_delete_own"
  on public.event_interests
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists event_interests_event_key_created_at_idx
  on public.event_interests (event_key, created_at desc);

create index if not exists event_interests_user_id_idx
  on public.event_interests (user_id);

notify pgrst, 'reload schema';
