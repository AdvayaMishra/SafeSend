-- Reconciliation for the audited existing development schema. No rows are deleted.
do $$ declare t text; begin
  foreach t in array array['secrets','access_events','secret_events','secret_attachments',
    'secret_access_tokens','user_profiles','workspaces','workspace_members',
    'workspace_invitations','threat_rules','threat_incidents','tamper_audit_logs',
    'recipient_access_tokens','api_keys','user_passkeys','passkey_challenges',
    'notifications','notification_preferences','upload_sessions','upload_chunks'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end $$;
-- These audited policies currently match every object in this bucket, regardless
-- of sender or recipient. Browser traffic must go through authorized backend APIs.
alter policy "Allow backend delete from secure-attachments" on storage.objects to service_role;
alter policy "Allow backend read from secure-attachments" on storage.objects to service_role;
alter policy "Allow backend upload to secure-attachments" on storage.objects to service_role;
update storage.buckets set public=false, file_size_limit=26214400,
  allowed_mime_types=array['application/octet-stream','text/plain']
where id='secure-attachments';
create index if not exists access_events_secret_created_idx on public.access_events(secret_id,created_at desc);
create index if not exists attachments_secret_idx on public.secret_attachments(secret_id);
create index if not exists access_tokens_expiry_idx on public.secret_access_tokens(expires_at);
create index if not exists secrets_expiry_idx on public.secrets(expires_at) where status='active';
