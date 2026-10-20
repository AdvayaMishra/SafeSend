import 'dotenv/config';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const base='http://localhost:5100';
async function suite(args,environment) {
  const server=spawn(process.execPath,['dist/server.js'],{env:environment,windowsHide:true,stdio:'ignore'});
  try {
    let ready=false;
    for(let i=0;i<60;i++) {
      try {ready=(await fetch(base+'/api/health')).ok;if(ready)break}catch{}
      await new Promise(r=>setTimeout(r,250));
    }
    if(!ready)throw new Error('Isolated test backend did not start');
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,args,{env:{...environment,TEST_API_URL:base,NEXT_PUBLIC_API_URL:base},windowsHide:true,stdio:'inherit'});
      child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Integration suite failed')));
    });
  } finally {server.kill();await new Promise(r=>server.once('exit',r));}
}
const selected=new Set(process.argv.slice(2));
for(const [name,args] of [
  ['platform',['scripts/test-platform.mjs']],['chunks',['--import','tsx','scripts/test-chunks.mts']],['cli',['scripts/test-cli.mjs']],['core',['--experimental-strip-types','scripts/test-core.mjs']]
])if(!selected.size||selected.has(name))await suite(args,{...process.env,PORT:'5100',EVENT_HMAC_KEY:randomBytes(32).toString('hex'),ENABLE_LIFECYCLE_WORKER:'false'});
console.log('All isolated development integration suites passed.');
