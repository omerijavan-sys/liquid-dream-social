alter table public.reels add column if not exists video_volume real not null default 1 check (video_volume between 0 and 1);
alter table public.reels add column if not exists music_volume real not null default 1 check (music_volume between 0 and 1);
alter table public.posts add column if not exists music_volume real not null default 1 check (music_volume between 0 and 1);
