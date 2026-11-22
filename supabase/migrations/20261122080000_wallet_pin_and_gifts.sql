-- Wallet PIN: stored as a bcrypt hash, only reachable through the functions below.
create table if not exists public.wallet_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed int not null default 0,
  locked_until timestamptz,
  verified_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.wallet_pins enable row level security; -- no policies: clients never read or write it directly

create or replace function public.wallet_has_pin() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.wallet_pins where user_id = auth.uid());
$$;

create or replace function public.wallet_set_pin(_pin text, _old text default null) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _row public.wallet_pins;
begin
  if _uid is null then raise exception 'Authentication required'; end if;
  if _pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4 to 6 digits'; end if;
  select * into _row from public.wallet_pins where user_id = _uid;
  if found then
    if _row.locked_until is not null and _row.locked_until > now() then raise exception 'Too many wrong PINs. Try again later.'; end if;
    if _old is null or _row.pin_hash <> crypt(_old, _row.pin_hash) then
      update public.wallet_pins set failed = failed + 1, locked_until = case when failed + 1 >= 5 then now() + interval '15 minutes' else locked_until end where user_id = _uid;
      raise exception 'Current PIN is wrong';
    end if;
    update public.wallet_pins set pin_hash = crypt(_pin, gen_salt('bf')), failed = 0, locked_until = null, verified_until = null, updated_at = now() where user_id = _uid;
  else
    insert into public.wallet_pins (user_id, pin_hash) values (_uid, crypt(_pin, gen_salt('bf')));
  end if;
  return true;
end $$;

-- Checks the PIN and opens a 2-minute, single-use window for one money-moving action.
create or replace function public.wallet_verify_pin(_pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _row public.wallet_pins;
begin
  if _uid is null then raise exception 'Authentication required'; end if;
  select * into _row from public.wallet_pins where user_id = _uid;
  if not found then return true; end if;
  if _row.locked_until is not null and _row.locked_until > now() then raise exception 'Too many wrong PINs. Try again in a few minutes.'; end if;
  if _row.pin_hash = crypt(coalesce(_pin, ''), _row.pin_hash) then
    update public.wallet_pins set failed = 0, locked_until = null, verified_until = now() + interval '2 minutes' where user_id = _uid;
    return true;
  end if;
  update public.wallet_pins set failed = failed + 1, locked_until = case when failed + 1 >= 5 then now() + interval '15 minutes' else null end where user_id = _uid;
  return false;
end $$;

create or replace function public.wallet_require_pin() returns void
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _v timestamptz;
begin
  if not exists (select 1 from public.wallet_pins where user_id = _uid) then return; end if;
  select verified_until into _v from public.wallet_pins where user_id = _uid;
  if _v is null or _v < now() then raise exception 'PIN required'; end if;
  update public.wallet_pins set verified_until = null where user_id = _uid; -- single use
end $$;

revoke all on function public.wallet_require_pin() from public, anon, authenticated;
grant execute on function public.wallet_has_pin(), public.wallet_set_pin(text, text), public.wallet_verify_pin(text) to authenticated;

-- every money-moving function now needs the PIN window when the user has set a PIN
create or replace function public.prime_tip(_recipient uuid, _amount numeric) returns numeric
language plpgsql security definer set search_path to 'public' as $function$
declare
  _sender uuid := auth.uid();
  _amount_to_send numeric(12,2) := round(_amount, 2);
  _creator_name text; _sender_name text;
begin
  if _sender is null then raise exception 'Authentication required'; end if;
  if _amount_to_send is null or _amount_to_send not in (5, 20, 50, 100, 500, 1000) then raise exception 'Pick a valid tip amount'; end if;
  if _sender = _recipient then raise exception 'You cannot tip your own content'; end if;
  select username into _creator_name from public.profiles where user_id = _recipient;
  if not found then raise exception 'Creator not found'; end if;
  perform public.wallet_require_pin();
  perform pg_advisory_xact_lock(hashtextextended(_sender::text, 0));
  if public.wallet_balance(_sender) < _amount_to_send then raise exception 'Insufficient balance'; end if;
  select username into _sender_name from public.profiles where user_id = _sender;
  insert into public.wallet_transactions (user_id, type, amount, counterparty, note) values (_sender, 'send', _amount_to_send, coalesce(_creator_name, 'Primegram creator'), 'Creator tip');
  insert into public.wallet_transactions (user_id, type, amount, counterparty, note) values (_recipient, 'receive', round(_amount_to_send * 0.95, 2), coalesce(_sender_name, 'Primegram member'), 'Creator tip (5% fee)');
  return round(_amount_to_send * 0.95, 2);
end $function$;

create or replace function public.wallet_send(_recipient text, _amount numeric) returns table(transfer_amount numeric, new_balance numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare _sender uuid := auth.uid(); _recipient_id uuid; _amt numeric(12,2); _bal numeric;
begin
  if _sender is null then raise exception 'Authentication required'; end if;
  _amt := round(_amount, 2);
  if _amt is null or _amt <= 0 or _amt > 100000 then raise exception 'Invalid amount'; end if;
  select p.user_id into _recipient_id from public.profiles p where lower(p.username) = lower(btrim(_recipient)) limit 1;
  if _recipient_id is null then raise exception 'Recipient not found'; end if;
  if _recipient_id = _sender then raise exception 'Cannot send to yourself'; end if;
  perform public.wallet_require_pin();
  perform pg_advisory_xact_lock(hashtextextended(_sender::text, 0));
  _bal := public.wallet_balance(_sender);
  if _bal < _amt then raise exception 'Insufficient balance'; end if;
  insert into public.wallet_transactions (user_id, type, amount, counterparty) values (_sender, 'send', _amt, (select username from public.profiles where user_id = _recipient_id));
  insert into public.wallet_transactions (user_id, type, amount, counterparty) values (_recipient_id, 'receive', _amt, (select username from public.profiles where user_id = _sender));
  return query select _amt, public.wallet_balance(_sender);
end $function$;

-- Withdrawals: same body as before plus the PIN check
create or replace function public.wallet_request_withdrawal(_amount numeric, _phone text) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare
  _uid uuid := auth.uid(); _amt numeric(12,2) := round(_amount, 2);
  _digits text; _msisdn text; _id uuid; _flags text[] := '{}'; _24h numeric; _earned numeric; _created timestamptz;
begin
  if _uid is null then raise exception 'Authentication required'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'Sign in to withdraw'; end if;
  if _amt is null or _amt < 50 then raise exception 'Minimum withdrawal is KES 50'; end if;
  if _amt > 50000 then raise exception 'Maximum per withdrawal is KES 50,000'; end if;
  _digits := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  if _digits ~ '^0[17][0-9]{8}$' then _msisdn := '254' || substr(_digits, 2);
  elsif _digits ~ '^254[17][0-9]{8}$' then _msisdn := _digits;
  elsif _digits ~ '^[17][0-9]{8}$' then _msisdn := '254' || _digits;
  else raise exception 'Enter a valid Safaricom number, e.g. 0712 345 678'; end if;
  perform public.wallet_require_pin();
  perform pg_advisory_xact_lock(hashtextextended(_uid::text, 0));
  if (select count(*) from public.withdrawal_requests where user_id = _uid and status = 'pending') >= 3 then raise exception 'You already have 3 pending withdrawals. Wait for them to be processed.'; end if;
  select coalesce(sum(amount),0) into _24h from public.withdrawal_requests where user_id = _uid and status in ('pending','paid') and created_at > now() - interval '24 hours';
  if _24h + _amt > 50000 then raise exception 'Daily withdrawal limit is KES 50,000 (you have % available today)', greatest(0, 50000 - _24h); end if;
  if public.wallet_balance(_uid) < _amt then raise exception 'Insufficient balance'; end if;
  select created_at into _created from auth.users where id = _uid;
  if _created > now() - interval '7 days' then _flags := _flags || 'new_account'; end if;
  if _amt >= 20000 then _flags := _flags || 'large_amount'; end if;
  if not exists (select 1 from public.withdrawal_requests where user_id = _uid and status = 'paid') then _flags := _flags || 'first_withdrawal'; end if;
  select coalesce(sum(amount),0) into _earned from public.wallet_transactions where user_id = _uid and type = 'receive' and note not like 'Withdrawal%';
  if _earned < _amt then _flags := _flags || 'cashing_out_topup'; end if;
  if exists (select 1 from public.withdrawal_requests where phone = _msisdn and user_id <> _uid) then _flags := _flags || 'phone_used_by_other_account'; end if;
  insert into public.withdrawal_requests (user_id, amount, phone, risk_flags) values (_uid, _amt, _msisdn, _flags) returning id into _id;
  insert into public.wallet_transactions (user_id, type, amount, counterparty, note) values (_uid, 'send', _amt, 'M-Pesa ' || _msisdn, 'Withdrawal ' || _id::text);
  return _id;
end $function$;

-- Live gifts paid from the wallet (host receives 95%), announced in the live chat
create or replace function public.live_send_gift(_stream uuid, _amount numeric, _gift text) returns numeric
language plpgsql security definer set search_path to 'public' as $function$
declare _sender uuid := auth.uid(); _host uuid; _amt numeric(12,2) := round(_amount, 2); _sname text; _hname text; _status text;
begin
  if _sender is null then raise exception 'Authentication required'; end if;
  if _amt is null or _amt not in (10, 20, 50, 100, 200, 500, 1000, 5000) then raise exception 'Pick a valid gift'; end if;
  select host_id, status into _host, _status from public.live_streams where id = _stream;
  if _host is null then raise exception 'Live not found'; end if;
  if _status <> 'live' then raise exception 'This live has ended'; end if;
  if _host = _sender then raise exception 'You cannot gift yourself'; end if;
  perform public.wallet_require_pin();
  perform pg_advisory_xact_lock(hashtextextended(_sender::text, 0));
  if public.wallet_balance(_sender) < _amt then raise exception 'Insufficient balance'; end if;
  select username into _sname from public.profiles where user_id = _sender;
  select username into _hname from public.profiles where user_id = _host;
  insert into public.wallet_transactions (user_id, type, amount, counterparty, note) values (_sender, 'send', _amt, coalesce(_hname, 'Host'), 'Live gift');
  insert into public.wallet_transactions (user_id, type, amount, counterparty, note) values (_host, 'receive', round(_amt * 0.95, 2), coalesce(_sname, 'Viewer'), 'Live gift (5% fee)');
  insert into public.live_comments (stream_id, user_id, content) values (_stream, _sender, '🎁 ' || coalesce(nullif(left(_gift, 24), ''), 'Gift') || ' · KES ' || _amt::text);
  return round(_amt * 0.95, 2);
end $function$;
grant execute on function public.live_send_gift(uuid, numeric, text) to authenticated;
notify pgrst, 'reload schema';
