alter function public.validate_profile_tz() set search_path = public;
alter function public.streak_tier(int) set search_path = public;
alter function public.next_streak(int, date, date) set search_path = public;
alter function public.gen_referral_code() set search_path = public;
alter function public.guard_referral_columns() set search_path = public;

revoke execute on function public.aesthetics_guard(), public.daily_drops_before_insert(), public.daily_drops_after_insert() from public, anon, authenticated;
revoke execute on function public.are_mutuals(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.user_today(uuid) from public, anon;
revoke execute on function public.get_friend_drops(int), public.claim_referral(text), public.hangout_answers_for(uuid), public.hangout_poll_results(uuid) from public, anon;
grant execute on function public.user_today(uuid), public.get_friend_drops(int), public.claim_referral(text), public.hangout_answers_for(uuid), public.hangout_poll_results(uuid) to authenticated;
