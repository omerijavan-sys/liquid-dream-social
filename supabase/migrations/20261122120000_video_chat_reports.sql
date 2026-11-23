create table if not exists public.video_chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid,
  reason text not null check (reason in ('underage','harassment','explicit_content','spam')),
  created_at timestamptz not null default now()
);
alter table public.video_chat_reports enable row level security;
create policy "reporters insert own" on public.video_chat_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reporters read own" on public.video_chat_reports for select to authenticated using (reporter_id = auth.uid());
create policy "admins manage" on public.video_chat_reports for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
