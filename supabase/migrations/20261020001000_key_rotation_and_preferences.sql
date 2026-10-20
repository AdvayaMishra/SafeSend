create or replace function public.rotate_api_key(p_id uuid,p_user uuid,p_hash text,p_prefix text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare k public.api_keys%rowtype; result uuid; begin
  select * into k from public.api_keys where id=p_id and user_id=p_user for update;
  if not found or k.is_revoked then raise exception 'Key unavailable' using errcode='42501'; end if;
  insert into public.api_keys(user_id,workspace_id,name,key_prefix,key_hash,scopes,rate_limit_per_minute,expires_at)
    values(k.user_id,k.workspace_id,k.name,p_prefix,p_hash,k.scopes,k.rate_limit_per_minute,k.expires_at) returning id into result;
  update public.api_keys set is_revoked=true where id=p_id;return result;
end $$;
revoke all on function public.rotate_api_key(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.rotate_api_key(uuid,uuid,text,text) to service_role;
do $$ declare definition text; begin
  select pg_get_functiondef('public.observe_security_event(uuid,text,text)'::regprocedure) into definition;
  if position('if uid is not null then' in definition)=0 then raise exception 'Unexpected threat function'; end if;
  definition:=replace(definition,'if uid is not null then',
    'if uid is not null and coalesce((select threat_alerts from public.notification_preferences where user_id=uid),true) then');
  execute definition;
end $$;
