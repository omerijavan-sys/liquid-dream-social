-- delete_my_account now removes the user's content (posts, reels, messages, comments, likes...) and keeps
-- payment / withdrawal / audit records for accounting and legal reasons. Applied via MCP.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path to 'public', 'auth' as $$
declare
  uid uuid := auth.uid();
  r record;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.withdrawal_requests where user_id = uid and status = 'pending') then
    raise exception 'Resolve your pending withdrawals before deleting your account';
  end if;
  if to_regclass('public.referral_withdrawals') is not null
     and exists (select 1 from public.referral_withdrawals where user_id = uid and status = 'pending') then
    raise exception 'Resolve your pending referral withdrawal before deleting your account';
  end if;
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name in ('user_id','sender_id','receiver_id','reporter_id','follower_id','following_id','blocker_id','blocked_id','owner_id','creator_id')
      and c.data_type = 'uuid'
      and c.table_name !~ '(transaction|topup|payment|withdraw|bonus|audit|ledger|payout_log)'
      and c.table_name <> 'profiles'
  loop
    execute format('delete from public.%I where %I = $1', r.table_name, r.column_name) using uid;
  end loop;
  delete from auth.users where id = uid;
end $$;
