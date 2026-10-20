import {supabase} from './config/supabase.js';
import {check} from './security.js';
// Optional application worker. Keep disabled during reconciliation so merely
// starting a development server never purges pre-existing records or objects.
export async function lifecycleBatch(ids?:string[]) {
  return check(await supabase.rpc('expire_secrets',{p_ids:ids??null}));
}
export function startLifecycleWorker() {
  if(process.env.ENABLE_LIFECYCLE_WORKER!=='true')return;
  let running=false;
  const timer=setInterval(async()=>{
    if(running)return;running=true;
    try {const count=await lifecycleBatch();if(count)console.log(JSON.stringify({event:'expiration_batch',count}));}
    catch {console.error(JSON.stringify({event:'operational_alert',kind:'expiration_worker_failed'}));}
    finally{running=false;}
  },60000);timer.unref();
}
