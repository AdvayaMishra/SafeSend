import 'dotenv/config';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const base=process.env.TEST_API_URL??'http://localhost:5000';
async function run(command,input) {
  return new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,['../cli/secureshare.mjs',command],{env:{...process.env,SECURESHARE_API_URL:base},stdio:['pipe','pipe','pipe'],windowsHide:true});
    const output=[];p.stdout.on('data',b=>output.push(b));p.on('error',reject);
    p.on('close',code=>code===0?resolve(Buffer.concat(output).toString('utf8')):reject(new Error('CLI operation failed')));
    p.stdin.end(input);
  });
}
let id;
try {
  const link=(await run('create','CLI encrypted fixture')).trim();id=new URL(link).pathname.split('/').at(-1);
  const stored=await db.from('secrets').select('encrypted_content').eq('id',id).single();assert.equal(stored.error,null);
  assert.ok(!stored.data.encrypted_content.includes('CLI encrypted fixture'));
  assert.equal(await run('open',link),'CLI encrypted fixture');
  console.log('CLI stdin creation/open round trip passed; plaintext and decryption key were not printed by this test.');
} finally {if(id)await db.from('secrets').delete().eq('id',id);}
