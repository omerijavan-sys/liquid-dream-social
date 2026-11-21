alter table public.posts
  add column if not exists allow_comments boolean not null default true,
  add column if not exists allow_download boolean not null default true,
  add column if not exists hide_likes boolean not null default false,
  add column if not exists visibility text not null default 'public' check (visibility in ('public','followers','close_friends')),
  add column if not exists location text;
alter table public.reels add column if not exists location text;

drop policy if exists "Members can view posts" on public.posts;
create policy "Members can view posts" on public.posts for select using (
  auth.uid() is not null
  and (not is_adult or user_id = auth.uid() or exists (select 1 from profiles p where p.user_id = auth.uid() and p.adult_verified_at is not null))
  and (visibility = 'public' or user_id = auth.uid() or (visibility = 'followers' and exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = posts.user_id)))
);
notify pgrst, 'reload schema';
