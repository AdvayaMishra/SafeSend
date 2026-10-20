alter table public.upload_chunks add column if not exists storage_path text;
create or replace function public.finish_upload(p_session uuid,p_bundle text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.upload_sessions%rowtype; n bigint; bytes bigint; begin
  select * into s from public.upload_sessions where id=p_session for update;
  if not found then raise exception 'Upload not found' using errcode='42501'; end if;
  if s.status='completed' then return s.id; end if;
  if s.status<>'in_progress' or s.expires_at<=now() then raise exception 'Upload closed' using errcode='42501'; end if;
  select count(*),coalesce(sum(chunk_size),0) into n,bytes from public.upload_chunks where session_id=p_session;
  if n<>s.total_chunks or bytes<>s.total_file_size then raise exception 'Upload incomplete' using errcode='22023'; end if;
  insert into public.secret_attachments(id,secret_id,file_name,mime_type,file_size,storage_path,encrypted_key_bundle)
    values(s.id,s.secret_id,'encrypted.bin','application/octet-stream',s.total_file_size,s.storage_path,p_bundle);
  update public.upload_sessions set status='completed',encrypted_key_bundle=p_bundle,uploaded_chunks=n,updated_at=now() where id=p_session;
  insert into public.access_events(secret_id,event_type) values(s.secret_id,'ATTACHMENT_UPLOADED');
  return s.id;
end $$;
revoke all on function public.finish_upload(uuid,text) from public,anon,authenticated;
grant execute on function public.finish_upload(uuid,text) to service_role;
