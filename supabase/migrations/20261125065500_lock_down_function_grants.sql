-- NOT YET APPLIED to the live database (the apply was blocked and is waiting for the owner's go-ahead).
-- Signed-out visitors should not be able to call wallet, gifting or ban-check functions through the public API.
revoke execute on function public.am_i_banned(), public.aura_leaderboard(integer), public.aura_rank(uuid), public.is_adult_verified(uuid),
  public.live_send_gift(uuid, numeric, text), public.music_play(uuid), public.wallet_has_pin(), public.wallet_set_pin(text, text), public.wallet_verify_pin(text) from anon, public;
-- Trigger functions are only ever run by triggers, never through /rest/v1/rpc.
revoke execute on function public.notify_new_call(), public.notify_new_group_message(), public.notify_new_message(), public.guard_staff_bans(), public.pay_referral_bonus() from anon, authenticated, public;
alter function public.transactions_immutable() set search_path = public;
