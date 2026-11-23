-- =====================================================================
-- Primegram growth features: Daily Drops + Streaks, Aesthetics / Vibe Cards,
-- Group Hangouts, Referral loop + perks.
-- All tables have RLS on. Writes that must not be forged (streaks, referral
-- counts, perks) happen only in SECURITY DEFINER functions / triggers.
-- =====================================================================

-- ---------- shared helpers ----------
create or replace function public.are_mutuals(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from follows where follower_id = a and following_id = b)
     and exists (select 1 from follows where follower_id = b and following_id = a);
$$;

-- is_group_member(_gid, _uid) already exists in this project and is reused as-is.

-- Each user's own timezone drives "what day is it" for drops and streak resets.
alter table public.profiles add column if not exists tz text not null default 'Africa/Nairobi';

create or replace function public.validate_profile_tz() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.tz) then
    new.tz := 'Africa/Nairobi';
  end if;
  return new;
end $$;
drop trigger if exists profiles_validate_tz on public.profiles;
create trigger profiles_validate_tz before insert or update of tz on public.profiles
  for each row execute function public.validate_profile_tz();

create or replace function public.user_today(uid uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select tz from profiles where user_id = uid), 'Africa/Nairobi'))::date;
$$;

-- =====================================================================
-- 1. DAILY DROPS + STREAKS
-- =====================================================================
create table if not exists public.daily_drops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drop_date date not null,                       -- set by trigger from the user's timezone, never trusted from the client
  kind text not null check (kind in ('photo','voice','song')),
  media_url text check (media_url is null or media_url ~ '^https://'),
  caption text check (char_length(caption) <= 140),
  duration_s numeric(4,1) check (duration_s is null or duration_s <= 6),
  song_title text check (char_length(song_title) <= 120),
  song_artist text check (char_length(song_artist) <= 120),
  song_art_url text check (song_art_url is null or song_art_url ~ '^https://'),
  song_url text check (song_url is null or song_url ~ '^https://'),
  created_at timestamptz not null default now(),
  unique (user_id, drop_date)                    -- one drop per local day
);
create index if not exists daily_drops_date_idx on public.daily_drops (drop_date desc, user_id);

create or replace function public.daily_drops_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.drop_date := public.user_today(new.user_id);
  if new.kind in ('photo','voice') and new.media_url is null then raise exception 'A % drop needs media', new.kind; end if;
  if new.kind = 'voice' and (new.duration_s is null or new.duration_s > 6) then raise exception 'Voice drops are 5 seconds max'; end if;
  if new.kind = 'song' and new.song_title is null then raise exception 'A song drop needs a song'; end if;
  return new;
end $$;
drop trigger if exists daily_drops_bi on public.daily_drops;
create trigger daily_drops_bi before insert on public.daily_drops for each row execute function public.daily_drops_before_insert();

-- streak tables ------------------------------------------------------
create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_drop_date date
);
create table if not exists public.pair_streaks (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_day date,
  primary key (user_a, user_b),
  check (user_a < user_b)                        -- one canonical row per pair
);
create table if not exists public.group_streaks (
  group_id uuid primary key references public.chat_groups(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_day date
);

create or replace function public.streak_tier(n int) returns text language sql immutable as $$
  select case when n >= 30 then 'inferno' when n >= 7 then 'blaze' when n >= 3 then 'spark' else 'none' end;
$$;

-- Advances a streak: same day = no change, consecutive day = +1, gap = restart at 1.
create or replace function public.next_streak(cur int, last_day date, today date) returns int
language sql immutable as $$
  select case when last_day = today then greatest(cur, 1)
              when last_day = today - 1 then cur + 1
              else 1 end;
$$;

create or replace function public.daily_drops_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; g record; n int; a uuid; b uuid;
begin
  -- personal streak
  insert into user_streaks (user_id, current_streak, longest_streak, last_drop_date)
  values (new.user_id, 1, 1, new.drop_date)
  on conflict (user_id) do update set
    current_streak = next_streak(user_streaks.current_streak, user_streaks.last_drop_date, new.drop_date),
    longest_streak = greatest(user_streaks.longest_streak, next_streak(user_streaks.current_streak, user_streaks.last_drop_date, new.drop_date)),
    last_drop_date = new.drop_date;

  -- pair streaks with every mutual who also dropped today (same local date)
  for m in
    select f.following_id as other from follows f
    where f.follower_id = new.user_id
      and exists (select 1 from follows r where r.follower_id = f.following_id and r.following_id = new.user_id)
      and exists (select 1 from daily_drops d where d.user_id = f.following_id and d.drop_date = new.drop_date)
  loop
    a := least(new.user_id, m.other); b := greatest(new.user_id, m.other);
    insert into pair_streaks (user_a, user_b, current_streak, longest_streak, last_day) values (a, b, 1, 1, new.drop_date)
    on conflict (user_a, user_b) do update set
      current_streak = next_streak(pair_streaks.current_streak, pair_streaks.last_day, new.drop_date),
      longest_streak = greatest(pair_streaks.longest_streak, next_streak(pair_streaks.current_streak, pair_streaks.last_day, new.drop_date)),
      last_day = new.drop_date;
  end loop;

  -- group streaks: a day counts once at least 2 members have dropped
  for g in select group_id from chat_group_members where user_id = new.user_id loop
    select count(distinct d.user_id) into n from daily_drops d
      join chat_group_members cm on cm.user_id = d.user_id and cm.group_id = g.group_id
      where d.drop_date = new.drop_date;
    if n >= 2 then
      insert into group_streaks (group_id, current_streak, longest_streak, last_day) values (g.group_id, 1, 1, new.drop_date)
      on conflict (group_id) do update set
        current_streak = next_streak(group_streaks.current_streak, group_streaks.last_day, new.drop_date),
        longest_streak = greatest(group_streaks.longest_streak, next_streak(group_streaks.current_streak, group_streaks.last_day, new.drop_date)),
        last_day = new.drop_date;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists daily_drops_ai on public.daily_drops;
create trigger daily_drops_ai after insert on public.daily_drops for each row execute function public.daily_drops_after_insert();

-- "Effective" streaks: a streak whose last day is older than yesterday (in the owner's timezone) has already reset to 0.
create or replace view public.user_streaks_live with (security_invoker = on) as
select s.user_id, s.longest_streak,
  case when s.last_drop_date >= public.user_today(s.user_id) - 1 then s.current_streak else 0 end as current_streak,
  (s.last_drop_date = public.user_today(s.user_id) - 1) as at_risk,
  public.streak_tier(case when s.last_drop_date >= public.user_today(s.user_id) - 1 then s.current_streak else 0 end) as tier
from public.user_streaks s;

create or replace view public.pair_streaks_live with (security_invoker = on) as
select p.user_a, p.user_b, p.longest_streak,
  case when p.last_day >= public.user_today(auth.uid()) - 1 then p.current_streak else 0 end as current_streak,
  public.streak_tier(case when p.last_day >= public.user_today(auth.uid()) - 1 then p.current_streak else 0 end) as tier
from public.pair_streaks p;

create or replace view public.group_streaks_live with (security_invoker = on) as
select g.group_id, g.longest_streak,
  case when g.last_day >= public.user_today(auth.uid()) - 1 then g.current_streak else 0 end as current_streak,
  public.streak_tier(case when g.last_day >= public.user_today(auth.uid()) - 1 then g.current_streak else 0 end) as tier
from public.group_streaks g;

-- Friends' drops with the unlock mechanic enforced SERVER-SIDE: until you post today's drop, media is returned as NULL.
create or replace function public.get_friend_drops(_limit int default 40)
returns table (id uuid, user_id uuid, drop_date date, kind text, media_url text, caption text, duration_s numeric,
               song_title text, song_artist text, song_art_url text, song_url text, created_at timestamptz, locked boolean, mutual boolean)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); today date; unlocked boolean;
begin
  if me is null then return; end if;
  today := user_today(me);
  unlocked := exists (select 1 from daily_drops where daily_drops.user_id = me and daily_drops.drop_date = today);
  return query
    select d.id, d.user_id, d.drop_date, d.kind,
           case when unlocked then d.media_url end, case when unlocked then d.caption end, case when unlocked then d.duration_s end,
           case when unlocked then d.song_title end, case when unlocked then d.song_artist end,
           case when unlocked then d.song_art_url end, case when unlocked then d.song_url end,
           d.created_at, not unlocked, are_mutuals(me, d.user_id)
    from daily_drops d
    where d.user_id <> me
      and d.drop_date >= today - 1 and d.drop_date <= today + 1   -- covers timezone differences
      and exists (select 1 from follows f where f.follower_id = me and f.following_id = d.user_id)
    order by d.created_at desc
    limit least(coalesce(_limit, 40), 100);
end $$;
grant execute on function public.get_friend_drops(int) to authenticated;

alter table public.daily_drops enable row level security;
alter table public.user_streaks enable row level security;
alter table public.pair_streaks enable row level security;
alter table public.group_streaks enable row level security;

create policy "own drops: read" on public.daily_drops for select to authenticated using (user_id = auth.uid());
create policy "own drops: insert" on public.daily_drops for insert to authenticated with check (user_id = auth.uid());
create policy "own drops: delete" on public.daily_drops for delete to authenticated using (user_id = auth.uid());
create policy "streak badges are public" on public.user_streaks for select to authenticated using (true);
create policy "pair streaks: participants" on public.pair_streaks for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "group streaks: members" on public.group_streaks for select to authenticated using (public.is_group_member(group_id, auth.uid()));

-- =====================================================================
-- 2. PROFILE AESTHETICS (+ Vibe Card data)
-- =====================================================================
create table if not exists public.user_perks (
  user_id uuid not null references auth.users(id) on delete cascade,
  perk text not null check (perk in ('obsidian_gold_theme','founder_ring','vip_badge','platinum_badge')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, perk)
);
alter table public.user_perks enable row level security;
create policy "perks are visible" on public.user_perks for select to authenticated using (true);   -- no write policies: only definer functions grant perks

create table if not exists public.profile_aesthetics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  accent text not null default '#a78bfa' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  glass_opacity smallint not null default 8 check (glass_opacity between 2 and 40),
  ring text not null default 'none' check (ring in ('none','pulse','spin','aurora','founder')),
  font text not null default 'sans' check (font in ('sans','serif','mono','script','display')),
  theme text not null default 'obsidian' check (theme in ('obsidian','midnight','sunset','obsidian_gold')),
  status_text text check (char_length(status_text) <= 80),
  pinned_title text check (char_length(pinned_title) <= 120),
  pinned_artist text check (char_length(pinned_artist) <= 120),
  pinned_art_url text check (pinned_art_url is null or pinned_art_url ~ '^https://'),
  pinned_audio_url text check (pinned_audio_url is null or pinned_audio_url ~ '^https://'),
  updated_at timestamptz not null default now()
);
alter table public.profile_aesthetics enable row level security;
create policy "aesthetics are public" on public.profile_aesthetics for select to authenticated using (true);
create policy "own aesthetics: insert" on public.profile_aesthetics for insert to authenticated with check (user_id = auth.uid());
create policy "own aesthetics: update" on public.profile_aesthetics for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Locked cosmetics can only be used by people who earned them.
create or replace function public.aesthetics_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.theme = 'obsidian_gold' and not exists (select 1 from user_perks where user_id = new.user_id and perk = 'obsidian_gold_theme') then
    raise exception 'Invite 3 friends to unlock the Obsidian Gold theme';
  end if;
  if new.ring = 'founder' and not exists (select 1 from user_perks where user_id = new.user_id and perk = 'founder_ring') then
    raise exception 'Invite 3 friends to unlock the Founder ring';
  end if;
  return new;
end $$;
drop trigger if exists aesthetics_guard_trg on public.profile_aesthetics;
create trigger aesthetics_guard_trg before insert or update on public.profile_aesthetics for each row execute function public.aesthetics_guard();

-- =====================================================================
-- 4. REFERRALS (created before hangouts because handle_new_user uses them)
-- =====================================================================
create or replace function public.gen_referral_code() returns text language plpgsql as $$
declare c text;
begin
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.profiles where referral_code = c);
  end loop;
  return c;
end $$;

alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists referral_count int not null default 0;
update public.profiles set referral_code = public.gen_referral_code() where referral_code is null;
alter table public.profiles alter column referral_code set default public.gen_referral_code();
alter table public.profiles alter column referral_code set not null;
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);

create table if not exists public.referrals (
  referred_id uuid primary key references auth.users(id) on delete cascade,   -- a person can only ever be referred once
  referrer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)                                         -- no self-referrals
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);
alter table public.referrals enable row level security;
create policy "referrals: participants read" on public.referrals for select to authenticated using (auth.uid() in (referrer_id, referred_id));

-- Users can edit their profile, but never their referral fields.
create or replace function public.guard_referral_columns() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.referral_write', true), '') <> '1' then
    new.referral_code := old.referral_code; new.referred_by := old.referred_by; new.referral_count := old.referral_count;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_referral on public.profiles;
create trigger profiles_guard_referral before update on public.profiles for each row execute function public.guard_referral_columns();

create or replace function public.grant_referral_perks(uid uuid, n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if n >= 3 then
    insert into user_perks (user_id, perk) values (uid,'obsidian_gold_theme'),(uid,'founder_ring'),(uid,'vip_badge') on conflict do nothing;
  end if;
  if n >= 10 then insert into user_perks (user_id, perk) values (uid,'platinum_badge') on conflict do nothing; end if;
end $$;
revoke execute on function public.grant_referral_perks(uuid, int) from public, anon, authenticated;

-- Core claim logic, used by sign-up trigger and by the client RPC.
create or replace function public._apply_referral(uid uuid, _code text, max_age interval) returns text
language plpgsql security definer set search_path = public as $$
declare ref_id uuid; me profiles%rowtype; cnt int;
begin
  select * into me from profiles where user_id = uid;
  if not found then return 'no_profile'; end if;
  if me.referred_by is not null then return 'already_referred'; end if;
  if me.created_at < now() - max_age then return 'too_old'; end if;           -- existing accounts can't be farmed
  select user_id into ref_id from profiles where referral_code = upper(trim(_code));
  if ref_id is null then return 'invalid_code'; end if;
  if ref_id = uid then return 'self_referral'; end if;
  if exists (select 1 from profiles where user_id = ref_id and referred_by = uid) then return 'circular'; end if;

  perform set_config('app.referral_write', '1', true);
  insert into referrals (referred_id, referrer_id) values (uid, ref_id) on conflict do nothing;
  if not found then perform set_config('app.referral_write', '', true); return 'already_referred'; end if;
  update profiles set referred_by = ref_id where user_id = uid;
  update profiles set referral_count = referral_count + 1 where user_id = ref_id returning referral_count into cnt;
  perform grant_referral_perks(ref_id, cnt);
  perform set_config('app.referral_write', '', true);
  return 'ok';
end $$;
revoke execute on function public._apply_referral(uuid, text, interval) from public, anon, authenticated;

create or replace function public.claim_referral(_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  r := _apply_referral(auth.uid(), _code, interval '3 days');
  return jsonb_build_object('ok', r = 'ok', 'error', case when r = 'ok' then null else r end);
end $$;
grant execute on function public.claim_referral(text) to authenticated;

-- Public lookup so the invite landing page can say "Ada invited you" before sign-up.
create or replace function public.referral_preview(_code text) returns table (display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select display_name, avatar_url from profiles where referral_code = upper(trim(_code)) limit 1;
$$;
grant execute on function public.referral_preview(text) to anon, authenticated;

-- Sign-up: also honour a `ref` code passed in the sign-up metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name, username)
  values (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', 'user_' || LEFT(NEW.id::text, 8)), ' ', '_')));
  begin
    if coalesce(NEW.raw_user_meta_data->>'ref', '') <> '' then
      perform public._apply_referral(NEW.id, NEW.raw_user_meta_data->>'ref', interval '1 day');
    end if;
  exception when others then null;   -- a bad code must never block sign-up
  end;
  return NEW;
end $$;

-- =====================================================================
-- 3. GROUP HANGOUTS (Q&A + polls; live reactions & "listening together" use Realtime Broadcast/Presence, no tables)
-- =====================================================================
create table if not exists public.hangout_prompts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('qa','poll')),
  body text not null check (char_length(body) between 1 and 200),
  options jsonb check (options is null or (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 2)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  check ((kind = 'poll') = (options is not null))
);
create index if not exists hangout_prompts_group_idx on public.hangout_prompts (group_id, created_at desc);

create table if not exists public.hangout_answers (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.hangout_prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer text not null check (char_length(answer) between 1 and 280),
  created_at timestamptz not null default now()
);
create table if not exists public.hangout_votes (
  prompt_id uuid not null references public.hangout_prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice smallint not null check (choice in (0, 1)),
  primary key (prompt_id, user_id)
);
alter table public.hangout_prompts enable row level security;
alter table public.hangout_answers enable row level security;
alter table public.hangout_votes enable row level security;

create policy "prompts: members read" on public.hangout_prompts for select to authenticated using (public.is_group_member(group_id, auth.uid()));
create policy "prompts: members create" on public.hangout_prompts for insert to authenticated
  with check (author_id = auth.uid() and public.is_group_member(group_id, auth.uid()));
create policy "prompts: author deletes" on public.hangout_prompts for delete to authenticated using (author_id = auth.uid());
-- answers are ANONYMOUS: nobody can SELECT the table (so user_id never leaks); everyone reads through hangout_answers_for().
create policy "answers: members add" on public.hangout_answers for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from hangout_prompts p where p.id = prompt_id and p.kind = 'qa' and p.expires_at > now() and public.is_group_member(p.group_id, auth.uid())));
create policy "votes: members vote" on public.hangout_votes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from hangout_prompts p where p.id = prompt_id and p.kind = 'poll' and p.expires_at > now() and public.is_group_member(p.group_id, auth.uid())));
create policy "votes: change own" on public.hangout_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes: read own" on public.hangout_votes for select to authenticated using (user_id = auth.uid());

create or replace function public.hangout_answers_for(_prompt uuid) returns table (id uuid, answer text, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.answer, a.created_at, a.user_id = auth.uid()
  from hangout_answers a join hangout_prompts p on p.id = a.prompt_id
  where a.prompt_id = _prompt and public.is_group_member(p.group_id, auth.uid())
  order by a.created_at desc limit 100;
$$;
create or replace function public.hangout_poll_results(_prompt uuid) returns table (choice smallint, votes bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  select c.choice, count(v.user_id), coalesce(bool_or(v.user_id = auth.uid()), false)
  from (values (0::smallint), (1::smallint)) c(choice)
  left join hangout_votes v on v.prompt_id = _prompt and v.choice = c.choice
  where exists (select 1 from hangout_prompts p where p.id = _prompt and public.is_group_member(p.group_id, auth.uid()))
  group by c.choice order by c.choice;
$$;
grant execute on function public.hangout_answers_for(uuid), public.hangout_poll_results(uuid) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.hangout_prompts; exception when duplicate_object then null; end;
end $$;
