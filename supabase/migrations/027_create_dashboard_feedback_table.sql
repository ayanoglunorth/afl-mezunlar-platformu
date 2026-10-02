create table if not exists public.dashboard_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text,
  sender_email text,
  sender_role text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'archived')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

alter table public.dashboard_feedback enable row level security;

drop policy if exists "dashboard_feedback_insert_own" on public.dashboard_feedback;
create policy "dashboard_feedback_insert_own"
  on public.dashboard_feedback
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "dashboard_feedback_select_admins" on public.dashboard_feedback;
create policy "dashboard_feedback_select_admins"
  on public.dashboard_feedback
  for select
  to authenticated
  using (public.is_platform_admin(auth.uid()));

create index if not exists dashboard_feedback_created_at_idx
  on public.dashboard_feedback (created_at desc);

create index if not exists dashboard_feedback_user_id_idx
  on public.dashboard_feedback (user_id);

notify pgrst, 'reload schema';
