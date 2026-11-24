-- Pay-to-view (PPV): locked photos/videos in Primempire posts and in direct messages.
-- The buyer pays from their wallet; the creator receives 85% and Primegram keeps 15%.
-- The media lives in a PRIVATE bucket and can only be read (via signed URL) by its owner or a buyer who unlocked it.

alter table public.transactions drop constraint if exists transactions_payment_type_check;
alter table public.transactions add constraint transactions_payment_type_check check (payment_type = any (array['tip','subscription','topup','ppv']));
alter table public.messages drop constraint if exists messages_media_type_check;
alter table public.messages add constraint messages_media_type_check check (media_type = any (array['image','video','audio','post','reel','ppv']));

insert into storage.buckets (id, name, public) values ('locked-media', 'locked-media', false) on conflict (id) do nothing;

create table if not exists public.ppv_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('post','message')),
  receiver_id uuid references auth.users(id) on delete cascade,
  price_kes numeric(12,2) not null check (price_kes between 20 and 20000),
  media_path text not null,
  media_type text not null check (media_type in ('image','video')),
  teaser text,
  created_at timestamptz not null default now(),
  check (kind <> 'message' or receiver_id is not null)
);
create table if not exists public.ppv_unlocks (
  item_id uuid not null references public.ppv_items(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  price_kes numeric(12,2) not null,
  fee_kes numeric(12,2) not null,
  created_at timestamptz not null default now(),
  primary key (item_id, buyer_id)
);
create index if not exists ppv_unlocks_buyer on public.ppv_unlocks (buyer_id);
alter table public.posts add column if not exists ppv_item_id uuid references public.ppv_items(id) on delete set null;
alter table public.messages add column if not exists ppv_item_id uuid references public.ppv_items(id) on delete set null;

alter table public.ppv_items enable row level security;
alter table public.ppv_unlocks enable row level security;
-- media_path is never exposed through the table API
revoke all on public.ppv_items from anon, authenticated;
grant select (id, owner_id, kind, receiver_id, price_kes, media_type, teaser, created_at) on public.ppv_items to authenticated;
revoke all on public.ppv_unlocks from anon, authenticated;
grant select on public.ppv_unlocks to authenticated;
create policy "ppv items visible" on public.ppv_items for select to authenticated
  using (kind = 'post' or owner_id = auth.uid() or receiver_id = auth.uid());
create policy "ppv unlocks: buyer or seller" on public.ppv_unlocks for select to authenticated
  using (buyer_id = auth.uid() or exists (select 1 from public.ppv_items i where i.id = item_id and i.owner_id = auth.uid()));

create or replace function public.ppv_can_view(_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ppv_items i where i.media_path = _name and (
    i.owner_id = auth.uid() or exists (select 1 from public.ppv_unlocks u where u.item_id = i.id and u.buyer_id = auth.uid())))
$$;
revoke all on function public.ppv_can_view(text) from public, anon;
grant execute on function public.ppv_can_view(text) to authenticated;

create policy "locked-media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'locked-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "locked-media read owner or buyer" on storage.objects for select to authenticated
  using (bucket_id = 'locked-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.ppv_can_view(name)));
create policy "locked-media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'locked-media' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.ppv_check_new(_price numeric, _path text, _type text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if _price is null or _price < 20 or _price > 20000 then raise exception 'Price must be between KES 20 and KES 20,000'; end if;
  if _type not in ('image','video') then raise exception 'Only photos and videos can be locked'; end if;
  if _path is null or split_part(_path, '/', 1) <> auth.uid()::text then raise exception 'Invalid file'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'locked-media' and name = _path) then raise exception 'Upload the file first'; end if;
end $$;

create or replace function public.ppv_create_post(_caption text, _price numeric, _path text, _type text, _teaser text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid(); _item uuid;
begin
  perform public.ppv_check_new(_price, _path, _type);
  if not exists (select 1 from public.profiles where user_id = _me and adult_verified_at is not null) then
    raise exception 'Verify your age in Primempire before posting paid content';
  end if;
  insert into public.ppv_items (owner_id, kind, price_kes, media_path, media_type, teaser) values (_me, 'post', round(_price, 2), _path, _type, left(nullif(trim(_teaser), ''), 80)) returning id into _item;
  insert into public.posts (user_id, caption, media_url, media_type, is_adult, ppv_item_id) values (_me, nullif(left(_caption, 2000), ''), null, _type, true, _item);
  return _item;
end $$;

create or replace function public.ppv_send_message(_receiver uuid, _price numeric, _path text, _type text, _teaser text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid(); _item uuid; _msg uuid;
begin
  perform public.ppv_check_new(_price, _path, _type);
  if _receiver is null or _receiver = _me then raise exception 'Choose someone to send this to'; end if;
  insert into public.ppv_items (owner_id, kind, receiver_id, price_kes, media_path, media_type, teaser) values (_me, 'message', _receiver, round(_price, 2), _path, _type, left(nullif(trim(_teaser), ''), 80)) returning id into _item;
  insert into public.messages (sender_id, receiver_id, content, media_type, ppv_item_id)
    values (_me, _receiver, '🔒 Paid ' || case when _type = 'video' then 'video' else 'photo' end || ' · KES ' || round(_price, 0)::text, 'ppv', _item) returning id into _msg;
  return _msg;
end $$;

-- Buyer pays: 85% to the creator, 15% to Primegram. Idempotent: unlocking twice never charges twice.
create or replace function public.ppv_unlock(_item uuid) returns text
language plpgsql security definer set search_path = public as $$
declare _buyer uuid := auth.uid(); i public.ppv_items; _fee numeric(12,2); _net numeric(12,2); _bname text; _oname text;
begin
  if _buyer is null then raise exception 'Authentication required'; end if;
  select * into i from public.ppv_items where id = _item;
  if i.id is null then raise exception 'This content is no longer available'; end if;
  if i.owner_id = _buyer then return i.media_path; end if;
  if i.kind = 'message' and i.receiver_id <> _buyer then raise exception 'This content was not sent to you'; end if;
  if exists (select 1 from public.ppv_unlocks where item_id = _item and buyer_id = _buyer) then return i.media_path; end if;
  perform public.wallet_require_pin();
  perform pg_advisory_xact_lock(hashtextextended(_buyer::text, 0));
  if exists (select 1 from public.ppv_unlocks where item_id = _item and buyer_id = _buyer) then return i.media_path; end if;
  if public.wallet_balance(_buyer) < i.price_kes then raise exception 'Insufficient balance'; end if;
  _fee := round(i.price_kes * 0.15, 2); _net := i.price_kes - _fee;
  select username into _bname from public.profiles where user_id = _buyer;
  select username into _oname from public.profiles where user_id = i.owner_id;
  insert into public.wallet_transactions (user_id, type, amount, counterparty, note) values (_buyer, 'send', i.price_kes, coalesce(_oname, 'Creator'), 'Unlocked paid content');
  insert into public.wallet_transactions (user_id, type, amount, counterparty, note) values (i.owner_id, 'receive', _net, coalesce(_bname, 'Fan'), 'Paid content (15% fee)');
  insert into public.transactions (reference, payment_type, buyer_id, creator_id, gross_kes, platform_fee_kes, creator_net_kes, paystack_fee_kes, channel, status)
    values ('ppv_' || gen_random_uuid()::text, 'ppv', _buyer, i.owner_id, i.price_kes, _fee, _net, 0, 'wallet', 'success');
  insert into public.ppv_unlocks (item_id, buyer_id, price_kes, fee_kes) values (_item, _buyer, i.price_kes, _fee);
  return i.media_path;
end $$;

revoke all on function public.ppv_check_new(numeric, text, text), public.ppv_create_post(text, numeric, text, text, text), public.ppv_send_message(uuid, numeric, text, text, text), public.ppv_unlock(uuid) from public, anon;
grant execute on function public.ppv_create_post(text, numeric, text, text, text), public.ppv_send_message(uuid, numeric, text, text, text), public.ppv_unlock(uuid) to authenticated;
