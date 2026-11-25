-- Blocks in either direction, for the caller only (no way to probe other people's blocks).
create or replace function public.blocked_either_way(_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = _other)
       or (blocker_id = _other and blocked_id = auth.uid())
  );
$$;

create or replace function public.my_blocked_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select blocked_id as x from public.user_blocks where blocker_id = auth.uid()
    union
    select blocker_id from public.user_blocks where blocked_id = auth.uid()
  ) s;
$$;

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages" on public.messages
  for insert to authenticated
  with check (auth.uid() = sender_id and not public.blocked_either_way(receiver_id));
