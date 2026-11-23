-- Prompts are anonymous: members may read everything EXCEPT who wrote it. Live updates use Realtime Broadcast, not table change feeds.
revoke select on public.hangout_prompts from anon, authenticated;
grant select (id, group_id, kind, body, options, created_at, expires_at) on public.hangout_prompts to authenticated;
do $$ begin
  begin alter publication supabase_realtime drop table public.hangout_prompts; exception when others then null; end;
end $$;
