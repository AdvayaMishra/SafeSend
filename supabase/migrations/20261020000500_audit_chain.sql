alter table public.tamper_audit_logs add column if not exists chain_key text;
alter table public.tamper_audit_logs add column if not exists chain_index bigint;
create unique index if not exists audit_chain_index on public.tamper_audit_logs(chain_key,chain_index);
create or replace function public.append_audit_event(p_chain text,p_actor text,p_action text,
  p_type text,p_resource text,p_workspace uuid,p_metadata jsonb default '{}')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare previous text; n bigint; canonical text; ts timestamptz:=clock_timestamp(); eid uuid:=gen_random_uuid(); begin
  perform pg_advisory_xact_lock(hashtext('audit:'||p_chain));
  select current_hash,chain_index+1 into previous,n from public.tamper_audit_logs
    where chain_key=p_chain order by chain_index desc limit 1;
  previous:=coalesce(previous,repeat('0',64));n:=coalesce(n,1);
  canonical:=jsonb_build_object('version',1,'chain',p_chain,'index',n,'eventId',eid,
    'timestamp',to_char(ts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'actor',p_actor,'action',p_action,'resourceType',p_type,'resourceId',p_resource,
    'workspaceId',p_workspace,'metadata',p_metadata)::text;
  insert into public.tamper_audit_logs(chain_key,chain_index,event_id,timestamp,workspace_id,
    actor_id,action,resource_type,resource_id,metadata,canonical_payload,previous_hash,current_hash)
  values(p_chain,n,eid,ts,p_workspace,p_actor,p_action,p_type,p_resource,p_metadata,canonical,previous,
    encode(sha256(convert_to(previous||canonical,'UTF8')),'hex'));
end $$;
create or replace function public.audit_access_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare wid uuid; begin
  select workspace_id into wid from public.secrets where id=new.secret_id;
  perform public.append_audit_event('secret:'||new.secret_id,'system',new.event_type,
    'secret',new.secret_id::text,wid,'{}'::jsonb);
  return new;
end $$;
create trigger secure_share_audit_access after insert on public.access_events
  for each row execute function public.audit_access_event();
create or replace function public.reject_audit_mutation() returns trigger
language plpgsql set search_path=public,pg_temp as $$ begin
  raise exception 'Audit records are append-only' using errcode='42501';
end $$;
create trigger secure_share_audit_immutable before update or delete on public.tamper_audit_logs
  for each row execute function public.reject_audit_mutation();
revoke update,delete,truncate on public.tamper_audit_logs from service_role;
revoke all on function public.append_audit_event(text,text,text,text,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.audit_access_event() from public,anon,authenticated;
revoke all on function public.reject_audit_mutation() from public,anon,authenticated;
grant execute on function public.append_audit_event(text,text,text,text,text,uuid,jsonb) to service_role;
