-- Live broadcasts: one row per stream, plus live chat. Video itself travels peer-to-peer (WebRTC); this only tracks who is live.
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text,
  status text not null default 'live' check (status in ('live','ended')),
  peak_viewers int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists live_streams_status_idx on public.live_streams(status, started_at desc);
alter table public.live_streams enable row level security;
create policy "live_select" on public.live_streams for select to authenticated using (true);
create policy "live_insert" on public.live_streams for insert to authenticated with check (host_id = auth.uid());
create policy "live_update" on public.live_streams for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

create table if not exists public.live_comments (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists live_comments_stream_idx on public.live_comments(stream_id, created_at);
alter table public.live_comments enable row level security;
create policy "livec_select" on public.live_comments for select to authenticated using (true);
create policy "livec_insert" on public.live_comments for insert to authenticated with check (user_id = auth.uid());

alter publication supabase_realtime add table public.live_streams;
alter publication supabase_realtime add table public.live_comments;
