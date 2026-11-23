-- Minor admins ("moderator" role): can manage users (ban / unban) and their posts, reels, comments and reports.
-- They can NOT grant badges (protect_profile_badges already strips badge changes for non-admins), see revenue,
-- withdrawals, health, audit logs or support tickets, and cannot act on admins or other minor admins.
-- Only a full admin can add or remove minor admins, through the RPCs below.

create or replace function public.is_minor_admin(_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid and role = 'moderator')
$$;

create or replace function public.is_staff_user(_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid and role in ('admin','moderator'))
$$;
revoke all on function public.is_minor_admin(uuid), public.is_staff_user(uuid) from public, anon;
grant execute on function public.is_minor_admin(uuid), public.is_staff_user(uuid) to authenticated;

-- Content moderation (never against staff-owned content)
create policy "Minor admins delete posts" on public.posts for delete to authenticated
  using (public.is_minor_admin(auth.uid()) and not public.is_staff_user(user_id));
create policy "Minor admins update posts" on public.posts for update to authenticated
  using (public.is_minor_admin(auth.uid()) and not public.is_staff_user(user_id));
create policy "Minor admins delete reels" on public.reels for delete to authenticated
  using (public.is_minor_admin(auth.uid()) and not public.is_staff_user(user_id));
create policy "Minor admins update reels" on public.reels for update to authenticated
  using (public.is_minor_admin(auth.uid()) and not public.is_staff_user(user_id));
create policy "Minor admins delete comments" on public.post_comments for delete to authenticated
  using (public.is_minor_admin(auth.uid()) and not public.is_staff_user(user_id));

-- Reports
create policy "Minor admins read reports" on public.reports for select to authenticated using (public.is_minor_admin(auth.uid()));
create policy "Minor admins update reports" on public.reports for update to authenticated using (public.is_minor_admin(auth.uid()));
create policy "Minor admins manage chat reports" on public.video_chat_reports for all to authenticated
  using (public.is_minor_admin(auth.uid())) with check (public.is_minor_admin(auth.uid()));

-- Bans (cannot ban or unban staff)
create policy "Minor admins read bans" on public.user_bans for select to authenticated using (public.is_minor_admin(auth.uid()));
create policy "Minor admins ban users" on public.user_bans for insert to authenticated
  with check (public.is_minor_admin(auth.uid()) and not public.is_staff_user(user_id));
create policy "Minor admins update bans" on public.user_bans for update to authenticated
  using (public.is_minor_admin(auth.uid()) and not public.is_staff_user(user_id))
  with check (public.is_minor_admin(auth.uid()) and not public.is_staff_user(user_id));
create policy "Minor admins lift bans" on public.user_bans for delete to authenticated
  using (public.is_minor_admin(auth.uid()) and not public.is_staff_user(user_id));

-- Managing the team: admins only
create or replace function public.admin_set_minor_admin(_user uuid, _on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  if _user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if public.has_role(_user, 'admin') then raise exception 'That account is already a full admin'; end if;
  if _on then
    insert into public.user_roles (user_id, role) values (_user, 'moderator') on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles where user_id = _user and role = 'moderator';
  end if;
  begin
    insert into public.security_audit_log (user_id, category, event, details)
      values (auth.uid(), 'admin', case when _on then 'minor_admin_added' else 'minor_admin_removed' end, jsonb_build_object('target', _user));
  exception when others then null; -- never block the role change because of the audit row
  end;
end $$;

create or replace function public.admin_list_minor_admins() returns table (user_id uuid, username text, display_name text, avatar_url text, since timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  return query select r.user_id, p.username, p.display_name, p.avatar_url, r.created_at
    from public.user_roles r left join public.profiles p on p.user_id = r.user_id
    where r.role = 'moderator' order by r.created_at desc;
end $$;
revoke all on function public.admin_set_minor_admin(uuid, boolean), public.admin_list_minor_admins() from public, anon;
grant execute on function public.admin_set_minor_admin(uuid, boolean), public.admin_list_minor_admins() to authenticated;
