#!/usr/bin/env node
import {SecureShareClient} from '../sdk/dist/index.js';
const [command,id]=process.argv.slice(2);
const client=new SecureShareClient(process.env.SECURESHARE_API_URL??'http://localhost:5000',
  process.env.SECURESHARE_SHARE_ORIGIN??'http://localhost:3000',process.env.SECURESHARE_API_KEY);
try {
  if(!['create','open','revoke'].includes(command))throw new Error('Usage: pipe plaintext into create; pipe share link into open; revoke <id>. Configure SECURESHARE_API_URL and optional SECURESHARE_API_KEY.');
  if(command==='revoke') {await client.revoke(id,process.env.SECURESHARE_MANAGEMENT_TOKEN);process.stdout.write('Revoked\n');}
  else {
    const parts=[];let size=0;
    for await(const chunk of process.stdin){size+=chunk.length;if(size>500000)throw new Error('Input too large');parts.push(chunk)}
    const input=Buffer.concat(parts).toString('utf8');
    if(command==='create') {
      const result=await client.create(input,{expiresAt:new Date(Date.now()+3600000).toISOString(),maxViews:1});
      // Intentional local user output. Never forwarded to server or telemetry.
      process.stdout.write(result.shareUrl+'\n');
      if(process.env.SECURESHARE_MANAGEMENT_OUTPUT) {
        const {writeFile}=await import('node:fs/promises');
        await writeFile(process.env.SECURESHARE_MANAGEMENT_OUTPUT,JSON.stringify({secretId:result.secretId,managementToken:result.managementToken}),{flag:'wx',mode:0o600});
      }
    } else process.stdout.write((await client.open(input.trim(),process.env.SECURESHARE_SECRET_PASSWORD)).plaintext);
  }
} catch {process.stderr.write('SecureShare request failed. Check the command, configuration, access policy and connection.\n');process.exitCode=1;}
