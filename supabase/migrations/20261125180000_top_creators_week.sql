-- Weekly leaderboard: score = likes*3 + views over posts and reels created in the last 7 days (public, non-adult).
create or replace function public.top_creators_week(_limit int default 20)
returns table (user_id uuid, username text, display_name text, avatar_url text, score bigint, likes bigint, views bigint, items bigint)
language sql stable security definer set search_path = public as $$
  with c as (
    select p.user_id, p.likes_count l, p.views_count v from public.posts p
      where p.created_at > now() - interval '7 days' and coalesce(p.is_adult, false) = false and p.visibility = 'public'
    union all
    select r.user_id, r.likes_count, r.views_count from public.reels r
      where r.created_at > now() - interval '7 days' and r.visibility = 'public'
  ), s as (
    select user_id, sum(l)::bigint likes, sum(v)::bigint views, count(*)::bigint items,
           (sum(l) * 3 + sum(v))::bigint score
    from c group by user_id
  )
  select s.user_id, pr.username, pr.display_name, pr.avatar_url, s.score, s.likes, s.views, s.items
  from s join public.profiles pr on pr.user_id = s.user_id
  where s.score > 0
  order by s.score desc, s.items desc
  limit least(greatest(_limit, 1), 50);
$$;
grant execute on function public.top_creators_week(int) to authenticated;
