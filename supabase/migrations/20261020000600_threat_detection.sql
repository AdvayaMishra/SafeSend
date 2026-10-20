create table if not exists secureshare_private.source_defenses (
  source_hash text primary key, expires_at timestamptz not null
);
create index if not exists access_events_source_created_idx on public.access_events(ip_address,created_at desc);
insert into public.threat_rules(name,description,rule_type,threshold,window_seconds,risk_score,severity,is_active)
select v.* from (values
  ('Repeated password failures','Three rejected passwords in fifteen minutes','failed_password',3,900,35,'MEDIUM',true),
  ('Excessive access frequency','Sixty requests within one minute','access_frequency',60,60,55,'HIGH',true),
  ('Multiple targeted secrets','Ten distinct secrets targeted within five minutes','multi_secret',10,300,65,'HIGH',true),
  ('Repeated policy denials','Ten policy denials within five minutes','policy_violation',10,300,45,'MEDIUM',true),
  ('Expired secret probing','Ten expired accesses within five minutes','expired_access',10,300,35,'MEDIUM',true),
  ('Abnormal attachment requests','Twenty rejected attachment requests within five minutes','attachment_abuse',20,300,55,'HIGH',true)
) as v(name,description,rule_type,threshold,window_seconds,risk_score,severity,is_active)
where not exists(select 1 from public.threat_rules r where r.rule_type=v.rule_type);

create or replace function public.observe_security_event(p_secret uuid,p_source text,p_event text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n integer; wid uuid; uid uuid; kind text; begin
  perform pg_advisory_xact_lock(hashtext('source:'||p_source));
  if exists(select 1 from secureshare_private.source_defenses where source_hash=p_source and expires_at>now()) then return false; end if;
  select workspace_id,created_by_user_id into wid,uid from public.secrets where id=p_secret;
  if not found then return true; end if;
  insert into public.access_events(secret_id,event_type,ip_address) values(p_secret,'SECURITY_'||p_event,p_source);
  for r in select * from public.threat_rules where is_active loop
    kind:=case r.rule_type when 'failed_password' then 'SECURITY_FAILED_PASSWORD'
      when 'policy_violation' then 'SECURITY_POLICY_DENIED' when 'expired_access' then 'SECURITY_EXPIRED_ACCESS'
      when 'attachment_abuse' then 'SECURITY_ATTACHMENT_REJECTED' else 'SECURITY_ACCESS_ATTEMPT' end;
    if r.threshold<1 or r.window_seconds<1 or r.window_seconds>86400 then continue; end if;
    if 'SECURITY_'||p_event<>kind then continue; end if;
    if r.rule_type='multi_secret' then
      select count(distinct secret_id) into n from public.access_events where ip_address=p_source
        and event_type=kind and created_at>=now()-make_interval(secs=>r.window_seconds);
    else
      select count(*) into n from public.access_events where ip_address=p_source
        and event_type=kind and created_at>=now()-make_interval(secs=>r.window_seconds);
    end if;
    if n>=r.threshold and not exists(select 1 from public.threat_incidents where source_ip=p_source
      and incident_type=r.rule_type and created_at>now()-make_interval(secs=>r.window_seconds)) then
      insert into public.threat_incidents(incident_type,severity,risk_score,source_ip,target_secret_id,
        target_workspace_id,description,details,status,defensive_action)
      values(r.rule_type,r.severity,r.risk_score,p_source,p_secret,wid,r.description,
        jsonb_build_object('observations',n,'threshold',r.threshold,'windowSeconds',r.window_seconds),
        'open',case when r.risk_score>=50 then 'Temporary source cooldown (10 minutes)' else 'Alert recorded' end);
      if r.risk_score>=50 then
        insert into secureshare_private.source_defenses(source_hash,expires_at) values(p_source,now()+interval '10 minutes')
          on conflict(source_hash) do update set expires_at=excluded.expires_at;
      end if;
      if uid is not null then
        insert into public.notifications(user_id,workspace_id,type,title,body,metadata)
          values(uid,wid,'THREAT','Suspicious access detected',r.description,jsonb_build_object('secretId',p_secret));
      end if;
    end if;
  end loop;
  return true;
end $$;
revoke all on function public.observe_security_event(uuid,text,text) from public,anon,authenticated;
grant execute on function public.observe_security_event(uuid,text,text) to service_role;
