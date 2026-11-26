-- Suggestions now skip blocked people (either way) and rank accounts that posted in the last 30 days first. Applied via MCP.
create or replace function public.suggested_people(_limit integer default 12)
returns table(user_id uuid, username text, display_name text, avatar_url text, is_verified boolean, is_official boolean, followers bigint)
language sql stable security definer set search_path to 'public' as $$
  select p.user_id, p.username, p.display_name, p.avatar_url, coalesce(p.is_verified,false), coalesce(p.is_official,false),
         (select count(*) from public.follows f where f.following_id = p.user_id) as followers
  from public.profiles p
  where auth.uid() is not null
    and p.user_id <> auth.uid()
    and p.username is not null
    and not exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.user_id)
    and not exists (select 1 from public.user_bans b where b.user_id = p.user_id)
    and not public.blocked_either_way(p.user_id)
  order by
    ((select count(*) from public.posts x where x.user_id = p.user_id and x.created_at > now() - interval '30 days')
     + (select count(*) from public.reels r where r.user_id = p.user_id and r.created_at > now() - interval '30 days')) > 0 desc,
    coalesce(p.is_official,false) desc, coalesce(p.is_verified,false) desc,
    (select count(*) from public.follows f where f.following_id = p.user_id) desc, p.created_at desc
  limit least(greatest(coalesce(_limit, 12), 1), 30)
$$;
