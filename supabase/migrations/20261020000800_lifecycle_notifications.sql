create or replace function public.audit_access_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare wid uuid; uid uuid; preferences public.notification_preferences%rowtype; enabled boolean; kind text; begin
  select workspace_id,created_by_user_id into wid,uid from public.secrets where id=new.secret_id;
  perform public.append_audit_event('secret:'||new.secret_id,'system',new.event_type,'secret',new.secret_id::text,wid,'{}'::jsonb);
  if uid is null then return new; end if;
  select * into preferences from public.notification_preferences where user_id=uid;
  if new.event_type='ACCESS_SUCCESS' then
    enabled:=coalesce(preferences.access_notifications,true);kind:='ACCESS';
  elsif new.event_type='MESSAGE_EXPIRED' then
    enabled:=coalesce(preferences.expiration_notices,true);kind:='EXPIRY';
  elsif new.event_type in ('MESSAGE_REVOKED','MESSAGE_DESTROYED') then
    enabled:=true;kind:='SECURITY';
  else return new;
  end if;
  if enabled then insert into public.notifications(user_id,workspace_id,type,title,body,metadata)
    values(uid,wid,kind,replace(initcap(lower(new.event_type)),'_',' '),'A secret security event was recorded.',jsonb_build_object('secretId',new.secret_id));
  end if;
  return new;
end $$;
create or replace function public.expire_secrets(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n integer:=0; begin
  for r in select id from public.secrets where status='active' and expires_at<=now()
    and (p_ids is null or id=any(p_ids)) order by expires_at limit 100 for update skip locked loop
    update public.secrets set status='expired',destroyed_at=now() where id=r.id;
    insert into public.access_events(secret_id,event_type) values(r.id,'MESSAGE_EXPIRED');n:=n+1;
  end loop;
  return n;
end $$;
revoke all on function public.expire_secrets(uuid[]) from public,anon,authenticated;
grant execute on function public.expire_secrets(uuid[]) to service_role;
