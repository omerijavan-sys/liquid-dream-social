create table if not exists public.client_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('error','page','event')),
  name text not null check (char_length(name) <= 120),
  message text check (char_length(message) <= 1500),
  stack text check (char_length(stack) <= 4000),
  path text check (char_length(path) <= 200),
  platform text check (char_length(platform) <= 40),
  app_version text check (char_length(app_version) <= 40),
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists client_events_created_idx on public.client_events (created_at desc);
create index if not exists client_events_kind_idx on public.client_events (kind, created_at desc);
alter table public.client_events enable row level security;
create policy "anyone can log" on public.client_events for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy "admins read" on public.client_events for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins delete" on public.client_events for delete to authenticated using (public.has_role(auth.uid(),'admin'));
