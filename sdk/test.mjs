import assert from 'node:assert/strict';
import {SecureShareClient} from './dist/index.js';
const original=globalThis.fetch;
let stored;
globalThis.fetch=async(url,options)=>{
  assert.ok(!String(url).includes('#'),'decryption key never enters request URL');
  const b=JSON.parse(options.body??'{}');
  if(String(url).endsWith('/access'))return Response.json({success:true,encryptedContent:stored.encryptedContent,iv:stored.iv});
  assert.ok(!JSON.stringify(b).includes('sdk local plaintext fixture'),'plaintext never sent');
  assert.ok(!('key' in b)&&!('message' in b),'no key or plaintext field');stored=b;
  return Response.json({secretId:'12345678-1234-4234-8234-123456789abc',managementToken:'opaque-fixture'});
};
try {
  const client=new SecureShareClient('https://api.example.invalid','https://share.example.invalid');
  const created=await client.create('sdk local plaintext fixture',{expiresAt:new Date(Date.now()+3600000).toISOString()});
  assert.equal((await client.open(created.shareUrl)).plaintext,'sdk local plaintext fixture');
  console.log('SDK client-side encryption and key/fragment isolation tests passed');
} finally {globalThis.fetch=original;}
