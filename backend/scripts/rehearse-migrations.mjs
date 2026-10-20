import {databaseClient} from './database-client.mjs';
import {readFileSync,readdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const client=databaseClient();
const suffix=randomBytes(6).toString('hex'),app=`ss_rehearsal_${suffix}`,storage=`ss_storage_${suffix}`,privateSchema=`ss_private_${suffix}`;
try {
  await client.connect();await client.query('begin');
  for(const name of [app,storage,privateSchema])await client.query(`create schema ${name}`);
  await client.query(`create table ${storage}.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])`);
  await client.query(`create table ${storage}.objects(id uuid primary key default gen_random_uuid(),bucket_id text)`);
  const files=readdirSync('../supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
  for(const file of files) {
    const sql=readFileSync('../supabase/migrations/'+file,'utf8')
      .replace(/^(begin|commit);\s*$/gim,'')
      .replaceAll('public.',app+'.').replaceAll('storage.',storage+'.')
      .replaceAll('secureshare_private.',privateSchema+'.').replaceAll('search_path=public,',`search_path=${app},`);
    await client.query(sql);
  }
  const tables=await client.query('select count(*)::int as count from pg_tables where schemaname=$1',[app]);
  const rls=await client.query('select count(*)::int as count from pg_tables where schemaname=$1 and not rowsecurity',[app]);
  if(tables.rows[0].count!==21||rls.rows[0].count!==0)throw new Error('Fresh bootstrap verification failed');
  await client.query('rollback');
  console.log(JSON.stringify({result:'passed',migrations:files.length,applicationTables:21,rlsDisabled:0,rolledBack:true,
    scope:'fresh-schema transactional rehearsal; storage API and auth deployment settings tested separately'}));
} catch(error) {
  await client.query('rollback').catch(()=>{});
  console.error(JSON.stringify({check:'migration rehearsal',code:error.code??'FAILED',migrationError:error.message?.slice(0,180)}));
  process.exitCode=1;
} finally{await client.end();}
