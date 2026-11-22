create table if not exists public.user_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text,
  banned_by uuid,
  banned_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.user_bans enable row level security;
create policy "users read own ban" on public.user_bans for select to authenticated using (user_id = auth.uid());
create policy "admins manage bans" on public.user_bans for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter table public.video_chat_reports add column if not exists status text not null default 'open' check (status in ('open','actioned','dismissed'));
alter table public.video_chat_reports add column if not exists resolved_by uuid;
alter table public.video_chat_reports add column if not exists resolved_at timestamptz;

-- Is the signed-in user currently banned? (used by the app to lock suspended accounts)
create or replace function public.am_i_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_bans where user_id = auth.uid() and (expires_at is null or expires_at > now()));
$$;
grant execute on function public.am_i_banned() to authenticated;
