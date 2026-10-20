-- Reconcile the previously applied function without changing its signature or
-- policy checks. Fail if the expected implementation is absent.
do $$ declare definition text; begin
  select pg_get_functiondef('public.consume_secret(uuid,text,text,text)'::regprocedure) into definition;
  if position('set view_count=view_count+1, failed_attempts=0' in definition)=0 then
    raise exception 'Unexpected consume_secret definition'; end if;
  definition:=replace(definition,'set view_count=view_count+1, failed_attempts=0',
    'set encrypted_content=case when stop then '''' else encrypted_content end, view_count=view_count+1, failed_attempts=0');
  execute definition;
end $$;
create or replace function public.expire_secrets(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n integer:=0; begin
  for r in select id from public.secrets where status='active' and expires_at<=now()
    and (p_ids is null or id=any(p_ids)) order by expires_at limit 100 for update skip locked loop
    update public.secrets set status='expired',destroyed_at=now(),encrypted_content='' where id=r.id;
    insert into public.access_events(secret_id,event_type) values(r.id,'MESSAGE_EXPIRED');n:=n+1;
  end loop;
  return n;
end $$;
