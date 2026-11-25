-- Caller's own place in the weekly leaderboard (same scoring as top_creators_week). Applied via MCP.
create or replace function public.my_week_rank()
returns table (rank bigint, total bigint, score bigint, likes bigint, views bigint, items bigint)
language sql stable security definer set search_path = public as $$
  with c as (
    select p.user_id, p.likes_count l, p.views_count v from public.posts p
      where p.created_at > now() - interval '7 days' and coalesce(p.is_adult, false) = false and p.visibility = 'public'
    union all
    select r.user_id, r.likes_count, r.views_count from public.reels r
      where r.created_at > now() - interval '7 days' and r.visibility = 'public'
  ), s as (
    select user_id, sum(l)::bigint likes, sum(v)::bigint views, count(*)::bigint items, (sum(l) * 3 + sum(v))::bigint score
    from c group by user_id
  ), ranked as (
    select s.*, rank() over (order by score desc, items desc) rk, count(*) over () tot from s where s.score > 0
  )
  select rk::bigint, tot::bigint, score, likes, views, items from ranked where user_id = auth.uid();
$$;
grant execute on function public.my_week_rank() to authenticated;
