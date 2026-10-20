import 'dotenv/config';
import {createClient} from '@supabase/supabase-js';
// Explicit retention task: only expired secrets and elapsed delivery-grace
// records qualify. Dry run is the default. No application rows are deleted.
const apply=process.argv.includes('--apply');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const now=new Date().toISOString(),grace=new Date(Date.now()-10*60000).toISOString();
try {
  const {data,error}=await db.from('secrets').select('id').or(`expires_at.lte.${now},destroyed_at.lte.${grace}`).limit(100);
  if(error)throw error;
  let removed=0,eligible=0;
  for(const secret of data??[]) {
    const {data:legacy,error:legacyError}=await db.from('secret_attachments').select('storage_path').eq('secret_id',secret.id);
    const {data:sessions,error:sessionsError}=await db.from('upload_sessions').select('id').eq('secret_id',secret.id);
    if(legacyError||sessionsError)throw new Error('Metadata query failed');
    const {data:chunks,error:chunkError}=sessions?.length?await db.from('upload_chunks').select('storage_path').in('session_id',sessions.map(s=>s.id)):{data:[],error:null};
    if(chunkError)throw chunkError;
    const paths=[...new Set([...(legacy??[]),...(chunks??[])].map(r=>r.storage_path).filter(Boolean))];
    eligible+=paths.length;
    if(apply&&paths.length){const r=await db.storage.from('secure-attachments').remove(paths);if(r.error)throw r.error;removed+=r.data?.length??0;}
  }
  const stale=await db.from('upload_sessions').select('storage_path,total_chunks').or(`status.eq.aborted,and(status.eq.in_progress,expires_at.lte.${now})`).limit(100);
  if(stale.error)throw stale.error;
  for(const session of stale.data??[]) {
    const paths=Array.from({length:Math.min(26,session.total_chunks)},(_,i)=>`${session.storage_path}/${i}`);
    eligible+=paths.length;
    if(apply&&paths.length){const r=await db.storage.from('secure-attachments').remove(paths);if(r.error)throw r.error;removed+=r.data?.length??0;}
  }
  console.log(JSON.stringify({mode:apply?'apply':'dry-run',eligibleObjects:eligible,removedObjects:removed,
    note:'Candidate paths include expired/aborted upload chunks; metadata is retained for audit.'}));
}catch {console.error('Storage retention task failed; no error details or object paths logged.');process.exitCode=1;}
