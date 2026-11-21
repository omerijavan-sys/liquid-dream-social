-- Unique viewers per post/reel, reel view registration, aura scores + rank.
create table if not exists public.post_viewers (post_id uuid not null references public.posts(id) on delete cascade, viewer_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key (post_id, viewer_id));
create table if not exists public.reel_viewers (reel_id uuid not null references public.reels(id) on delete cascade, viewer_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key (reel_id, viewer_id));
alter table public.post_viewers enable row level security;
alter table public.reel_viewers enable row level security;

create or replace function public.register_post_view(_post_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare _views integer; _owner uuid; _new boolean := false; _n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select user_id into _owner from public.posts where id = _post_id
    and (not is_adult or user_id = auth.uid() or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.adult_verified_at is not null));
  if _owner is null then return 0; end if;
  if _owner <> auth.uid() then
    insert into public.post_viewers(post_id, viewer_id) values (_post_id, auth.uid()) on conflict do nothing;
    get diagnostics _n = row_count; _new := _n > 0;
  end if;
  if _new then update public.posts set views_count = views_count + 1 where id = _post_id; end if;
  select views_count into _views from public.posts where id = _post_id;
  return coalesce(_views, 0);
end $$;

create or replace function public.register_reel_view(_reel_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare _views integer; _owner uuid; _new boolean := false; _n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select user_id into _owner from public.reels where id = _reel_id;
  if _owner is null then return 0; end if;
  if _owner <> auth.uid() then
    insert into public.reel_viewers(reel_id, viewer_id) values (_reel_id, auth.uid()) on conflict do nothing;
    get diagnostics _n = row_count; _new := _n > 0;
  end if;
  if _new then update public.reels set views_count = views_count + 1 where id = _reel_id; end if;
  select views_count into _views from public.reels where id = _reel_id;
  return coalesce(_views, 0);
end $$;
revoke execute on function public.register_reel_view(uuid) from public, anon;
grant execute on function public.register_reel_view(uuid) to authenticated;

-- Aura = 5/like + 10/comment + 1/view on posts, 6/like + 10/comment + 1/view on reels (reels auto-made from a post are not counted twice).
create or replace function public.aura_scores() returns table(user_id uuid, aura bigint)
language sql stable security definer set search_path = '' as $$
  with parts as (
    select p.user_id u, sum(coalesce(p.likes_count,0) * 5 + coalesce(p.views_count,0))::bigint a from public.posts p group by 1
    union all select po.user_id, count(*) * 10 from public.post_comments c join public.posts po on po.id = c.post_id group by 1
    union all select r.user_id, sum(coalesce(r.likes_count,0) * 6 + coalesce(r.views_count,0))::bigint from public.reels r where r.source_post_id is null group by 1
    union all select r.user_id, count(*) * 10 from public.reel_comments c join public.reels r on r.id = c.reel_id where r.source_post_id is null group by 1
  ) select u, sum(a)::bigint from parts group by u $$;

create or replace function public.aura_rank(_user uuid) returns table(aura bigint, rank integer, total_users integer)
language sql stable security definer set search_path = '' as $$
  with s as (select * from public.aura_scores()), me as (select coalesce((select aura from s where user_id = _user), 0) a)
  select (select a from me), (1 + (select count(*) from s where s.aura > (select a from me)))::integer, (select count(*) from s)::integer $$;

create or replace function public.aura_leaderboard(_limit integer default 10)
returns table(user_id uuid, username text, display_name text, avatar_url text, aura bigint)
language sql stable security definer set search_path = '' as $$
  select s.user_id, p.username, p.display_name, p.avatar_url, s.aura from public.aura_scores() s join public.profiles p on p.user_id = s.user_id order by s.aura desc limit least(coalesce(_limit,10), 50) $$;
revoke execute on function public.aura_scores() from public, anon, authenticated;
grant execute on function public.aura_rank(uuid), public.aura_leaderboard(integer) to authenticated;
